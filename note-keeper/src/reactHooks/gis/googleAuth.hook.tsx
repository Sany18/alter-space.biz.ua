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

export type EnsureFreshAccessTokenOptions = {
  forceRefresh?: boolean;
};

type PendingRefresh = {
  promise: Promise<string>;
  resolve: (token: string) => void;
  reject: (error: any) => void;
  watchdogId?: ReturnType<typeof setTimeout>;
  // True when the current token is expired or a 401 already proved it invalid.
  // A failed replacement attempt must then surface the reconnect action immediately.
  shouldRequireReauthOnFailure: boolean;
};

const defaultExpiresInSec = 3599; // GIS access tokens are normally valid for ~1h
const expiryBufferMs = 5 * 60 * 1000; // treat the token as due for renewal 5 min early
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

  const persistCurrentUser = useCallback((user: Partial<UserState>) => {
    // Keep imperative callers in sync immediately. Waiting for the React effect here
    // can start a second refresh in the small gap after the first refresh resolves.
    currentUserRef.current = user;
    setItem(LocalStorageKeys.CURRENT_USER, user);
  }, [setItem]);

  // Purely a first-load gate now — routine background token refreshes must never
  // make consumers (e.g. the file viewer) treat the app as "still initializing".
  const isAuthInitializing = !googleAuthReady;

  // Records a failed silent-refresh attempt: backs off the next attempt, and — unless
  // the token was still within its own safety buffer when we tried — flags needsReauth
  // once retries have had a fair chance. If the token was *already* hard-expired before
  // we even attempted (e.g. the tab was asleep for hours), there's no live session left
  // to protect from disruption, so this surfaces the reconnect prompt on the very first
  // failure instead of leaving the user looking at an app with no data for 2 minutes.
  const recordSilentFailure = useCallback((shouldRequireReauthOnFailure: boolean) => {
    const refreshState = silentRefreshRef.current;
    refreshState.consecutiveFailures += 1;
    if (!refreshState.firstFailureAt) refreshState.firstFailureAt = Date.now();

    const backoff = Math.min(baseBackoffMs * (2 ** (refreshState.consecutiveFailures - 1)), maxBackoffMs);
    refreshState.nextAllowedAttemptAt = Date.now() + backoff;

    const failingForMs = Date.now() - refreshState.firstFailureAt;
    const storedUser = currentUserRef.current || getUserDefaultState();
    const tokenIsHardExpiredNow = isTokenHardExpired(storedUser.googleAccessTokenToGD);

    const shouldSurfaceReconnect = shouldRequireReauthOnFailure
      || (tokenIsHardExpiredNow && failingForMs >= minFailureWindowBeforeReauthMs);

    if (shouldSurfaceReconnect && !storedUser.needsReauth) {
      persistCurrentUser({ ...storedUser, needsReauth: true });
    }
  }, [persistCurrentUser]);

  useEffect(() => {
    const finishFailedTokenRequest = (error: any, isOAuthError: boolean) => {
      const refreshState = silentRefreshRef.current;
      const pending = refreshState.pending;
      refreshState.pending = null;
      refreshState.inProgress = false;
      refreshState.lastRequestedState = null;
      if (pending?.watchdogId) clearTimeout(pending.watchdogId);

      const wasGesture = refreshState.lastAttemptWasGesture;
      refreshState.lastAttemptWasGesture = false;

      log.appEvent(
        isOAuthError
          ? 'GoogleAuth: Token request returned an error'
          : 'GoogleAuth: Token popup failed',
        error,
      );

      // A cancelled/failed explicit login or scope request is not a signal about
      // whether a background refresh can succeed.
      if (!wasGesture) {
        recordSilentFailure(!!pending?.shouldRequireReauthOnFailure);
      }

      const currentToken = currentUserRef.current?.googleAccessTokenToGD;
      const canUseExistingToken = pending
        && !pending.shouldRequireReauthOnFailure
        && currentToken?.access_token
        && !isTokenHardExpired(currentToken);

      if (canUseExistingToken) {
        // Refreshes start inside the early-expiry buffer. If the popup is blocked or
        // closed while the old token is still genuinely valid, let the action proceed
        // with it and retry renewal on a later gesture.
        pending.resolve(currentToken.access_token);
      } else {
        pending?.reject(error);
      }
    };

    const initTokenCallback = (tokenResponse) => {
      const refreshState = silentRefreshRef.current;
      const pending = refreshState.pending;

      if (tokenResponse?.error) {
        finishFailedTokenRequest(tokenResponse, true);
        return;
      }

      // Confirm this response corresponds to the request we most recently sent. Not a
      // meaningful CSRF guard for this popup-callback model (see generateOAuthState's
      // comment), but a mismatch is still worth refusing rather than silently accepting.
      const expectedState = refreshState.lastRequestedState;
      refreshState.lastRequestedState = null;

      if (!expectedState || tokenResponse.state !== expectedState) {
        refreshState.pending = null;
        refreshState.inProgress = false;
        refreshState.lastRequestedState = null;
        refreshState.lastAttemptWasGesture = false;
        if (pending?.watchdogId) clearTimeout(pending.watchdogId);
        log.error('GoogleAuth: OAuth response state did not match the request; discarding it', {
          expectedState,
          receivedState: tokenResponse.state,
        });
        pending?.reject(new Error('GoogleAuth: unexpected OAuth state'));
        return;
      }

      refreshState.pending = null;
      refreshState.inProgress = false;
      refreshState.lastAttemptWasGesture = false;
      if (pending?.watchdogId) clearTimeout(pending.watchdogId);
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

      persistCurrentUser(nextUser);
      // Never include the bearer token in application logs.
      log.appEvent('GoogleAuth: Access token received');
      pending?.resolve(tokenResponse.access_token);
    };

    const initGoogleAuth = () => {
      googleSignInRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        scope: minimalGDscopes.join(' '),
        callback: initTokenCallback,
        error_callback: (error) => finishFailedTokenRequest(error, false),
        include_granted_scopes: true,
      });

      setGoogleAuthReady(true);
    };

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = initGoogleAuth;
    document.body.appendChild(script);
  }, [persistCurrentUser, recordSilentFailure]);

  // Returns the current access token if still fresh, otherwise triggers (or joins an
  // already in-flight) silent refresh and resolves once a new token is obtained.
  // Concurrent callers coalesce onto a single request instead of each opening a popup.
  const ensureFreshAccessToken = useCallback((
    options: EnsureFreshAccessTokenOptions = {},
  ): Promise<string> => {
    const token = currentUserRef.current?.googleAccessTokenToGD;

    if (!options.forceRefresh && token?.access_token && !isTokenExpired(token)) {
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
      shouldRequireReauthOnFailure: !!options.forceRefresh || isTokenHardExpired(token),
    };
    refreshState.pending = pendingEntry;
    refreshState.inProgress = true;
    refreshState.lastAttemptAt = Date.now();
    refreshState.lastRequestedState = generateOAuthState();

    try {
      googleSignInRef.current.requestAccessToken({
        prompt: 'none',
        state: refreshState.lastRequestedState,
      });
    } catch (error) {
      refreshState.pending = null;
      refreshState.inProgress = false;
      refreshState.lastRequestedState = null;
      recordSilentFailure(pendingEntry.shouldRequireReauthOnFailure);

      if (!pendingEntry.shouldRequireReauthOnFailure && !isTokenHardExpired(token)) {
        pendingEntry.resolve(token.access_token);
      } else {
        pendingEntry.reject(error);
      }
      return promise;
    }

    pendingEntry.watchdogId = setTimeout(() => {
      if (refreshState.pending !== pendingEntry) return;
      refreshState.pending = null;
      refreshState.inProgress = false;
      refreshState.lastRequestedState = null;
      recordSilentFailure(pendingEntry.shouldRequireReauthOnFailure);

      if (!pendingEntry.shouldRequireReauthOnFailure && !isTokenHardExpired(token)) {
        pendingEntry.resolve(token.access_token);
      } else {
        pendingEntry.reject(new Error('GoogleAuth: token refresh timed out'));
      }
    }, refreshWatchdogMs);

    return promise;
  }, [recordSilentFailure]);

  // GIS's browser token model requires replacement tokens to be requested from a
  // user-driven event. Start the refresh in capture phase so the action's own handler
  // can join the same pending promise before it dispatches a Drive request.
  useEffect(() => {
    if (!googleAuthReady || !currentUser.loggedIn) return;

    const attemptOnGesture = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-google-auth-action]')) return;

      const token = currentUserRef.current?.googleAccessTokenToGD;
      if (!token?.access_token || !isTokenExpired(token)) return;

      ensureFreshAccessToken().catch(() => {});
    };

    document.addEventListener('click', attemptOnGesture, { capture: true });
    document.addEventListener('keydown', attemptOnGesture, { capture: true });

    return () => {
      document.removeEventListener('click', attemptOnGesture, { capture: true });
      document.removeEventListener('keydown', attemptOnGesture, { capture: true });
    };
  }, [googleAuthReady, currentUser.loggedIn, ensureFreshAccessToken]);

  const requestAdditionalScopes = useCallback(() => {
    if (googleSignInRef.current) {
      const refreshState = silentRefreshRef.current;
      if (refreshState.pending) return;

      refreshState.lastAttemptWasGesture = true;
      refreshState.lastRequestedState = generateOAuthState();
      googleSignInRef.current.requestAccessToken({
        // This action requests a scope the user may not have approved yet, so a
        // no-UI request cannot work. It is invoked directly from the permission button.
        prompt: 'consent',
        scope: AllGDscopes.join(' '),
        state: refreshState.lastRequestedState,
      });
    }
  }, []);

  const login = useCallback(() => {
    if (googleSignInRef.current) {
      const refreshState = silentRefreshRef.current;
      // GIS does not expose a way to cancel a token popup. Starting another request
      // would make the shared callback ambiguous, so let the current request settle.
      if (refreshState.pending) return;

      refreshState.lastAttemptWasGesture = true;
      refreshState.consecutiveFailures = 0;
      refreshState.firstFailureAt = 0;
      refreshState.nextAllowedAttemptAt = 0;
      refreshState.inProgress = true;
      refreshState.lastAttemptAt = Date.now();
      refreshState.lastRequestedState = generateOAuthState();

      googleSignInRef.current.requestAccessToken({ prompt: 'select_account', state: refreshState.lastRequestedState });
    }
  }, []);

  const logout = useCallback(() => {
    const refreshState = silentRefreshRef.current;
    if (refreshState.pending?.watchdogId) clearTimeout(refreshState.pending.watchdogId);
    refreshState.pending?.reject(new Error('GoogleAuth: logged out during token refresh'));
    refreshState.pending = null;
    refreshState.inProgress = false;
    refreshState.lastRequestedState = null;
    refreshState.lastAttemptWasGesture = false;

    window.gapi?.client?.setToken?.(null);
    currentUserRef.current = getUserDefaultState();
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
