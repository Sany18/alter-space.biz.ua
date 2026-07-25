/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BASE_PATH?: string;
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_GOOGLE_AUTH_DOMAIN: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_GOOGLE_WEB_API_KEY: string;
  readonly VITE_SHOW_DEBUG?: string;
  readonly VITE_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
