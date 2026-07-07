# MA 기반 MM / MD 기능 통합 전략

작성일: 2026-07-07

## 목적

`MA(markdown-annotator)`를 통합 프로젝트의 베이스로 삼고, `MM(markmini)`와 `MD(markdeck)`의 기능을 흡수하는 전략을 정리한다.

- `MA`: `/Users/yoophi/project/agentic-workspace/apps/markdown-annotator`
- `MM`: `/Users/yoophi/project/markmini`
- `MD`: `/Users/yoophi/project/markdeck`

## 결론

MA를 베이스로 삼는 전략은 “Markdown annotation + agent handoff”를 제품 중심에 둘 때 적합하다. MA는 이미 Tauri 기반이고, annotation core/react package, block/source line parser, prompt export가 분리되어 있어 review workflow를 중심으로 확장하기 좋다.

다만 MA는 현재 단일 문서 annotation 도구에 가깝다. MM의 디렉터리 기반 reader, root safety, 멀티 윈도우, watcher 모델을 먼저 흡수하지 않으면 큰 Markdown vault를 탐색하는 제품이 되기 어렵다. MD의 기능은 Electron 구현을 직접 가져오기보다 search, asset, WikiLink, workspace UX의 개념을 MA/Tauri 구조에 맞게 재구현해야 한다.

## 왜 MA를 베이스로 삼는가

MA를 베이스로 삼을 만한 이유:

- 최종 제품의 핵심이 단순 reader보다 “문서에 표시하고 agent에게 작업 지시를 넘기는 workflow”라면 MA가 가장 가깝다.
- `@yoophi/markdown-annotation-core`와 `@yoophi/markdown-annotation-react`가 이미 분리되어 있다.
- block/source line 기반 model이 있어 annotation, prompt export, future patch generation으로 확장하기 쉽다.
- Tauri 기반이라 MM 기능을 흡수할 때 runtime 계열이 맞다.
- Rust backend가 `domain`, `application`, `inbound`, `infrastructure`로 나뉘어 장기적으로 커질 구조가 있다.

MA를 베이스로 삼을 때 감수할 비용:

- MM의 directory tree, root session, symlink safety, multi-window 모델을 새로 이식해야 한다.
- MA의 현재 화면은 단일 문서 중심이라 전체 shell/navigation을 다시 설계해야 한다.
- MD의 reader/search/workspace 기능은 Electron IPC 구현이므로 직접 복사하기 어렵다.
- MA의 annotation draft는 persistence가 없으므로 sidecar 저장이나 review session restore는 별도 설계가 필요하다.

## 목표 제품 형태

MA 기반 통합 앱은 다음 3개 영역을 가진다.

1. **Workspace Reader**
   - MM에서 가져올 디렉터리 스캔, 파일 트리, root safety, 멀티 윈도우.
   - MD에서 가져올 full-text search, local asset, WikiLink, recent workspace UX.

2. **Document Review**
   - MA 기존 annotation viewer, block/source line parser, selection annotation, group annotation.
   - 현재 문서의 annotation draft, annotation 목록, stale selection 표시.

3. **Agent Handoff**
   - MA 기존 `formatAnnotationsForAgent`.
   - 향후 MD의 `.memo` sidecar 방향을 참고한 persistence/export.

## 기능별 이식 전략

### 1. MM에서 가져올 기능

#### 디렉터리 기반 session

MA는 현재 단일 파일 중심이다. 먼저 MM의 session model을 MA backend에 추가한다.

가져올 개념:

- launch target이 directory이면 root로 사용.
- launch target이 Markdown file이면 부모 directory를 root로 사용하고 해당 문서를 선택.
- root별 file list와 selected file.
- window label별 session state.
- root-relative document path contract.

MA에 맞춘 구조:

```text
src-tauri/src/
  domain/
    workspace.rs          # root/session/file metadata model
  application/
    workspace_service.rs  # scan/read/refresh use case
  inbound/
    tauri_commands.rs     # 기존 document command + workspace command
  infrastructure/
    fs_workspace_reader.rs
    fs_workspace_watcher.rs
```

#### 파일 안전성

MM의 root safety는 반드시 우선 이식한다.

가져올 정책:

- `.md`, `.markdown` 인식. 필요하면 MA의 `.mdx` 지원 여부를 별도 결정.
- `.git`, `node_modules`, `target`, `dist`, `.next` 제외.
- 접근 불가 directory는 건너뛰고 계속 scan.
- root 밖 symlink Markdown 파일 차단.
- read command는 session file list에 있는 root-relative path만 허용.

주의:

- MA의 `read_markdown_file(path: String)`처럼 absolute path를 바로 읽는 command는 workspace mode에서는 사용하지 않는다.
- 파일 다이얼로그로 외부 파일을 열 때도 별도 temporary workspace를 만들거나 부모 directory root로 편입한다.

#### 파일 트리 UX

MM의 `FileTree` 기능을 MA shell에 이식한다.

가져올 기능:

- tree build/flatten.
- 검색어 persistence.
- 정렬 mode/direction.
- keyboard navigation.
- recent documents.
- favorite documents.
- scan progress 표시.

