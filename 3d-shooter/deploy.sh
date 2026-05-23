# Deploy the project to the remote server
#
# Current config uses rsync to deploy the project to the remote server.
# The project is built on the remote server, and the backend server is
# started in detached mode.

set -o allexport
source ../.env
set +o allexport

echo "Deploying to $REMOTE_HOST"

# Build frontend (DOMAIN from parent .env is picked up by vite.config.ts)
pnpm run build

# Deploy frontend dist
rsync -av \
  --exclude-from=.gitignore \
  dist/ \
  root@${REMOTE_HOST}:/var/www/${DOMAIN}/3d-shooter

# Deploy WS server source
rsync -av \
  --exclude=node_modules \
  server/ \
  root@${REMOTE_HOST}:/var/www/${DOMAIN}/3d-shooter-server

# Bootstrap and (re)start the WS server on the remote
ssh root@${REMOTE_HOST} << EOF
  # Install Docker if missing
  if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
  fi

  cd /var/www/${DOMAIN}/3d-shooter-server

  docker build -t 3d-shooter-ws .

  docker rm -f 3d-shooter-ws 2>/dev/null || true

  docker run -d \
    --name 3d-shooter-ws \
    --restart unless-stopped \
    -p ${SHOOTER_WS_PORT}:${SHOOTER_WS_PORT} \
    -e SHOOTER_WS_PORT=${SHOOTER_WS_PORT} \
    -e DOMAIN=${DOMAIN} \
    3d-shooter-ws
EOF

echo "Deployed to $REMOTE_HOST"

rm -rf dist
