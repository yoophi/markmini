# markmini Implementation Plan

## Goal

`markmini` is a compact desktop markdown viewer based on the core reading experience of `../markdeck`, rebuilt with Tauri for a lighter runtime and simpler UX.

The app must support launching from the command line:

- `markmini .`
- `markmini /some/path`
- `markmini ./path/file.md`

## Product Direction

- Focus on fast local markdown browsing and reading.
- Preserve high-value reading features from `markdeck`:
  - markdown rendering
  - table of contents
  - mermaid code block rendering
- Exclude annotation and feedback workflows.
- Prefer a simpler 2-panel layout:
  - left: document list / file tree
  - right: reader with sticky TOC

## Technical Stack

- Desktop shell: Tauri v2
- Frontend: React + TypeScript + Vite
- Styling: Tailwind CSS
- UI foundation: shadcn-style components
- State: Zustand
- Markdown: `react-markdown` + `remark-gfm`
- Mermaid: `mermaid`

## Architecture

### Rust backend

Responsibilities:

- Read launch arguments from the native process.
- Resolve the initial target path:
  - current directory
  - specific directory
  - specific markdown file
- Normalize the target into an app session:
  - `root_dir`
  - `selected_file`
- Expose commands for:
  - getting initial session state
  - listing markdown files under the root
  - reading a markdown file

Rules:

- If the target is a directory, use it as `root_dir`.
- If the target is a markdown file, use its parent as `root_dir` and the file as `selected_file`.
- If no argument exists, default to current working directory.
- Ignore annotation-specific data structures from `markdeck`.

### React frontend

Responsibilities:

- Bootstrap from backend-provided session state.
- Show markdown files under the current root.
- Load and render the selected document.
- Extract headings and render a TOC.
- Detect mermaid fenced code blocks and render them visually.

State model:

- session:
  - root directory
  - file list
  - selected file
- document:
  - content
  - headings
  - loading/error state
- ui:
  - sidebar visibility on smaller widths

## UX Notes

- The visual direction should be cleaner and more compact than `markdeck`.
- Keep chrome minimal and reading-focused.
- Use a distinct but restrained editorial look rather than a generic dashboard.
- On narrow widths, the file list becomes a slide-over panel.

## Delivery Sequence

1. Scaffold Tauri + React app.
2. Add Tailwind and shadcn-style primitives.
3. Implement Rust commands and launch argument resolution.
4. Implement Zustand store and frontend data flow.
5. Port simplified markdown, TOC, and Mermaid behavior from `markdeck`.
6. Validate with typecheck/build.
