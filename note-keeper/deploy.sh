#!/usr/bin/env bash
# Deploy note-keeper to the remote server
#
# Builds locally, then rsyncs the static output to the shared VPS under this
# project's own path. Matches the pattern used by the other sub-projects here
# (see ../screen-saver/deploy.sh) rather than note-keeper's old GitHub Pages
# flow, which force-pushed the build to a gh-pages branch instead.

set -euo pipefail

set -o allexport
source ../.env      # REMOTE_HOST, DOMAIN, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID
source .env.prod    # Note Keeper VITE_* browser configuration; see .env.example
set +o allexport

echo "Deploying to $REMOTE_HOST"

if [[ ! -x node_modules/.bin/vite ]]; then
  pnpm install --frozen-lockfile
fi

node bump-version.cjs
VITE_BASE_PATH=/note-keeper/ pnpm run build

rsync -av \
  --exclude-from=.gitignore \
  build/ \
  root@${REMOTE_HOST}:/var/www/${DOMAIN}/note-keeper

echo "Deployed to $REMOTE_HOST"

../purge-cloudflare.sh

rm -rf build
