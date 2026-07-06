# Deploy note-keeper to the remote server
#
# Builds locally, then rsyncs the static output to the shared VPS under this
# project's own path. Matches the pattern used by the other sub-projects here
# (see ../screen-saver/deploy.sh) rather than note-keeper's old GitHub Pages
# flow, which force-pushed the build to a gh-pages branch instead.

set -o allexport
source ../.env      # REMOTE_HOST, DOMAIN, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID
source .env.prod    # VITE_GOOGLE_CLIENT_ID, VITE_GOOGLE_WEB_API_KEY, VITE_GOOGLE_AUTH_DOMAIN, VITE_VERSION
set +o allexport

echo "Deploying to $REMOTE_HOST"

node bump-version.cjs
VITE_BASE_PATH=/note-keeper/ pnpm run build

rsync -av \
  --exclude-from=.gitignore \
  build/ \
  root@${REMOTE_HOST}:/var/www/${DOMAIN}/note-keeper

echo "Deployed to $REMOTE_HOST"

../purge-cloudflare.sh

rm -rf build
