# Release Process

This guide is for maintainers publishing a versioned public release.

## 1. Prepare

1. Update `VERSION` using Semantic Versioning.
2. Move relevant entries from `Unreleased` into the matching `CHANGELOG.md` version section.
3. Confirm README instructions, privacy language, supported platforms, and demo links are current.
4. Confirm only reviewed first-party documentation media is present.

## 2. Verify

~~~bash
python3 tools/sync_index_status.py --fix
python3 tools/sync_index_status.py --check
python3 tools/vault_doctor.py
python3 -m unittest discover -s tests -v
node --check Knowledge-UI/app.js
sh -n open-preview.sh
git diff --check
~~~

Also require a green GitHub Actions run on the release commit. Test the actual launcher flow on each supported desktop platform when launcher behavior changed.

## 3. Package

From a clean, committed worktree:

~~~bash
version="$(tr -d '\r\n' < VERSION)"
git archive --format=zip --prefix="boujoy-local-markdown-memory-${version}/" --output="boujoy-local-markdown-memory-${version}.zip" HEAD
shasum -a 256 "boujoy-local-markdown-memory-${version}.zip" > "boujoy-local-markdown-memory-${version}.zip.sha256"
unzip -tq "boujoy-local-markdown-memory-${version}.zip"
~~~

Run the checksum command from the directory that contains both files. Never package a personal Vault, `.git`, runtime caches, logs, or generated desktop Apps.

## 4. Publish

1. Create an annotated `vX.Y.Z` tag from the verified commit.
2. Create a GitHub Release using the matching changelog section.
3. Attach the source archive and checksum when distributing a curated archive.
4. Keep documentation-only demo media releases from being marked as the latest product release.
5. Download the published artifact into a clean directory and repeat archive, checksum, and smoke verification.
