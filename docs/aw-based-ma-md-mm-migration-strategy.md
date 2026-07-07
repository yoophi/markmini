# AW 기반 MA / MD / MM 기능 마이그레이션 전략

작성일: 2026-07-07

## 목적

`AW(agentic-workbench)`를 통합 베이스로 삼고, `MA(markdown-annotator)`, `MD(markdeck)`, `MM(markmini)`의 기능을 AW 안으로 통합하는 전략을 정리한다.

- `AW`: `/Users/yoophi/project/agentic-workspace/apps/agentic-workbench`
- `MA`: `/Users/yoophi/project/agentic-workspace/apps/markdown-annotator`
- `MD`: `/Users/yoophi/project/markdeck`
- `MM`: `/Users/yoophi/project/markmini`

## 결론

AW를 베이스로 삼는 전략은 “Markdown reader/reviewer를 독립 앱이 아니라 agent 작업 공간의 일부로 통합한다”는 방향이다. AW는 이미 worktree, Git history, changes, agent run, prompt send 흐름을 갖고 있고, `@yoophi/markdown-annotation-core`, `@yoophi/markdown-annotation-react`, `@yoophi/workspace-auto-refresh`를 사용한다. 즉 MA 기능의 핵심은 이미 AW 안에 들어와 있다.

따라서 AW 기반 통합의 핵심은 MA를 다시 옮기는 것이 아니라, AW의 Markdown workspace를 다음 수준으로 올리는 것이다.

1. MA의 annotation/prompt export 기능을 AW의 agent run workflow와 더 깊게 연결한다.
2. MM의 Markdown directory reader polish, file tree UX, root/session safety를 worktree file UX에 흡수한다.
3. MD의 full-text search, local asset/image, WikiLink, relative link, workspace productivity UX를 AW/Tauri 구조로 재구현한다.
4. 최종적으로 AW를 “Git/worktree + Markdown review + agent handoff” 통합 작업 공간으로 만든다.

## 현재 AW 상태

AW에는 이미 아래 기반이 있다.

- Tauri v2 + React + TypeScript + Vite.
- React Query 기반 async state.
- `domain/application/infrastructure/inbound`로 나뉜 Rust backend.
- Git worktree, Git history graph/list, working tree diff, worktree file listing.
- worktree watcher와 stale selection helper.
- Markdown workspace tab.
- `@yoophi/markdown-annotation-core`의 `parseMarkdownToBlocks`, `extractTocEntries`, `formatAnnotationsForAgent`.
- `@yoophi/markdown-annotation-react`의 `MarkdownViewer`, `AnnotationInputDialog`, selection anchor helper.
- Markdown annotation prompt를 agent run panel로 보내는 `onSendAnnotationPrompt` 연결점.
- worktree file provider의 root-relative path 검증과 markdown scope listing.

즉 AW는 세 프로젝트 중 가장 “통합 목적지”에 가깝다. 다만 Markdown reader 제품으로서의 세부 UX는 MM/MD보다 덜 정교하고, Markdown vault 기능은 아직 부족하다.

## 목표 제품 형태

AW 안에서 Markdown 관련 기능은 별도 앱이 아니라 worktree session의 한 영역이 된다.

```text
Project
  Worktree Session
    Git tab
    Files tab
    Markdown tab
      Markdown tree
      Reader mode
      Review mode
      Annotation panel
      Agent prompt export/send
      Search panel
```

제품 방향:

- Git 변경사항과 Markdown 문서 리뷰를 한 worktree 안에서 함께 본다.
- Markdown annotation은 바로 agent prompt로 전송할 수 있다.
- agent가 수정한 결과는 AW의 Git/worktree diff에서 다시 검토한다.
- 독립 reader 앱의 편의성은 흡수하되, 최종 workflow는 agentic workbench 중심으로 유지한다.

## 프로젝트별 이식 역할

### MA에서 가져올 것

이미 AW에 들어온 것:

