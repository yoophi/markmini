# Contributing to MarkMini

Thanks for helping improve MarkMini. This project currently keeps a strict boundary between the stable viewer and future editing/write flows.

## Choose the right branch

Before opening an issue or PR, decide which workflow area the change belongs to:

- **Viewer-only work** targets `main`.
  - Examples: reading Markdown, document navigation, search/filter/sort, rendering, filesystem watching, validation, docs, and accessibility.
  - Do not add edit/save/write flows to `main`.
- **Editing/write work** targets `feat/markdown-editing` or a branch stacked on top of it.
  - Examples: editor mode, save commands, dirty draft state, create/rename/delete write flows, and unsaved-change guards.

Relevant docs:

- [Branch Policy](./docs/branch-policy.md)
- [Document Tree PR Status](./docs/document-tree-pr-status.md)
- Markdown Editing Consolidation Checklist: tracked in [#131](https://github.com/yoophi/markmini/issues/131) / [#132](https://github.com/yoophi/markmini/pull/132) until the checklist lands on `main`.

## Open an issue first

Use the GitHub issue templates when possible:

- Bug reports should include scope, reproduction steps, expected behavior, actual behavior, and validation context.
- Feature requests should include scope, motivation, proposed behavior, acceptance criteria, and suggested validation.

If the scope is unclear, choose `Unsure` and describe the uncertainty.

## Local setup

```bash
pnpm install
pnpm tauri dev
```

To run a specific path in development:

```bash
pnpm tauri dev -- .
pnpm tauri dev -- ./README.md
```

## Validation

Run the checks that match the files you changed. For a normal code PR, run the full local sequence:

```bash
pnpm test
pnpm typecheck
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

When aggregate scripts are available on your branch, you can use:

```bash
pnpm check
pnpm check:tauri
```

Docs-only and metadata-only changes may use a lighter check such as:

```bash
pnpm typecheck
```

Always list the commands you ran in the PR description.

## Pull requests

Use the pull request template and include:

- a short summary of the change
- linked issues, preferably with `Closes #...`
- the intended base branch
- confirmation that `main` remains viewer-only when targeting `main`
- validation commands and results

Small, focused PRs are preferred. If a change touches both viewer and editing concerns, split it into separate PRs when practical.
