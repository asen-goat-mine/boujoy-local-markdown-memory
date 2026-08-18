# Local Markdown Memory

A local-first Markdown knowledge vault for Codex and WorkBuddy. It combines lightweight indexes, value filtering, deduplication rules, and a read-only desktop preview without adding a database or cloud knowledge service.

The public repository contains only code, rules, starter indexes, and four removable synthetic examples. It contains no author knowledge, projects, preferences, logs, media, prompts, or Skills.

## Quick start

1. Clone or download this repository.
2. Open the repository root in Codex, or set it as the WorkBuddy workspace.
3. On macOS, run `./open-preview.command`. On Windows, double-click `open-preview.cmd`.
4. Add temporary material to `01-Inbox/_Capture.md` or ask the agent to create a project or knowledge card.

Full preview mode requires Python 3.9+ and uses only the standard library. The fallback browser mode can still browse a selected Vault, with reduced media and auto-refresh capabilities.

Data stays in Markdown. The preview binds to `127.0.0.1`, contains no telemetry, and does not upload Vault content. Codex, WorkBuddy, and Git hosting are separate products with their own data policies.

See [README.md](README.md), [PRIVACY.md](PRIVACY.md), and [SECURITY.md](SECURITY.md).

Licensed under the [MIT License](LICENSE).
