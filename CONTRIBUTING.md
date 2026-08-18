# Contributing

Contributions are welcome when they preserve the core boundaries: Markdown remains the only data source, the preview remains read-only, and no database, telemetry, personal data, bundled Skill, or external knowledge API is introduced.

Before opening a pull request:

1. Run `python3 tools/vault_doctor.py`.
2. Run `python3 tools/sync_index_status.py --check`.
3. Run `python3 -m unittest discover -s tests`.
4. Confirm `git diff --check` is clean.
5. Do not commit working Vault content, logs, media, cache, runtime files, or absolute personal paths.

