#!/usr/bin/env bash
# Usage: ./run-node.sh <nodeA|nodeB>
set -euo pipefail
NODE=${1:?usage: run-node.sh <nodeA|nodeB>}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT/data/$NODE"
exec "$ROOT/bin/node" -config node-config.json
