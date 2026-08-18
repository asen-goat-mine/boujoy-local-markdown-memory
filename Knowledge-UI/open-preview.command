#!/bin/zsh

set -u
umask 077

SCRIPT_DIR="${0:A:h}"
CODEX_PYTHON="${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
LOG_DIR="${TMPDIR:-/tmp}/local-markdown-memory-preview"
if ! /bin/mkdir -p -- "${LOG_DIR}"; then
  echo "无法创建预览日志目录：${LOG_DIR}"
  exit 1
fi
LOG_FILE="${LOG_DIR}/launch-$(/bin/date '+%Y%m%d-%H%M%S')-$$.log"
if ! READY_DIR="$(/usr/bin/mktemp -d "/tmp/local-memory-preview-ready-${UID}.XXXXXX")"; then
  echo "无法创建预览启动握手目录。"
  exit 1
fi
READY_FILE="${READY_DIR}/ready"

cleanup_ready_file() {
  /bin/rm -f -- "${READY_FILE}"
  /bin/rmdir "${READY_DIR}" 2>/dev/null
}

trap cleanup_ready_file EXIT

python_candidates=(
  "${CODEX_PYTHON}"
  "/opt/homebrew/bin/python3"
  "/usr/local/bin/python3"
  "/usr/bin/python3"
)

PYTHON_BIN=""
for candidate in "${python_candidates[@]}"; do
  if [[ -x "${candidate}" ]] && "${candidate}" -c "import sys,http.server; raise SystemExit(sys.version_info < (3, 9))" >/dev/null 2>&1; then
    PYTHON_BIN="${candidate}"
    break
  fi
done

if [[ -z "${PYTHON_BIN}" ]]; then
  echo "Python 3 not found; opening browser compatibility mode."
  /usr/bin/open "${SCRIPT_DIR}/index.html"
  exit $?
fi

LAUNCH_LABEL="org.localmarkdownmemory.preview.${UID}.$$"
/usr/bin/touch "${LOG_FILE}"
/bin/chmod 600 "${LOG_FILE}"
if ! /bin/launchctl submit \
  -l "${LAUNCH_LABEL}" \
  -o "${LOG_FILE}" \
  -e "${LOG_FILE}" \
  -- "${PYTHON_BIN}" "${SCRIPT_DIR}/web_preview.pyw" \
  --ready-file "${READY_FILE}" \
  --launchd-label "${LAUNCH_LABEL}"; then
  echo "无法向 macOS 用户服务提交知识库预览进程。"
  echo "运行日志：${LOG_FILE}"
  exit 1
fi

for attempt in {1..100}; do
  if [[ -s "${READY_FILE}" ]]; then
    PREVIEW_URL="$(/usr/bin/head -n 1 "${READY_FILE}")"
    if [[ "${PREVIEW_URL}" != http://127.0.0.1:*/* ]]; then
      /bin/launchctl remove "${LAUNCH_LABEL}" >/dev/null 2>&1
      echo "The preview returned an invalid local URL."
      echo "运行日志：${LOG_FILE}"
      exit 1
    fi
    echo "Local Markdown Memory is ready."
    echo "预览地址：${PREVIEW_URL}"
    echo "运行日志：${LOG_FILE}"
    exit 0
  fi

  if ! /bin/launchctl print "gui/${UID}/${LAUNCH_LABEL}" >/dev/null 2>&1; then
    echo "Local Markdown Memory failed to start."
    echo "运行日志：${LOG_FILE}"
    if [[ -s "${LOG_FILE}" ]]; then
      /usr/bin/tail -n 20 "${LOG_FILE}"
    fi
    exit 1
  fi

  /bin/sleep 0.1
done

echo "Local Markdown Memory startup timed out."
echo "运行日志：${LOG_FILE}"
if [[ -s "${LOG_FILE}" ]]; then
  /usr/bin/tail -n 20 "${LOG_FILE}"
fi
/bin/launchctl remove "${LAUNCH_LABEL}" >/dev/null 2>&1
exit 1
