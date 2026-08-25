#!/usr/bin/env python3
"""Turn the public starter vault into a private, ready-to-use workspace."""

from __future__ import annotations

import argparse
import os
import re
import shutil
import sys
import tempfile
from datetime import date
from pathlib import Path

import sync_index_status


STARTER_FILES = (
    Path("02-Projects/example-project.md"),
    Path("03-Knowledge/example-knowledge-card.md"),
    Path("04-Content/example-content-draft.md"),
    Path("05-Prompts/example-prompt.md"),
)
TOUCHED_FILES = (
    Path("DASHBOARD.md"),
    Path("00-System/Active-Context.md"),
    Path("00-System/Hot-Index.md"),
    Path("00-System/Memory-Index.md"),
    Path("00-System/Index-Health.md"),
)


def clean_label(value: str, fallback: str) -> str:
    value = " ".join(value.strip().split())
    if not value:
        return fallback
    if len(value) > 80 or any(char in value for char in "\r\n\x00[]()"):
        raise ValueError("Names must be one plain-text line without Markdown link characters.")
    return value


def slugify(value: str) -> str:
    pieces: list[str] = []
    pending_dash = False
    for char in value.lower():
        if char.isalnum():
            if pending_dash and pieces:
                pieces.append("-")
            pieces.append(char)
            pending_dash = False
        else:
            pending_dash = True
    slug = "".join(pieces).strip("-")
    return slug[:64] or "my-first-project"


def write_atomic(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".starter.tmp")
    temporary.write_text(text, encoding="utf-8")
    os.replace(temporary, path)


def project_card(project_name: str, today: str) -> str:
    return f"""---
type: project
status: active
visibility: library
updated: {today}
tags: [project]
---

# {project_name}

## One-sentence conclusion

This is the current project. Replace this sentence with the outcome you want to preserve across sessions.

## Use cases

Use this card to keep the real goal, current decisions, verified progress, blockers, and next action together.

## Key decisions

- Markdown remains the source of truth.
- Record completed work only after it is actually verified.

## Reusable method

1. State the desired outcome.
2. Keep only currently valid decisions.
3. Record verified progress and blockers.
4. End each session with one concrete next action.

## Next action

Capture the first real decision or task for this project.

## Related tags

`#project`

## Source type

Created by the local starter setup.

## Updated

{today}
"""


def dashboard(vault_name: str, project_name: str, project_path: str, today: str) -> str:
    return f"""# {vault_name}

> Start here. Your Markdown files are the only long-term source of truth.

**Updated: {today} | Mode: Quiet Mode | Source: local Markdown**

## Current focus

- Project: [{project_name}]({project_path})
- State: personal Vault is ready
- Next action: capture the first real project decision

## Start directly

| Goal | Ask Codex or WorkBuddy |
|---|---|
| Capture a decision | “Compress this decision into the current project card.” |
| Save a method | “Check for duplicates, then save this as reusable knowledge.” |
| Continue work | “Use the Vault to continue the current project.” |
| Wrap up | “Record the real state and the next continuation point.” |
| Check health | “Run the read-only Vault Doctor.” |

## Quick links

- [Current project]({project_path})
- [Active context](00-System/Active-Context.md)
- [Hot index](00-System/Hot-Index.md)
- [Memory index](00-System/Memory-Index.md)
- [Memory queue](00-System/Memory-Queue.md)
- [Asset index](00-System/Asset-Index.md)
- [Inbox](01-Inbox/_Capture.md)
- [Preview guide](Knowledge-UI/README.md)

## System status

| Item | Current value |
|---|---:|
| Memory-Index topics | 1 |
| Checked index paths | 0 |
| Missing index paths | 0 |
| Memory queue | 0 |

## Boundaries

- Markdown is the only data source.
- The preview is read-only and has no telemetry.
- Private Vaults should not be pushed to a public repository.
"""


def active_context(project_name: str, today: str) -> str:
    return f"""# Active Context

> This file contains only the current continuation point.

**Updated: {today}**

## Current project

{project_name}

## Completed

- The starter Vault was initialized locally.
- Synthetic examples were moved to `90-Archive/Starter-Examples/`.

## Current decisions

- Markdown is the only source of truth.
- The preview remains read-only.
- Project state must reflect verified work rather than optimistic plans.

## Next actions

1. Capture the first real decision or task.
2. Ask the Agent to update this context when the project state changes.

## Blockers

None.
"""


def hot_index(project_name: str, project_path: str, today: str) -> str:
    return f"""# Hot Index

> Keep only the current project, frequently reused topics, and stable working preferences.

**Updated: {today}**

## Current project

- [{project_name}](../{project_path})

## Frequent topics

- None yet.

## Stable system preferences

- Local Markdown, one source of truth, Quiet Mode, and a read-only preview.
"""


