## Summary

- 

## Linked issues

Closes #

## Branch policy

- [ ] This PR targets the correct base branch.
- [ ] If this targets `main`, it keeps `main` viewer-only and does not introduce edit/save/write flows.
- [ ] If this is editing work, it targets `feat/markdown-editing` or a branch stacked on top of it.
- [ ] I checked the relevant policy docs:
  - [Branch Policy](../docs/branch-policy.md)
  - [Document Tree PR Status](../docs/document-tree-pr-status.md)

## Validation

Run the relevant checks and mark what passed:

- [ ] `pnpm test`
- [ ] `pnpm typecheck`
- [ ] `pnpm build`
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] `cargo check --manifest-path src-tauri/Cargo.toml`
- [ ] Not applicable; this is a docs-only or metadata-only change.

Notes:

- 
