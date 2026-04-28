# Security Policy

MarkMini is a local-first desktop Markdown viewer. Security-sensitive reports are especially important when they involve filesystem access, path resolution, symlinks, process execution, dependency updates, or packaged desktop builds.

## Supported scope

The current supported line is the viewer-focused `main` branch.

Security reports are in scope when they affect:

- local Markdown file discovery or reading
- root-directory boundary enforcement
- symlink handling
- filesystem watcher behavior
- Tauri command input validation
- dependency or build-chain safety
- packaged desktop app behavior

Editing/write flows are being handled separately on the `feat/markdown-editing` branch. If a report involves editing behavior, mention that explicitly so it can be triaged against the correct branch.

## Reporting a vulnerability

Please do not publish exploit details in a public GitHub issue before the report has been triaged.

If private vulnerability reporting is available in this repository, use GitHub's private vulnerability reporting flow. Otherwise, contact a repository maintainer directly and include enough detail to reproduce the issue safely.

Helpful details include:

- affected branch or commit
- operating system and app/runtime version
- minimal reproduction files or directory layout
- exact command used to launch MarkMini
- expected behavior
- actual behavior
- whether symlinks, hidden directories, generated files, or external paths are involved
- any relevant logs or screenshots

## Public issues

For non-sensitive bugs, use the bug report issue template. If you are unsure whether a report is security-sensitive, avoid posting exploit details publicly and start with a high-level description.

## Validation expectations

Security-related fixes should include focused tests when practical. Relevant checks usually include:

```bash
pnpm test
pnpm typecheck
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```