MA에 맞춘 UI 위치:

- `pages/workspace/WorkspacePage.tsx`
- `widgets/document-tree/`
- `entities/workspace/`

#### 멀티 윈도우와 CLI

MA의 `ma` CLI를 유지하되 의미를 확장한다.

권장 동작:

- `ma file.md`: 해당 파일의 부모 directory를 workspace root로 열고, 파일을 Review mode로 선택.
- `ma dir`: 해당 directory를 workspace로 열기.
- 같은 root가 이미 열려 있으면 focus.
- 같은 file review가 열려 있으면 해당 문서 선택/scroll.

MM의 “root별 window session”을 우선하고, MA의 macOS tabbing은 후순위로 둔다.

### 2. MD에서 가져올 기능

#### Full-text search

MD의 search 구현은 Electron main의 Node fs 기반이므로 개념만 가져온다.

MA/Tauri 방식:

- Rust `workspace_service`에 search command 추가.
- 초기 구현은 단순 substring search.
- index payload는 `relativePath`, `title`, `snippet`, `size`, `updatedAt`.
- watcher invalidation 시 search index invalidate.

권장 command:

```text
search_markdown_documents(query: String, window: WebviewWindow)
get_search_status(window: WebviewWindow)
```

#### Local asset / image handling

MD의 asset 처리 방향을 MA에 맞게 Tauri command로 재구현한다.

필요 기능:

- Markdown image/link가 root 내부 asset을 가리키면 안전하게 읽기.
- root 밖 asset 접근 차단.
- MIME type 반환.
- renderer에서는 직접 file path를 노출하지 않고 Tauri URL 또는 base64/blob URL로 표시.

주의:

- annotation prompt에는 asset 자체보다 Markdown raw context가 중요하므로, reader 표시와 prompt export 책임을 분리한다.

#### WikiLink / relative link

MD의 vault navigation 기능을 MA reader에 추가한다.

가져올 개념:

- `[[Document]]`, `[[Document#Heading]]` 해석.
- relative Markdown link resolve.
- hash link 이동.
- known documents 목록 기반 link target 찾기.

MA에서의 위치:

- `packages/markdown-annotation-core`에 순수 resolver를 추가하거나,
- app 내부 `entities/document/lib/link-resolution.ts`로 시작한다.

#### Workspace UX

MD의 recent workspace, command palette, shortcut help는 MA 제품 확장에 유용하다.

권장 순서:

1. recent workspace.
2. command palette.
3. keyboard shortcut help.
4. desktop menu integration.

Electron menu 구현은 가져오지 않고 UX와 command 목록만 참고한다.

### 3. MA에서 유지할 핵심

유지할 것:

- `parseMarkdownToBlocks`.
- `extractTocEntries`.
- `detectMermaidBlock`.
- `MarkdownViewer`.
- `AnnotationInputDialog`.
- annotation type/model.
- `formatAnnotationsForAgent`.
- multi-block selection grouping.
- prompt goal/instruction UI.
- Storybook과 package-level 테스트 구조.

보강할 것:

- annotation draft를 selected document별로 분리.
- document reload 시 stale selection 표시.
- prompt export에 workspace root와 root-relative path를 함께 표시.
- sidecar persistence 설계를 위한 schema version 추가.

## 제안 구조

MA 기존 구조를 유지하면서 workspace layer를 추가한다.

```text
src/
  app/
    App.tsx
  pages/
    workspace/
      WorkspacePage.tsx
    annotator/
      AnnotatorPanel.tsx
  widgets/
    document-tree/
    search/
    review-panel/
    prompt-export/
  features/
    open-document/
    annotate-selection/
    export-agent-prompt/
    switch-workspace/
  entities/
    workspace/
    document/
    annotation/
    markdown-block/
  shared/
    ui/
```

Backend:

```text
src-tauri/src/
  domain/
    document.rs
    workspace.rs
    search.rs
  application/
    document_service.rs
    workspace_service.rs
    search_service.rs
  inbound/
    tauri_commands.rs
  infrastructure/
    fs_document_reader.rs
    fs_workspace_repository.rs
    fs_workspace_watcher.rs
```

## 단계별 마이그레이션

### Phase 0. MA baseline 정리

- MA를 통합 repository/base app으로 확정한다.
- package dependency와 workspace root 실행 명령을 정리한다.
- 현재 annotator page를 “단일 문서 review” 기능으로 보존한다.
- MM/MD 이식 전 MA 테스트를 통과시켜 기준선을 만든다.

검증:

```bash
pnpm check-types
pnpm build
pnpm test
cd src-tauri && cargo check
```

### Phase 1. Workspace session backend 추가

- MM의 root/session/file scan 모델을 MA Rust backend에 이식한다.
- absolute path read command와 workspace-safe read command를 분리한다.
- root 밖 symlink 차단을 추가한다.
- scan progress event를 추가한다.

완료 기준:

- directory launch가 가능하다.
- Markdown file launch 시 부모 directory가 root가 되고 해당 파일이 선택된다.
- root-relative file list를 frontend가 받을 수 있다.

### Phase 2. Document tree shell 추가

