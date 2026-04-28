# Document Tree PR Stack

This note tracks the current document-tree work stack so reviewers can merge it safely. The stack is intentionally incremental: each PR should be reviewed and merged in ascending PR number unless a reviewer explicitly rebases/squashes the chain.

## Recommended merge order

### Search and filtering

1. [#54 feat: add document tree filtering](https://github.com/yoophi/markmini/pull/54)
2. [#56 feat: persist document tree filter query](https://github.com/yoophi/markmini/pull/56)
3. [#58 feat: add document search clear affordances](https://github.com/yoophi/markmini/pull/58)
4. [#60 feat: highlight document search matches](https://github.com/yoophi/markmini/pull/60)

### Recent and favorite documents

5. [#62 feat: add recent documents to file tree](https://github.com/yoophi/markmini/pull/62)
6. [#64 feat: persist recent documents locally](https://github.com/yoophi/markmini/pull/64)
7. [#66 feat: add favorite documents](https://github.com/yoophi/markmini/pull/66)

### Sort controls and modified-time metadata

8. [#68 feat: add document tree sort controls](https://github.com/yoophi/markmini/pull/68)
9. [#70 feat: add markdown file metadata sorting](https://github.com/yoophi/markmini/pull/70)
10. [#72 feat: show modified time in document tree](https://github.com/yoophi/markmini/pull/72)
11. [#74 feat: persist document tree sort mode](https://github.com/yoophi/markmini/pull/74)

### Metadata refresh and backend contract tests

12. [#76 feat: refresh metadata after document writes](https://github.com/yoophi/markmini/pull/76)
13. [#78 test: cover markdown file metadata payloads](https://github.com/yoophi/markmini/pull/78)

### File size metadata and navigation UI

14. [#80 feat: expose file size metadata](https://github.com/yoophi/markmini/pull/80)
15. [#82 feat: show file size in document tree](https://github.com/yoophi/markmini/pull/82)
16. [#84 feat: add file size sort mode](https://github.com/yoophi/markmini/pull/84)

### Sort direction preferences

17. [#86 feat: add document sort direction control](https://github.com/yoophi/markmini/pull/86)
18. [#88 feat: remember sort direction per mode](https://github.com/yoophi/markmini/pull/88)

## Validation commands

Run the full validation set after merging each group, and again after the final PR in the stack:

```bash
pnpm test
pnpm typecheck
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
pnpm build
```

For frontend-only groups, `pnpm test`, `pnpm typecheck`, and `pnpm build` are the minimum checks. For metadata/backend groups, include both Cargo commands.

## Merge notes

- The later PRs are stacked on earlier document-tree work and may not apply cleanly if merged out of order.
- Favorites and Recent intentionally preserve their own ordering; sort mode and sort direction apply only to the main tree.
- Metadata payloads are content-free. Current file metadata contains `relativePath`, `modifiedAt`, and `sizeBytes` only.
- Preference storage is root-scoped through localStorage keys, so reviewers should verify backward-compatible fallback behavior when preference keys are missing or stale.
