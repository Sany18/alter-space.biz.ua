# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Note-Keeper is a React-based note-taking and file management app with Google Drive as its backend storage, cross-device file transfer via WebSocket, and multi-format file viewing (PDF, image, markdown, text, password-protected notes).

**Abbreviations used throughout the codebase:**
- **RS** — Remote Storage (Google Drive)
- **LS** — Local Storage (browser localStorage)
- **GD** — Google Drive
- **Firebase Auth** — hosted Google sign-in and redirect handling

## Stack

React 18 + Vite + Recoil + TypeScript. Package manager: **pnpm** (also compatible with npm).

## Commands

```bash
pnpm start        # Dev server (port 34564)
pnpm build        # Production build
pnpm lint         # ESLint
pnpm sort         # Sort imports
pnpm preview      # Preview production build
```

## Architecture

### Frontend

**State management** uses Recoil atoms grouped into three categories:
- `fe/src/state/sessionState/` — transient session state (loading, upload progress)
- `fe/src/state/localState/` — persisted app state (file tree, active file, preferences)
- `fe/src/state/events/` — cross-component event system

**Singleton Provider Pattern** — the main architectural pattern. Most global hooks are wrapped with `createSingletonProvider()`, which creates a Context Provider + a typed `useValue()` hook. Providers are composed at the app root via `providerWrapper()`. Providers include: `LocalStorage`, `GoogleAuth`, `ActiveFile`, `Explorer`, `Gapi`.

**Key modules:**
- `fe/src/reactHooks/gis/` — Google Identity Services / OAuth token management
- `fe/src/reactHooks/gapi/googleDriveCRUD/` — Google Drive API v3 CRUD operations (getList, updateFile, uploadFiles, deleteFile, renameFile, changeFileParent)
- `fe/src/reactHooks/fileManager/explorer/` — file tree state and navigation logic
- `fe/src/services/websocket/websocket.service.ts` — singleton Socket.io client for device sync and file transfer
- `fe/src/services/userInfo/userInfo.service.ts` — generates a stable `userHash` from Google account identifiers (used as the backend key for per-user device tracking)

**Component tree:**
```
App.tsx
├── Header + Menu
├── Explorer (file tree)
├── FileViewer (TextEditor | PDFViewer | ImageViewer | PasswordEditor)
├── DropFileUpload (drag-and-drop overlay)
└── Loader
```

### Backend

NestJS modules with two domains:

**DeviceModule** (`be/src/device/`)
- `device.service.ts` — in-memory `Map<deviceId, Device>` with user-indexed lookup by `userHash`
- `device.gateway.ts` — WebSocket event handlers: `register-device`, device updates broadcast to all user sessions
- `device.controller.ts` — REST endpoints for device management

**FileTransferModule** (`be/src/file-transfer/`)
- `file-transfer.service.ts` — tracks transfer state and chunk reassembly
- Chunked transfer protocol via WebSocket: `request-file-transfer` → `file-transfer-response` → `file-chunk` events; backend relays chunks between devices

### Authentication Flow

1. Firebase Authentication initializes with local persistence
2. `GoogleAuthProvider` requests the Drive scopes through `signInWithRedirect`; Firebase's hosted `/__/auth/handler` returns the browser to the app without a popup
3. The returned Google OAuth access token and expiry time are stored in local state. When it expires or Drive returns 401, the app marks the session for an explicit redirect-based Reconnect
4. All Google Drive API calls use this token directly from the browser — there is no backend, refresh-token storage, or request relay

## Environment Variables

Frontend env vars are prefixed with `VITE_`. Key variables:
```
VITE_GOOGLE_CLIENT_ID        # OAuth client ID
VITE_GOOGLE_WEB_API_KEY      # Drive API / Picker browser key
VITE_GOOGLE_AUTH_DOMAIN      # Firebase/auth domain
VITE_FIREBASE_API_KEY        # Firebase web key with Identity Toolkit access
VITE_FIREBASE_PROJECT_ID     # Optional; defaults from the auth domain
VITE_FIREBASE_APP_ID         # Optional Firebase web app ID
VITE_BASE_PATH               # URL base path (/ locally, /note-keeper/ on GitHub Pages)
VITE_VERSION                 # Used to bust service worker cache — bump on deploy
```

Backend:
```
BE_PORT          # Backend port (3011 dev, 3011 prod)
FRONTEND_URL     # Used for CORS (empty = localhost in dev)
```

## Deployment

- **GitHub Actions** (`.github/workflows/deploy.yml`) — triggers on `master` push; builds `fe/` and deploys to GitHub Pages
- **VPS** — manual deploy via `ssh.sh`; backend runs as a Node process on the server
- **Cache busting** — increment `VITE_VERSION` in `.env.prod` before each production deploy to force service worker update
