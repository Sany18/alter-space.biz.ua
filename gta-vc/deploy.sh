# Deploy the project to the remote server
#
# Unlike the other projects here, revcDOS ships pre-built - there's no local
# build step. revcdos-bin/ is the engine + auto.html, vc-assets/ is the
# converted GTA: Vice City game data. Both need to land under /gta-vc so
# the engine's relative fetches ("vc-assets/...", "preload_files.list") resolve
# correctly - see server.ts for the equivalent local-dev path mapping.

set -o allexport
source ../.env
set +o allexport

echo "Deploying to $REMOTE_HOST"

rsync -av \
  revcdos-bin/ \
  root@${REMOTE_HOST}:/var/www/${DOMAIN}/gta-vc/

rsync -av \
  vc-assets/ \
  root@${REMOTE_HOST}:/var/www/${DOMAIN}/gta-vc/vc-assets/

echo "Deployed to $REMOTE_HOST"
