#!/bin/zsh
set -euo pipefail
ROOT="${0:A:h}"
cd "${ROOT}"
PYTHON="$(command -v python3 2>/dev/null || true)"
[[ -n "${PYTHON}" ]] || { print "Python 3 is required for one-time setup. Install Python 3 and run this file again." >&2; exit 1; }
"${PYTHON}" tools/initialize_vault.py
exec "${ROOT}/open-preview.command"
