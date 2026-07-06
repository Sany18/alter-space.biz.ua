import { createSingletonProvider } from "services/reactProvider/singletonProvider";
import { LocalStorageKeys, useLocalStorage } from "reactHooks/localStorage/localStorage.hook";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { log } from "services/log/log.service";

import { leftDrawerSelector } from "state/localState/leftDrawerState";
import { useRecoilState, useSetRecoilState } from "recoil";
import { allStatesSelector, defaultAllStates } from "state/localState/allStates";

import { UserState } from "./userState.type";
import { AllGDscopes, GDScopePrefix, minimalGDscopes } from "const/remoteStorageProviders/googleDrive/GDScopes";

const getUserDefaultState = (): UserState => ({
  loggedIn: false,
  userInfo: null,
  googleAccessTokenToGD: null,
  scopes: [],
});

type StoredToken = { receivedAt?: string; expires_in?: number } | null | undefined;

type PendingRefresh = {
  promise: Promise<string>;
  resolve: (token: string) => void;
  reject: (error: any) => void;
  watchdogId?: ReturnType<typeof setTimeout>;
  // Whether the token was already past its real (non-buffered) expiry when this
  // attempt started — distinguishes "session was already dead" from "a live session
  // hit a transient hiccup", which changes how quickly we surface a reconnect prompt.
  tokenWasHardExpiredAtAttempt: boolean;
};

const defaultExpiresInSec = 3599; // GIS access tokens are normally valid for ~1h
const expiryBufferMs = 5 * 60 * 1000; // treat the token as due for renewal 5 min early
const proactiveCheckIntervalMs = 60 * 1000; // how often to check for staleness while idle
const baseBackoffMs = 5000;
const maxBackoffMs = 5 * 60 * 1000;
const minFailureWindowBeforeReauthMs = 2 * 60 * 1000; // keep retrying quietly for at least this long
const refreshWatchdogMs = 20000; // guard against the GIS callback never firing

const tokenTtlMs = (token: StoredToken): number => (token?.expires_in ?? defaultExpiresInSec) * 1000;

export const isTokenExpired = (token?: StoredToken): boolean => {
  if (!token?.receivedAt) return true;

  const tokenIssuedAt = new Date(token.receivedAt).getTime();
  if (Number.isNaN(tokenIssuedAt)) return true;

  return (Date.now() - tokenIssuedAt) >= (tokenTtlMs(token) - expiryBufferMs);
};

// Same as isTokenExpired but without the early-renewal buffer — used only to decide
// whether a token is truly dead (as opposed to merely due for a background refresh).
const isTokenHardExpired = (token?: StoredToken): boolean => {
  if (!token?.receivedAt) return true;

  const tokenIssuedAt = new Date(token.receivedAt).getTime();
  if (Number.isNaN(tokenIssuedAt)) return true;

  return (Date.now() - tokenIssuedAt) >= tokenTtlMs(token);
};

