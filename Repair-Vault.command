#!/bin/zsh
set -euo pipefail
ROOT="${0:A:h}"
cd "${ROOT}"
PYTHON="$(command -v python3 2>/dev/null || true)"
[[ -n "${PYTHON}" ]] || { print "Python 3 was not found." >&2; exit 1; }
"${PYTHON}" tools/sync_index_status.py --fix
"${PYTHON}" tools/vault_doctor.py
"${PYTHON}" tools/sync_index_status.py --check
print "Vault indexes were repaired and verified."
