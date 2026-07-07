# MM / MA / MD 프로젝트 특징 조사

작성일: 2026-07-07

## 대상 프로젝트

| Alias | 프로젝트 | 위치 | 한 줄 설명 |
| --- | --- | --- | --- |
| `MM` | markmini | `/Users/yoophi/project/markmini` | Tauri 기반 local-first Markdown reader |
| `MA` | markdown-annotator | `/Users/yoophi/project/agentic-workspace/apps/markdown-annotator` | Tauri 기반 Markdown annotation + agent prompt export 앱 |
| `MD` | markdeck | `/Users/yoophi/project/markdeck` | Electron 기반 Markdown reader + review/feedback 앱 |

## 전체 요약

세 프로젝트는 모두 로컬 Markdown 문서를 다루지만 중심축이 다르다.

- `MM`은 디렉터리 단위 탐색과 안전한 로컬 Markdown 읽기에 집중한다.
- `MA`는 하나의 Markdown 문서를 block/source line 단위로 annotation하고 agent에게 줄 prompt로 내보내는 데 집중한다.
- `MD`는 reader와 reviewer를 모두 포함한 더 큰 desktop product이며, 검색, asset 처리, workspace UX, feedback workflow 방향이 가장 넓다.

통합 관점에서는 `MM`을 가벼운 Tauri 기반 shell로 두고, `MA`의 annotation/prompt export 기능과 `MD`의 reader/search/workspace 아이디어를 선별적으로 흡수하는 방향이 가장 자연스럽다.

## 핵심 비교표

| 구분 | MM | MA | MD |
| --- | --- | --- | --- |
| 제품 초점 | Markdown viewer | Annotation prompt tool | Reader + reviewer product |
| 런타임 | Tauri v2 | Tauri v2 | Electron + electron-vite |
| 입력 모델 | 디렉터리 또는 Markdown 파일 | 예제 또는 단일 Markdown 파일 | content root 디렉터리 또는 Markdown 파일 |
| 탐색 | 파일 트리 중심 | 단일 문서 중심 | browse/docs/search route 중심 |
| 검색 | 파일 트리 필터링 | 없음 | 본문 full-text search |
| Markdown rendering | 일반 reader 최적화 | block/source line 기반 annotation viewer | reader + annotation overlay |
| TOC | heading 추출 + current section | block 기반 TOC package | TOC + breadcrumb |
| Mermaid | 자동 감지/render | block parser metadata + expanded view | Mermaid render |
| Annotation | 없음 | delete/question/change-request/note/approve | highlight/comment/deletion/strike |
| Export | 없음 | agent prompt Markdown | `.memo` serialization preview 방향 |
| Persistence | recent/favorite localStorage | draft 중심, prompt copy | localStorage draft, `.memo` 계획 |
| Watcher | root directory watcher | single document watcher | content root watcher |
| 안전성 | symlink/root boundary 강함 | 단일 파일 canonical 확인 중심 | IPC boundary/error normalization 강함 |
| Desktop UX | 멀티 윈도우, `mm` CLI | 문서 window/tab, `ma` CLI | menu, command palette, recent workspace |
| 테스트 | Vitest 일부 | core/react package 테스트 풍부 | Electron main 회귀 테스트 풍부 |

## MM 특징

### 제품 성격

`MM`은 로컬 디렉터리 안의 Markdown 파일을 빠르게 탐색하고 읽는 앱이다. Annotation, comment, feedback workflow, 문서 편집 UI는 의도적으로 제외된 viewer-only 성격이 강하다.

### 주요 기능

- 로컬 디렉터리 기준 Markdown 파일 탐색.
- `.md`, `.markdown` 파일 스캔.
- 스캔 중 발견된 파일을 점진적으로 표시.
- Markdown 렌더링, syntax highlighting, table/code overflow 처리.
- TOC 표시와 heading hash navigation.
- Mermaid 코드 블록 자동 감지 및 렌더링.
- 파일 트리 검색, 정렬, 최근 문서, 즐겨찾기.
- 파일 시스템 watcher 기반 자동 새로고침.
- 여러 root를 독립 창으로 여는 멀티 윈도우.
- root 밖 symlink Markdown 파일 차단.
- 앱에서 `mm` CLI wrapper 설치/확인.