def memory_index(project_name: str, project_path: str, today: str) -> str:
    triggers = f"{project_name.lower()}, current project, next action"
    return f"""# Memory Index

> Global topic map containing only paths, retrieval triggers, short conclusions, and update dates.

**Updated: {today} | Topics: 1**

## Projects

### {project_name}

- Path: `{project_path}`
- Triggers: {triggers}
- Conclusion: the current project card preserves the real goal, decisions, verified progress, blockers, and next action.

## Knowledge

No durable knowledge cards yet.

## Content

No content cards yet.

## Prompts

No custom prompt cards yet.
"""


def initialize(root: Path, vault_name: str, project_name: str, *, dry_run: bool = False) -> Path:
    root = root.resolve()
    memory_index_path = root / "00-System/Memory-Index.md"
    if not memory_index_path.is_file():
        raise RuntimeError("This does not look like a Local Markdown Memory Vault.")
    if "Example project" not in memory_index_path.read_text(encoding="utf-8"):
        raise RuntimeError("This Vault is already initialized. No files were changed.")
    required = [root / path for path in STARTER_FILES + TOUCHED_FILES[:-1]]
    missing = [path.relative_to(root).as_posix() for path in required if not path.is_file()]
    if missing:
        raise RuntimeError(
            "This does not look like an untouched starter Vault. Missing: " + ", ".join(missing)
        )

    today = date.today().isoformat()
    project_relative = Path("02-Projects") / f"{slugify(project_name)}.md"
    project_path = root / project_relative
    if project_path.exists() and project_path not in [root / path for path in STARTER_FILES]:
        raise RuntimeError(f"Project card already exists: {project_relative.as_posix()}")
    if dry_run:
        return project_relative

    archive_root = root / "90-Archive/Starter-Examples"
    archive_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="local-memory-setup-") as backup_name:
        backup = Path(backup_name)
        for relative in TOUCHED_FILES:
            source = root / relative
            if source.exists():
                target = backup / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)
        moved: list[tuple[Path, Path]] = []
        try:
            for relative in STARTER_FILES:
                source = root / relative
                destination = archive_root / source.name
                if destination.exists():
                    raise RuntimeError(f"Starter archive already contains: {destination.name}")
                shutil.move(str(source), str(destination))
                moved.append((source, destination))

            write_atomic(project_path, project_card(project_name, today))
            project_posix = project_relative.as_posix()
            write_atomic(root / "DASHBOARD.md", dashboard(vault_name, project_name, project_posix, today))
            write_atomic(root / "00-System/Active-Context.md", active_context(project_name, today))
            write_atomic(root / "00-System/Hot-Index.md", hot_index(project_name, project_posix, today))
            write_atomic(root / "00-System/Memory-Index.md", memory_index(project_name, project_posix, today))
            summary = sync_index_status.fix_vault(root)
            if summary["count_drift"] or summary["missing_index_paths"]:
                raise RuntimeError("Index verification failed after initialization.")
        except Exception:
            if project_path.exists():
                project_path.unlink()
            for source, destination in reversed(moved):
                if destination.exists():
                    source.parent.mkdir(parents=True, exist_ok=True)
                    shutil.move(str(destination), str(source))
            for relative in TOUCHED_FILES:
                saved = backup / relative
                if saved.exists():
                    shutil.copy2(saved, root / relative)
            raise
    return project_relative


def main() -> int:
    parser = argparse.ArgumentParser(description="Initialize a personal Local Markdown Memory Vault.")
    parser.add_argument("--vault", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--name", help="Dashboard title")
    parser.add_argument("--project", help="First project name")
    parser.add_argument("--quick", action="store_true", help="Use safe defaults without prompts")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    try:
        if args.quick:
            vault_name = clean_label(args.name or "My Local Memory", "My Local Memory")
            project_name = clean_label(args.project or "My first project", "My first project")
        else:
            if not sys.stdin.isatty() and (not args.name or not args.project):
                raise ValueError("Pass --name and --project, or use --quick in a non-interactive terminal.")
            vault_name = clean_label(args.name or input("Vault name [My Local Memory]: "), "My Local Memory")
            project_name = clean_label(args.project or input("First project [My first project]: "), "My first project")
        relative = initialize(args.vault, vault_name, project_name, dry_run=args.dry_run)
    except (OSError, RuntimeError, ValueError) as error:
        print(f"Setup failed: {error}", file=sys.stderr)
        return 1
    if args.dry_run:
        print(f"Dry run passed. Project card would be: {relative.as_posix()}")
    else:
        print(f"Vault is ready. Current project: {relative.as_posix()}")
        print("Synthetic examples were preserved in 90-Archive/Starter-Examples/.")
        print("Open the preview, then open this folder in Codex, WorkBuddy, or Obsidian.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
