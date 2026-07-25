import { initializeApp, getApp, getApps } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider as FirebaseGoogleAuthProvider,
  setPersistence,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSetRecoilState } from "recoil";

import { AllGDscopes, GDScopePrefix, minimalGDscopes } from "const/remoteStorageProviders/googleDrive/GDScopes";
import { LocalStorageKeys, useLocalStorage } from "reactHooks/localStorage/localStorage.hook";
import { log } from "services/log/log.service";
import { createSingletonProvider } from "services/reactProvider/singletonProvider";
import { allStatesSelector, defaultAllStates } from "state/localState/allStates";
import { leftDrawerSelector } from "state/localState/leftDrawerState";

import { UserState } from "./userState.type";

type StoredToken = {
  access_token?: string;
  receivedAt?: string;
  expires_in?: number;
} | null | undefined;

export type EnsureFreshAccessTokenOptions = {
  forceRefresh?: boolean;
};

const defaultExpiresInSec = 3599;
const expiryBufferMs = 5 * 60 * 1000;
const pendingScopesKey = "note_keeper_google_oauth_scopes";

const getUserDefaultState = (): UserState => ({
  loggedIn: false,
  userInfo: null,
  googleAccessTokenToGD: null,
  scopes: [],
  needsReauth: false,
});

const tokenTtlMs = (token: StoredToken): number =>
  (token?.expires_in ?? defaultExpiresInSec) * 1000;

export const isTokenExpired = (token?: StoredToken): boolean => {
  if (!token?.access_token || !token.receivedAt) return true;

  const tokenIssuedAt = new Date(token.receivedAt).getTime();
  if (Number.isNaN(tokenIssuedAt)) return true;

  return Date.now() - tokenIssuedAt >= tokenTtlMs(token) - expiryBufferMs;
};

const firebaseApp = getApps().length
  ? getApp()
  : initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_GOOGLE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    });
const firebaseAuth = getAuth(firebaseApp);

const normalizeScopes = (scopes: string[]): string[] =>
  scopes
    .map((scope) => scope.replace(GDScopePrefix, "").trim())
    .filter(Boolean);

const userInfoFromFirebase = (user) => ({
  id: user.uid,
  sub: user.uid,
  email: user.email,
  name: user.displayName,
  picture: user.photoURL,
});

const createGoogleProvider = (scopes: string[], forceAccountSelection: boolean) => {
  const provider = new FirebaseGoogleAuthProvider();
  scopes.forEach((scope) => provider.addScope(scope));
  provider.setCustomParameters({
    include_granted_scopes: "true",
    ...(forceAccountSelection ? { prompt: "select_account" } : {}),
  });
  return provider;
};

