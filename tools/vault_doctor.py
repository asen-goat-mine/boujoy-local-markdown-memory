#!/usr/bin/env python3
"""Read-only health check for a Local Markdown Memory Vault."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import sync_index_status


IGNORED_DIRS = {
    ".git", ".cache", ".codex", ".agents", ".openai", ".workbuddy",
    ".idea", ".vscode", ".pytest_cache", ".ruff_cache", ".mypy_cache",
    "node_modules", ".venv", "venv", "__pycache__", "99-Logs",
}


def markdown_files(root: Path) -> list[Path]:
    return sorted(
        path
        for path in root.rglob("*.md")
        if not any(part in IGNORED_DIRS for part in path.relative_to(root).parts)
    )


def result(check_id: str, label: str, status: str, summary: str, details: object = None) -> dict[str, object]:
    return {
        "id": check_id,
        "label": label,
        "status": status,
        "summary": summary,
        "details": details if details is not None else {},
    }


def inspect(root: Path) -> dict[str, object]:
    root = root.resolve()
    checks: list[dict[str, object]] = []
    required = [
        "AGENTS.md", "DASHBOARD.md", "README.md", "00-System/Boot.md",
        "00-System/Hot-Index.md", "00-System/Memory-Index.md",
        "00-System/Active-Context.md", "Knowledge-UI/index.html",
        "Knowledge-UI/app.js", "Knowledge-UI/styles.css",
        "Knowledge-UI/web_preview.pyw",
    ]
    missing = [path for path in required if not (root / path).is_file()]
    checks.append(result(
        "core",
        "Core files",
        "fail" if missing else "pass",
        f"{len(required) - len(missing)}/{len(required)} required files present.",
        {"missing": missing},
    ))

    try:
        index = sync_index_status.inspect_vault(root)
        index_failed = bool(index["count_drift"] or index["missing_index_paths"])
        checks.append(result(
            "index",
            "Index consistency",
            "fail" if index_failed else "pass",
            f"{index['topic_count']} topics, {index['checked_index_paths']} paths, {index['missing_index_paths']} missing.",
            index,
        ))
    except (OSError, ValueError) as error:
        checks.append(result("index", "Index consistency", "fail", str(error)))

    files = markdown_files(root)
    unreadable: list[str] = []
    metadata = {"One-sentence conclusion": 0, "Next action": 0, "Related tags": 0, "Updated": 0}
    card_files = [
        path for path in files
        if path.relative_to(root).parts[0] in {"02-Projects", "03-Knowledge", "04-Content", "05-Prompts", "06-Business"}
        and path.name.lower() != "readme.md"
    ]
    for path in files:
        try:
            text = path.read_text(encoding="utf-8-sig")
        except OSError:
            unreadable.append(path.relative_to(root).as_posix())
            continue
        if path in card_files:
            for field in metadata:
                if re.search(rf"(?im)^##\s+{re.escape(field)}\s*$", text):
                    metadata[field] += 1
    checks.append(result(
        "markdown",
        "Markdown readability",
        "fail" if unreadable else "pass",
        f"{len(files) - len(unreadable)}/{len(files)} Markdown files readable.",
        {"unreadable": unreadable},
    ))
    missing_fields = sum(len(card_files) - count for count in metadata.values())
    checks.append(result(
        "metadata",
        "Card metadata",
        "warn" if missing_fields else "pass",
        f"Coverage across {len(card_files)} content cards.",
        {field: {"present": count, "total": len(card_files)} for field, count in metadata.items()},
    ))

    skill_files = [path.relative_to(root).as_posix() for path in root.rglob("SKILL.md")]
    checks.append(result(
        "bundled_skills",
        "Bundled Skills",
        "fail" if skill_files else "pass",
        "No Skill files are bundled." if not skill_files else f"Found {len(skill_files)} Skill files.",
        {"files": skill_files},
    ))

    fail_count = sum(item["status"] == "fail" for item in checks)
    warn_count = sum(item["status"] == "warn" for item in checks)
    return {
        "name": "Local Markdown Memory Doctor",
        "readonly": True,
        "platform": sys.platform,
        "overall": {
            "status": "failed" if fail_count else "attention" if warn_count else "healthy",
            "exit_code": 1 if fail_count else 0,
            "passed": sum(item["status"] == "pass" for item in checks),
            "warnings": warn_count,
            "failed": fail_count,
        },
        "checks": checks,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--vault", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    report = inspect(args.vault)
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        overall = report["overall"]
        print(
            f"Local Markdown Memory Doctor: {overall['status']} | "
            f"pass {overall['passed']} | warn {overall['warnings']} | fail {overall['failed']}"
        )
        for item in report["checks"]:
            print(f"[{item['status'].upper()}] {item['label']}: {item['summary']}")
    return int(report["overall"]["exit_code"])


if __name__ == "__main__":
    sys.exit(main())
