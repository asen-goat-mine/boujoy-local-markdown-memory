from __future__ import annotations

import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEXT_SUFFIXES = {"", ".md", ".txt", ".html", ".xml", ".js", ".css", ".py", ".pyw", ".command", ".cmd", ".yml", ".yaml", ".json", ".applescript"}
FORBIDDEN_TEXT = (
    "/Us" + "ers/",
    "C" + ":\\Us" + "ers\\",
    "/var/fol" + "ders/",
)
FORBIDDEN_SUFFIXES = {
    ".mp4", ".mov", ".mkv", ".webm", ".mp3", ".wav", ".m4a", ".flac",
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".pptx", ".docx",
    ".zip", ".7z", ".rar",
}
ALLOWED_DEMO_MEDIA = {
    "docs/assets/knowledge-memory-demo.gif",
}


class ReleaseSafetyTests(unittest.TestCase):
    def test_no_personal_markers(self) -> None:
        hits: list[str] = []
        for path in ROOT.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
                continue
            text = path.read_text(encoding="utf-8-sig", errors="replace")
            for marker in FORBIDDEN_TEXT:
                if marker.lower() in text.lower():
                    hits.append(f"{path.relative_to(ROOT)}: {marker}")
        self.assertEqual(hits, [])

    def test_no_skill_media_archive_or_symlink(self) -> None:
        forbidden: list[str] = []
        for path in ROOT.rglob("*"):
            relative = path.relative_to(ROOT).as_posix()
            media_is_allowed = relative in ALLOWED_DEMO_MEDIA
            if (
                path.is_symlink()
                or path.name == "SKILL.md"
                or (
                    path.suffix.lower() in FORBIDDEN_SUFFIXES
                    and not media_is_allowed
                )
                or ".app/" in relative
            ):
                forbidden.append(relative)
        self.assertEqual(forbidden, [])

    def test_no_absolute_windows_paths(self) -> None:
        pattern = re.compile(r"(?i)(?<![A-Za-z0-9])[A-Z]:[\\/]")
        hits: list[str] = []
        for path in ROOT.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
                continue
            if pattern.search(path.read_text(encoding="utf-8-sig", errors="replace")):
                hits.append(path.relative_to(ROOT).as_posix())
        self.assertEqual(hits, [])


if __name__ == "__main__":
    unittest.main()
