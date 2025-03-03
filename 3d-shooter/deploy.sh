# Deploy the project to the remote server
#
# Current config uses rsync to deploy the project to the remote server.
# The project is built on the remote server, and the backend server is
# started in detached mode.

set -o allexport
source ../.env
set +o allexport

echo "Deploying to $REMOTE_HOST"

# Build production command
pnpm run build

# Exclude and deploy the project to the remote server
rsync -av \
  --exclude-from=.gitignore \
  dist/ \
  root@${REMOTE_HOST}:/var/www/${DOMAIN}/3d-shooter

echo "Deployed to $REMOTE_HOST"

rm -rf dist
