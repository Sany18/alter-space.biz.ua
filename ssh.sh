# Description: SSH into the remote host

set -o allexport
source .env
set +o allexport

ssh root@$REMOTE_HOST
