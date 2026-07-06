#!/usr/bin/env bash
# Full play — new user turn (UserPromptSubmit). May fetch fresh reels on client.
API="${REELIO_API:-http://localhost:3001}"
curl -s -X POST "$API/api/player/play" \
  -H 'Content-Type: application/json' \
  -d '{"keepAlive":false}' >/dev/null 2>&1 &
exit 0
