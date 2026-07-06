#!/usr/bin/env bash
# Pause on turn complete (Stop) or session end. Debounce Stop so mid-turn
# thinking→tool transitions don't minimize before PreToolUse keep-alive fires.
eval "$(node -e "
const fs = require('fs');
let d = {};
try { d = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch {}
const force = d.hook_event_name === 'SessionEnd';
const skip = Array.isArray(d.background_tasks) && d.background_tasks.length > 0;
process.stdout.write('FORCE=' + (force ? '1' : '0') + '; SKIP=' + (skip ? '1' : '0'));
" 2>/dev/null || echo 'FORCE=0; SKIP=0')"

if [ "$SKIP" = "1" ]; then
  exit 0
fi

API="${REELIO_API:-http://localhost:3001}"
PAYLOAD='{"debounceMs":500}'
if [ "$FORCE" = "1" ]; then
  PAYLOAD='{"force":true}'
fi

curl -s -X POST "$API/api/player/pause" \
  -H 'Content-Type: application/json' \
  -d "$PAYLOAD" >/dev/null 2>&1 &
exit 0
