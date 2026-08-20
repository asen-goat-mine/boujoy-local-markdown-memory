## Problem

Describe the user-visible problem and why it belongs in this project.

## Changes

- <!-- Summarize each focused change. -->

## Verification

- [ ] `python3 tools/sync_index_status.py --check`
- [ ] `python3 tools/vault_doctor.py`
- [ ] `python3 -m unittest discover -s tests -v`
- [ ] `node --check Knowledge-UI/app.js`
- [ ] Relevant launcher or browser flow tested when behavior changed

## Safety and scope

- [ ] Markdown remains the only long-term data source.
- [ ] The preview remains read-only and local-only.
- [ ] No private Vault content, credentials, personal paths, logs, caches, or unreviewed media are included.
- [ ] Chinese and English README instructions remain aligned where applicable.
- [ ] The diff contains no unrelated formatting or generated files.
