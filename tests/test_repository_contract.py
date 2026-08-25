from __future__ import annotations

import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SEMVER_PATTERN = re.compile(r"^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$")
MARKDOWN_LINK_PATTERN = re.compile(r"\[[^\]]+\]\(([^)\r\n]+)\)")


class RepositoryContractTests(unittest.TestCase):
    def test_version_is_semver_and_documented(self) -> None:
        version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
        self.assertRegex(version, SEMVER_PATTERN)
        changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
        self.assertIn(f"## [{version}]", changelog)

    def test_cross_platform_launchers_exist(self) -> None:
        for relative in ("open-preview.command", "open-preview.cmd", "open-preview.sh"):
            with self.subTest(relative=relative):
                self.assertTrue((ROOT / relative).is_file())

    def test_first_run_and_maintenance_launchers_exist(self) -> None:
        for relative in (
            "Start-Here.command", "Start-Here.cmd", "start-here.sh",
            "Check-Vault.command", "Check-Vault.cmd",
            "Repair-Vault.command", "Repair-Vault.cmd",
            "tools/initialize_vault.py",
        ):
            with self.subTest(relative=relative):
                self.assertTrue((ROOT / relative).is_file())

    def test_health_center_lists_all_supported_platforms(self) -> None:
        script = (ROOT / "Knowledge-UI/app.js").read_text(encoding="utf-8")
        self.assertIn("macOS · Windows · Linux · 浏览器兼容模式", script)

    def test_public_documentation_has_no_broken_local_links(self) -> None:
        documents = (
            "README.md", "README_EN.md", "CHANGELOG.md", "CONTRIBUTING.md",
            "SECURITY.md", "SUPPORT.md", "docs/README.md",
        )
        missing: list[str] = []
        for relative in documents:
            source = ROOT / relative
            text = source.read_text(encoding="utf-8")
            for match in MARKDOWN_LINK_PATTERN.finditer(text):
                raw = match.group(1).strip().strip("<>")
                if not raw or raw.startswith(("#", "http://", "https://", "mailto:")):
                    continue
                target = raw.split("#", 1)[0].split("?", 1)[0]
                if target and not (source.parent / target).resolve().exists():
                    missing.append(f"{relative} -> {target}")
        self.assertEqual(missing, [])

    def test_media_policy_matches_the_reviewed_demo_exception(self) -> None:
        paths = (
            ROOT / ".codebuddy/rules/local-markdown-memory.md",
            ROOT / "00-System/Active-Context.md",
            ROOT / "CONTRIBUTING.md",
        )
        stale_claims = []
        for path in paths:
            text = path.read_text(encoding="utf-8").lower()
            if "no skill, plugin, log, media, or runtime" in text:
                stale_claims.append(path.relative_to(ROOT).as_posix())
            if "no personal content, logs, media, runtime, or skill files" in text:
                stale_claims.append(path.relative_to(ROOT).as_posix())
        self.assertEqual(stale_claims, [])


if __name__ == "__main__":
    unittest.main()
