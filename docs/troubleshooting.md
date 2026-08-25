# Troubleshooting

## The preview does not start

Check the Python version:

~~~bash
python3 --version
~~~

Full mode requires Python 3.9+. If it is unavailable, open `Knowledge-UI/index.html` and use browser compatibility mode.

On macOS, the launcher writes a private log under the system temporary directory and prints its location when startup fails. Do not attach that log publicly without checking it for local paths.

## Port 8765 is already in use

Normal desktop launch automatically falls back to a random loopback port when another service owns port 8765. `--server-only` mode is strict and reports the conflict instead.

## The browser shows old content

Full mode refreshes after Markdown changes. If a refresh was missed, reload the page. Browser compatibility mode does not provide the same automatic-refresh behavior.

## A card is missing from an index

Use `Repair-Vault.command` on macOS or `Repair-Vault.cmd` on Windows. The repair only synchronizes index metadata and the generated health report.

The equivalent commands are:

Run:

~~~bash
python3 tools/sync_index_status.py --fix
python3 tools/sync_index_status.py --check
python3 tools/vault_doctor.py
~~~

The preview never repairs indexes because it is intentionally read-only.

## Start Here says the Vault is already initialized

This is a safety guard. The initializer only runs against the untouched public starter and will not overwrite an existing personal Vault. Continue using the existing Vault; use the repair entry only if an index check fails.

## A local file cannot be opened or revealed

The preview rejects paths outside the Vault, including traversal and resolved symlink escapes. Move the intended asset inside the Vault, register it in `00-System/Asset-Index.md`, and use a relative link.

## Windows opens the browser compatibility mode

The launcher could not find Python 3.9+ through its supported candidates. Install a current Python release or continue in compatibility mode. No pip packages are required.

## Still blocked

Read [SUPPORT.md](../SUPPORT.md) before opening an issue. Use synthetic sample content and never publish a private Vault or credentials.
