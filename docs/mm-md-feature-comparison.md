# MM / MD / MA 기능 비교 및 통합 마이그레이션 메모

작성일: 2026-07-07

## 목적

현재 프로젝트 `MM(markmini)`, 참조 프로젝트 `MD(markdeck)`, 참조 프로젝트 `MA(markdown-annotator)`의 기능과 구현 상태를 비교하고, 세 프로젝트를 하나의 제품/코드베이스로 통합하기 위한 판단 기준을 정리한다.

- `MM`: `/Users/yoophi/project/markmini`
- `MD`: `/Users/yoophi/project/markdeck`
- `MA`: `/Users/yoophi/project/agentic-workspace/apps/markdown-annotator`

## 한 줄 요약

`MM`은 Tauri 기반의 작고 빠른 로컬 Markdown viewer로, 파일 스캔 안전성, 멀티 윈도우, 단순한 상태 모델이 좋다. `MD`는 Electron 기반의 더 큰 Markdown reader/reviewer로, 검색, 라우팅, 첨부 asset 처리, workspace UX, desktop main 아키텍처가 풍부하다. `MA`는 Tauri 기반의 단일 문서 annotation 도구로, block/source line 기반 annotation과 agent prompt export가 가장 구체적이다.

통합 방향은 `MM`을 가벼운 Tauri 런타임/제품 베이스로 삼고, `MD`의 reader/search/workspace 기능과 `MA`의 annotation/prompt export 기능을 선별적으로 이식하는 방식이 가장 현실적이다.

## 프로젝트 성격 비교

| 구분 | MM | MD | MA |
| --- | --- | --- | --- |
| 제품 방향 | Local-first Markdown reader | Markdown reader + review/feedback product | Markdown annotation + agent prompt export |
| 런타임 | Tauri v2 + Rust | Electron + electron-vite | Tauri v2 + Rust |
| 프론트엔드 | React + TypeScript + Vite | React + TypeScript + electron-vite renderer | React + TypeScript + Vite |
| 상태 관리 | Zustand 중심 | React Query + route state + renderer adapters | React state 중심, core/react package 활용 |
| 주 입력 | 디렉터리 또는 Markdown 파일 | content root 또는 Markdown 파일 | 예제 또는 단일 Markdown 파일 |
| 백엔드/OS 경계 | Rust Tauri commands | Electron main/preload IPC | Rust Tauri commands, domain/application/inbound/infrastructure |
| 주요 강점 | 단순성, symlink 안전성, 멀티 윈도우, 점진 스캔 | 검색, asset 처리, WikiLink, workspace UX, 아키텍처 분리 | block parser, source line tracking, annotation, prompt export |
| 주요 결손 | full-text search, asset/image IPC, annotation, workspace UX | 런타임 무거움, renderer 구조 정리 필요, annotation persistence 미완 | directory browser 없음, root safety 약함, persistence 없음 |

## 기능별 비교

### 1. Markdown 읽기

**MM에서 잘 되어 있는 점**

- `react-markdown`, `remark-gfm`, `rehype-highlight` 기반 Markdown 렌더링이 간결하다.
- Mermaid fenced code block과 Mermaid처럼 보이는 코드 블록을 감지해 렌더링한다.
- heading id 생성, hash 이동, TOC 연동이 단순하게 구성되어 있다.
- 테이블과 코드 블록 overflow 처리가 viewer 앱에 맞게 정리되어 있다.

**MM에서 부족한 점**

- local image/attachment를 안전한 앱 경로로 변환해 읽는 기능이 없다.
- Obsidian-style WikiLink 지원이 없다.
- Markdown source position과 rendered block 간 mapping이 없다.
- annotation, edit suggestion, source patch 같은 확장 기능을 붙이기 위한 중간 document model이 없다.

**MD에서 잘 되어 있는 점**

- relative Markdown link, local image/attachment, desktop asset link 처리 흐름이 있다.
- WikiLink 지원 방향이 README에 명시되어 있고 관련 content link helper가 존재한다.
- TOC, breadcrumb, recent docs, search route 등 reader product 기능이 넓다.
- source-to-render mapping 설계 문서가 있어 annotation/edit suggestion으로 확장할 방향이 구체적이다.

**MD에서 부족한 점**

