# Branch Policy

MarkMini now separates stable Markdown viewing from Markdown editing work.

## Main line: viewer-first

`main` should stay focused on a stable local Markdown viewer:

- open a root directory or Markdown file
- discover Markdown documents safely
- render Markdown, code blocks, Mermaid diagrams, and table of contents
- handle filesystem updates without corrupting viewer state
- improve viewer navigation, accessibility, performance, and validation

Do not add edit/save/dirty-draft behavior directly to `main` unless the branch policy changes again.

Current viewer-only split PR:

- [#91 chore: split markdown editing out of main](https://github.com/yoophi/markmini/pull/91)

## Editing branch

Markdown editing work should live on the dedicated editing branch until it is ready to be productized separately:

- [`yoophi-a:feat/markdown-editing`](https://github.com/yoophi-a/markmini/tree/feat/markdown-editing)

Editing-branch work may include:

- editor mode UI
- file write commands
- save shortcuts
- dirty draft state
- external-change conflict handling for drafts
- create/rename/delete file actions if they depend on write flows

## PR guidance

For the current editing cleanup checklist, see [Markdown Editing Consolidation Checklist](./markdown-editing-consolidation.md).

- Viewer stabilization PRs should target `main`.
- Editing PRs should target the editing branch or a branch stacked on top of it.
- If a change touches both viewing and editing concerns, split it into two PRs when practical.
- When reviewing viewer PRs, check that no `write_markdown_file`, edit mode, save button, dirty draft, or create/rename/delete write flow is reintroduced accidentally.