- `@yoophi/markdown-annotation-core`
- `@yoophi/markdown-annotation-react`
- `@yoophi/workspace-auto-refresh`
- block/source line parser.
- annotation draft model.
- annotation viewer.
- prompt formatter.
- Mermaid expanded view adapter.
- stale selection helper.

추가로 보강할 것:

- MA의 prompt goal/instruction UI를 AW Markdown tab에 추가한다.
- MA처럼 annotation 없는 상태에서도 prompt skeleton을 보여준다.
- prompt export에 worktree path, root-relative path, selected file metadata를 더 명확히 넣는다.
- MA의 grouped annotation UX를 AW annotation list에서 더 명확히 표시한다.
- MA의 local document watcher는 가져오지 않는다. AW worktree watcher가 source of truth다.

### MM에서 가져올 것

가져올 기능:

- Markdown file tree UX polish.
- 검색어 persistence.
- sort mode/direction.
- recent documents.
- favorite documents.
- keyboard navigation.
- selected file ancestor auto expand.
- scan progress/skip count 표현.
- symlink/root safety 강화 관점.
- `mm file.md`식 “파일을 열면 부모 디렉터리를 root로 잡고 해당 파일 선택” UX 참고.

이미 AW에 있는 유사 기능:

- `listWorktreeFiles(worktree.path, { kind: "markdown" })`.
- markdown file과 조상 directory만 반환하는 backend scope.
- path traversal 방지.
- worktree root 밖 path 차단.
- worktree watcher.

주의:

- MM의 앱 전체 session model을 그대로 가져오지는 않는다. AW의 project/worktree session 모델이 이미 source of truth다.
- MM의 CLI는 AW에 직접 필요 없다. 필요하면 AW project/worktree open command로 재해석한다.

### MD에서 가져올 것

가져올 기능/아이디어:

- full-text search.
- search index/cache/status.
- snippet generation.
- local image/attachment rendering.
- relative Markdown link navigation.
- Obsidian-style WikiLink.
- breadcrumb/recent docs/workspace polish.
- command palette/shortcut help 아이디어.
- structured desktop error normalization.
- `.memo` sidecar persistence 방향.

주의:

- MD의 Electron main/preload 구현은 AW Tauri backend에 직접 맞지 않는다.
- MD의 feedback model은 MA/AW annotation model과 중복된다. MD에서는 `.memo` persistence와 reader UX 아이디어만 주로 참고한다.

## 기능별 전략

### 1. Markdown Tree 고도화

현재 AW Markdown tab은 markdown scope file list를 표시하지만, MM 수준의 tree UX는 아직 부족하다.

이식할 MM 기능:

- 검색 input과 clear button.
- sort mode: name/path/modified/size.
- sort direction.
- recent documents.
- favorite documents.
- keyboard navigation.
- selected file ancestor auto expand.
- empty/loading/error state polish.

AW에 맞춘 구현 위치:

```text
src/features/worktree-workspace/
  model/
    markdown-tree.ts
    markdown-tree.test.ts
  ui/
    markdown-file-tree.tsx
```

Backend는 기존 `list_worktree_files`를 우선 사용한다. 필요한 경우 `WorktreeFileListScope`에 sort/filter를 추가하기보다 frontend에서 먼저 구현한다.

### 2. Reader Mode / Review Mode 분리

현재 AW Markdown tab은 annotation-aware `MarkdownViewer`를 기본 preview로 사용한다. 기능적으로는 좋지만, 빠른 읽기 UX와 review UX가 섞여 있다.

전략:

- `Reader mode`: 가벼운 Markdown preview. annotation action 숨김.
- `Review mode`: 현재 MA 기반 annotation viewer 사용.
- mode toggle은 Markdown tab header나 preview header에 둔다.

가져올 기준:

- Reader mode polish는 MM의 MarkdownView와 MD의 reader UX 참고.
- Review mode는 AW/MA 현재 구현 유지.

완료 기준:

- 일반 읽기에서는 block toolbar가 방해하지 않는다.
- Review mode로 전환하면 block/selection annotation이 가능하다.
- 같은 selected file의 blocks/TOC는 공유한다.