- Markdown rendering 컴포넌트가 reader 기능과 annotation 기능을 함께 많이 들고 있어 복잡하다.
- Electron IPC/main 구조의 구현을 Tauri 앱에 그대로 가져올 수 없다.

**MA에서 잘 되어 있는 점**

- `parseMarkdownToBlocks`가 Markdown을 block으로 나누고 source line, raw Markdown context, block order를 보존한다.
- frontmatter line 보정, table/list/blockquote/code block parsing, Mermaid metadata가 있다.
- `@yoophi/markdown-annotation-react`의 viewer가 block shell과 inline annotation을 렌더링한다.
- Mermaid expanded view와 annotation-aware block UI가 분리되어 있다.

**MA에서 부족한 점**

- 기본 reader라기보다 annotation viewer에 가깝다.
- block parser는 실용적인 line parser이며 완전한 Markdown AST parser는 아니다.
- local image/attachment, WikiLink, directory browsing은 주 기능이 아니다.

### 2. 문서 탐색 / 파일 트리

**MM에서 잘 되어 있는 점**

- 전체 Markdown 파일 목록을 root-relative path로 관리해 구현이 단순하다.
- 검색, 정렬, 정렬 방향, 수정일/파일 크기 metadata, 최근 문서, 즐겨찾기 UI가 들어가 있다.
- keyboard navigation, directory expand/collapse, selected file ancestor 자동 확장이 구현되어 있다.
- 스캔 중 progress payload를 받아 파일 목록을 점진적으로 보여준다.

**MM에서 부족한 점**

- 검색은 현재 파일명/path 기반 tree filtering에 가깝고, 문서 본문 full-text search는 없다.
- workspace/content root 선택 UX가 작다. 실행 인자 중심이고 앱 내부 root 전환 흐름은 제한적이다.
- 최근 workspace 개념이 없다.

**MD에서 잘 되어 있는 점**

- browse page, docs route, search page가 분리되어 reader 앱의 navigation surface가 넓다.
- content root, recent content roots, directory picker, open recent root use case가 있다.
- Electron main의 `listDirectory`, `buildDocumentTree`, `collectMarkdownRelativePaths` query가 명확히 나뉘어 있다.

**MD에서 부족한 점**

- document tree 자체의 상호작용 밀도는 MM 쪽이 더 정교하다.
- README/TODO 기준으로 renderer 구조 정리와 workspace restore 보강이 아직 남아 있다.

**MA에서 잘 되어 있는 점**

- 단일 Markdown 파일을 파일 다이얼로그, CLI, query path로 여는 흐름이 있다.
- 같은 파일이 이미 열려 있으면 기존 document window를 focus한다.
- macOS native tabbing을 일부 지원한다.

**MA에서 부족한 점**

- 디렉터리 전체 탐색과 파일 트리 UX가 없다.
- root-relative document path, workspace, recent folder 개념이 없다.
- 단일 문서 중심이라 MM/MD의 vault browsing을 대체할 수 없다.

### 3. 검색

**MM에서 잘 되어 있는 점**

- 파일 트리 내 빠른 필터링과 검색어 persistence가 있다.
- 검색 UX가 현재 viewer surface 안에 자연스럽게 들어가 있다.

**MM에서 부족한 점**

- 본문 full-text search가 없다.
- search index/cache/query status 개념이 없다.
- snippet, search result page, 검색 결과에서 문서 이동 흐름이 없다.

**MD에서 잘 되어 있는 점**

- `searchMarkdownDocuments(query)`와 search index cache가 있다.
- path, title, content를 합친 lower-case index로 단순하지만 실용적인 full-text search를 제공한다.
- snippet 생성, search status, search route/page가 있다.

**MD에서 부족한 점**

- 대형 vault에서의 indexing 성능 측정과 incremental refresh는 TODO로 남아 있다.
- 검색 엔진은 단순 substring 기반이라 ranking, tokenization, fuzzy search는 없다.

**MA에서 잘 되어 있는 점**

- 검색 제품 기능은 거의 없다.
- annotation prompt export에서 line range와 source context를 제공하므로 agent가 후속 탐색을 할 단서는 충분히 제공한다.

**MA에서 부족한 점**

- 파일명 검색, 본문 검색, 결과 page, index/cache 개념이 없다.

