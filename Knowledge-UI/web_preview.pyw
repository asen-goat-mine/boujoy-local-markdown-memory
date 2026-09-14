from __future__ import annotations

import errno
import hashlib
import json
import mimetypes
import os
import re
import subprocess
import sys
import time
import webbrowser
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen


APP_DIR = Path(__file__).resolve().parent
VAULT_ROOT = APP_DIR.parent.resolve()
SERVICE_ID = "local-markdown-memory-preview"
SERVICE_VERSION = 2
DEFAULT_LOCAL_PORT = 8765
IDLE_TIMEOUT_SECONDS = 10 * 60
HEARTBEAT_TIMEOUT_SECONDS = 0.75
RANGE_PATTERN = re.compile(r"bytes=(\d*)-(\d*)$")

IGNORED_DIRS = {
    ".cache",
    ".codebuddy",
    ".codex",
    ".git",
    ".agents",
    ".mypy_cache",
    ".nox",
    ".openai",
    ".pytest_cache",
    ".ruff_cache",
    ".tox",
    ".venv",
    ".workbuddy",
    "__pypackages__",
    "node_modules",
    "site-packages",
    "venv",
    "__pycache__",
    "99-Logs",
    "_dist",
}


def relative_display(path: Path | str) -> str:
    try:
        return Path(path).resolve(strict=False).relative_to(VAULT_ROOT).as_posix()
    except (OSError, RuntimeError, ValueError):
        return Path(path).name or "."


def diagnostic(path: Path | str, error: BaseException) -> dict[str, str]:
    return {
        "path": relative_display(path),
        "error": f"{type(error).__name__}: {error}",
    }


class VaultCache:
    def __init__(self) -> None:
        self.lock = Lock()
        self.source_fingerprint = ""
        self.etag = ""
        self.payload = b""
        self.last_checked = 0.0
        self.last_verified = 0.0
        self.entries: dict[str, tuple[tuple[int, int, int, int], dict]] = {}

    @staticmethod
    def markdown_paths() -> tuple[list[Path], list[dict[str, str]]]:
        if not VAULT_ROOT.is_dir():
            raise RuntimeError(f"Vault root is not a directory: {VAULT_ROOT}")
        if not (VAULT_ROOT / "AGENTS.md").is_file() or not (VAULT_ROOT / "00-System").is_dir():
            raise RuntimeError("The preview must remain directly inside a valid Vault root.")

        paths: list[Path] = []
        skipped: list[dict[str, str]] = []

        def on_walk_error(error: OSError) -> None:
            skipped.append(diagnostic(error.filename or VAULT_ROOT, error))

        for current, directories, filenames in os.walk(
            VAULT_ROOT,
            onerror=on_walk_error,
        ):
            directories[:] = sorted(
                name for name in directories if name not in IGNORED_DIRS
            )
            current_path = Path(current)
            for filename in sorted(filenames):
                if filename.lower().endswith(".md"):
                    paths.append(current_path / filename)
        return paths, skipped

    def read(self, *, max_age: float = 0.0) -> tuple[str, bytes]:
        with self.lock:
            if self.payload and time.monotonic() - self.last_checked < max_age:
                return self.etag, self.payload
            result = self._read_locked()
            self.last_checked = time.monotonic()
            return result

    def _read_locked(self) -> tuple[str, bytes]:
        paths, skipped = self.markdown_paths()
        snapshots: list[tuple[Path, os.stat_result]] = []
        parts: list[str] = []
        for path in paths:
            try:
                if path.is_symlink():
                    raise PermissionError("Symbolic-link Markdown is not indexed")
                path.resolve().relative_to(VAULT_ROOT)
                stat = path.stat()
                relative = path.relative_to(VAULT_ROOT).as_posix()
            except (OSError, ValueError) as error:
                skipped.append(diagnostic(path, error))
                continue
            snapshots.append((path, stat))
            parts.append(f"{relative}:{stat.st_mtime_ns}:{stat.st_ctime_ns}:{stat.st_size}:{stat.st_ino}")

        for item in skipped:
            parts.append(f"skipped:{item['path']}:{item['error']}")
        source_fingerprint = hashlib.sha256(
            "|".join(parts).encode("utf-8")
        ).hexdigest()
        # Windows ctime is creation time. Periodically verify bytes as well,
        # so editors preserving size/mtime cannot keep stale content forever.
        verify_content = time.monotonic() - self.last_verified >= 30
        if not verify_content and source_fingerprint == self.source_fingerprint and self.payload:
            return self.etag, self.payload

        files = []
        entries = {}
        unreadable: list[dict[str, str]] = []
        for path, stat in snapshots:
            try:
                relative = path.relative_to(VAULT_ROOT).as_posix()
                signature = (stat.st_mtime_ns, stat.st_ctime_ns, stat.st_size, stat.st_ino)
                cached = self.entries.get(relative)
                if not verify_content and cached and cached[0] == signature:
                    files.append(cached[1])
                    entries[relative] = cached
                    continue
                raw = path.read_bytes()
                text = raw.decode("utf-8", errors="replace")
            except (OSError, ValueError) as error:
                unreadable.append(diagnostic(path, error))
                continue
            files.append(
                {
                    "path": relative,
                    "text": text,
                    "lastModified": stat.st_mtime * 1000,
                    "size": stat.st_size,
                    "contentHash": hashlib.sha256(raw).hexdigest(),
                }
            )
            entries[relative] = (signature, files[-1])

        payload = json.dumps(
            {
                "root": VAULT_ROOT.name,
                "files": files,
                "skipped": skipped,
                "unreadable": unreadable,
            },
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode("utf-8")
        etag = hashlib.sha256(payload).hexdigest()
        # Retry temporarily unreadable files even if their metadata is unchanged.
        self.source_fingerprint = "" if unreadable else source_fingerprint
        self.etag = etag
        self.payload = payload
        self.entries = entries
        if verify_content:
            self.last_verified = time.monotonic()
        return etag, payload


CACHE = VaultCache()


class PreviewServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address: tuple[str, int]) -> None:
        super().__init__(address, PreviewHandler)
        self.last_request = time.monotonic()
        self.started_at = time.time()


