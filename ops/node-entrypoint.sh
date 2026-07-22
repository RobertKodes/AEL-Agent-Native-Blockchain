#!/bin/sh
set -eu
state_dir="$(dirname "${AEL_NODE_STATE_PATH:-/data/follower-state.json}")"
mkdir -p "$state_dir"
chown -R 1000:1000 "$state_dir"
exec su -s /bin/sh node -c 'exec node src/actor-runner.js'