// Generates a per-request OAuth state value. Google's own reference marks `state` as
// "not recommended" for this token model specifically (the response is delivered
// straight to this page's JS callback, not via a re-navigable redirect URL, so it isn't
// guarding against the classic CSRF replay `state` exists for) — but it's supported,
// cheap, and Google Cloud Console's project checkup flags OAuth clients that omit it.
const generateOAuthState = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const _useGoogleAuth = () => {
  const setAllStates = useSetRecoilState(allStatesSelector);
  const [drawerState, setDraverState] = useRecoilState(leftDrawerSelector);

  const { items, setItem, getItem, clearLocalStorage } = useLocalStorage();

  const googleSignInRef = useRef(null);
  const silentRefreshRef = useRef({
    inProgress: false,
    lastAttemptAt: 0,
    nextAllowedAttemptAt: 0,
    consecutiveFailures: 0,
    firstFailureAt: 0,
    lastAttemptWasGesture: false,
    lastRequestedState: null as string | null,
    pending: null as PendingRefresh | null,
  });
  const [googleAuthReady, setGoogleAuthReady] = useState(false);

  const currentUser = useMemo<Partial<UserState>>((): Partial<UserState> => {
    return getItem(LocalStorageKeys.CURRENT_USER) || getUserDefaultState();
  }, [items[LocalStorageKeys.CURRENT_USER]]);

  // Mirrors currentUser for code that must read fresh values from callbacks/timers
  // frozen at mount time (GIS's token client callback, the proactive-refresh effect).
  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Purely a first-load gate now — routine background token refreshes must never
  // make consumers (e.g. the file viewer) treat the app as "still initializing".
  const isAuthInitializing = !googleAuthReady;

  // Records a failed silent-refresh attempt: backs off the next attempt, and — unless
  // the token was still within its own safety buffer when we tried — flags needsReauth
  // once retries have had a fair chance. If the token was *already* hard-expired before
  // we even attempted (e.g. the tab was asleep for hours), there's no live session left
  // to protect from disruption, so this surfaces the reconnect prompt on the very first
  // failure instead of leaving the user looking at an app with no data for 2 minutes.
  const recordSilentFailure = useCallback((tokenWasHardExpiredAtAttempt: boolean) => {
    const refreshState = silentRefreshRef.current;
    refreshState.consecutiveFailures += 1;
    if (!refreshState.firstFailureAt) refreshState.firstFailureAt = Date.now();

    const backoff = Math.min(baseBackoffMs * (2 ** (refreshState.consecutiveFailures - 1)), maxBackoffMs);
    refreshState.nextAllowedAttemptAt = Date.now() + backoff;

    const failingForMs = Date.now() - refreshState.firstFailureAt;
    const storedUser = currentUserRef.current || getUserDefaultState();
    const tokenIsHardExpiredNow = isTokenHardExpired(storedUser.googleAccessTokenToGD);

    const shouldSurfaceReconnect = tokenIsHardExpiredNow
      && (tokenWasHardExpiredAtAttempt || failingForMs >= minFailureWindowBeforeReauthMs);

    if (shouldSurfaceReconnect && !storedUser.needsReauth) {
      setItem(LocalStorageKeys.CURRENT_USER, { ...storedUser, needsReauth: true });
    }
  }, [setItem]);

  useEffect(() => {
    const initTokenCallback = (tokenResponse) => {
      const refreshState = silentRefreshRef.current;
      const pending = refreshState.pending;
      refreshState.pending = null;
      refreshState.inProgress = false;
      if (pending?.watchdogId) clearTimeout(pending.watchdogId);

      const wasGesture = refreshState.lastAttemptWasGesture;
      refreshState.lastAttemptWasGesture = false;

      if (tokenResponse?.error) {
        log.appEvent('GoogleAuth: Token request returned an error', tokenResponse);

        // A cancelled/failed gesture-triggered request (login, additional-scopes) is not
        // a signal about the health of silent background refresh — don't let it feed backoff.
        if (!wasGesture) {
          recordSilentFailure(!!pending?.tokenWasHardExpiredAtAttempt);
        }

        pending?.reject(tokenResponse);
        return;
      }

      // Confirm this response corresponds to the request we most recently sent. Not a
      // meaningful CSRF guard for this popup-callback model (see generateOAuthState's
      // comment), but a mismatch is still worth refusing rather than silently accepting.
      const expectedState = refreshState.lastRequestedState;
      refreshState.lastRequestedState = null;

      if (expectedState && tokenResponse.state !== expectedState) {
        log.error('GoogleAuth: OAuth response state did not match the request; discarding it', {
          expectedState,
          receivedState: tokenResponse.state,
        });
        pending?.reject(new Error('GoogleAuth: unexpected OAuth state'));
        return;
      }

      refreshState.consecutiveFailures = 0;
      refreshState.firstFailureAt = 0;
      refreshState.nextAllowedAttemptAt = 0;

      const storedUser = currentUserRef.current || getUserDefaultState();
      tokenResponse.receivedAt = new Date().toISOString();

      const nextUser: Partial<UserState> = {
        ...storedUser,
        googleAccessTokenToGD: tokenResponse,
        loggedIn: true,
        needsReauth: false,
        scopes: tokenResponse.scope
          .split(GDScopePrefix)
          .map(s => s.trim())
          .filter(Boolean),
      };

      setItem(LocalStorageKeys.CURRENT_USER, nextUser);
      log.appEvent('GoogleAuth: Access token received', nextUser);
      pending?.resolve(tokenResponse.access_token);
    };

    const initGoogleAuth = () => {
      googleSignInRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        scope: minimalGDscopes.join(' '),
        callback: initTokenCallback,
        include_granted_scopes: true,
        enable_granular_consent: true,
      });

      setGoogleAuthReady(true);
    };

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = initGoogleAuth;
    document.body.appendChild(script);
  }, []);

  // Returns the current access token if still fresh, otherwise triggers (or joins an
  // already in-flight) silent refresh and resolves once a new token is obtained.
  // Concurrent callers coalesce onto a single request instead of each opening a popup.
  const ensureFreshAccessToken = useCallback((): Promise<string> => {
    const token = currentUserRef.current?.googleAccessTokenToGD;

    if (token?.access_token && !isTokenExpired(token)) {
      return Promise.resolve(token.access_token);
    }

    // Nothing to refresh (never logged in, or logged out) — don't trigger a token
    // request just because some unauthenticated call happened to 401.
    if (!token?.access_token) {
      return Promise.reject(new Error('GoogleAuth: no session to refresh'));
    }

    if (!googleSignInRef.current) {
      return Promise.reject(new Error('GoogleAuth: auth is not ready yet'));
    }

    const refreshState = silentRefreshRef.current;

    if (refreshState.pending) return refreshState.pending.promise;

    if (Date.now() < refreshState.nextAllowedAttemptAt) {
      return Promise.reject(new Error('GoogleAuth: silent refresh is backing off'));
    }

    let resolvePending: (token: string) => void;
    let rejectPending: (error: any) => void;

    const promise = new Promise<string>((resolve, reject) => {
      resolvePending = resolve;
      rejectPending = reject;
    });

    const pendingEntry: PendingRefresh = {
      promise,
      resolve: resolvePending,
      reject: rejectPending,
      tokenWasHardExpiredAtAttempt: isTokenHardExpired(token),
    };
    refreshState.pending = pendingEntry;
    refreshState.inProgress = true;
    refreshState.lastAttemptAt = Date.now();
    refreshState.lastRequestedState = generateOAuthState();

    googleSignInRef.current.requestAccessToken({ prompt: 'none', state: refreshState.lastRequestedState });

    pendingEntry.watchdogId = setTimeout(() => {
      if (refreshState.pending !== pendingEntry) return;
      refreshState.pending = null;
      refreshState.inProgress = false;
      recordSilentFailure(pendingEntry.tokenWasHardExpiredAtAttempt);
      pendingEntry.reject(new Error('GoogleAuth: token refresh timed out'));
    }, refreshWatchdogMs);

    return promise;
  }, [recordSilentFailure]);

  // Proactively keeps the token fresh while the app is open: a recurring check plus an
  // immediate re-check whenever the tab regains visibility/focus (background tabs throttle
  // timers, so the visibility/focus listeners are what catch a session up after being away).
  // The effect itself deliberately does not depend on the token/needsReauth — it keeps
  // running so it's ready to resume the moment needsReauth clears (e.g. after the user
  // reconnects) — but each individual attempt below does skip while needsReauth is set,
  // since a silent (non-gesture) attempt has no real chance of succeeding once we already
  // know the session is dead; only a real user gesture can still open the popup at that point.
  useEffect(() => {
    if (!googleAuthReady || !currentUser.loggedIn) return;

    const attemptIfStale = () => {
      const user = currentUserRef.current;
      const token = user?.googleAccessTokenToGD;
      if (!token?.access_token || !isTokenExpired(token)) return;
      if (user?.needsReauth) return;
      // A refresh popup opened from a hidden tab is very likely to be blocked by the
      // browser; skip it here and let the visibility/focus listener retry once shown again.
      if (document.visibilityState !== 'visible') return;

      ensureFreshAccessToken().catch(() => {});
    };

    // Code running synchronously inside a real click/keypress counts as a genuine user
    // gesture to the browser, unlike the timer/visibility checks above — so a refresh
    // attempted here has a real chance of opening its popup even when those keep getting
    // blocked, including once needsReauth is already set (a click can still recover a
    // session that a background timer never could). Any click/keydown anywhere in the
    // app is treated as an opportunity; ensureFreshAccessToken's own backoff and pending-
    // request coalescing keep this from attempting anything on every single keystroke.
    const attemptOnGesture = () => {
      const token = currentUserRef.current?.googleAccessTokenToGD;
      if (!token?.access_token || !isTokenExpired(token)) return;

      ensureFreshAccessToken().catch(() => {});
    };

    attemptIfStale();

    const intervalId = setInterval(attemptIfStale, proactiveCheckIntervalMs);
    document.addEventListener('visibilitychange', attemptIfStale);
    window.addEventListener('focus', attemptIfStale);
    // Capture phase so this still runs even if some component's click/keydown handler
    // calls stopPropagation() during the (more common) bubbling phase.
    document.addEventListener('click', attemptOnGesture, { capture: true });
    document.addEventListener('keydown', attemptOnGesture, { capture: true });

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', attemptIfStale);
      window.removeEventListener('focus', attemptIfStale);
      document.removeEventListener('click', attemptOnGesture, { capture: true });
      document.removeEventListener('keydown', attemptOnGesture, { capture: true });
    };
  }, [googleAuthReady, currentUser.loggedIn, ensureFreshAccessToken]);

  const requestAdditionalScopes = useCallback(() => {
    if (googleSignInRef.current) {
      const refreshState = silentRefreshRef.current;
      refreshState.lastAttemptWasGesture = true;
      refreshState.lastRequestedState = generateOAuthState();
      googleSignInRef.current.requestAccessToken({
        prompt: 'none',
        scope: AllGDscopes.join(' '),
        state: refreshState.lastRequestedState,
      });
    }
  }, []);

  const login = useCallback(() => {
    if (googleSignInRef.current) {
      const refreshState = silentRefreshRef.current;
      refreshState.lastAttemptWasGesture = true;
      refreshState.consecutiveFailures = 0;
      refreshState.firstFailureAt = 0;
      refreshState.nextAllowedAttemptAt = 0;
      refreshState.inProgress = true;
      refreshState.lastAttemptAt = Date.now();
      refreshState.lastRequestedState = generateOAuthState();

      // A gesture-triggered login supersedes any in-flight silent refresh — settle it
      // now so its watchdog can't later fire against a flow that's no longer relevant.
      if (refreshState.pending) {
        if (refreshState.pending.watchdogId) clearTimeout(refreshState.pending.watchdogId);
        refreshState.pending.reject(new Error('GoogleAuth: superseded by an explicit login'));
        refreshState.pending = null;
      }

      googleSignInRef.current.requestAccessToken({ prompt: 'select_account', state: refreshState.lastRequestedState });
    }
  }, []);

  const logout = useCallback(() => {
    clearLocalStorage();
    setAllStates(defaultAllStates);
  }, [setAllStates, clearLocalStorage]);

  useEffect(() => {
    const newDrawerState = { ...drawerState };
    newDrawerState.open = !!currentUser.loggedIn;
    setDraverState(newDrawerState);
  }, [currentUser.loggedIn]);

  return {
    currentUser,
    login,
    logout,
    requestAdditionalScopes,
    ensureFreshAccessToken,
    isAuthInitializing,
  }
}

export const {
  Provider: GoogleAuthProvider,
  useValue: useGoogleAuth,
} = createSingletonProvider(_useGoogleAuth, 'GoogleAuth');
