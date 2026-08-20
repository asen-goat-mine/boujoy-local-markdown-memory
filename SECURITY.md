# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| Latest release | Yes |
| Default branch | Yes |
| Older revisions | No |

## Report a vulnerability

Use GitHub's private vulnerability reporting feature. Do not open a public issue and do not include real Vault content, credentials, personal paths, or private documents.

Include the affected version, platform, reproduction steps using synthetic data, expected impact, and any proposed mitigation. The maintainer will acknowledge a complete report when it is reviewed; no fixed response or remediation deadline is promised.

## Local preview boundary

- The service listens only on `127.0.0.1`.
- File reads are resolved inside the Vault and reject traversal or symlink escape.
- File reveal uses same-origin `POST` requests.
- The preview is read-only and contains no telemetry.

These controls do not replace operating-system permissions or safe Git practices.

## Scope

Security reports are especially useful for path traversal, symlink escape, unintended writes, cross-origin access, local-service exposure, unsafe file reveal, or leakage of private Vault data. General support requests belong in [SUPPORT.md](SUPPORT.md).
