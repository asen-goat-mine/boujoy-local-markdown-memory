# Getting Started

## Requirements

- Any text editor for the Markdown Vault.
- Python 3.9+ for the full read-only preview.
- A modern Chromium-based browser for browser compatibility mode.
- Codex or WorkBuddy is optional; the Vault remains ordinary Markdown without either tool.

No pip packages, npm packages, database, account, or external API are required.

## Create your Vault

For a new personal Vault, use GitHub's **Use this template** action when enabled, or download a release/source archive. Keep the resulting repository private if it will contain personal or company knowledge.

Open the new Vault root as the workspace. `AGENTS.md`, `DASHBOARD.md`, and the lightweight indexes provide the startup context.

## Start the preview

### macOS

~~~bash
./open-preview.command
~~~

### Windows

Double-click `open-preview.cmd` or run it from Command Prompt.

### Linux

~~~bash
./open-preview.sh
~~~

If Python is unavailable, open `Knowledge-UI/index.html` and select the Vault folder. This browser compatibility mode has reduced automatic-refresh, local-media Range, and file-reveal support.

## Replace the starter content

1. Replace or delete the synthetic example cards.
2. Update `DASHBOARD.md` and `00-System/Active-Context.md` with real state.
3. Add topics to `00-System/Memory-Index.md` only after creating durable cards.
4. Run the index synchronization commands after index changes:

~~~bash
python3 tools/sync_index_status.py --fix
python3 tools/sync_index_status.py --check
~~~

## Keep private work private

Do not add credentials, identity documents, customer data, private transcripts, or unlicensed media. Before pushing, run `python3 tools/vault_doctor.py` and review the full Git diff.