### 구현 특징

- React + TypeScript + Vite + Zustand.
- Tauri/Rust backend가 session, scan, watcher, CLI 설치, multi-window lifecycle을 담당한다.
- frontend는 `src/lib/tauri.ts` wrapper를 통해 Tauri command를 호출한다.
- 파일 목록은 root-relative path 중심으로 관리된다.
- window label별 session/watchers를 관리한다.

### 잘 되어 있는 점

- 세 프로젝트 중 root safety와 symlink 차단이 가장 직접적이다.
- 디렉터리 기반 Markdown reader UX가 가장 단순하고 빠르다.
- 파일 트리 interaction이 좋다: 검색, 정렬, keyboard navigation, 최근/즐겨찾기.
- Tauri 기반이라 배포 크기와 runtime 비용이 Electron보다 작을 가능성이 높다.
- 멀티 윈도우 session model이 이미 있다.

### 부족한 점

- 본문 full-text search가 없다.
- local image/attachment를 안전하게 읽는 asset command가 없다.
- Obsidian-style WikiLink 지원이 없다.
- annotation, source line mapping, prompt export가 없다.
- backend가 한 파일에 많이 모여 있어 기능이 늘면 계층 분리가 필요하다.
- structured error code가 부족하다.

### 재사용/통합 역할

`MM`은 통합 앱의 기본 shell과 runtime으로 적합하다.

- 유지할 것: Tauri runtime, root/session model, file tree, watcher, symlink safety, `mm` CLI.
- 보강할 것: full-text search, asset read, review mode, annotation prompt export.

## MA 특징

### 제품 성격

`MA`는 Markdown 문서를 block 단위로 렌더링하고, 사용자가 block 또는 선택 영역에 annotation을 남긴 뒤, agent에게 전달할 구조화된 Markdown prompt를 만드는 앱이다. Plannotator식 block annotation workflow에 가깝다.

### 주요 기능

- 예제 Markdown 문서 선택.
- Tauri 파일 다이얼로그로 로컬 Markdown 파일 열기.
- 브라우저 fallback file input.
- Markdown block parser와 source line 추적.
- block 단위 delete/note annotation.
- 선택 영역 단위 delete/note/change-request/question/approve annotation.
- multi-block selection을 block별 segment로 분해하고 `groupId`로 묶음.
- annotation 목록 관리.
- agent prompt 목표 선택: 문서 수정, 검토 참고, custom.
- 사용자 지침 입력.
- file path, line range, selected text, raw Markdown context를 포함한 prompt export.
- clipboard copy.
- `ma`, `ma-dev`, `markdown-annotator-cli` 실행 흐름.

### 구현 특징

- Tauri v2 + React + Vite.
- 앱 내부는 Feature-Sliced Design 형태: `app`, `pages`, `features`, `entities`, `shared`.
- Rust backend는 `domain`, `application`, `inbound`, `infrastructure`로 나뉜 hexagonal architecture 방향.
- 핵심 annotation 로직은 workspace package로 분리되어 있다.
  - `@yoophi/markdown-annotation-core`
  - `@yoophi/markdown-annotation-react`
  - `@yoophi/workspace-auto-refresh`
- `parseMarkdownToBlocks`가 Markdown을 block으로 나누고 source line을 보존한다.
- `formatAnnotationsForAgent`가 agent에게 전달할 Markdown prompt를 생성한다.

### 잘 되어 있는 점

