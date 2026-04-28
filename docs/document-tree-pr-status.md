# Document Tree PR Status

`main` is currently a viewer-only baseline after the markdown editing work was separated from the primary branch. Document-tree changes should be merged only when their diff is clean on top of current `origin/main` and does not reintroduce edit/save/write flows.

## Current baseline

`origin/main` currently includes the first document-tree/search cleanup PRs through:

- [#113 — feat: persist document tree filter query](https://github.com/yoophi/markmini/pull/113)
- [#114 — feat: add document search clear affordances](https://github.com/yoophi/markmini/pull/114)
- [#115 — feat: highlight document search matches](https://github.com/yoophi/markmini/pull/115)

## Recommended merge/rebuild order

### 1. Remaining clean viewer-only PR

This PR is still clean on the current viewer-only baseline and should be reviewed before rebuilding the later stack:

1. [#116 — feat: add recent documents section](https://github.com/yoophi/markmini/pull/116)

### 2. Viewer UX stack to rebuild after #116

After `main` advanced through #113-#115, these clean replacement PRs now need to be recreated or rebased on top of the latest viewer-only baseline before merge:

- Recent and favorites:
  - [#117 — feat: persist recent documents](https://github.com/yoophi/markmini/pull/117)
  - [#118 — feat: add favorite documents](https://github.com/yoophi/markmini/pull/118)
- Sorting and modified-time metadata:
  - [#119 — feat: add document tree sort controls](https://github.com/yoophi/markmini/pull/119)
  - [#120 — feat: expose markdown file metadata](https://github.com/yoophi/markmini/pull/120)
  - [#121 — feat: show modified time context](https://github.com/yoophi/markmini/pull/121)
  - [#122 — feat: persist document tree sort preference](https://github.com/yoophi/markmini/pull/122)
- File-size metadata and sorting:
  - [#123 — test: cover metadata payload helpers](https://github.com/yoophi/markmini/pull/123)
  - [#124 — feat: expose file size metadata](https://github.com/yoophi/markmini/pull/124)
  - [#125 — feat: show file size context](https://github.com/yoophi/markmini/pull/125)
  - [#126 — feat: add file size sort mode](https://github.com/yoophi/markmini/pull/126)
- Sort direction preferences:
  - [#127 — feat: add document tree sort direction](https://github.com/yoophi/markmini/pull/127)
  - [#128 — feat: remember sort direction per mode](https://github.com/yoophi/markmini/pull/128)

### 3. Process/docs PRs still clean on `main`

These independent process and documentation PRs remain mergeable on the current `main` and can be reviewed separately from the document-tree feature stack:

- [#130 — docs: refresh document tree PR stack](https://github.com/yoophi/markmini/pull/130)
- [#132 — docs: add markdown editing consolidation checklist](https://github.com/yoophi/markmini/pull/132)
- [#134 — chore: add aggregate validation scripts](https://github.com/yoophi/markmini/pull/134)
- [#137 — docs: align README validation commands](https://github.com/yoophi/markmini/pull/137)
- [#139 — docs: link policy docs from README](https://github.com/yoophi/markmini/pull/139)
- [#141 — chore: add pull request template](https://github.com/yoophi/markmini/pull/141)
- [#143 — chore: add issue templates](https://github.com/yoophi/markmini/pull/143)
- [#145 — docs: add contributing guide](https://github.com/yoophi/markmini/pull/145)
- [#147 — chore: add editorconfig](https://github.com/yoophi/markmini/pull/147)
- [#149 — chore: add gitattributes](https://github.com/yoophi/markmini/pull/149)
- [#151 — chore: add dependabot config](https://github.com/yoophi/markmini/pull/151)
- [#153 — docs: add security policy](https://github.com/yoophi/markmini/pull/153)
- [#155 — ci: harden validation workflow](https://github.com/yoophi/markmini/pull/155)

### 4. Older superseded/conflicting PRs

The older PRs below are superseded by clean replacement work or belong on the editing branch. Do not merge them directly into viewer-only `main`.

- Older document-tree stack: [#54](https://github.com/yoophi/markmini/pull/54), [#56](https://github.com/yoophi/markmini/pull/56), [#58](https://github.com/yoophi/markmini/pull/58), [#60](https://github.com/yoophi/markmini/pull/60), [#62](https://github.com/yoophi/markmini/pull/62), [#64](https://github.com/yoophi/markmini/pull/64), [#66](https://github.com/yoophi/markmini/pull/66), [#68](https://github.com/yoophi/markmini/pull/68), [#70](https://github.com/yoophi/markmini/pull/70), [#72](https://github.com/yoophi/markmini/pull/72), [#74](https://github.com/yoophi/markmini/pull/74), [#78](https://github.com/yoophi/markmini/pull/78), [#80](https://github.com/yoophi/markmini/pull/80), [#82](https://github.com/yoophi/markmini/pull/82), [#84](https://github.com/yoophi/markmini/pull/84), [#86](https://github.com/yoophi/markmini/pull/86), [#88](https://github.com/yoophi/markmini/pull/88), [#90](https://github.com/yoophi/markmini/pull/90)
- Editing/file-write stack: [#26](https://github.com/yoophi/markmini/pull/26), [#28](https://github.com/yoophi/markmini/pull/28), [#30](https://github.com/yoophi/markmini/pull/30), [#32](https://github.com/yoophi/markmini/pull/32), [#34](https://github.com/yoophi/markmini/pull/34), [#36](https://github.com/yoophi/markmini/pull/36), [#38](https://github.com/yoophi/markmini/pull/38), [#40](https://github.com/yoophi/markmini/pull/40), [#42](https://github.com/yoophi/markmini/pull/42), [#44](https://github.com/yoophi/markmini/pull/44), [#46](https://github.com/yoophi/markmini/pull/46), [#48](https://github.com/yoophi/markmini/pull/48), [#76](https://github.com/yoophi/markmini/pull/76)

## Validation expectation

For viewer-only document-tree work, run:

```sh
pnpm test
pnpm typecheck
pnpm build
```

If a change touches Tauri backend file scanning or metadata payloads, also run:

```sh
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```
