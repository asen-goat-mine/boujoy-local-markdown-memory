from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
sys.path.insert(0, str(TOOLS))
import sync_index_status  # noqa: E402


class IndexToolTests(unittest.TestCase):
    def test_index_has_no_drift_or_missing_paths(self) -> None:
        summary = sync_index_status.inspect_vault(ROOT)
        self.assertFalse(summary["count_drift"])
        self.assertEqual(summary["missing_index_paths"], 0)
        self.assertEqual(summary["topic_count"], summary["memory_index_declared"])
        self.assertEqual(summary["topic_count"], summary["dashboard_declared"])

    def test_markdown_links_support_spaces_and_percent_encoding(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "Index.md"
            folder = root / "Cards"
            folder.mkdir()
            (folder / "中文 文件.md").write_text("# One\n", encoding="utf-8")
            (folder / "space name.md").write_text("# Two\n", encoding="utf-8")
            source.write_text(
                "[one](<Cards/中文 文件.md>)\n[two](Cards/space%20name.md)\n",
                encoding="utf-8",
            )
            references = sync_index_status.collect_references(root, [source])
            self.assertEqual([item.relative for item in references], [
                "Cards/space name.md",
                "Cards/中文 文件.md",
            ])
            self.assertTrue(all(item.exists for item in references))

    def test_all_javascript_ids_exist_in_html(self) -> None:
        import re

        html = (ROOT / "Knowledge-UI/index.html").read_text(encoding="utf-8")
        script = (ROOT / "Knowledge-UI/app.js").read_text(encoding="utf-8")
        html_ids = set(re.findall(r'id="([^"]+)"', html))
        script_ids = set(re.findall(r'\$\("#([^"]+)"\)', script))
        self.assertEqual(sorted(script_ids - html_ids), [])


if __name__ == "__main__":
    unittest.main()
