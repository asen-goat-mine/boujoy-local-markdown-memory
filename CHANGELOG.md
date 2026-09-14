# Changelog

All notable changes to Boujoy Local Markdown Memory are recorded here. The project follows [Semantic Versioning](https://semver.org/), and entries are grouped using the structure from [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

## [0.2.0] - 2026-09-14

### Added

- First-run `Start-Here` launchers for macOS, Windows, and Linux.
- A dependency-free initializer that archives synthetic examples, creates the first real project, updates lightweight indexes, and verifies the result.
- Double-click Vault check and index-repair entry points for macOS and Windows.
- Linux preview launcher and Linux CI coverage.
- Repository version file, documentation hub, release guide, support guide, and community templates.
- Repository-contract tests for versioning, launchers, documentation links, and public media policy.

### Changed

- Startup reads four entries once per task; Dashboard and the global Memory Index are read on demand.
- Preview caches decoded Markdown per file and coalesces concurrent refreshes. Content hashes and periodic byte validation detect same-size edits with preserved timestamps (within 30 seconds plus the next refresh).
- Temporarily unreadable files are retried, removed files are evicted, and Markdown symlinks are excluded from indexing.
- Updated GitHub Actions to their current Node.js 24-based major versions.
- Expanded CI to cover Python 3.9 and 3.13 on Linux, macOS, and Windows.
- Clarified the boundary between reviewed public demo media and private Vault media.

## [0.1.0] - 2026-08-18

### Added

- Local Markdown Vault conventions, lightweight indexes, knowledge-card templates, and checkpoint rules.
- Dependency-free read-only preview for Markdown, local media, search, health status, and relationship views.
- macOS and Windows launchers, local security controls, release-safety tests, and bilingual README files.