### 4. 파일 시스템 안전성 / watcher

**MM에서 잘 되어 있는 점**

- Rust에서 canonical path를 기준으로 root 밖 symlink Markdown 파일을 차단하는 모델이 명확하다.
- `.git`, `node_modules`, `target`, `dist`, `.next` 같은 heavy/generated directory를 스캔에서 제외한다.
- 접근 불가 디렉터리는 건너뛰고 가능한 문서를 계속 표시한다.
- watcher가 window label별로 설치/정리되어 멀티 윈도우와 잘 맞는다.

**MM에서 부족한 점**

- error payload가 Rust 문자열 중심이라 renderer에서 structured error code로 분기하기 어렵다.
- full-text search index나 asset cache까지 watcher invalidation에 연결되어 있지 않다.
- annotation draft가 외부 파일 변경으로 stale해졌는지 판단하지 않는다.

**MD에서 잘 되어 있는 점**

- main/preload/renderer 경계가 문서화되어 있고 renderer가 fs를 직접 만지지 않는 원칙이 명확하다.
- unsafe path, not found, permission denied, invalid input 등을 desktop-safe error code로 normalize한다.
- watcher invalidation과 content refresh orchestration에 대한 회귀 테스트가 있다.

**MD에서 부족한 점**

- symlink가 root 밖을 가리키는 경우의 강한 canonical boundary 정책은 MM 쪽이 더 직접적으로 보인다.
- watcher failure/reconnect, 대량 변경 성능은 TODO에 남아 있다.

**MA에서 잘 되어 있는 점**

- 단일 document watcher가 변경 이벤트를 debounce해서 emit한다.
- `@yoophi/workspace-auto-refresh`에 stale selection 판단 helper가 있다.
- 문서 reload 후 annotation/selection 상태를 어떻게 다룰지 UX가 있다.

**MA에서 부족한 점**

- root directory 전체 watcher가 아니며, MM의 tree/session watcher를 대체할 수 없다.
- 단일 파일 absolute path read 중심이라 root boundary 정책은 약하다.

### 5. Desktop 실행 / 멀티 윈도우 / CLI

**MM에서 잘 되어 있는 점**

- Tauri single-instance plugin을 사용하면서 다른 root는 새 window로 열고, 같은 root는 기존 window를 focus한다.
- directory 또는 Markdown file launch target을 처리하고, file target이면 부모 directory를 root로 잡고 해당 문서를 연다.
- window별 session/watchers가 분리되어 있다.
- 앱에서 `mm` CLI launcher를 설치/확인하는 기능이 있다.

**MM에서 부족한 점**

- app menu, command palette, shortcut help, recent workspace reopen 같은 desktop 생산성 layer는 작다.
- packaged app release/signing/notarization 자동화는 아직 단순하다.

**MD에서 잘 되어 있는 점**

- Electron menu, command palette, keyboard command, shortcut help, single-instance handoff, recent workspace UX가 있다.
- desktop main application/core/infrastructure 계층에 launch/content-root/watcher 흐름 테스트가 많다.
- packaging/hardened runtime baseline이 있다.

**MD에서 부족한 점**

- Electron 기반이라 앱 크기와 런타임 비용이 MM/MA보다 크다.
- main runtime 일부가 JavaScript이고 TypeScript 전환이 TODO로 남아 있다.

**MA에서 잘 되어 있는 점**

- release용 `ma`, 개발용 `ma-dev`, 설명적 binary인 `markdown-annotator-cli` 흐름이 있다.
- 같은 문서가 이미 열려 있으면 document hash label로 기존 window를 focus한다.
- macOS native tabbing을 일부 지원한다.
- `Install CLI` 버튼으로 `~/.local/bin/ma` wrapper를 설치한다.

**MA에서 부족한 점**

- directory root 기반 multi-window/session model은 없다.
- `ma` CLI는 MM의 `mm`와 통합 시 역할 충돌 가능성이 있다.

### 6. Annotation / review / feedback

**MM에서 잘 되어 있는 점**

- 의도적으로 viewer-only baseline을 유지하고 있어 기능 범위가 명확하다.
- 문서 읽기 품질을 해치지 않고 review 기능을 별도 단계로 설계할 여지가 있다.

