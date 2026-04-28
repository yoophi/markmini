# Document Tree PR Status

`main` is currently a viewer-only baseline. Document-tree changes should be merged only when their diff is clean on top of current `origin/main` and does not reintroduce edit/save/write flows.

## Recommended merge order

### 1. Already merged viewer foundation

These PRs established the current viewer/document-tree baseline:

1. [#107 — fix: correct file tree indentation](https://github.com/yoophi/markmini/pull/107)
2. [#108 — fix: contain wide markdown preview content](https://github.com/yoophi/markmini/pull/108)
3. [#109 — feat: float table of contents](https://github.com/yoophi/markmini/pull/109)
4. [#110 — feat: add document tree filtering](https://github.com/yoophi/markmini/pull/110)

### 2. Current clean document-tree stack

These PRs were recreated on the current viewer-only baseline and should be reviewed/merged in this order:

#### Search polish

1. [#113 — feat: persist document tree filter query](https://github.com/yoophi/markmini/pull/113)
2. [#114 — feat: add document search clear affordances](https://github.com/yoophi/markmini/pull/114)
3. [#115 — feat: highlight document search matches](https://github.com/yoophi/markmini/pull/115)

#### Recent documents and favorites

4. [#116 — feat: add recent documents section](https://github.com/yoophi/markmini/pull/116)
5. [#117 — feat: persist recent documents](https://github.com/yoophi/markmini/pull/117)
6. [#118 — feat: add favorite documents](https://github.com/yoophi/markmini/pull/118)

#### Sorting and modified-time metadata

7. [#119 — feat: add document tree sort controls](https://github.com/yoophi/markmini/pull/119)
8. [#120 — feat: expose markdown file metadata](https://github.com/yoophi/markmini/pull/120)
9. [#121 — feat: show modified time context](https://github.com/yoophi/markmini/pull/121)
10. [#122 — feat: persist document tree sort preference](https://github.com/yoophi/markmini/pull/122)
11. [#123 — test: cover metadata payload helpers](https://github.com/yoophi/markmini/pull/123)

#### File-size metadata and sorting

12. [#124 — feat: expose file size metadata](https://github.com/yoophi/markmini/pull/124)
13. [#125 — feat: show file size context](https://github.com/yoophi/markmini/pull/125)
14. [#126 — feat: add file size sort mode](https://github.com/yoophi/markmini/pull/126)

#### Sort direction preferences

15. [#127 — feat: add document tree sort direction](https://github.com/yoophi/markmini/pull/127)
16. [#128 — feat: remember sort direction per mode](https://github.com/yoophi/markmini/pull/128)

### 3. Superseded conflicting PRs

The older document-tree PRs below contain earlier versions of the same ideas, but their current diffs conflict with the viewer-only baseline. Prefer the clean replacements above instead of merging these directly:

- Search follow-ups: [#56](https://github.com/yoophi/markmini/pull/56), [#58](https://github.com/yoophi/markmini/pull/58), [#60](https://github.com/yoophi/markmini/pull/60)
- Recent and favorites: [#62](https://github.com/yoophi/markmini/pull/62), [#64](https://github.com/yoophi/markmini/pull/64), [#66](https://github.com/yoophi/markmini/pull/66)
- Sorting and modified-time metadata: [#68](https://github.com/yoophi/markmini/pull/68), [#70](https://github.com/yoophi/markmini/pull/70), [#72](https://github.com/yoophi/markmini/pull/72), [#74](https://github.com/yoophi/markmini/pull/74)
- Write-dependent metadata refresh: [#76](https://github.com/yoophi/markmini/pull/76)
- Metadata tests and file-size work: [#78](https://github.com/yoophi/markmini/pull/78), [#80](https://github.com/yoophi/markmini/pull/80), [#82](https://github.com/yoophi/markmini/pull/82), [#84](https://github.com/yoophi/markmini/pull/84)
- Sort direction preferences: [#86](https://github.com/yoophi/markmini/pull/86), [#88](https://github.com/yoophi/markmini/pull/88)
- Previous stack note: [#90](https://github.com/yoophi/markmini/pull/90)

### 4. Editing/write work to keep off `main`

The older editing-related PRs should not target `main` while the branch remains viewer-only. Retarget them to a dedicated editing branch such as `feat/markdown-editing`:

- File actions and dirty-state flows: [#26](https://github.com/yoophi/markmini/pull/26), [#28](https://github.com/yoophi/markmini/pull/28), [#30](https://github.com/yoophi/markmini/pull/30), [#32](https://github.com/yoophi/markmini/pull/32), [#34](https://github.com/yoophi/markmini/pull/34), [#36](https://github.com/yoophi/markmini/pull/36), [#38](https://github.com/yoophi/markmini/pull/38), [#40](https://github.com/yoophi/markmini/pull/40), [#42](https://github.com/yoophi/markmini/pull/42), [#44](https://github.com/yoophi/markmini/pull/44), [#46](https://github.com/yoophi/markmini/pull/46), [#48](https://github.com/yoophi/markmini/pull/48)

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
```
