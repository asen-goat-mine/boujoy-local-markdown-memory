#!/usr/bin/env python3
"""Inspect or refresh lightweight Markdown index status without dependencies."""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from urllib.parse import unquote


LINK_PATTERN = re.compile(r"\[[^\]]+\]\(([^)\r\n]+)\)")
CODE_PATTERN = re.compile(r"`([^`\r\n]+)`")
TOPIC_PATTERN = re.compile(r"(?m)^###\s+")


@dataclass(frozen=True)
class Reference:
    source: str
    raw: str
    relative: str
    exists: bool


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


def inside_root(root: Path, candidate: Path) -> bool:
    try:
        candidate.relative_to(root)
        return True
    except ValueError:
        return False


def normalize_reference(value: str) -> str:
    candidate = value.strip().strip("<>")
    candidate = candidate.split("#", 1)[0].split("?", 1)[0]
    return unquote(candidate).strip()


def reference_from(
    root: Path,
    source: Path,
    value: str,
    *,
    relative_to_source: bool,
    allow_spaces: bool = False,
) -> Reference | None:
    candidate = normalize_reference(value)
    lowered = candidate.lower()
    if not candidate or lowered.startswith(("http:", "https:", "mailto:", "file:")):
        return None
    if candidate.startswith(("#", "~/", "~\\", "//", "\\\\")):
        return None
    if re.match(r"^[A-Za-z]:[\\/]", candidate) or any(mark in candidate for mark in "*?|→"):
        return None
    if any(char in candidate for char in "\r\n\x00"):
        return None
    if not allow_spaces and any(char.isspace() for char in candidate):
        return None
    path_text = candidate.replace("\\", "/")
    base = source.parent if relative_to_source else root
    resolved = (base / path_text).resolve(strict=False)
    if not inside_root(root, resolved):
        return None
    looks_like_path = "/" in path_text or Path(path_text).suffix or resolved.exists()
    if not looks_like_path:
        return None
    return Reference(
        source=source.relative_to(root).as_posix(),
        raw=candidate,
        relative=resolved.relative_to(root).as_posix(),
        exists=resolved.exists(),
    )


def collect_references(root: Path, paths: list[Path]) -> list[Reference]:
    root = root.resolve()
    unique: dict[tuple[str, str], Reference] = {}
    for source in paths:
        source = source.resolve()
        text = read_text(source)
        for match in LINK_PATTERN.finditer(text):
            item = reference_from(
                root,
                source,
                match.group(1),
                relative_to_source=True,
                allow_spaces=True,
            )
            if item:
                unique[(item.source, item.relative)] = item
        for match in CODE_PATTERN.finditer(text):
            item = reference_from(root, source, match.group(1), relative_to_source=False)
            if item:
                unique[(item.source, item.relative)] = item
    return sorted(unique.values(), key=lambda item: (item.source, item.relative))


def declared_number(text: str, patterns: tuple[str, ...]) -> int:
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.MULTILINE | re.IGNORECASE)
        if match:
            return int(match.group(1))
    return -1


def paths_for(root: Path) -> tuple[list[Path], Path, Path, Path]:
    dashboard = root / "DASHBOARD.md"
    system = root / "00-System"
    memory = system / "Memory-Index.md"
    hot = system / "Hot-Index.md"
    active = system / "Active-Context.md"
    assets = system / "Asset-Index.md"
    report = system / "Index-Health.md"
    required = [dashboard, memory, hot, active, assets]
    missing = [path for path in required if not path.is_file()]
    if missing:
        raise FileNotFoundError("Missing required index file: " + ", ".join(str(path) for path in missing))
    return required, dashboard, memory, report


def inspect_vault(root: Path) -> dict[str, object]:
    root = root.resolve()
    required, dashboard, memory, _report = paths_for(root)
    memory_text = read_text(memory)
    dashboard_text = read_text(dashboard)
    topic_count = len(TOPIC_PATTERN.findall(memory_text))
    memory_declared = declared_number(
        memory_text,
        (r"Topics:\s*(\d+)", r"主题数[：:]\s*(\d+)"),
    )
    dashboard_declared = declared_number(
        dashboard_text,
        (r"^\|\s*Memory-Index topics\s*\|\s*(\d+)\s*\|", r"^\|\s*全局索引主题\s*\|\s*(\d+)\s*\|"),
    )
    references = collect_references(root, required)
    missing = [item for item in references if not item.exists]
    return {
        "topic_count": topic_count,
        "memory_index_declared": memory_declared,
        "dashboard_declared": dashboard_declared,
        "checked_index_paths": len(references),
        "missing_index_paths": len(missing),
        "count_drift": memory_declared != topic_count or dashboard_declared != topic_count,
        "missing": [item.__dict__ for item in missing],
    }


def replace_first(text: str, pattern: str, replacement: str) -> str:
    return re.sub(pattern, replacement, text, count=1, flags=re.MULTILINE | re.IGNORECASE)


def fix_vault(root: Path) -> dict[str, object]:
    root = root.resolve()
    required, dashboard, memory, report = paths_for(root)
    summary = inspect_vault(root)
    today = date.today().isoformat()
    topics = int(summary["topic_count"])
    checked = int(summary["checked_index_paths"])
    missing = int(summary["missing_index_paths"])

    memory_text = read_text(memory)
    memory_text = replace_first(memory_text, r"(Updated:\s*)\d{4}-\d{2}-\d{2}", rf"\g<1>{today}")
    memory_text = replace_first(memory_text, r"(Topics:\s*)\d+", rf"\g<1>{topics}")
    memory.write_text(memory_text, encoding="utf-8")

    dashboard_text = read_text(dashboard)
    dashboard_text = replace_first(dashboard_text, r"(Updated:\s*)\d{4}-\d{2}-\d{2}", rf"\g<1>{today}")
    for label, value in (
        ("Memory-Index topics", topics),
        ("Checked index paths", checked),
        ("Missing index paths", missing),
    ):
        dashboard_text = replace_first(
            dashboard_text,
            rf"^(\|\s*{re.escape(label)}\s*\|)\s*\d+\s*(\|)",
            rf"\g<1> {value} \g<2>",
        )
    dashboard.write_text(dashboard_text, encoding="utf-8")

    missing_lines = [
        f"- `{item['relative']}` (from `{item['source']}`)"
        for item in summary["missing"]
    ] or ["None."]
    report.write_text(
        "\n".join(
            [
                "# Index Health",
                "",
                f"> Generated by `tools/sync_index_status.py` on {today}.",
                "",
                "## Summary",
                "",
                "| Check | Result |",
                "|---|---:|",
                f"| Memory-Index topics | {topics} |",
                f"| Checked index paths | {checked} |",
                f"| Missing index paths | {missing} |",
                "",
                "## Missing paths",
                "",
                *missing_lines,
                "",
                "## Maintenance",
                "",
                "1. Run `python3 tools/sync_index_status.py --fix` after changing an index.",
                "2. Run `python3 tools/sync_index_status.py --check` before committing.",
                "3. The preview remains read-only and never updates this report.",
                "",
            ]
        ),
        encoding="utf-8",
    )
    return inspect_vault(root)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--vault", type=Path, default=Path(__file__).resolve().parents[1])
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true")
    mode.add_argument("--fix", action="store_true")
    args = parser.parse_args()
    try:
        summary = fix_vault(args.vault) if args.fix else inspect_vault(args.vault)
    except (OSError, ValueError) as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False))
        return 2
    summary["mode"] = "fix" if args.fix else "check" if args.check else "inspect"
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if args.check and (summary["count_drift"] or summary["missing_index_paths"]):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
