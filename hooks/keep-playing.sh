#!/usr/bin/env bash
# Keep-alive play — mid-turn (tools/subagents). Resume without refreshing reels.
API="${REELIO_API:-http://localhost:3001}"
curl -s -X POST "$API/api/player/play" \
  -H 'Content-Type: application/json' \
  -d '{"keepAlive":true}' >/dev/null 2>&1 &
exit 0
