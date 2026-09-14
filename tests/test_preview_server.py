from __future__ import annotations

import importlib.machinery
import importlib.util
import json
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import ProxyHandler, Request, build_opener

# Loopback fixtures must not be routed through the host system proxy.
urlopen = build_opener(ProxyHandler({})).open


ROOT = Path(__file__).resolve().parents[1]
SERVER_PATH = ROOT / "Knowledge-UI/web_preview.pyw"


def load_server_module():
    loader = importlib.machinery.SourceFileLoader("local_preview_server", str(SERVER_PATH))
    spec = importlib.util.spec_from_loader(loader.name, loader)
    module = importlib.util.module_from_spec(spec)
    loader.exec_module(module)
    return module


class PreviewServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.module = load_server_module()
        cls.module.CACHE.read()
        cls.server = cls.module.PreviewServer(("127.0.0.1", 0))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        host, port = cls.server.server_address
        cls.base = f"http://{host}:{port}"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=3)

    def test_heartbeat_uses_anonymous_vault_id(self) -> None:
        with urlopen(f"{self.base}/api/heartbeat", timeout=3) as response:
            payload = json.loads(response.read())
        self.assertTrue(payload["ready"])
        self.assertIn("vaultId", payload)
        self.assertNotIn("vaultRoot", payload)

    def test_root_has_security_headers(self) -> None:
        with urlopen(f"{self.base}/", timeout=3) as response:
            self.assertIn("default-src 'self'", response.headers["Content-Security-Policy"])
            self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")

    def test_range_request(self) -> None:
        request = Request(
            f"{self.base}/api/file?path=README.md",
            headers={"Range": "bytes=0-15"},
        )
        with urlopen(request, timeout=3) as response:
            self.assertEqual(response.status, 206)
            self.assertEqual(len(response.read()), 16)
            self.assertTrue(response.headers["Content-Range"].startswith("bytes 0-15/"))

    def test_traversal_is_rejected(self) -> None:
        with self.assertRaises(HTTPError) as caught:
            urlopen(f"{self.base}/api/file?path=..", timeout=3)
        self.assertEqual(caught.exception.code, 403)

    def test_vault_endpoint_supports_etag(self) -> None:
        with urlopen(f"{self.base}/api/vault", timeout=3) as response:
            etag = response.headers["ETag"]
            self.assertTrue(etag)
        request = Request(f"{self.base}/api/vault", headers={"If-None-Match": etag})
        with self.assertRaises(HTTPError) as caught:
            urlopen(request, timeout=3)
        self.assertEqual(caught.exception.code, 304)

    def test_reveal_requires_post_and_same_origin(self) -> None:
        with self.assertRaises(HTTPError) as caught:
            urlopen(f"{self.base}/api/reveal?path=README.md", timeout=3)
        self.assertEqual(caught.exception.code, 405)

        request = Request(
            f"{self.base}/api/reveal?path=README.md",
            method="POST",
            headers={"Origin": "https://example.invalid", "Sec-Fetch-Site": "cross-site"},
        )
        with self.assertRaises(HTTPError) as cross_site:
            urlopen(request, timeout=3)
        self.assertEqual(cross_site.exception.code, 403)


if __name__ == "__main__":
    unittest.main()