**MM에서 부족한 점**

- annotation, selection popover, block actions, feedback panel, `.memo` model이 없다.
- source/render mapping이 없어 annotation persistence를 바로 얹기 어렵다.
- agent prompt export가 없다.

**MD에서 잘 되어 있는 점**

- `highlight`, `comment`, `deletion`, `strike` annotation kind와 `text-range`, `block` anchor 모델이 있다.
- selection quote, occurrence, prefix/suffix 기반 re-anchoring 힌트가 있다.
- feedback side panel, block quick actions, serialization preview가 있다.
- `.memo` sidecar 방향이 문서화되어 있다.

**MD에서 부족한 점**

- `.memo` 실제 file write/read는 아직 후속 작업이다.
- anchor drift recovery와 export/share flow가 미완이다.
- annotation UI가 Markdown rendering과 강하게 결합되어 있어 이식 시 분리 설계가 필요하다.

**MA에서 잘 되어 있는 점**

- annotation type이 `delete`, `question`, `change-request`, `note`, `approve`로 agent 작업에 적합하다.
- anchor가 `blockId`, offset, selectedText, startLine/endLine을 포함한다.
- multi-block selection을 여러 annotation으로 나누고 `groupId`로 묶는다.
- block delete/note, inline delete/note/change-request/question/approve를 다룬다.
- `formatAnnotationsForAgent`가 file path, 목표, 사용자 지침, line range, raw Markdown context, replacement instruction을 포함한 Markdown prompt를 만든다.

**MA에서 부족한 점**

- annotation은 draft/prompt export 중심이며 sidecar persistence는 없다.
- block id가 parse order 기반 `block-0`, `block-1`이라 문서 편집 후 안정성이 제한적이다.
- prompt export 이후 앱 내부 agent 실행이나 자동 문서 수정은 없다.

### 7. 테스트 / 유지보수성

**MM에서 잘 되어 있는 점**

- Vitest로 app store와 file tree behavior를 검증한다.
- 작은 코드베이스라 변경 영향 범위를 파악하기 쉽다.
- Rust backend는 helper 단위로 더 테스트를 늘리기 좋은 구조다.

**MM에서 부족한 점**

- Tauri backend 회귀 테스트와 integration-level smoke test가 부족하다.
- 파일 시스템 edge case, watcher, symlink 정책에 대한 자동 테스트가 더 필요하다.

**MD에서 잘 되어 있는 점**

- Electron main core/application/adapters에 Node test 기반 회귀 테스트가 많다.
- command/query split, launch target, content root, watcher invalidation, error normalization 테스트가 있다.
- docs에 platform boundary와 architecture direction이 잘 남아 있다.

**MD에서 부족한 점**

- renderer integration test와 packaged-app smoke test는 TODO에 가깝다.
- renderer 구조가 아직 정리 중이라 대형 기능 추가 전에 cleanup이 필요하다고 문서에 적혀 있다.

**MA에서 잘 되어 있는 점**

- `markdown-annotation-core`, `markdown-annotation-react`, `workspace-auto-refresh` package에 parser, TOC, Mermaid, prompt formatter, annotation viewer, selection staleness 테스트가 많다.
- UI primitive adapter 계약이 있어 viewer 이식성이 좋다.
- Rust backend가 domain/application/inbound/infrastructure 형태로 나뉘어 커질 여지가 있다.

**MA에서 부족한 점**

- 독립 앱 수준의 directory browsing/integration 테스트는 없다.
- annotation persistence와 drift recovery 테스트는 아직 필요하다.

## 통합 시 권장 제품 결정

먼저 아래 결정을 내려야 한다.

1. 통합 제품이 `viewer-only 확장`인지, `reader + reviewer`인지 결정한다.
2. 런타임을 Tauri로 통일할지 Electron으로 유지할지 결정한다.
3. annotation의 1차 산출물을 prompt export로 둘지, sidecar persistence까지 포함할지 결정한다.
4. `mm` CLI만 유지할지, `ma` compatibility alias를 둘지 결정한다.

현재 상태만 보면 추천은 다음과 같다.

