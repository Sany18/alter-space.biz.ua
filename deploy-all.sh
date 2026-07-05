#!/usr/bin/env bash
#
# Deploy all projects to the remote server by running each project's own
# deploy.sh in sequence. Continues past a failed project so one broken
# deploy doesn't block the rest; reports a summary at the end and exits
# non-zero if anything failed.
#
# Usage:
#   ./deploy-all.sh                  # deploy every project
#   ./deploy-all.sh 3d-shooter tetris # deploy only the named projects

set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

ALL_PROJECTS=(3d-shooter gta-vc screen-saver tetris welcome-page)
PROJECTS=("${@:-${ALL_PROJECTS[@]}}")

declare -a SUCCEEDED=()
declare -a FAILED=()

for project in "${PROJECTS[@]}"; do
  if [[ ! -x "$project/deploy.sh" ]]; then
    echo "Skipping $project: no executable deploy.sh found"
    FAILED+=("$project")
    continue
  fi

  echo "=== Deploying $project ==="
  (cd "$project" && ./deploy.sh)

  if [[ $? -eq 0 ]]; then
    SUCCEEDED+=("$project")
  else
    echo "!!! $project deploy failed"
    FAILED+=("$project")
  fi
  echo
done

echo "=== Deploy summary ==="
echo "Succeeded: ${SUCCEEDED[*]:-none}"
echo "Failed:    ${FAILED[*]:-none}"

[[ ${#FAILED[@]} -eq 0 ]]
