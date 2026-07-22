#!/bin/sh
set -eu
state_dir="$(dirname "${AEL_STATE:-/data/devnet-state.json}")"
mkdir -p "$state_dir"
chown -R 1000:1000 "$state_dir"
exec su -s /bin/sh node -c 'exec node src/devnet.js'
