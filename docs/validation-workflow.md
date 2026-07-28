# Validation Workflow

MarkMini uses the GitHub Actions workflow in `.github/workflows/validation.yml` as the standard PR gate for viewer-focused changes.

## When it runs

The workflow runs on:

- every pull request
- every push to `main`

Runs are grouped by workflow and git ref, and in-progress runs for the same ref are cancelled when a newer commit arrives.

## CI steps

The `Viewer validation` job runs on `ubuntu-latest` and performs these steps:

1. Check out the repository.
2. Install pnpm `10.32.1`.
3. Set up Node.js `22` with pnpm dependency caching.
4. Set up the stable Rust toolchain.
5. Install Linux packages required by Tauri checks:
   - `libwebkit2gtk-4.1-dev`
   - `libayatana-appindicator3-dev`
   - `librsvg2-dev`
   - `patchelf`
6. Install frontend dependencies with `pnpm install --frozen-lockfile`.
7. Run frontend tests with `pnpm test`.
8. Typecheck the frontend with `pnpm typecheck`.
9. Run Tauri backend tests with `cargo test --manifest-path src-tauri/Cargo.toml`.
10. Check the Tauri backend with `cargo check --manifest-path src-tauri/Cargo.toml`.
11. Build the frontend with `pnpm build`.

## Local equivalent

For changes that only touch frontend viewer code or docs adjacent to frontend behavior, run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

For changes that touch Tauri commands, file scanning, filesystem watcher behavior, symlink/path safety, metadata payloads, or Rust tests, also run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

If the aggregate validation scripts from [#133](https://github.com/yoophi/markmini/issues/133) are available on the branch, these commands are equivalent:

```bash
pnpm check
pnpm check:tauri
```

## Interpreting failures

- `pnpm test`: frontend unit or component behavior changed unexpectedly.
- `pnpm typecheck`: TypeScript types, imports, or public payload shapes are inconsistent.
- `cargo test`: Rust scanning, path safety, event classification, or metadata behavior regressed.
- `cargo check`: Rust code no longer compiles for the Tauri backend.
- `pnpm build`: the production frontend bundle cannot be generated.

Prefer fixing the failing step directly before rerunning the full workflow.
