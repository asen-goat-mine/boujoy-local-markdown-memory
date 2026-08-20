# Architecture and Boundaries

Boujoy Local Markdown Memory is intentionally both a starter Vault and a small read-only application. The numbered folders are user-facing information architecture, not implementation internals.

## Repository layers

| Layer | Paths | Responsibility |
|---|---|---|
| Workspace contract | `AGENTS.md`, `.codebuddy/rules/` | Tells supported agents how to retrieve, save, and protect knowledge. |
| Lightweight context | `DASHBOARD.md`, `00-System/*Index.md`, `00-System/Active-Context.md` | Provides fast startup and targeted retrieval. |
| User content | `01-Inbox` through `90-Archive` | Stores projects, reusable knowledge, content, prompts, business decisions, and archives. |
| Read-only preview | `Knowledge-UI/` | Reads Markdown and local media without writing Vault files. |
| Maintenance | `tools/`, `tests/`, `.github/` | Checks index consistency, public-release safety, and cross-platform behavior. |

## Data flow

~~~text
Conversation or source material
          |
          v
value filter -> deduplicate -> compress -> Markdown card
                                      |
                                      v
                         lightweight indexes/context
                                      |
                                      v
                         targeted agent retrieval
~~~

The preview reads the same Markdown files. It does not maintain a database, vector store, remote cache, or hidden write path.

## Security boundary

Full preview mode binds to `127.0.0.1`, constrains resolved paths to the Vault, uses same-origin checks for file reveal, sends restrictive browser headers, and exposes an anonymous Vault identifier instead of the local path.

These controls reduce accidental exposure; they do not make a public repository suitable for private knowledge. Personal Vaults should remain private or be separated from this public starter.

## Why the Vault remains at the repository root

Moving all numbered folders under `src/` or `vault/` would make the source tree look more conventional, but would weaken the central workflow: download, open the root, and start using it. Engineering code is therefore isolated by responsibility while the user-facing Vault remains the root structure.
