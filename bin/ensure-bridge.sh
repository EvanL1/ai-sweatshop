#!/bin/bash
# Lazy-start bridge: post event to bridge, start it first if needed.
# Called by Claude Code hooks — stdin is the JSON payload.

PORT="${SWEATSHOP_PORT:-7777}"
URL="http://localhost:${PORT}/events"
BRIDGE="/Users/evan/dev/sweatshop/server/bridge.mjs"
NODE="/opt/homebrew/bin/node"

payload=$(cat)

# Fast path — bridge already running
if echo "$payload" | curl -sf -X POST "$URL" -H 'Content-Type: application/json' --data-binary @- 2>/dev/null; then
  exit 0
fi

# Start bridge (mkdir = atomic lock, prevents double-start from concurrent hooks)
LOCKDIR="/tmp/sweatshop-bridge.lock"
if mkdir "$LOCKDIR" 2>/dev/null; then
  # Start in new process group so hook timeout won't kill it
  "$NODE" "$BRIDGE" > /tmp/sweatshop.log 2>&1 &
  disown
  rmdir "$LOCKDIR"
fi

# Wait for bridge (up to 3s), then deliver the event
for _ in 1 2 3 4 5 6; do
  sleep 0.5
  if echo "$payload" | curl -sf -X POST "$URL" -H 'Content-Type: application/json' --data-binary @- 2>/dev/null; then
    exit 0
  fi
done

exit 0
