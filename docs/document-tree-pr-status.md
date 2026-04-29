# Document Tree PR Status

`main` is currently a viewer-only baseline after the markdown editing work was separated from the primary branch. Document-tree changes should be merged only when their diff is clean on top of current `origin/main` and does not reintroduce edit/save/write flows.

## Current baseline

`origin/main` now includes the clean viewer/document-tree stack through [#128](https://github.com/yoophi/markmini/pull/128):

- Search/filtering: [#113](https://github.com/yoophi/markmini/pull/113), [#114](https://github.com/yoophi/markmini/pull/114), [#115](https://github.com/yoophi/markmini/pull/115)
- Recent/favorites: [#116](https://github.com/yoophi/markmini/pull/116), [#117](https://github.com/yoophi/markmini/pull/117), [#118](https://github.com/yoophi/markmini/pull/118)
- Sorting and metadata: [#119](https://github.com/yoophi/markmini/pull/119), [#120](https://github.com/yoophi/markmini/pull/120), [#121](https://github.com/yoophi/markmini/pull/121), [#122](https://github.com/yoophi/markmini/pull/122), [#123](https://github.com/yoophi/markmini/pull/123), [#124](https://github.com/yoophi/markmini/pull/124), [#125](https://github.com/yoophi/markmini/pull/125), [#126](https://github.com/yoophi/markmini/pull/126), [#127](https://github.com/yoophi/markmini/pull/127), [#128](https://github.com/yoophi/markmini/pull/128)
- Reader layout/TOC overflow fix: latest `main` also includes `dbab9a3`.

There are no remaining viewer-only document-tree feature PRs from the clean replacement stack that need to be merged in order.

## Open process/docs PRs

These independent process and documentation PRs remain reviewable separately from the document-tree feature stack:

- [#130 — docs: refresh document tree PR stack](https://github.com/yoophi/markmini/pull/130)
- [#132 — docs: add markdown editing consolidation checklist](https://github.com/yoophi/markmini/pull/132)
- [#134 — chore: add aggregate validation scripts](https://github.com/yoophi/markmini/pull/134)
- [#139 — docs: link policy docs from README](https://github.com/yoophi/markmini/pull/139)
- [#141 — chore: add pull request template](https://github.com/yoophi/markmini/pull/141)
- [#143 — chore: add issue templates](https://github.com/yoophi/markmini/pull/143)
- [#145 — docs: add contributing guide](https://github.com/yoophi/markmini/pull/145)
- [#147 — chore: add editorconfig](https://github.com/yoophi/markmini/pull/147)
- [#149 — chore: add gitattributes](https://github.com/yoophi/markmini/pull/149)
- [#151 — chore: add dependabot config](https://github.com/yoophi/markmini/pull/151)
- [#153 — docs: add security policy](https://github.com/yoophi/markmini/pull/153)
- [#155 — ci: harden validation workflow](https://github.com/yoophi/markmini/pull/155)
- [#163 — docs: align README validation commands](https://github.com/yoophi/markmini/pull/163)

## Superseded document-tree PRs

The older document-tree PRs were superseded by the clean replacement stack above and have been closed:

- Search/filtering: [#54](https://github.com/yoophi/markmini/pull/54), [#56](https://github.com/yoophi/markmini/pull/56), [#58](https://github.com/yoophi/markmini/pull/58), [#60](https://github.com/yoophi/markmini/pull/60)
- Recent/favorites: [#62](https://github.com/yoophi/markmini/pull/62), [#64](https://github.com/yoophi/markmini/pull/64), [#66](https://github.com/yoophi/markmini/pull/66)
- Sorting and metadata: [#68](https://github.com/yoophi/markmini/pull/68), [#70](https://github.com/yoophi/markmini/pull/70), [#72](https://github.com/yoophi/markmini/pull/72), [#74](https://github.com/yoophi/markmini/pull/74), [#78](https://github.com/yoophi/markmini/pull/78), [#80](https://github.com/yoophi/markmini/pull/80), [#82](https://github.com/yoophi/markmini/pull/82), [#84](https://github.com/yoophi/markmini/pull/84), [#86](https://github.com/yoophi/markmini/pull/86), [#88](https://github.com/yoophi/markmini/pull/88), [#90](https://github.com/yoophi/markmini/pull/90)

## Editing/write work to keep off `main`

The older editing-related PRs should not target `main` while the branch remains viewer-only. Retarget or rebuild them on a dedicated editing branch such as `feat/markdown-editing`:

- File actions and dirty-state flows: [#26](https://github.com/yoophi/markmini/pull/26), [#28](https://github.com/yoophi/markmini/pull/28), [#30](https://github.com/yoophi/markmini/pull/30), [#32](https://github.com/yoophi/markmini/pull/32), [#34](https://github.com/yoophi/markmini/pull/34), [#36](https://github.com/yoophi/markmini/pull/36), [#38](https://github.com/yoophi/markmini/pull/38), [#40](https://github.com/yoophi/markmini/pull/40), [#42](https://github.com/yoophi/markmini/pull/42), [#44](https://github.com/yoophi/markmini/pull/44), [#46](https://github.com/yoophi/markmini/pull/46), [#48](https://github.com/yoophi/markmini/pull/48)
- Write-dependent metadata refresh: [#76](https://github.com/yoophi/markmini/pull/76)

## Validation expectation

For viewer-only document-tree work, run:

```sh
pnpm test
pnpm typecheck
pnpm build
```

If a change touches Tauri backend file scanning, watcher behavior, or metadata payloads, also run:

```sh
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```
