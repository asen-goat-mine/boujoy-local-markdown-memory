#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3.9 or newer is required to start the full preview." >&2
  echo "You can still open Knowledge-UI/index.html in a compatible browser." >&2
  exit 1
fi

if ! python3 -c 'import sys; raise SystemExit(sys.version_info < (3, 9))'; then
  echo "Python 3.9 or newer is required to start the full preview." >&2
  exit 1
fi

exec python3 "${SCRIPT_DIR}/Knowledge-UI/web_preview.pyw"
