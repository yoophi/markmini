# PR Stack Review

Last reviewed: 2026-07-28

## Summary

`main` is the viewer-only baseline. The current open PR list falls into three groups:

1. clean process/docs/hygiene PRs that target `main`
2. clean viewer/document-tree PRs that target `main`
3. older editing/write PRs that still target `main` and should be retargeted or rebuilt on `feat/markdown-editing`

The recent process/docs/hygiene PRs all report a successful `Viewer validation` check. GitHub currently reports `mergeStateStatus=UNKNOWN` for the listed PRs, so reviewers should still use the branch policy and local validation commands before merging.

## Process and Repository Hygiene PRs

These PRs are complete and can be reviewed independently because they do not reintroduce editing/write flows:

1. [#134](https://github.com/yoophi/markmini/pull/134) `chore: add aggregate validation scripts` - closes #133
2. [#139](https://github.com/yoophi/markmini/pull/139) `docs: link policy docs from README` - closes #138
3. [#141](https://github.com/yoophi/markmini/pull/141) `chore: add pull request template` - closes #140
4. [#143](https://github.com/yoophi/markmini/pull/143) `chore: add issue templates` - closes #142
5. [#145](https://github.com/yoophi/markmini/pull/145) `docs: add contributing guide` - closes #144
6. [#147](https://github.com/yoophi/markmini/pull/147) `chore: add editorconfig` - closes #146
7. [#149](https://github.com/yoophi/markmini/pull/149) `chore: add gitattributes` - closes #148
8. [#151](https://github.com/yoophi/markmini/pull/151) `chore: add dependabot config` - closes #150
9. [#153](https://github.com/yoophi/markmini/pull/153) `docs: add security policy` - closes #152
10. [#155](https://github.com/yoophi/markmini/pull/155) `ci: harden validation workflow` - closes #154
11. [#157](https://github.com/yoophi/markmini/pull/157) `docs: refresh document tree status` - closes #156
12. [#163](https://github.com/yoophi/markmini/pull/163) `docs: align README validation commands` - closes #135
13. [#165](https://github.com/yoophi/markmini/pull/165) `docs: document validation workflow` - closes #49

## Viewer Document-Tree PRs

These PRs document the current viewer-only document-tree stack and editing consolidation plan:

1. [#130](https://github.com/yoophi/markmini/pull/130) `docs: refresh document tree PR stack` - closes #129
2. [#132](https://github.com/yoophi/markmini/pull/132) `docs: add markdown editing consolidation checklist` - closes #131

For the full document-tree merge order, see [Document Tree PR Status](./document-tree-pr-status.md).

## Editing PRs To Keep Off `main`

These PRs are still open against `main`, but they include editing/write behavior. Do not merge them into viewer-only `main` as-is. Rebuild or retarget the useful work onto `feat/markdown-editing`:

1. [#26](https://github.com/yoophi/markmini/pull/26) `feat: replace file action prompts with in-app dialogs` - #25
2. [#28](https://github.com/yoophi/markmini/pull/28) `feat: replace unsaved-change confirm with in-app dialog` - #27
3. [#30](https://github.com/yoophi/markmini/pull/30) `feat: add inline success feedback for file actions` - #29
4. [#32](https://github.com/yoophi/markmini/pull/32) `feat: guard dirty drafts on window close` - #31
5. [#34](https://github.com/yoophi/markmini/pull/34) `feat: add save-and-continue unsaved dialog action` - #33
6. [#36](https://github.com/yoophi/markmini/pull/36) `chore: refine unsaved dialog copy by action` - #35
7. [#38](https://github.com/yoophi/markmini/pull/38) `feat: guard delete action with unsaved dialog` - #37
8. [#40](https://github.com/yoophi/markmini/pull/40) `refactor: extract unsaved change guard hook` - #39
9. [#42](https://github.com/yoophi/markmini/pull/42) `test: cover document safety store flows` - #41
10. [#44](https://github.com/yoophi/markmini/pull/44) `docs: align README with file action flows` - #43
11. [#48](https://github.com/yoophi/markmini/pull/48) `test: cover unsaved change guard hook` - #47
12. [#76](https://github.com/yoophi/markmini/pull/76) `feat: refresh metadata after document writes` - #75

For the PR-by-PR editing consolidation checklist, see [Markdown Editing Consolidation Checklist](./markdown-editing-consolidation.md).

## Issue Status Guidance

Issues #49, #129, #131, #133, #135, #138, #140, #142, #144, #146, #148, #150, #152, #154, and #156 are completed and closed.

Issues #25, #27, #29, #31, #33, #35, #37, #39, #41, #43, #47, and #75 should stay open until their editing work is rebuilt on `feat/markdown-editing`, retargeted there, or intentionally dropped.

Issue #112 remains the umbrella task for the editing-branch consolidation itself.

## Validation

For viewer-only PRs targeting `main`, run:

```sh
pnpm test
pnpm typecheck
pnpm build
```

If the PR touches Tauri commands, file scanning, filesystem watcher behavior, symlink/path safety, metadata payloads, or Rust tests, also run:

```sh
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

## Next Product-Facing Work

After the process/docs PRs are merged, the best next product-facing slice is #112: rebuild the editing stack on `feat/markdown-editing`. Start with the reusable unsaved-change guard and dirty draft state before restoring create, rename, delete, save-and-continue, and metadata refresh behavior.