### 3. Prompt Export와 Agent Run 통합

AW의 강점은 annotation prompt를 바로 agent run으로 보낼 수 있다는 점이다. MA보다 이 부분을 더 깊게 연결해야 한다.

보강할 기능:

- prompt goal 선택: `edit-document`, `review-reference`, `custom`.
- 사용자 지침 입력.
- prompt preview 항상 표시 또는 접기.
- annotation이 없어도 skeleton prompt 제공.
- `Send` 시 agent run panel prompt input/queue에 명확히 전달.
- 전송 후 해당 prompt와 annotation group 간 추적 metadata를 남길지 검토.

MA에서 가져올 것:

- prompt goal/instruction UI.
- `formatAnnotationsForAgent` options 사용.

AW 추가 고려:

- worktree path와 branch 정보를 prompt에 추가할지 결정.
- agent가 수정 후 Git diff에서 확인하는 workflow를 문서화한다.

### 4. Full-text Search

MD의 본문 검색은 AW Markdown workspace에 큰 가치가 있다.

구현 전략:

- Rust backend에 worktree markdown search command 추가.
- 기존 `FsWorktreeFileProvider`의 root safety와 markdown scope를 재사용한다.
- 초기 search는 substring 기반으로 시작한다.
- payload:
  - `relativePath`
  - `title`
  - `snippet`
  - `size`
  - `modifiedMs`
  - optional `lineNumber`

추천 command:

```text
search_worktree_markdown_files(working_directory, query)
get_worktree_markdown_search_status(working_directory)
```

UI:

- Markdown tab 안에 Search panel 또는 command palette action.
- 결과 클릭 시 selected file 변경.
- 가능하면 heading/block scroll.

Watcher 연동:

- `WORKTREE_CHANGED_EVENT`에서 search query invalidate.
- active tab이 Markdown일 때만 즉시 refetch.

### 5. Local Asset / Image Rendering

MD의 local image/attachment handling을 AW에 맞게 재구현한다.

필요 기능:

- Markdown image path를 selected file 기준 relative path로 resolve.
- worktree root 밖 접근 차단.
- MIME type 판별.
- Tauri command 또는 custom protocol로 asset 제공.

추천 backend:

```text
read_worktree_asset(working_directory, current_file_path, asset_path)
```

주의:

- `read_worktree_text_file`은 UTF-8 text preview용이다. binary asset과 분리한다.
- root safety는 `resolve_worktree_path`와 같은 정책을 재사용한다.

### 6. Relative Link / WikiLink Navigation

MD의 vault navigation을 AW Markdown tab에 추가한다.

필요 기능:

- `[label](./other.md)` 클릭 시 worktree relative path resolve.
- `[label](./other.md#heading)` 클릭 시 file 선택 후 block/heading scroll.
- `[[Other Document]]`, `[[Other Document#Heading]]` 해석.
- 없는 문서 링크는 disabled 또는 external/default handling.

구현 위치:

- 순수 resolver는 `src/features/worktree-workspace/model/markdown-link-resolution.ts`.
- 장기적으로 `@yoophi/markdown-annotation-core`에 옮길 수 있다.

주의:

- AW의 `MarkdownViewer`가 block renderer 중심이라 link component hook이 어디에 들어갈지 먼저 확인해야 한다.
- 필요하면 `MarkdownViewer` package에 link resolver injection point를 추가한다.

### 7. Annotation Persistence

현재 AW annotation은 component state의 `annotationsByFile`에 머문다. 통합 제품에서는 최소한 session restore 또는 sidecar persistence가 필요하다.

선택지:

1. in-memory only: 현재 상태. 구현 단순, 손실 큼.
2. localStorage per worktree/file: 빠른 개선, conflict 약함.
3. sidecar file: MD의 `.memo` 방향. 장기적으로 적합.
4. Git-tracked review file: agent workflow와 궁합 좋음.

권장 순서:

