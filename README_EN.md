<div align="center">

# Boujoy Local Markdown Memory

## Do not leave your memory trapped in chat history. Write it back into Markdown you own.

A local-first knowledge vault for Codex and WorkBuddy. Projects, decisions, methods, and prompts stay as ordinary files; lightweight indexes help an agent read only the context that actually matters.

**Not another cloud drive. Not an opaque memory plug-in. A local work memory you can open, move, audit, and reuse for years.**

[简体中文](README.md) · [Watch the full demo](https://github.com/asen-goat-mine/boujoy-local-markdown-memory/releases/download/demo-2026-08-19/Boujoy-Local-Markdown-Memory-Demo.mp4)

</div>

<p align="center">
  <a href="https://github.com/asen-goat-mine/boujoy-local-markdown-memory/actions/workflows/ci.yml"><img src="https://github.com/asen-goat-mine/boujoy-local-markdown-memory/actions/workflows/ci.yml/badge.svg" alt="Cross-platform checks"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-0f766e.svg" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/Python-3.9%2B-3776AB.svg" alt="Python 3.9+"></p>

<p align="center">
  <a href="https://github.com/asen-goat-mine/boujoy-local-markdown-memory/releases/download/demo-2026-08-19/Boujoy-Local-Markdown-Memory-Demo.mp4">
    <img src="docs/assets/knowledge-memory-demo.gif" alt="Animated Local Markdown Memory UI demo. Click for the full video." width="900">
  </a>
</p>

<p align="center"><sub>The animation plays in this README. Click it to open the complete 23-second MP4.</sub></p>

## Which project should you use?

| What you need | Choose |
| --- | --- |
| A lightweight, transparent Markdown memory template that you maintain yourself | **This project: Local Markdown Memory** |
| Automatic conversation observation, personal understanding, and visual memory management | [Bok](https://github.com/asen-goat-mine/bok) |
| A desktop client with a full conversation UI and Agent execution environment | [Boujoy Harness](https://github.com/asen-goat-mine/boujoy-harness) |

All three can point at the same Markdown vault, but they solve different problems. You do not need to install all of them.

## Why this exists

Chat histories grow, projects become complicated, models change, and tools come and go. A well-written local Markdown project card, knowledge card, or prompt is still readable by you, Codex, WorkBuddy, and any text editor years later.

This project is not trying to make an AI remember everything. It establishes a durable loop:

~~~text
Raw conversation / temporary material
        │
        ▼
Value filter → deduplicate → compress into a knowledge card → write Markdown
        │                                              │
        └────────────── indexes and active context ───┘
                                                       │
                                                       ▼
                                     Agent reads relevant material on demand
~~~

Long-term context is therefore not locked inside one chat window, account, or model invocation.

## Core principles

| Principle | What it means |
| --- | --- |
| Markdown is the source of truth | A database, vector index, or chat cache cannot replace the original knowledge files you own. |
| Index first, read on demand | Start with Dashboard and lightweight indexes, then read only one to three relevant cards after a topic match. |
| Compress before saving | Turn a long discussion into conclusions, context, decisions, methods, and next actions instead of dumping transcripts into the vault. |
| Deduplicate before writing | Update a similar existing card where appropriate. Mark superseded or changed conclusions instead of creating conflicting memories. |
| Local-first and auditable | Rules, indexes, and cards are all directly readable. No database, cloud knowledge service, or external API is required. |
| The UI is read-only | The preview helps you browse, search, read, and inspect health; it does not silently modify Markdown. |

> The public repository contains rules, index entry points, removable synthetic examples, and one reviewed product-UI demo animation. It contains no author projects, knowledge, prompts, preferences, logs, private media, Skills, or credentials.

## Three-minute start

### 1. Get the repository

~~~bash
git clone https://github.com/asen-goat-mine/boujoy-local-markdown-memory.git
cd boujoy-local-markdown-memory
~~~

Downloading and extracting the ZIP also works.

For long-term personal use, enable GitHub's Template Repository setting and create an independent repository with **Use this template** instead of committing private knowledge to a public fork. Personal and company Vaults should be private.

### 2. Turn it into your own Vault

Run the first-time entry point for your platform:

- macOS: double-click `Start-Here.command`
- Windows: double-click `Start-Here.cmd`
- Linux: run `./start-here.sh`

Enter a Vault name and the first project name. The initializer moves synthetic examples into `90-Archive/Starter-Examples/`, creates a real project card, updates Dashboard, active context, and indexes, verifies the result, then opens the preview. It does not delete the examples or contact an external service.

To keep the untouched starter template, skip initialization and use the preview launcher below.

### 3. Open the vault as a workspace

- **Codex:** open the repository root. AGENTS.md defines startup reading, retrieval, saving, deduplication, and security boundaries.
- **WorkBuddy:** set the repository root as the workspace. Both tools read the same vault; no second memory store is needed.
- **Any editor:** VS Code, Obsidian, Typora, Finder, and Explorer can all read the same ordinary Markdown files.

### 4. Open the read-only preview

Full mode requires only Python 3.9+ from the standard library. No pip, npm, database, or external API is needed:

~~~bash
# macOS
./open-preview.command
~~~

On Windows, double-click open-preview.cmd. The preview serves only on 127.0.0.1 and prefers local port 8765.

On Linux, run:

~~~bash
./open-preview.sh
~~~

Without Python, open Knowledge-UI/index.html and select a Vault folder to use browser compatibility mode. It can still browse Markdown, but automatic refresh, local-media range serving, and file reveal are reduced.

On macOS, Knowledge-UI/install-macos-app.command can build a local Desktop app entry. No prebuilt app is committed to this repository.

### Support matrix

| Platform | Full preview | Launcher | CI coverage |
| --- | --- | --- | --- |
| macOS | Python 3.9+ | `open-preview.command` | Python 3.9 / 3.13 |
| Windows | Python 3.9+ | `open-preview.cmd` | Python 3.9 / 3.13 |
| Linux | Python 3.9+ | `open-preview.sh` | Python 3.9 / 3.13 |
| Compatible browser | Reduced mode, no Python | `Knowledge-UI/index.html` | Static contract checks |

## Use it with Codex and WorkBuddy

This vault is not driven by a keyword trigger. Its behavior is defined by AGENTS.md, startup indexes, active project context, and targeted follow-up reads.

Useful prompts include:

- “Compress this decision into a project card, after checking for similar topics.”
- “Based on my knowledge vault, what is the most important next action for the current project?”
- “Turn this method into a reusable knowledge card with scope and boundaries.”
- “Write this in my existing AI explainer style, but do not invent history or preferences.”
- “Close out this phase and record only real completed work, blockers, and next steps.”

A healthy agent loop is:

1. **Start:** read AGENTS.md, Dashboard, and 00-System/Boot.md first; then read Hot-Index, Memory-Index, and Active-Context as the lightweight startup index.
2. **Match:** read only the relevant project or knowledge cards instead of scanning the entire vault.
3. **Work:** write the output into the right project, knowledge, content, prompt, or business directory.
4. **Close:** record real progress and next steps. Do not fabricate tests, deliveries, or save records.

## The folder structure is the information architecture

| Path | Purpose |
| --- | --- |
| 00-System | Startup, retrieval, value filtering, deduplication, security, indexes, and checkpoint rules. |
| 01-Inbox | Unprocessed material and the temporary capture entry point. |
| 02-Projects | Projects, products, systems, decisions, and progress. |
| 03-Knowledge | Reusable methods, technical knowledge, and judgments. |
| 04-Content | Articles, scripts, ideas, and delivery drafts. |
| 05-Prompts | Reusable prompts and style instructions. |
| 06-Business | Business, operations, customer, and monetization judgments. |
| 90-Archive | Superseded, low-frequency, or retired material. |
| Knowledge-UI | Cross-platform, local, read-only preview. |
| tools | Dependency-free index and health checks. |

More detail lives in the [documentation hub](docs/README.md):

- [Getting started](docs/getting-started.md)
- [Architecture and boundaries](docs/architecture.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Release process](docs/releasing.md)

## What makes a useful card

Do not paste an entire chat. A high-value card should answer:

1. **One-line conclusion:** what do we know now?
2. **When it applies:** in which situations can it be reused?
3. **Key decision:** why this choice rather than an alternative?
4. **Reusable method:** what steps can be followed next time?
5. **Next action:** what still needs validation, who owns it, and what is next?
6. **Tags, source type, and update date:** how do we retrieve and assess it later?

Start with 00-System/Knowledge-Card-Template.md and the example cards in the directory tree. The examples are synthetic and safe to remove.

## What the preview UI does

Knowledge-UI is a browser and desktop entry point, not a second data system. It reads the current vault and can:

- Search titles, tags, and body text.
- Browse projects, knowledge, content, prompts, and all Markdown.
- Render Markdown, internal links, tasks, tables, code, and local media.
- Surface current work, next actions, recent updates, and relationship views.
- Show content pipelines and a read-only health center.
- Detect Markdown additions, edits, and deletions automatically.
- Reveal files in Finder or Explorer only within the selected vault.

It does not upload your vault, create a remote database, or write knowledge cards on your behalf.

## Privacy and public-repository boundary

- “Local-first” describes the vault and preview data flow; it does not mean Codex, WorkBuddy, or Git hosting are offline products.
- Keep a private working vault private, or separate the public system template from personal work material.
- Do not put passwords, API keys, client data, identity documents, payment data, or unauthorized transcripts in knowledge cards.
- Markdown tracked by Git can be pushed to a remote. Review sensitive content before every commit.
- The preview binds to loopback only and includes no telemetry or external assets.

Read [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md) for more detail.

## What this is not

Boujoy Local Markdown Memory is not a cloud-sync service, database, vector-search engine, Markdown editor, or required always-on MCP server.

It is first an open Markdown convention. A future optional read-only MCP adapter can give more agents a standard tool interface, but MCP will not replace Markdown or become the only source of truth.

## Maintenance and verification

For maintenance without terminal commands, double-click:

- macOS: `Check-Vault.command` or `Repair-Vault.command`
- Windows: `Check-Vault.cmd` or `Repair-Vault.cmd`

The check entry is read-only. Repair only synchronizes indexes and the health report; it does not rewrite knowledge-card content.

~~~bash
python3 tools/vault_doctor.py
python3 tools/sync_index_status.py --check
python3 -m unittest discover -s tests
~~~

These commands check indexes, paths, security boundaries, and preview contracts. GitHub Actions also run static and unit checks on Linux, macOS, and Windows.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before contributing. See [SUPPORT.md](SUPPORT.md) for help and [CHANGELOG.md](CHANGELOG.md) for version history.

## FAQ

### Does it send the entire vault to the model?

It should not. The intended flow reads lightweight indexes first and then a small number of relevant cards. When no basis exists, the agent should say so rather than inventing history.

### Can I use it without Python?

Yes. Browser compatibility mode lets you select a vault and browse Markdown. Python 3.9+ is needed for full automatic-refresh and local-service features.

### Can I use it with Obsidian?

Yes. Obsidian is one possible editor. The system uses regular files and relative links and is not tied to one application.

### Can it use MCP?

Yes, as an optional read-only interface in the future. The current core does not depend on MCP; keeping Markdown, rules, and indexes usable first is the more stable cross-agent design.

## License

Released under the [MIT License](LICENSE). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for notices.
