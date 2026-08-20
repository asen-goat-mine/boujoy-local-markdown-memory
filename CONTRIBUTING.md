# Contributing

Thank you for helping improve Boujoy Local Markdown Memory. Small, focused pull requests are easiest to review.

## Project boundaries

Contributions must preserve these guarantees:

- Markdown remains the only long-term data source.
- The preview remains read-only and binds only to the local loopback interface.
- No database, telemetry, bundled Skill, private Vault content, or external knowledge API is introduced.
- Runtime code does not load third-party scripts, fonts, or services.
- Reviewed first-party documentation assets are allowed under `docs/assets`; private or unlicensed media is not.

If a proposal changes one of these boundaries, open a feature request before implementing it.

## Development setup

Python 3.9+ and Node.js are sufficient; the project has no install step.

~~~bash
python3 tools/sync_index_status.py --check
python3 tools/vault_doctor.py
python3 -m unittest discover -s tests -v
node --check Knowledge-UI/app.js
~~~

On macOS or Linux, also validate launcher syntax:

~~~bash
sh -n open-preview.sh
zsh -n open-preview.command Knowledge-UI/open-preview.command Knowledge-UI/install-macos-app.command
~~~

## Pull requests

Before opening a pull request:

1. Explain the user-visible problem and the chosen scope.
2. Add or update tests when behavior changes.
3. Keep the Chinese and English README files aligned when shared instructions change.
4. Run the checks above and confirm `git diff --check` is clean.
5. Confirm no credentials, personal paths, private Vault content, logs, caches, runtime files, or unreviewed media were added.

For help deciding whether an idea belongs in the project, see [SUPPORT.md](SUPPORT.md).
