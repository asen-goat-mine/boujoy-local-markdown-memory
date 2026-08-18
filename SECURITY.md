# Security Policy

## Supported version

Only the latest revision on the default branch receives security fixes.

## Reporting

Please use GitHub's private vulnerability reporting feature. Do not include real Vault content, credentials, personal paths, or private documents in a public issue.

## Local preview boundary

- The service listens only on `127.0.0.1`.
- File reads are resolved inside the Vault and reject traversal or symlink escape.
- File reveal uses same-origin `POST` requests.
- The preview is read-only and contains no telemetry.

These controls do not replace operating-system permissions or safe Git practices.