class PreviewHandler(SimpleHTTPRequestHandler):
    server: PreviewServer

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, directory=str(APP_DIR), **kwargs)

    def log_message(self, _format: str, *_args) -> None:
        return

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cache-Control", "no-store")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; img-src 'self' data:; media-src 'self'; "
            "style-src 'self' 'unsafe-inline'; script-src 'self'; "
            "connect-src 'self'; object-src 'none'; base-uri 'none'; "
            "frame-ancestors 'none'",
        )
        super().end_headers()

    def do_GET(self) -> None:
        self.server.last_request = time.monotonic()
        parsed = urlparse(self.path)
        route = parsed.path
        if route == "/api/vault":
            self.serve_vault()
            return
        if route == "/api/heartbeat":
            self.serve_heartbeat()
            return
        if route == "/api/file":
            self.serve_file(parsed.query, head_only=False)
            return
        if route == "/api/reveal":
            self.method_not_allowed("POST")
            return
        if route == "/":
            self.path = "/index.html"
        super().do_GET()

    def do_HEAD(self) -> None:
        self.server.last_request = time.monotonic()
        parsed = urlparse(self.path)
        if parsed.path == "/api/file":
            self.serve_file(parsed.query, head_only=True)
            return
        if parsed.path == "/api/heartbeat":
            self.serve_heartbeat(head_only=True)
            return
        if parsed.path == "/api/reveal":
            self.method_not_allowed("POST", head_only=True)
            return
        if parsed.path == "/":
            self.path = "/index.html"
        super().do_HEAD()

    def do_POST(self) -> None:
        self.server.last_request = time.monotonic()
        parsed = urlparse(self.path)
        if parsed.path == "/api/reveal":
            self.serve_reveal(parsed.query)
            return
        self.method_not_allowed("GET, HEAD")

    def send_json(
        self,
        status: int,
        value: object,
        *,
        head_only: bool = False,
    ) -> None:
        payload = json.dumps(
            value,
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        if not head_only:
            self.wfile.write(payload)

    def method_not_allowed(self, allow: str, *, head_only: bool = False) -> None:
        payload = b'{"error":"method_not_allowed"}'
        self.send_response(HTTPStatus.METHOD_NOT_ALLOWED)
        self.send_header("Allow", allow)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        if not head_only:
            self.wfile.write(payload)

    @staticmethod
    def local_header_url(value: str) -> bool:
        parsed = urlparse(value)
        return (
            parsed.scheme in {"http", "https"}
            and parsed.hostname in {"127.0.0.1", "localhost"}
        )

    def api_request_is_local(self, *, require_browser_proof: bool = False) -> bool:
        host = self.headers.get("Host", "").split(":", 1)[0].strip("[]").lower()
        if host not in {"127.0.0.1", "localhost"}:
            return False

        fetch_site = self.headers.get("Sec-Fetch-Site", "").lower()
        if fetch_site and fetch_site not in {"same-origin", "none"}:
            return False

        local_context_header = False
        for header_name in ("Origin", "Referer"):
            value = self.headers.get(header_name)
            if not value:
                continue
            if not self.local_header_url(value):
                return False
            local_context_header = True

        if require_browser_proof:
            return fetch_site in {"same-origin", "none"} and local_context_header
        return True

    def requested_vault_path(
        self,
        query: str,
        *,
        require_browser_proof: bool = False,
    ) -> tuple[Path, str]:
        if not self.api_request_is_local(
            require_browser_proof=require_browser_proof
        ):
            raise PermissionError("Request origin is not local.")
        values = parse_qs(query, keep_blank_values=True).get("path", [])
        if len(values) != 1 or not values[0] or "\x00" in values[0]:
            raise ValueError("Exactly one non-empty path is required.")
        raw_path = values[0]
        candidate = (VAULT_ROOT / raw_path).resolve(strict=True)
        try:
            relative = candidate.relative_to(VAULT_ROOT).as_posix()
        except ValueError as error:
            raise PermissionError("Path is outside the Vault.") from error
        return candidate, relative

    def serve_heartbeat(self, *, head_only: bool = False) -> None:
        if not self.api_request_is_local():
            self.send_json(
                HTTPStatus.FORBIDDEN,
                {"error": "Request origin is not local."},
                head_only=head_only,
            )
            return
        host, port = self.server.server_address
        self.send_json(
            HTTPStatus.OK,
            {
                "service": SERVICE_ID,
                "version": SERVICE_VERSION,
                "ready": bool(CACHE.payload),
                "vaultId": hashlib.sha256(str(VAULT_ROOT).encode("utf-8")).hexdigest(),
                "url": f"http://{host}:{port}/",
                "pid": os.getpid(),
                "startedAt": self.server.started_at,
            },
            head_only=head_only,
        )

    def serve_vault(self) -> None:
        if not self.api_request_is_local():
            self.send_json(
                HTTPStatus.FORBIDDEN,
                {"error": "Request origin is not local."},
            )
            return
        try:
            etag, payload = CACHE.read(max_age=0.5)
        except Exception as error:
            self.send_json(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"error": "vault_scan_failed", "detail": str(error)},
            )
            return
        if self.headers.get("If-None-Match") == etag:
            self.send_response(HTTPStatus.NOT_MODIFIED)
            self.send_header("ETag", etag)
            self.end_headers()
            return
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("ETag", etag)
        self.end_headers()
        self.wfile.write(payload)

    def serve_reveal(self, query: str) -> None:
        try:
            candidate, relative = self.requested_vault_path(
                query,
                require_browser_proof=True,
            )
        except ValueError as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
            return
        except FileNotFoundError:
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "Path does not exist."})
            return
        except PermissionError as error:
            self.send_json(HTTPStatus.FORBIDDEN, {"error": str(error)})
            return
        except (OSError, RuntimeError):
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "Path is unavailable."})
            return

        if sys.platform == "darwin":
            command = ["/usr/bin/open", "-R", str(candidate)]
        elif sys.platform == "win32":
            command = ["explorer.exe", f"/select,{candidate}"]
        else:
            self.send_json(
                HTTPStatus.NOT_IMPLEMENTED,
                {"error": "Reveal is supported on macOS and Windows only."},
            )
            return
        try:
            subprocess.Popen(
                command,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
        except OSError as error:
            self.send_json(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"error": "reveal_failed", "detail": str(error)},
            )
            return
        self.send_json(HTTPStatus.OK, {"revealed": relative})

    def requested_range(self, size: int) -> tuple[int, int] | None:
        header = self.headers.get("Range")
        if not header:
            return None
        if "," in header:
            raise ValueError("Multiple ranges are not supported.")
        match = RANGE_PATTERN.fullmatch(header.strip())
        if not match or size <= 0:
            raise ValueError("Invalid byte range.")
        start_text, end_text = match.groups()
        if not start_text and not end_text:
            raise ValueError("Invalid byte range.")
        if not start_text:
            suffix_length = int(end_text)
            if suffix_length <= 0:
                raise ValueError("Invalid byte range.")
            start = max(0, size - suffix_length)
            end = size - 1
        else:
            start = int(start_text)
            end = int(end_text) if end_text else size - 1
            if start >= size or start > end:
                raise ValueError("Range is outside the file.")
            end = min(end, size - 1)
        return start, end

    def serve_file(self, query: str, *, head_only: bool) -> None:
        try:
            candidate, _relative = self.requested_vault_path(query)
        except ValueError as error:
            self.send_json(
                HTTPStatus.BAD_REQUEST,
                {"error": str(error)},
                head_only=head_only,
            )
            return
        except FileNotFoundError:
            self.send_json(
                HTTPStatus.NOT_FOUND,
                {"error": "File does not exist."},
                head_only=head_only,
            )
            return
        except PermissionError as error:
            self.send_json(
                HTTPStatus.FORBIDDEN,
                {"error": str(error)},
                head_only=head_only,
            )
            return
        except (OSError, RuntimeError):
            self.send_json(
                HTTPStatus.NOT_FOUND,
                {"error": "File is unavailable."},
                head_only=head_only,
            )
            return

        if not candidate.is_file():
            self.send_json(
                HTTPStatus.BAD_REQUEST,
                {"error": "Path is not a file."},
                head_only=head_only,
            )
            return
        try:
            source = candidate.open("rb")
            size = os.fstat(source.fileno()).st_size
            byte_range = self.requested_range(size)
        except (OSError, ValueError) as error:
            if "source" in locals():
                source.close()
            if isinstance(error, ValueError):
                self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                self.send_header("Content-Range", f"bytes */{size}")
                self.send_header("Content-Length", "0")
                self.end_headers()
            else:
                self.send_json(
                    HTTPStatus.INTERNAL_SERVER_ERROR,
                    {"error": "file_stat_failed", "detail": str(error)},
                    head_only=head_only,
                )
            return

        start, end = byte_range or (0, max(0, size - 1))
        length = 0 if size == 0 else end - start + 1
        content_type = mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
        self.send_response(
            HTTPStatus.PARTIAL_CONTENT if byte_range else HTTPStatus.OK
        )
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(length))
        self.send_header("Accept-Ranges", "bytes")
        if byte_range:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        if head_only or length == 0:
            source.close()
            return

        try:
            with source:
                source.seek(start)
                remaining = length
                while remaining:
                    chunk = source.read(min(128 * 1024, remaining))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            return
        except OSError:
            return


