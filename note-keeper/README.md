https://github.com/users/Sany18/projects/3
https://github.com/Sany18/note-keeper/issues

# Start
use pnpm

pnpm i
pnpm start

Create `.env` for local development:

```sh
cp .env.example .env
```

Deployment reads the same variables from `.env.prod`. Both real env files are
ignored by Git; `.env.example` contains placeholders only. Because Vite embeds
all `VITE_*` values into the client bundle, Firebase and Google browser API keys
must be restricted by allowed domain and API in their respective consoles.

# Styles
Padding grid 0.25rem

# Google APIs
### Login:
Firebase Authentication with `GoogleAuthProvider` and `signInWithRedirect`:
https://firebase.google.com/docs/auth/web/google-signin

The Firebase-hosted OAuth handler returns a Google access token with the
requested Drive scopes. The token is used directly by the browser; the app has
no authentication backend and does not use popups.

Google access tokens are short-lived. When one expires, the app displays
Reconnect and performs another full-page Firebase redirect from that explicit
user action. Firebase persists the signed-in identity, but does not expose a
Google refresh token to this browser-only app.

Firebase console setup:

- Enable Google under Authentication > Sign-in method.
- Add `alter-space.biz.ua` under Authentication > Settings > Authorized domains.
- Keep `https://${VITE_GOOGLE_AUTH_DOMAIN}/__/auth/handler` as an authorized
  OAuth redirect URI.
- Set `VITE_FIREBASE_API_KEY` to the Firebase web app API key. That key must
  permit Identity Toolkit API calls from `https://alter-space.biz.ua/*`.
- `VITE_GOOGLE_WEB_API_KEY` remains the separately restricted Drive/Picker key.

### Google Drive API
Google Drive API v3
https://developers.google.com/drive/api/reference/rest/v3

Google Drive API discovery ??
https://www.googleapis.com/discovery/v1/apis/drive/v3/rest

### Migration Guide from GSI to
https://developers.google.com/identity/gsi/web/guides/migration

scopes
https://developers.google.com/identity/protocols/oauth2/scopes

remove app from google account
https://myaccount.google.com/connections


Logo font: Rahovets

Breakpoints:
  800px

To debug on mobile chrome
chrome://inspect/#devices

Notes:
- Cloudflare has own cache, so if you update the site, you need to purge the cache


Verification process
1. Register domain
https://search.google.com/search-console/welcome

Change VITE_VERSION in .env file to update the version of the app
and avoid cache issues

### Custom events added to document directly

### Abbreviations
RS - Remote Storage
LS - Local Storage (browser)
LM - Local Machine (not browser)
