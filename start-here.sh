#!/usr/bin/env sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$ROOT"
command -v python3 >/dev/null 2>&1 || { echo "Python 3 is required for one-time setup." >&2; exit 1; }
python3 tools/initialize_vault.py
exec "$ROOT/open-preview.sh"
