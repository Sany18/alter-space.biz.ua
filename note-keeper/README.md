https://github.com/users/Sany18/projects/3
https://github.com/Sany18/note-keeper/issues

# Start
use pnpm

pnpm i
pnpm start

# Styles
Padding grid 0.25rem

# Google APIs
### Login:
Google Identity Services (GIS) OAuth 2.0 token model:
https://developers.google.com/identity/oauth2/web/guides/use-token-model

The Drive access token flow is popup-based and is not FedCM. FedCM applies to
Sign in with Google identity/ID-token flows, not to scoped Google Drive API
authorization.

The browser token model does not issue a refresh token. Replacement access
tokens must be requested from a user-driven event. A fully background refresh
would require the authorization-code model and a backend that stores the
refresh token.

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
