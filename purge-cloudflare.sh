#!/usr/bin/env bash
#
# Purge the entire Cloudflare cache for this zone. Called at the end of each
# project's deploy.sh.
#
# Why: Cloudflare caches static assets (.js/.css/images) at the edge with a
# multi-hour TTL. Updating the origin via rsync doesn't invalidate that edge
# cache, so without an explicit purge, visitors can keep getting a stale file
# for hours after a deploy - this bit us for real once (a stale game.js kept
# throwing on a since-removed DOM reference).
#
# Requires CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN in .env (the token
# only needs the Zone.Cache Purge permission, scoped to this zone). Silently
# skips if the token isn't set yet, so this is safe to call unconditionally.

if [[ -z "$CLOUDFLARE_API_TOKEN" ]]; then
  echo "CLOUDFLARE_API_TOKEN not set - skipping Cloudflare cache purge"
  exit 0
fi

echo "Purging Cloudflare cache for zone $CLOUDFLARE_ZONE_ID..."

response=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}')

if echo "$response" | grep -q '"success":true'; then
  echo "Cloudflare cache purged."
else
  echo "Cloudflare cache purge failed: $response"
fi