- 런타임/제품 베이스: `MM`
- reader/search/workspace 참조: `MD`
- annotation/prompt export 참조: `MA`
- 1차 통합 범위: reader parity + asset/link 개선
- 2차 통합 범위: search, workspace UX, structured error
- 3차 통합 범위: MA 기반 Review mode와 prompt export
- 4차 통합 범위: MD의 `.memo` 방향을 참고한 persistence

이유는 `MM`이 더 작고 Tauri 기반이라 앞으로 유지 비용이 낮고, `MA`와 같은 Tauri 계열이라 annotation 기능을 붙이기 쉽기 때문이다. `MD`는 기능 아이디어와 아키텍처 참고 가치가 크지만 Electron 구현을 MM에 그대로 이식하기는 어렵다.

## 권장 Source of Truth

| 영역 | 기준 구현 |
| --- | --- |
| 런타임/앱 셸 | MM |
| 파일 스캔/root safety | MM |
| 멀티 윈도우 | MM |
| 파일 트리 interaction | MM |
| 기본 Markdown reader | MM |
| full-text search | MD |
| asset/image handling | MD |
| WikiLink/relative link | MD |
| route/navigation model | MD 참고, MM에 맞게 축소 |
| block/source line parser | MA |
| annotation draft model | MA |
| annotation viewer/selection UX | MA |
| agent prompt formatter | MA |
| `.memo` sidecar persistence 방향 | MD |
| desktop error normalization | MD |
| stale selection 판단 | MA |
| watcher | MM root watcher 유지 |
| backend layering | MA/MD 참고 |
| 테스트 구조 | MM Vitest + MA package 테스트 패턴 + MD main 회귀 테스트 전략 |

## 마이그레이션 제안 단계

### Phase 0. 통합 기준선 고정

- `MM`의 viewer-only baseline을 유지한 상태에서 문서와 테스트를 먼저 정리한다.
- `MD`에서 가져올 기능을 reader/search/workspace로 분류한다.
- `MA`에서 가져올 기능을 annotation-core/review-viewer/prompt-export로 분류한다.
- 동일 기능 중 어느 구현을 source of truth로 삼을지 위 표 기준으로 고정한다.

완료 기준:

- 통합 제품 범위가 `viewer-only 확장`인지 `reader + reviewer`인지 결정된다.
- Review mode가 기본 기능인지 experimental 기능인지 결정된다.

### Phase 1. Reader parity

- MM Markdown renderer에 MD의 local asset/image link 처리 방식을 이식한다.
- relative Markdown link와 hash navigation의 현재 MM 동작을 유지하면서 WikiLink 지원을 추가한다.
- MD의 `content-links`, `assets`, `markdown` helper 중 순수 함수만 먼저 가져온다.
- 이 단계에서는 annotation UI를 가져오지 않는다.

완료 기준:

- directory open, Markdown file open, relative link, hash link, Mermaid, table, code block, local image가 동작한다.
- `pnpm test`, `pnpm typecheck`, `pnpm build`, `cargo check --manifest-path src-tauri/Cargo.toml` 통과.

### Phase 2. Search / workspace UX

- MD의 full-text search index 개념을 MM의 Rust backend 또는 frontend adapter 중 어디에 둘지 결정한다.
- 권장: 파일 읽기와 root safety는 Rust가 유지하고, search index도 Rust command로 제공한다. 초기에는 단순 substring search로 충분하다.
- 검색 결과 page 또는 panel을 추가한다.
- recent workspace/content root UX는 MM의 multi-window model과 충돌하지 않게 설계한다.

완료 기준:

- 본문 검색, snippet, 결과 클릭 이동, watcher invalidation 후 검색 갱신이 동작한다.
- 검색 성능 한계와 대형 directory fallback 정책이 문서화된다.

### Phase 3. Desktop command/error layer 정리

- MD의 structured desktop error code 방식을 MM Tauri command 결과에 맞게 도입한다.
- command palette/shortcut help는 검색과 workspace 전환이 들어간 뒤 추가한다.
- Tauri event 이름과 command wrapper는 `src/lib/tauri.ts`에서 계속 중앙 관리한다.

완료 기준:

- renderer는 문자열 error parsing 대신 code 기반 error state를 사용할 수 있다.
- 주요 desktop command가 테스트 가능해진다.

### Phase 4. MA core 기반 Review mode 준비

