# Getting Started

## Requirements

- Any text editor for the Markdown Vault.
- Python 3.9+ for the full read-only preview.
- A modern Chromium-based browser for browser compatibility mode.
- Codex or WorkBuddy is optional; the Vault remains ordinary Markdown without either tool.

No pip packages, npm packages, database, account, or external API are required.

## Create your Vault

For a new personal Vault, use GitHub's **Use this template** action when enabled, or download a release/source archive. Keep the resulting repository private if it will contain personal or company knowledge.

Run `Start-Here.command` on macOS, `Start-Here.cmd` on Windows, or `./start-here.sh` on Linux. Enter a Vault name and first project name. The initializer preserves synthetic examples in `90-Archive/Starter-Examples/`, creates the real project card, updates the lightweight indexes, and verifies the result.

Open the initialized Vault root as the workspace. `AGENTS.md`, `00-System/Boot.md`, `00-System/Active-Context.md`, and `00-System/Hot-Index.md` provide the startup context. Reuse them within the same task; search the Memory Index only when needed. Dashboard remains the human browsing entry.

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

The Start Here initializer performs these steps automatically. For a manual setup:

1. Replace or delete the synthetic example cards.
2. Update `DASHBOARD.md` and `00-System/Active-Context.md` with real state.
3. Add topics to `00-System/Memory-Index.md` only after creating durable cards.
4. Run the index synchronization commands after index changes:

~~~bash
python3 tools/sync_index_status.py --fix
python3 tools/sync_index_status.py --check
~~~

You can also double-click `Check-Vault.command` / `Repair-Vault.command` on macOS or the matching `.cmd` files on Windows.

## Keep private work private

Do not add credentials, identity documents, customer data, private transcripts, or unlicensed media. Before pushing, run `python3 tools/vault_doctor.py` and review the full Git diff.