def browser_candidates() -> list[Path]:
    candidates = []
    if sys.platform == "darwin":
        candidates.extend(
            [
                Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
                Path("/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"),
                Path("/Applications/Chromium.app/Contents/MacOS/Chromium"),
            ]
        )
    for environment, suffix in (
        ("ProgramFiles(x86)", "Microsoft/Edge/Application/msedge.exe"),
        ("ProgramFiles", "Microsoft/Edge/Application/msedge.exe"),
        ("ProgramFiles", "Google/Chrome/Application/chrome.exe"),
        ("LOCALAPPDATA", "Google/Chrome/Application/chrome.exe"),
    ):
        base = os.environ.get(environment)
        if base:
            candidates.append(Path(base) / Path(suffix))
    return candidates


def open_app_window(url: str) -> bool:
    for browser in browser_candidates():
        if browser.exists():
            if sys.platform == "darwin":
                try:
                    completed = subprocess.run(
                        [
                            "/usr/bin/open",
                            "-n",
                            "-a",
                            str(browser.parents[2]),
                            "--args",
                            f"--app={url}",
                            "--new-window",
                        ],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        timeout=8,
                        check=False,
                    )
                except (OSError, subprocess.SubprocessError):
                    continue
                if completed.returncode == 0:
                    return True
                continue
            subprocess.Popen(
                [str(browser), f"--app={url}", "--new-window"],
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
            return True
    return webbrowser.open(url, new=1)


def argument_value(name: str) -> str | None:
    try:
        return sys.argv[sys.argv.index(name) + 1]
    except (ValueError, IndexError):
        return None


def matching_preview_url(host: str, port: int) -> str | None:
    request = Request(
        f"http://{host}:{port}/api/heartbeat",
        headers={"Host": f"{host}:{port}"},
    )
    try:
        with urlopen(request, timeout=HEARTBEAT_TIMEOUT_SECONDS) as response:
            if response.status != HTTPStatus.OK:
                return None
            heartbeat = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None
    if (
        heartbeat.get("service") != SERVICE_ID
        or heartbeat.get("ready") is not True
        or heartbeat.get("vaultId") != hashlib.sha256(str(VAULT_ROOT).encode("utf-8")).hexdigest()
    ):
        return None
    return f"http://{host}:{port}/"


def write_ready_file(path: str | None, url: str) -> None:
    if not path:
        return
    Path(path).write_text(f"{url}\n", encoding="utf-8")


def bind_server(host: str, port: int, *, allow_random_fallback: bool) -> PreviewServer:
    try:
        return PreviewServer((host, port))
    except OSError as error:
        if not allow_random_fallback or error.errno != errno.EADDRINUSE:
            raise
        print(
            f"Port {port} is occupied by another service; using a random local port.",
            flush=True,
        )
        return PreviewServer((host, 0))


def run_preview() -> None:
    mimetypes.add_type("text/javascript", ".js")
    mimetypes.add_type("text/markdown; charset=utf-8", ".md")
    server_only = "--server-only" in sys.argv
    ready_file = argument_value("--ready-file")
    host = "127.0.0.1"

    if server_only:
        try:
            requested_port = int(argument_value("--server-only") or "8765")
        except ValueError as error:
            raise RuntimeError("--server-only requires a numeric port.") from error
    else:
        requested_port = DEFAULT_LOCAL_PORT

    if not server_only and requested_port:
        existing_url = matching_preview_url(host, requested_port)
        if existing_url:
            if not open_app_window(existing_url):
                raise RuntimeError("No supported browser could open the preview window.")
            print(f"Reused existing local preview: {existing_url}", flush=True)
            write_ready_file(ready_file, existing_url)
            return

    server = bind_server(
        host,
        requested_port,
        allow_random_fallback=not server_only and bool(requested_port),
    )
    server.timeout = 1
    bound_host, bound_port = server.server_address
    url = f"http://{bound_host}:{bound_port}/"
    try:
        etag, payload = CACHE.read()
        scan = json.loads(payload.decode("utf-8"))
        print(
            "Initial Vault scan succeeded: "
            f"{len(scan['files'])} files, "
            f"{len(scan['skipped'])} skipped, "
            f"{len(scan['unreadable'])} unreadable, etag={etag[:12]}",
            flush=True,
        )
        if not server_only and not open_app_window(url):
            raise RuntimeError("No supported browser could open the preview window.")
        print(f"Local Markdown Memory preview URL: {url}", flush=True)
        write_ready_file(ready_file, url)
        while time.monotonic() - server.last_request < IDLE_TIMEOUT_SECONDS:
            server.handle_request()
    finally:
        server.server_close()


def remove_launchd_job(label: str | None) -> None:
    if sys.platform != "darwin" or not label:
        return
    try:
        subprocess.run(
            ["/bin/launchctl", "remove", label],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=5,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return


def main() -> None:
    launchd_label = argument_value("--launchd-label")
    try:
        run_preview()
    finally:
        remove_launchd_job(launchd_label)


if __name__ == "__main__":
    main()
