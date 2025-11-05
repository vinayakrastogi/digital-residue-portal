#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "This will delete digital_residue.db and all files in uploads/."

rm -f digital_residue.db || true
mkdir -p uploads
find uploads -mindepth 1 -maxdepth 1 -type f -print -delete

echo "Reset complete. Restart the server to recreate schema."