- 세 프로젝트 중 agent prompt export가 가장 구체적이다.
- source line, raw Markdown context, offset, selected text를 prompt에 포함한다.
- annotation type이 agent 작업에 적합하다: `delete`, `question`, `change-request`, `note`, `approve`.
- core/react package에 테스트가 풍부하다.
- UI primitive adapter 계약이 있어 annotation viewer를 다른 앱에 이식하기 좋다.
- Mermaid expanded view, block shell, inline annotation 표시가 잘 분리되어 있다.

### 부족한 점

- 디렉터리 탐색과 multi-document reader UX가 없다.
- 단일 파일 중심이라 vault/workspace browsing에는 맞지 않는다.
- root boundary와 symlink safety는 MM보다 약하다.
- annotation은 draft/prompt export 중심이며 sidecar persistence는 없다.
- block id가 parse order 기반이라 문서 수정 후 anchor 안정성이 제한적이다.
- `workspace:*` package 의존성이 있어 MM에 바로 dependency로 붙이기는 어렵다.

### 재사용/통합 역할

`MA`는 통합 앱의 Review mode와 agent handoff 기능의 기준 구현으로 적합하다.

- 가져올 것: block parser, annotation model, annotation viewer, prompt formatter, stale selection helper.
- 그대로 가져오지 않을 것: 단일 document watcher, 단일 파일 중심 window model.

## MD 특징

### 제품 성격

`MD`는 desktop-first Markdown reader이자 review tool이다. Reader와 Reviewer를 모두 제품 목표로 삼고 있으며, 세 프로젝트 중 기능 범위가 가장 넓다.

### 주요 기능

- content root 기반 directory browsing.
- Markdown rendering.
- Mermaid code block rendering.
- full-text search.
- TOC, breadcrumb, recent docs.
- dark/light theme.
- local image/attachment rendering.
- relative Markdown link navigation.
- Obsidian-style WikiLink 지원.
- selection highlight/comment/strike.
- block-level highlight/comment/delete actions.
- feedback side panel.
- `.memo` sidecar serialization preview.
- recent workspace reopen.
- command palette, keyboard shortcut help.
- Electron packaging baseline.

### 구현 특징

- monorepo 구조의 Electron desktop app.
- Electron main / preload / renderer 분리.
- renderer는 React Router `HashRouter`와 React Query 기반 async state를 사용한다.
- desktop main은 core/application/infrastructure 계층으로 분리되어 있다.
- filesystem, search, asset read, desktop integration은 Electron main이 담당한다.
- renderer는 preload IPC contract를 통해 데이터에 접근한다.

### 잘 되어 있는 점

- 세 프로젝트 중 reader product 기능이 가장 넓다.
- full-text search와 snippet 생성이 있다.
- local image/attachment, relative link, WikiLink 같은 Markdown vault UX가 좋다.
- desktop main 아키텍처와 IPC boundary가 명확하다.
- command/query split, launch target, content root, watcher invalidation 테스트가 풍부하다.
- annotation/feedback product 방향과 `.memo` sidecar 문서가 있다.

### 부족한 점

- Electron 기반이라 runtime과 packaging 비용이 Tauri보다 크다.
- renderer 구조 정리가 아직 TODO로 남아 있다.
- annotation은 draft/preview 중심이며 실제 `.memo` file write/read는 미완이다.
- symlink root boundary 정책은 MM보다 직접적이지 않다.
- TypeScript로 완전히 통일되지 않은 main runtime JavaScript가 있다.

### 재사용/통합 역할

`MD`는 통합 앱의 reader/workspace/search 기능 참조로 적합하다.

- 가져올 것: full-text search 개념, asset/image handling, WikiLink/relative link, command palette/workspace UX, structured error normalization, architecture docs.
- 조심할 것: Electron main 구현을 Tauri/Rust에 그대로 복사하지 말고 개념만 이식해야 한다.

## 기능별 Source of Truth 제안

