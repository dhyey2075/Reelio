#!/usr/bin/env bash
set -euo pipefail

API="${REELIO_API:-http://localhost:3001}"

echo "Reelio smoke test → ${API}"

echo "→ GET /api/config"
CONFIG=$(curl -sf "${API}/api/config")
echo "$CONFIG" | grep -q '"apiBase"' || { echo "FAIL: /api/config"; exit 1; }

echo "→ GET /api/status"
STATUS=$(curl -sf "${API}/api/status")
echo "$STATUS" | grep -q '"browserLaunched"' || { echo "FAIL: /api/status"; exit 1; }

echo "→ GET /api/buffer/status"
BUFFER=$(curl -sf "${API}/api/buffer/status")
echo "$BUFFER" | grep -q '"bufferedCount"' || { echo "FAIL: /api/buffer/status"; exit 1; }

echo "→ POST /api/player/play"
curl -sf -X POST "${API}/api/player/play" \
  -H 'Content-Type: application/json' \
  -d '{"keepAlive":false}' >/dev/null

echo "→ POST /api/player/pause"
curl -sf -X POST "${API}/api/player/pause" \
  -H 'Content-Type: application/json' \
  -d '{"reelId":null,"currentTime":0,"force":true}' >/dev/null

echo "Smoke test passed."