1. localStorage draft restore.
2. `.파일명.memo` 또는 `.파일명.annotations.json` sidecar 설계.
3. save/load Tauri command.
4. Git diff에서 sidecar 변경도 확인 가능하게 표시.

Sidecar 저장 시 원칙:

- worktree root 밖 write 금지.
- selected Markdown file과 sidecar path 관계 검증.
- schema version 포함.
- source content hash 또는 modified timestamp 포함.
- anchor drift status 표시.

### 8. Worktree/Git Workflow 결합

AW만의 차별점은 Markdown review와 Git diff가 같은 공간에 있다는 점이다.

권장 workflow:

1. Markdown tab에서 문서 선택.
2. Review mode에서 annotation 작성.
3. Agent prompt로 전송.
4. Agent가 파일 수정.
5. Git tab 또는 Changes panel에서 diff 확인.
6. 필요하면 추가 annotation 또는 follow-up prompt 전송.

추가 기능 후보:

- “Send annotation prompt and switch to run panel”.
- “Open resulting changed file in Markdown tab”.
- annotation prompt와 agent run id 연결.
- run 완료 후 관련 file diff 자동 선택.

## 제안 구조

기존 AW 구조를 유지하고 Markdown workspace를 분리한다.

```text
src/features/worktree-workspace/
  model/
    markdown-tree.ts
    markdown-link-resolution.ts
    markdown-search.ts
    annotation-draft-store.ts
  ui/
    worktree-workspace-panel.tsx
    markdown-workspace-tab.tsx
    markdown-file-tree.tsx
    markdown-reader.tsx
    markdown-reviewer.tsx
    annotation-panel.tsx
    agent-prompt-panel.tsx
```

현재 `worktree-workspace-panel.tsx`가 매우 크므로, 통합 작업의 첫 단계 중 하나는 Markdown tab을 별도 컴포넌트로 추출하는 것이다.

Backend:

```text
src-tauri/src/
  domain/
    worktree_file.rs
    markdown_search.rs
    worktree_asset.rs
    annotation_sidecar.rs
  application/
    worktree_file_service.rs
    markdown_search_service.rs
    worktree_asset_service.rs
    annotation_sidecar_service.rs
  infrastructure/
    fs_worktree_file_provider.rs
    fs_markdown_search_provider.rs
    fs_worktree_asset_provider.rs
    fs_annotation_sidecar_repository.rs
```

## 단계별 마이그레이션

### Phase 0. AW Markdown Tab 기준선 고정

- 현재 Markdown tab 기능을 문서화한다.
- `worktree-workspace-panel.tsx`에서 Markdown tab을 별도 컴포넌트로 추출한다.
- 기존 annotation prompt send 동작을 테스트로 고정한다.

완료 기준:

- UI 동작 변화 없이 Markdown tab 코드가 분리된다.
- 기존 Vitest와 typecheck가 통과한다.

### Phase 1. MM식 Markdown Tree UX 보강

- 검색/정렬/최근/즐겨찾기/keyboard navigation을 추가한다.
- selected file ancestor expand를 추가한다.
- tree 상태는 worktree path별로 저장한다.

완료 기준:

- 큰 Markdown tree에서 탐색이 빠르다.
- 최근/즐겨찾기 문서를 바로 열 수 있다.

### Phase 2. Reader / Review Mode 분리

- Markdown preview에 mode toggle을 추가한다.
- Reader mode에서는 annotation toolbar를 숨긴다.
- Review mode에서는 현재 annotation 기능을 유지한다.

완료 기준:

- reader-only 사용성이 좋아진다.
- annotation 기능 회귀가 없다.

### Phase 3. MA Prompt UX 완성

- prompt goal과 user instruction UI를 추가한다.
- annotation이 없어도 prompt preview를 제공한다.
- Send 동작을 agent run flow와 더 명확히 연결한다.

완료 기준:

- MA의 prompt export UX가 AW 안에서 동등하거나 더 좋다.
- prompt 전송 후 사용자가 다음 단계로 자연스럽게 이동한다.

### Phase 4. MD식 Link / Asset 지원

