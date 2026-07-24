#!/bin/sh
set -eu
state_file="${AEL_STATE:-/data/devnet-state.json}"
state_dir="$(dirname "$state_file")"
mkdir -p "$state_dir"
if [ ! -s "$state_file" ] && [ -n "${AEL_RESTORE_URL:-}" ]; then
  node /app/scripts/restore-state.mjs "$AEL_RESTORE_URL" "$state_file" \
    || echo "State restore unavailable; starting from genesis"
fi
chown -R 1000:1000 "$state_dir"
exec su -s /bin/sh node -c 'exec node src/devnet.js'