- MA의 순수 로직을 MM 내부로 이식하거나 wrapper로 둔다.
  - `parseMarkdownToBlocks`
  - `detectMermaidBlock`
  - `extractTocEntries`
  - `stripInlineMarkdown`
  - annotation types
  - `formatAnnotationsForAgent`
- `src/lib/annotation` 또는 유사한 독립 영역에 배치한다.
- `app-store.ts`에 annotation state를 섞지 말고 별도 review store 또는 component reducer를 둔다.

완료 기준:

- 현재 selected document content를 block/source line model로 변환할 수 있다.
- annotation 없이도 prompt preview를 만들 수 있다.
- parser/formatter 테스트가 MM Vitest에 추가된다.

### Phase 5. MA annotation viewer 이식

- MA의 `MarkdownViewer`, `AnnotationInputDialog`, `buildViewerAnnotationMaps`, `getSelectionAnchors`, `segmentTextByAnnotations`, `scrollToBlock` 중 필요한 부분을 이식한다.
- MM의 shadcn/Radix UI primitive에 맞는 adapter를 작성한다.
- 기존 `MarkdownView`는 기본 reader로 유지하고, Review mode에서만 annotation-aware viewer를 사용한다.

완료 기준:

- block delete/note annotation이 동작한다.
- selection delete/note/change-request/question/approve annotation이 동작한다.
- multi-block selection이 `groupId`로 묶인다.
- annotation 목록과 prompt export가 연동된다.

### Phase 6. Stale selection / watcher 연동

- MM root watcher를 source of truth로 유지한다.
- MA의 stale selection helper를 현재 문서 reload 흐름에 연결한다.
- 단일 document watcher는 중복이므로 가져오지 않는다.

완료 기준:

- 외부에서 현재 문서가 수정되면 문서 reload가 일어난다.
- Review mode에 draft annotation이 있을 때 reload가 발생하면 stale 가능성을 표시한다.
- 사용자가 draft 유지/삭제/재검토를 선택할 수 있다.

### Phase 7. `.memo` persistence / export

- MD의 `.memo` sidecar 방향과 MA의 prompt formatter를 비교해 저장 schema를 확정한다.
- 초기에는 clipboard prompt export를 우선하고, sidecar 저장은 별도 단계로 둔다.
- file write/read는 반드시 Tauri/Rust command를 통해 수행한다.
- root 밖 write를 막고, Markdown file과 sidecar 경로의 관계를 canonical path로 검증한다.

완료 기준:

- prompt export가 안정적으로 동작한다.
- 이후 `.memo` 저장/로드, 외부 편집 후 재부착, feedback summary export를 단계적으로 추가할 수 있다.

## 주요 리스크

- `viewer-only`와 `reviewer` 제품 방향이 충돌할 수 있다. annotation은 별도 Review mode로 숨기는 편이 안전하다.
- MD의 Electron main 구조를 그대로 MM에 복사하면 Tauri/Rust 경계와 맞지 않는다. 개념만 가져오고 구현은 Tauri command 기준으로 재작성해야 한다.
- MA package를 `workspace:*`로 직접 추가하면 MM의 독립 프로젝트 구조와 충돌한다. 초기에는 필요한 순수 함수만 이식하는 편이 안전하다.
- annotation을 기본 Markdown renderer에 바로 섞으면 MM의 장점인 단순성이 사라진다.
- search index를 frontend-only로 만들면 대형 directory와 watcher invalidation에서 한계가 빨리 온다.
- local asset/image handling은 root safety와 직접 연결되므로 Rust command 설계가 먼저 필요하다.
- MA의 parse-order block id는 문서 수정 후 annotation 안정성이 낮을 수 있다.

## 다음 액션

1. 통합 제품 범위를 `viewer-only 확장` 또는 `reader + reviewer` 중 하나로 확정한다.
2. Phase 1 범위의 세부 이슈를 만든다: asset/image, WikiLink, relative link parity.
3. MD helper 중 순수 함수와 Electron 결합 코드를 분리해 이식 후보 목록을 만든다.
4. MA core 중 순수 함수와 UI 결합 코드를 분리해 이식 후보 목록을 만든다.
5. MM backend에 structured error payload와 asset read command를 추가할지 설계한다.
6. Review mode는 MA 기반 prompt preview부터 작게 시작한다.
