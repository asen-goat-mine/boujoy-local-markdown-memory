from __future__ import annotations

import shutil
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
sys.path.insert(0, str(TOOLS))
import initialize_vault  # noqa: E402
import sync_index_status  # noqa: E402


class InitializerTests(unittest.TestCase):
    def make_vault(self, directory: str) -> Path:
        target = Path(directory) / "vault"
        shutil.copytree(
            ROOT,
            target,
            ignore=shutil.ignore_patterns(".git", "__pycache__", "*.pyc"),
        )
        return target

    def test_initializer_preserves_examples_and_builds_valid_indexes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            vault = self.make_vault(directory)
            relative = initialize_vault.initialize(vault, "My Memory", "Research Notes")
            self.assertEqual(relative.as_posix(), "02-Projects/research-notes.md")
            self.assertTrue((vault / relative).is_file())
            self.assertFalse((vault / "02-Projects/example-project.md").exists())
            self.assertTrue((vault / "90-Archive/Starter-Examples/example-project.md").is_file())
            self.assertIn("Research Notes", (vault / "DASHBOARD.md").read_text(encoding="utf-8"))
            summary = sync_index_status.inspect_vault(vault)
            self.assertFalse(summary["count_drift"])
            self.assertEqual(summary["missing_index_paths"], 0)

    def test_initializer_refuses_to_overwrite_an_initialized_vault(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            vault = self.make_vault(directory)
            initialize_vault.initialize(vault, "My Memory", "First Project")
            with self.assertRaisesRegex(RuntimeError, "already initialized"):
                initialize_vault.initialize(vault, "Another Name", "Another Project")

    def test_names_reject_markdown_link_characters(self) -> None:
        with self.assertRaises(ValueError):
            initialize_vault.clean_label("Bad [name]", "Fallback")


if __name__ == "__main__":
    unittest.main()
