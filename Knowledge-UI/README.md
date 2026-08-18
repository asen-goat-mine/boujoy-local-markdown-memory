# Read-only preview

This folder contains the cross-platform read-only UI for Local Markdown Memory.

## Full mode

Full mode requires Python 3.9+ and uses only the standard library.

- macOS: run `open-preview.command`
- Windows: run `open-preview.cmd`

The server binds to `127.0.0.1`, prefers port `8765`, and falls back to a random local port if another service owns that port. Repeated launches reuse the same service only when its anonymous Vault identifier matches.

The service performs its first Vault scan before reporting ready, refreshes Markdown changes automatically, and exits after ten minutes without a request.

## Browser compatibility mode

When Python is unavailable, open `index.html`, select the Vault folder, and browse through the browser File System Access API. Automatic refresh, local media Range requests, and file reveal may be unavailable.

## macOS desktop entry

Run `install-macos-app.command` to compile an AppleScript App on the local Mac and create a Desktop link. The repository does not include a precompiled App or unnecessary privacy usage descriptions.

## Security boundary

- Read-only Markdown and local media access.
- Vault path containment, including resolved symlinks.
- Single-range media responses.
- Same-origin `POST` for Finder or Explorer reveal.
- CSP, no telemetry, no external assets, and no external API.

The UI folder must remain directly inside the Vault root so `web_preview.pyw` can verify `AGENTS.md` and `00-System` before serving files.

