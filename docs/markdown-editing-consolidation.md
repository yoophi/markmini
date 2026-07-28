# Markdown Editing Consolidation Checklist

`main` is currently a viewer-only branch. Editing and write-related work should be consolidated onto the dedicated long-running editing line instead of being merged directly into `main`.

Related policy:

- [Branch policy](./branch-policy.md)
- [Issue #112 — chore: consolidate markdown editing PRs onto dedicated editing branch](https://github.com/yoophi/markmini/issues/112)

## Target branch

Use the dedicated editing branch as the base for future editing work:

- [`yoophi-a:feat/markdown-editing`](https://github.com/yoophi-a/markmini/tree/feat/markdown-editing)

## Current conflicting editing PRs targeting `main`

These PRs are currently open against `main` and conflict with the viewer-only baseline. Do not merge them into `main` as-is.

| PR | Title | Head branch | Current base | Status | Recommended disposition |
| --- | --- | --- | --- | --- | --- |
| [#26](https://github.com/yoophi/markmini/pull/26) | feat: replace file action prompts with in-app dialogs | `feat/issue-25-file-action-dialogs` | `main` | DIRTY | Cherry-pick/rebuild useful dialog UI onto `feat/markdown-editing`, then close or retarget. |
| [#28](https://github.com/yoophi/markmini/pull/28) | feat: replace unsaved-change confirm with in-app dialog | `feat/issue-27-unsaved-change-dialog` | `main` | DIRTY | Rebuild on editing branch with dirty-state tests. |
| [#30](https://github.com/yoophi/markmini/pull/30) | feat: add inline success feedback for file actions | `feat/issue-29-inline-success-feedback` | `main` | DIRTY | Rebuild on editing branch if file actions remain in scope. |
| [#32](https://github.com/yoophi/markmini/pull/32) | feat: guard dirty drafts on window close | `feat/issue-31-window-close-dirty-guard` | `main` | DIRTY | Rebuild on editing branch with explicit unload/window-close behavior tests. |
| [#34](https://github.com/yoophi/markmini/pull/34) | feat: add save-and-continue unsaved dialog action | `feat/issue-33-save-and-continue-unsaved-dialog` | `main` | DIRTY | Fold into rebuilt unsaved-change dialog stack. |
| [#36](https://github.com/yoophi/markmini/pull/36) | chore: refine unsaved dialog copy by action | `feat/issue-35-refine-unsaved-copy` | `main` | DIRTY | Fold into rebuilt unsaved-change dialog stack. |
| [#38](https://github.com/yoophi/markmini/pull/38) | feat: guard delete action with unsaved dialog | `feat/issue-37-delete-unsaved-guard` | `main` | DIRTY | Rebuild after delete flow exists on editing branch. |
| [#40](https://github.com/yoophi/markmini/pull/40) | refactor: extract unsaved change guard hook | `refactor/issue-39-unsaved-guard-hook` | `main` | DIRTY | Rebuild as a small refactor PR on editing branch before feature PRs. |
| [#42](https://github.com/yoophi/markmini/pull/42) | test: cover document safety store flows | `test/issue-41-document-safety-flows` | `main` | DIRTY | Rebuild tests on editing branch after store shape is finalized. |
| [#44](https://github.com/yoophi/markmini/pull/44) | docs: align README with file action flows | `docs/issue-43-align-readme-file-actions` | `main` | DIRTY | Rebuild docs only after editing branch behavior is current. |
| [#46](https://github.com/yoophi/markmini/pull/46) | ci: add validation workflow | `ci/issue-45-validation-workflow` | `main` | DIRTY | Re-evaluate against current CI; keep only editing-specific checks if still useful. |
| [#48](https://github.com/yoophi/markmini/pull/48) | test: cover unsaved change guard hook | `test/issue-47-unsaved-guard-hook` | `main` | DIRTY | Rebuild after hook extraction lands on editing branch. |
| [#76](https://github.com/yoophi/markmini/pull/76) | feat: refresh metadata after document writes | `feat/issue-75-refresh-metadata-after-writes` | `main` | DIRTY | Keep off `main` until write operations are reintroduced; rebuild on editing branch. |

## Suggested consolidation order

1. Establish or refresh `feat/markdown-editing` from the latest known editing baseline.
2. Rebuild foundational editing state and UI in small PRs:
   - editor mode and write command boundaries
   - dirty draft state
   - reusable unsaved-change guard hook
3. Rebuild file actions after the dirty-state guard is stable:
   - create
   - rename
   - delete
   - save-and-continue behavior
4. Rebuild tests after the editing store/API shape is stable.
5. Rebuild editing docs and validation workflow last.
6. Close superseded `main`-targeting PRs once replacement editing-branch PRs exist or when their content is intentionally dropped.

## Validation expectation

For editing branch PRs, run at minimum:

```sh
pnpm test
pnpm typecheck
pnpm build
```

If the PR touches Tauri commands or filesystem writes, also run:

```sh
cargo test --manifest-path src-tauri/Cargo.toml
```

Before any future integration PR from `feat/markdown-editing` into `main`, confirm the PR description explicitly documents:

- viewer/editor boundary changes
- write-related Tauri commands added or changed
- dirty-state and unsaved-change behavior
- filesystem safety tests
