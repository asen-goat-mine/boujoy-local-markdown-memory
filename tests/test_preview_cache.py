from __future__ import annotations

import json
import os
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

from test_preview_server import load_server_module


class PreviewCacheTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        (self.root / "00-System").mkdir()
        (self.root / "AGENTS.md").write_text("# Instructions", encoding="utf-8")
        self.a = self.root / "a.md"
        self.b = self.root / "b.md"
        self.a.write_text("first", encoding="utf-8")
        self.b.write_text("other", encoding="utf-8")
        self.module = load_server_module()
        self.module.VAULT_ROOT = self.root
        self.cache = self.module.VaultCache()

    def snapshot(self):
        etag, payload = self.cache.read()
        return etag, json.loads(payload)

    def test_only_changed_markdown_is_read_again_and_deletions_are_evicted(self):
        self.snapshot()
        self.a.write_text("updated", encoding="utf-8")
        original = Path.read_bytes
        reads = []
        def read(path):
            reads.append(path)
            return original(path)
        with patch.object(Path, "read_bytes", read):
            _, payload = self.snapshot()
        self.assertEqual(reads, [self.a])
        self.assertEqual(next(f["text"] for f in payload["files"] if f["path"] == "a.md"), "updated")
        self.b.unlink()
        _, payload = self.snapshot()
        self.assertNotIn("b.md", {f["path"] for f in payload["files"]})
        self.assertNotIn("b.md", self.cache.entries)

    def test_same_size_edit_with_preserved_mtime_changes_hash_and_etag(self):
        old_etag, old = self.snapshot()
        stat = self.a.stat()
        self.a.write_text("later", encoding="utf-8")
        os.utime(self.a, ns=(stat.st_atime_ns, stat.st_mtime_ns))
        # Include platforms where ctime is creation time rather than change time.
        self.cache.last_verified -= 31
        new_etag, new = self.snapshot()
        self.assertNotEqual(old_etag, new_etag)
        before = next(f for f in old["files"] if f["path"] == "a.md")
        after = next(f for f in new["files"] if f["path"] == "a.md")
        self.assertEqual(before["lastModified"], after["lastModified"])
        self.assertNotEqual(before["contentHash"], after["contentHash"])
        self.assertEqual(after["text"], "later")

    def test_temporary_read_failure_is_retried_without_a_metadata_change(self):
        original = Path.read_bytes
        def read(path):
            if path == self.a:
                raise PermissionError("temporary test lock")
            return original(path)
        with patch.object(Path, "read_bytes", read):
            _, first = self.snapshot()
        self.assertEqual(first["unreadable"][0]["path"], "a.md")
        _, recovered = self.snapshot()
        self.assertEqual(recovered["unreadable"], [])
        self.assertIn("a.md", {f["path"] for f in recovered["files"]})

    def test_concurrent_refreshes_share_one_scan(self):
        with patch.object(self.cache, "markdown_paths", wraps=self.cache.markdown_paths) as walk:
            with ThreadPoolExecutor(max_workers=8) as pool:
                snapshots = list(pool.map(lambda _: self.cache.read(max_age=60), range(16)))
        self.assertEqual(walk.call_count, 1)
        self.assertTrue(all(item == snapshots[0] for item in snapshots))

    def test_markdown_symlink_does_not_read_outside_vault(self):
        with tempfile.TemporaryDirectory() as outside:
            source = Path(outside) / "external.md"
            source.write_text("outside content", encoding="utf-8")
            try:
                (self.root / "linked.md").symlink_to(source)
            except OSError as error:
                self.skipTest(f"Symlinks unavailable: {error}")
            _, payload = self.snapshot()
            self.assertNotIn("outside content", json.dumps(payload))
            self.assertNotIn("linked.md", {f["path"] for f in payload["files"]})


if __name__ == "__main__":
    unittest.main()