const _useGoogleAuth = () => {
  const setAllStates = useSetRecoilState(allStatesSelector);
  const setDrawerState = useSetRecoilState(leftDrawerSelector);
  const { items, setItem, getItem, clearLocalStorage } = useLocalStorage();
  const [googleAuthReady, setGoogleAuthReady] = useState(false);

  const currentUser = useMemo<Partial<UserState>>(
    () => getItem(LocalStorageKeys.CURRENT_USER) || getUserDefaultState(),
    [items[LocalStorageKeys.CURRENT_USER]],
  );
  const currentUserRef = useRef(currentUser);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const persistCurrentUser = useCallback(
    (user: Partial<UserState>) => {
      currentUserRef.current = user;
      setItem(LocalStorageKeys.CURRENT_USER, user);
    },
    [setItem],
  );

  useEffect(() => {
    let active = true;

    const initializeFirebaseAuth = async () => {
      try {
        await setPersistence(firebaseAuth, browserLocalPersistence);
        await firebaseAuth.authStateReady();

        const redirectResult = await getRedirectResult(firebaseAuth);
        if (!active) return;

        if (redirectResult) {
          const credential = FirebaseGoogleAuthProvider.credentialFromResult(redirectResult);
          const accessToken = credential?.accessToken;

          if (!accessToken) {
            throw new Error("Firebase returned without a Google OAuth access token");
          }

          const requestedScopes = JSON.parse(
            sessionStorage.getItem(pendingScopesKey) || "[]",
          );
          sessionStorage.removeItem(pendingScopesKey);

          persistCurrentUser({
            ...getUserDefaultState(),
            loggedIn: true,
            userInfo: userInfoFromFirebase(redirectResult.user),
            googleAccessTokenToGD: {
              access_token: accessToken,
              receivedAt: new Date().toISOString(),
              expires_in: defaultExpiresInSec,
            },
            scopes: normalizeScopes(
              requestedScopes.length ? requestedScopes : minimalGDscopes,
            ),
          });
          log.appEvent("GoogleAuth: Firebase redirect returned a Drive access token");
          return;
        }

        const storedUser = currentUserRef.current;
        if (firebaseAuth.currentUser) {
          persistCurrentUser({
            ...storedUser,
            loggedIn: true,
            userInfo:
              storedUser?.userInfo || userInfoFromFirebase(firebaseAuth.currentUser),
            needsReauth: isTokenExpired(storedUser?.googleAccessTokenToGD),
          });
        } else if (storedUser?.loggedIn) {
          persistCurrentUser(getUserDefaultState());
        }
      } catch (error) {
        log.error("GoogleAuth: Firebase redirect initialization failed", error);
        const storedUser = currentUserRef.current;
        if (storedUser?.loggedIn) {
          persistCurrentUser({ ...storedUser, needsReauth: true });
        }
      } finally {
        if (active) setGoogleAuthReady(true);
      }
    };

    initializeFirebaseAuth();
    return () => {
      active = false;
    };
  }, [persistCurrentUser]);

  const beginRedirect = useCallback(async (scopes: string[]) => {
    sessionStorage.setItem(pendingScopesKey, JSON.stringify(scopes));
    const provider = createGoogleProvider(scopes, !firebaseAuth.currentUser);

    try {
      await signInWithRedirect(firebaseAuth, provider);
    } catch (error) {
      sessionStorage.removeItem(pendingScopesKey);
      log.error("GoogleAuth: Could not start Firebase redirect", error);
      throw error;
    }
  }, []);

  const login = useCallback(() => {
    const grantedScopes = (currentUserRef.current?.scopes || [])
      .map((scope) => `${GDScopePrefix}${scope}`);
    const scopes = Array.from(new Set([...minimalGDscopes, ...grantedScopes]));
    return beginRedirect(scopes);
  }, [beginRedirect]);

  const requestAdditionalScopes = useCallback(
    () => beginRedirect(AllGDscopes),
    [beginRedirect],
  );

  const ensureFreshAccessToken = useCallback(
    (options: EnsureFreshAccessTokenOptions = {}): Promise<string> => {
      const storedUser = currentUserRef.current || getUserDefaultState();
      const token = storedUser.googleAccessTokenToGD;

      if (!options.forceRefresh && token?.access_token && !isTokenExpired(token)) {
        return Promise.resolve(token.access_token);
      }

      if (storedUser.loggedIn && !storedUser.needsReauth) {
        persistCurrentUser({ ...storedUser, needsReauth: true });
      }

      return Promise.reject(
        new Error("GoogleAuth: Drive access expired; redirect reconnect required"),
      );
    },
    [persistCurrentUser],
  );

  const logout = useCallback(async () => {
    window.gapi?.client?.setToken?.(null);

    try {
      await signOut(firebaseAuth);
    } catch (error) {
      log.error("GoogleAuth: Firebase sign-out failed", error);
    }

    currentUserRef.current = getUserDefaultState();
    clearLocalStorage();
    setAllStates(defaultAllStates);
  }, [setAllStates, clearLocalStorage]);

  useEffect(() => {
    setDrawerState((state) => ({ ...state, open: !!currentUser.loggedIn }));
  }, [currentUser.loggedIn, setDrawerState]);

  return {
    currentUser,
    login,
    logout,
    requestAdditionalScopes,
    ensureFreshAccessToken,
    isAuthInitializing: !googleAuthReady,
  };
};

export const {
  Provider: GoogleAuthProvider,
  useValue: useGoogleAuth,
} = createSingletonProvider(_useGoogleAuth, "GoogleAuth");