- relative Markdown link navigation.
- WikiLink navigation.
- local image/attachment rendering.
- root-safe asset command.

완료 기준:

- Markdown vault 문서를 AW 안에서 자연스럽게 읽을 수 있다.
- root 밖 asset 접근은 차단된다.

### Phase 5. MD식 Full-text Search

- Rust search command 추가.
- search result panel 추가.
- watcher invalidation 연결.

완료 기준:

- 본문 검색, snippet, 결과 클릭 이동이 동작한다.
- 큰 worktree에서 기본 성능 한계를 문서화한다.

### Phase 6. Annotation Persistence

- localStorage draft restore를 먼저 추가한다.
- sidecar schema를 설계한다.
- save/load command를 추가한다.
- Git changes에서 sidecar 변경이 보이도록 workflow를 정리한다.

완료 기준:

- AW 재시작 후 annotation draft를 복원할 수 있다.
- sidecar 저장은 root-safe하게 동작한다.

### Phase 7. Agent/Git Review Loop 자동화

- annotation prompt 전송 후 run id와 annotation batch를 연결한다.
- run 완료 후 변경 파일/diff로 이동하는 action을 추가한다.
- 추가 review prompt를 쉽게 보낼 수 있게 한다.

완료 기준:

- Markdown annotation → agent 수정 → Git diff review 흐름이 하나의 workbench 안에서 닫힌다.

## Source of Truth

| 영역 | 기준 |
| --- | --- |
| 앱 베이스 | AW |
| project/worktree model | AW |
| Git/worktree diff | AW |
| agent run/prompt send | AW |
| annotation core/viewer | MA package, 이미 AW에서 사용 |
| prompt formatter | MA package |
| Markdown tree UX | MM 참고 |
| root safety | AW 현재 provider + MM 정책 보강 |
| full-text search | MD 개념을 AW Rust backend로 구현 |
| asset/image handling | MD 개념을 AW Rust backend로 구현 |
| WikiLink/relative link | MD 개념을 pure helper/package로 구현 |
| workspace productivity | AW 기본 + MD command/recent UX 참고 |
| persistence | MD `.memo` 방향 + MA annotation model + AW Git workflow |

## 주요 리스크

- AW의 Markdown tab이 이미 크다. 기능 추가 전에 컴포넌트 분리가 필요하다.
- Reader mode와 Review mode를 분리하지 않으면 일반 문서 읽기가 annotation UI에 눌릴 수 있다.
- MD의 Electron 구현을 직접 복사하면 AW Tauri 구조와 충돌한다.
- asset/search/persistence는 root safety와 직결되므로 backend 설계를 먼저 해야 한다.
- annotation sidecar를 Git-tracked 파일로 만들면 사용자가 원치 않는 변경사항이 생길 수 있다.
- agent prompt와 실제 run 결과를 연결하려면 run id, file path, annotation batch metadata 설계가 필요하다.

## 권장 첫 작업

1. `MarkdownWorkspaceTab`을 `worktree-workspace-panel.tsx`에서 분리한다.
2. 현재 Markdown tab 기능에 회귀 테스트를 추가한다.
3. MM의 file tree 검색/정렬/최근/즐겨찾기 중 검색과 정렬부터 이식한다.
4. Reader/Review mode toggle을 추가한다.
5. MA의 prompt goal/user instruction UI를 AW annotation prompt panel에 추가한다.
6. 그 다음 MD의 relative link/asset 지원을 설계한다.

## 최종 판단

AW를 베이스로 하는 통합은 네 프로젝트 중 가장 “agentic workflow”에 맞다. MA는 annotation 엔진, MM은 reader/tree polish, MD는 vault/search/workspace UX 참고 구현으로 삼고, AW의 worktree/agent/Git 루프 안에 흡수하는 방식이 적합하다.

이 전략의 성공 조건은 Markdown 기능을 독립 앱처럼 붙이는 것이 아니라, AW의 기존 강점인 agent run과 Git diff review 흐름에 자연스럽게 연결하는 것이다.