| 영역 | 권장 기준 | 이유 |
| --- | --- | --- |
| 앱 runtime | MM | Tauri 기반이고 현재 통합 대상 repository |
| 디렉터리 scan | MM | root safety와 symlink 차단이 강함 |
| 파일 트리 UX | MM | 검색/정렬/최근/즐겨찾기와 keyboard navigation 보유 |
| 기본 Markdown reader | MM | 가볍고 viewer-only에 적합 |
| full-text search | MD | 이미 search index/snippet 흐름 보유 |
| local image/attachment | MD | asset read와 Markdown asset link 처리 경험 보유 |
| WikiLink/relative link | MD | vault-style navigation 기능 보유 |
| block/source line parser | MA | annotation prompt에 필요한 line mapping 보유 |
| annotation draft model | MA | agent 작업에 맞는 annotation type 보유 |
| annotation viewer | MA | package화되어 이식성이 좋음 |
| agent prompt export | MA | 가장 구체적인 formatter 보유 |
| feedback sidecar 방향 | MD | `.memo` persistence 설계가 있음 |
| watcher | MM | root watcher를 유지하고 MA stale helper만 보강 |
| desktop command/workspace UX | MD 참고 | command palette/recent workspace 경험이 있음 |
| backend layering | MA/MD 참고 | MM이 커질 때 계층 분리 참고 가능 |

## 통합 관점의 역할 분담

### MM을 중심에 둘 이유

- 현재 작업 repository다.
- Tauri 기반이라 MA와 runtime 계열이 같다.
- directory reader와 root safety가 이미 강하다.
- 통합 후에도 “가볍고 빠른 Markdown reader”라는 기본 가치가 유지된다.

### MA에서 먼저 가져올 것

1. `parseMarkdownToBlocks`
2. `detectMermaidBlock`
3. `extractTocEntries`
4. annotation type/model
5. `formatAnnotationsForAgent`
6. `MarkdownViewer`와 selection annotation helpers
7. stale selection helper

### MD에서 먼저 가져올 것

1. full-text search UX와 index/cache 아이디어
2. local image/attachment handling
3. WikiLink/relative Markdown link resolution
4. structured desktop error normalization
5. recent workspace / command palette UX 아이디어
6. `.memo` sidecar 설계 문서

## 통합 리스크

- `MM`의 viewer-only 단순성과 `MA/MD`의 review 기능이 충돌할 수 있다.
- `MA`의 package를 `workspace:*`로 그대로 붙이면 MM의 독립 프로젝트 구조와 충돌한다.
- `MD`의 Electron IPC/main 코드는 Tauri/Rust 구조에 직접 맞지 않는다.
- annotation persistence를 너무 빨리 도입하면 file safety, conflict, anchor drift 문제가 커진다.
- 세 프로젝트 모두 Markdown rendering이 다르므로 하나로 합칠 때 Mermaid, TOC, link, table, code block 회귀가 생길 수 있다.

## 권장 통합 순서

1. `MM`을 base app으로 고정한다.
2. `MA`의 annotation core 순수 함수만 MM 내부로 이식하고 테스트를 추가한다.
3. MM에 experimental Review mode를 추가해 prompt preview부터 표시한다.
4. MA의 annotation viewer와 selection annotation을 Review mode에 연결한다.
5. MD의 relative link, asset image, WikiLink 처리를 reader에 보강한다.
6. MD의 full-text search 아이디어를 MM Tauri command 또는 Rust-side index로 구현한다.
7. annotation draft가 안정화되면 MD의 `.memo` sidecar 방향을 참고해 persistence를 설계한다.

## 결론

세 프로젝트는 경쟁 관계라기보다 서로 다른 층을 담당한다.

- `MM`: 통합 앱의 뼈대와 안전한 local reader.
- `MA`: annotation과 agent prompt handoff 엔진.
- `MD`: 더 성숙한 reader/workspace/reviewer 제품 참고 구현.

따라서 최종 통합 제품은 `MM`의 Tauri reader를 유지하면서, `MA`의 Review mode를 붙이고, `MD`의 search/asset/workspace 아이디어를 단계적으로 흡수하는 형태가 가장 현실적이다.