- MA UI에 workspace layout을 추가한다.
- MM의 file tree 검색/정렬/최근/즐겨찾기 기능을 이식한다.
- 기존 annotator page는 선택 문서의 review panel로 재배치한다.

완료 기준:

- 왼쪽 file tree, 중앙 document reader/reviewer, 오른쪽 annotation/prompt panel 구조가 동작한다.
- 문서 선택 시 blocks와 TOC가 갱신된다.

### Phase 3. Reader mode와 Review mode 분리

- 기본은 reader mode로 열고, 필요할 때 review mode를 켠다.
- reader mode는 가볍게 렌더링한다.
- review mode는 MA `MarkdownViewer`와 annotation state를 사용한다.

완료 기준:

- 같은 문서를 reader/review 두 방식으로 볼 수 있다.
- review mode annotation이 reader mode를 오염시키지 않는다.

### Phase 4. MD 기반 link/asset parity

- relative Markdown link resolve.
- WikiLink resolve.
- local image/attachment read command.
- hash navigation.

완료 기준:

- Markdown vault 문서 간 이동이 가능하다.
- root 내부 이미지를 표시할 수 있다.
- root 밖 asset은 차단된다.

### Phase 5. MD 기반 full-text search

- Rust search command를 추가한다.
- search result panel/page를 만든다.
- watcher invalidation과 search index invalidation을 연결한다.

완료 기준:

- 본문 검색 결과와 snippet이 표시된다.
- 결과 클릭 시 문서가 열리고 가능하면 heading/hash로 이동한다.

### Phase 6. Annotation prompt export 고도화

- MA prompt export에 root-relative path, absolute path, line range를 함께 넣는다.
- annotation 없는 경우에도 review prompt skeleton을 제공한다.
- multi-document annotation export 여부를 결정한다.

완료 기준:

- 선택 문서 annotation prompt가 안정적으로 생성된다.
- clipboard copy와 prompt preview가 workspace shell에서 동작한다.

### Phase 7. Persistence 설계

- MD의 `.memo` sidecar 방향과 MA의 `AnnotationDraft`를 결합한다.
- schema version을 둔다.
- save/load command를 Tauri/Rust에 추가한다.
- root 밖 sidecar write를 차단한다.

권장 저장 순서:

1. localStorage per-document draft.
2. `.파일명.memo` 또는 `.파일명.annotations.json` sidecar.
3. export/import.
4. agent patch/write integration.

## Source of Truth

| 영역 | 기준 |
| --- | --- |
| 앱 베이스 | MA |
| Tauri runtime | MA 유지 |
| Backend 계층 구조 | MA |
| Annotation model | MA |
| Prompt export | MA |
| Block/source line parser | MA |
| Directory scan/root safety | MM에서 이식 |
| File tree UX | MM에서 이식 |
| Multi-window root session | MM에서 이식 |
| Full-text search | MD 개념을 Tauri/Rust로 재구현 |
| Asset/image handling | MD 개념을 Tauri/Rust로 재구현 |
| WikiLink/relative link | MD 개념을 순수 helper로 재구현 |
| Workspace/recent UX | MD 참고, MM shell과 조합 |
| Sidecar persistence | MD `.memo` 방향 + MA annotation model |

## 주요 리스크

- MA를 베이스로 삼으면 MM의 mature한 directory reader를 꽤 많이 다시 붙여야 한다.
- MA의 현재 single-document UX를 workspace UX로 확장하면서 화면 복잡도가 커질 수 있다.
- MD의 Electron 구현을 복사하면 Tauri 구조와 충돌한다.
- annotation 중심 제품이 되면 빠른 reader UX가 느려질 수 있다. Reader mode와 Review mode를 분리해야 한다.
- root safety를 늦게 붙이면 asset/read/search/persistence에서 보안 모델을 다시 고쳐야 한다.
- sidecar persistence를 서두르면 anchor drift, conflict handling, external edit 문제가 커진다.

## 권장 첫 작업

1. MA에 `workspace` domain/application model을 추가하는 설계 PRD를 작성한다.
2. MM의 scan/root safety 로직을 MA Rust 계층 구조에 맞게 작은 helper 단위로 이식한다.
3. workspace-safe `get_initial_workspace`, `refresh_workspace`, `read_workspace_markdown_file` command를 추가한다.
4. MA 화면에 최소 file tree + selected document reader shell을 추가한다.
5. 기존 annotator page를 selected document review panel로 이동한다.
6. 그 다음 MD의 relative link/asset/search를 순서대로 추가한다.

## 최종 판단

MA 기반 통합은 “agent에게 넘길 수 있는 annotation workflow”를 제품의 중심 가치로 삼는다면 좋은 선택이다. 반대로 “빠른 Markdown reader”가 중심이면 MM 기반 통합이 더 싸다.

MA를 베이스로 선택한다면 첫 번째 성공 조건은 annotation 기능을 늘리는 것이 아니라, MM 수준의 안전한 workspace reader를 MA 안에 먼저 만드는 것이다. 그 위에 MD의 search/asset/workspace polish를 얹고, 마지막에 persistence를 설계하는 순서가 가장 안정적이다.
