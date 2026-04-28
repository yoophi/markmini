# Document Tree PR Status

`main` is currently a viewer-only baseline after the markdown editing work was separated from the primary branch. Document-tree changes should be merged only when their diff is clean on top of current `origin/main` and does not reintroduce edit/save/write flows.

## Recommended merge order

### 1. Current clean viewer-only PRs

These PRs were recreated on the current viewer-only baseline and are safe to review first:

1. [#107 — fix: correct file tree indentation](https://github.com/yoophi/markmini/pull/107)
2. [#108 — fix: contain wide markdown preview content](https://github.com/yoophi/markmini/pull/108)
3. [#109 — feat: float table of contents](https://github.com/yoophi/markmini/pull/109)
4. [#110 — feat: add document tree filtering](https://github.com/yoophi/markmini/pull/110)

### 2. Viewer UX stack to recreate on `origin/main`

The older PRs below contain useful viewer UX ideas, but their current diffs are not clean on the viewer-only baseline. Recreate or rebase them onto current `origin/main` before merge:

- Search follow-ups: [#56](https://github.com/yoophi/markmini/pull/56), [#58](https://github.com/yoophi/markmini/pull/58), [#60](https://github.com/yoophi/markmini/pull/60)
- Recent and favorites: [#62](https://github.com/yoophi/markmini/pull/62), [#64](https://github.com/yoophi/markmini/pull/64), [#66](https://github.com/yoophi/markmini/pull/66)
- Sorting and modified-time metadata: [#68](https://github.com/yoophi/markmini/pull/68), [#70](https://github.com/yoophi/markmini/pull/70), [#72](https://github.com/yoophi/markmini/pull/72), [#74](https://github.com/yoophi/markmini/pull/74)
- File-size metadata and sorting: [#78](https://github.com/yoophi/markmini/pull/78), [#80](https://github.com/yoophi/markmini/pull/80), [#82](https://github.com/yoophi/markmini/pull/82), [#84](https://github.com/yoophi/markmini/pull/84)
- Sort direction preferences: [#86](https://github.com/yoophi/markmini/pull/86), [#88](https://github.com/yoophi/markmini/pull/88)

### 3. Editing/write work to keep off `main`

The older editing-related PRs should not target `main` while the branch remains viewer-only. Retarget them to a dedicated editing branch such as `feat/markdown-editing`:

- File actions and dirty-state flows: [#26](https://github.com/yoophi/markmini/pull/26), [#28](https://github.com/yoophi/markmini/pull/28), [#30](https://github.com/yoophi/markmini/pull/30), [#32](https://github.com/yoophi/markmini/pull/32), [#34](https://github.com/yoophi/markmini/pull/34), [#36](https://github.com/yoophi/markmini/pull/36), [#38](https://github.com/yoophi/markmini/pull/38), [#40](https://github.com/yoophi/markmini/pull/40), [#42](https://github.com/yoophi/markmini/pull/42), [#44](https://github.com/yoophi/markmini/pull/44), [#46](https://github.com/yoophi/markmini/pull/46), [#48](https://github.com/yoophi/markmini/pull/48)
- Write-dependent metadata refresh: [#76](https://github.com/yoophi/markmini/pull/76)

## Validation expectation

For viewer-only document-tree work, run:

```sh
pnpm test
pnpm typecheck
pnpm build
```

If a change touches Tauri backend file scanning or metadata payloads, also run the relevant Cargo tests under `src-tauri`.
