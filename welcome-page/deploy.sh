#!/usr/bin/env bash
# Deploy the project to the remote server
#
# Current config uses rsync to deploy the project to the remote server.
# The project is built on the remote server, and the backend server is
# started in detached mode.

set -euo pipefail

set -o allexport
source ../.env
set +o allexport

echo "Deploying to $REMOTE_HOST"

if [[ ! -x node_modules/.bin/webpack ]]; then
  pnpm install --frozen-lockfile
fi

# Build production command
pnpm run build

# Exclude and deploy the project to the remote server
rsync -av \
  --exclude-from=.gitignore \
  dist/ \
  root@${REMOTE_HOST}:/var/www/${DOMAIN}

echo "Deployed to $REMOTE_HOST"

../purge-cloudflare.sh

rm -rf dist
