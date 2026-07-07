# MM / MA 기능 비교 및 통합 마이그레이션 전략

작성일: 2026-07-07

## 목적

`MM(markmini)`와 `MA(markdown-annotator)`의 기능과 구현 방식을 비교하고, 두 프로젝트를 하나의 프로젝트로 통합하기 위한 현실적인 전략을 정리한다.

- `MM`: `/Users/yoophi/project/markmini`
- `MA`: `/Users/yoophi/project/agentic-workspace/apps/markdown-annotator`

## 결론

통합 베이스는 `MM`을 권장한다. `MM`은 디렉터리 기반 Markdown reader, root 안전성, 점진 스캔, 멀티 윈도우가 이미 잘 정리되어 있다. `MA`는 단일 Markdown 문서의 block/source line 기반 annotation, agent prompt export, annotation-aware Markdown viewer가 강점이다.

따라서 통합 방향은 다음이 적절하다.

1. `MM`의 파일 탐색/세션/멀티 윈도우/Tauri backend를 유지한다.
2. `MA`의 annotation core와 annotation viewer를 `MM`의 선택 문서 reader에 review mode로 붙인다.
3. `MA`의 단일 파일 open/window 모델은 그대로 가져오지 않고, `MM`의 directory-root/session model에 맞게 재해석한다.
4. Annotation 결과는 초기에 agent prompt export까지 지원하고, 실제 Markdown 수정/저장 기능은 별도 phase로 분리한다.

## 프로젝트 성격 비교

| 구분 | MM | MA |
| --- | --- | --- |
| 제품 목적 | 로컬 Markdown 디렉터리 탐색과 읽기 | Markdown annotation 후 agent prompt export |
| 런타임 | Tauri v2 + React + Rust | Tauri v2 + React + Rust |
| 주 입력 | 디렉터리 또는 Markdown 파일 | 예제 문서 또는 단일 Markdown 파일 |
| 주요 단위 | root directory session, relative document path | document, Markdown block, annotation draft |
| 화면 구조 | 파일 트리 + reader + TOC | document viewer + annotation 목록 + prompt export |
| 백엔드 강점 | root-safe scan/read, symlink 차단, per-window watcher | single document watcher, window/tab open, CLI wrapper |
| 프론트엔드 강점 | 문서 트리 검색/정렬/최근/즐겨찾기 | block parser, selection annotation, prompt formatter |
| 현재 제외/부족 | annotation, prompt export, source line mapping | directory browser, root safety, multi-document vault UX |

## 기능별 비교

### 1. 문서 열기와 탐색

**MM 강점**

- 디렉터리 전체를 root로 삼고 `.md`, `.markdown` 파일을 점진적으로 스캔한다.
- 파일 트리에서 검색, 정렬, 최근 문서, 즐겨찾기를 제공한다.
- Markdown 파일을 직접 열면 부모 디렉터리를 root로 잡고 해당 문서를 선택한다.
- 같은 root는 기존 window를 focus하고, 다른 root는 새 window/session으로 연다.

**MM 부족점**

- 단일 파일을 annotation task로 여는 모드가 없다.
- opened document를 agent task context로 변환하는 흐름이 없다.

**MA 강점**

- 파일 다이얼로그 또는 CLI로 단일 Markdown 파일을 바로 열 수 있다.
- 같은 파일이 이미 열려 있으면 기존 document window를 focus한다.
- macOS native tabbing을 일부 지원한다.

**MA 부족점**

- 디렉터리 전체 탐색과 문서 트리 UX가 없다.
- root-relative path, root boundary, symlink safety 개념이 약하다.
- 단일 파일 중심이라 여러 문서를 계속 탐색하며 읽는 reader UX에는 맞지 않는다.

**통합 판단**

문서 열기/탐색의 source of truth는 `MM`으로 둔다. `MA`의 단일 파일 open 기능은 `MM`에서 “현재 문서를 review tab/mode로 열기” 또는 “외부 파일을 새 MM session으로 열기”로 변환한다.

### 2. Markdown rendering

**MM 강점**

- `react-markdown`, `remark-gfm`, `rehype-highlight` 기반 일반 Markdown reader가 간결하다.
- Mermaid code block 자동 감지와 TOC/hash navigation이 reader에 잘 맞다.
- prose 기반 읽기 스타일과 overflow 처리가 이미 정리되어 있다.

**MM 부족점**

- Markdown source line과 rendered block의 연결 정보가 없다.
- block 단위 action, selection anchor, annotation overlay가 없다.

**MA 강점**

- `parseMarkdownToBlocks`가 Markdown을 heading, paragraph, code, table, hr, list-item, blockquote 등 block으로 나누고 source line을 보존한다.
- frontmatter를 건너뛰면서 line number를 보정한다.
- Mermaid metadata, block id, block order, raw markdown context를 만든다.
- `@yoophi/markdown-annotation-react`의 `MarkdownViewer`가 block shell, inline annotation mark, block note/delete action을 렌더링한다.

**MA 부족점**

- block parser는 실용적인 line parser이며 완전한 Markdown AST parser는 아니다.
- 기존 MM reader보다 일반 문서 읽기 UI에는 더 무겁다.
- annotation-aware viewer가 reader-only 화면에 그대로 들어오면 UI가 복잡해질 수 있다.

**통합 판단**

기본 reader는 `MM`의 `MarkdownView`를 유지한다. Review mode를 켰을 때만 `MA`의 block parser와 annotation viewer를 사용한다. 장기적으로 TOC/headings는 `MA`의 `extractTocEntries(blocks)`로 통합할 수 있지만, 첫 단계에서는 reader TOC를 유지한다.

### 3. Annotation 모델

**MM 상태**

- annotation 모델이 없다.
- `AGENTS.md` 기준으로 명시 요청 없이는 annotation/feedback workflow를 추가하지 않는 viewer-only 원칙이 있다.

**MA 강점**

- annotation type이 `delete`, `question`, `change-request`, `note`, `approve`로 구체적이다.
- anchor가 `blockId`, offset, selectedText, startLine/endLine을 포함한다.
- multi-block selection을 여러 annotation으로 나누고 `groupId`로 묶는다.
- inline annotation, block delete, block note를 viewer에 표시할 수 있다.
- annotation dialog UI가 별도 package contract로 분리되어 있다.

**MA 부족점**

- annotation은 draft state 중심이며 `.memo` 같은 영구 저장 모델은 없다.
- block id가 parse order 기반 `block-0`, `block-1`이라 문서 편집 후 안정성이 제한적이다.
- source anchor가 line/offset/selectedText 기반이지만 drift recovery는 별도 과제로 남는다.

**통합 판단**

`MA` annotation model을 `MM`의 review mode draft model로 채택한다. 단, 곧바로 영구 저장 형식으로 확정하지 말고, `AnnotationDraft`를 “agent prompt export용 임시 annotation”으로 시작한다.

### 4. Agent prompt export

**MM 상태**

- 현재 문서 내용을 읽고 보여줄 뿐, agent에게 전달할 annotation prompt를 만들지 않는다.

**MA 강점**

- `formatAnnotationsForAgent`가 file path, 목표, 사용자 지침, annotation type, line range, selected text, raw Markdown context, replacement instruction을 포함한 Markdown prompt를 만든다.
- 목표가 `edit-document`, `review-reference`, `custom`으로 나뉘어 있다.
- delete/change-request/note/question/approve를 agent가 해석하기 쉬운 문장으로 출력한다.

**MA 부족점**

- export 대상은 clipboard/prompt text이며, 앱 내부에서 agent 실행까지 연결하지 않는다.
- prompt schema version이나 machine-readable JSON export는 없다.

**통합 판단**

통합의 1차 annotation 산출물은 `Agent Prompt Export`로 둔다. 문서 직접 수정 기능보다 비용과 위험이 낮고, MM의 viewer-only 성격을 크게 깨지 않는다.

### 5. 파일 watcher와 refresh

**MM 강점**

- root directory watcher가 Markdown file create/remove/rename/modify를 감지한다.
- tree 변경 시 session refresh, 현재 문서 변경 시 reload가 가능하다.
- window label별 watcher/session 정리가 되어 있다.

**MM 부족점**

- annotation selection이 외부 파일 변경으로 stale해졌는지 판단하는 기능이 없다.

**MA 강점**

- 단일 document watcher가 변경 이벤트를 debounced emit한다.
- `@yoophi/workspace-auto-refresh`에 stale selection 판단 helper가 있다.
- 문서 reload 시 annotation/selection 상태를 어떻게 다룰지 UX가 있다.

**MA 부족점**

- root directory 전체 watcher가 아니며, MM의 tree/session watcher를 대체할 수 없다.
- 단일 document watcher는 MM에 그대로 추가하면 watcher가 중복될 수 있다.

**통합 판단**

watcher source of truth는 `MM`의 root watcher로 유지한다. `MA`의 stale selection 판단 로직만 가져와 현재 문서 변경 이벤트에 연결한다. 단일 file watcher는 중복이므로 이식하지 않는다.

### 6. Backend 구조

**MM 강점**

- Rust backend가 root path canonicalization, symlink safety, directory scan, session state, multi-window lifecycle을 한 파일에서 직접 처리한다.
- root 밖 symlink Markdown 파일을 차단한다.
- 파일 읽기 command는 session files 목록에 있는 root-relative path만 허용한다.

**MM 부족점**

- backend가 커지고 있어 기능이 늘면 domain/application/inbound/infrastructure 분리가 필요해질 수 있다.
- error가 대부분 string이라 structured error code가 없다.

**MA 강점**

- Rust backend가 `domain`, `application`, `inbound`, `infrastructure`로 나뉘어 hexagonal architecture 방향이 잡혀 있다.
- Tauri permission(`read-markdown-file.toml`)과 command boundary가 명시되어 있다.
- CLI launcher가 release용 `ma`, dev용 `ma-dev`로 나뉘어 있다.

**MA 부족점**

- document reader가 absolute path를 직접 읽는 구조라 MM의 root/session safety보다 약하다.
- 단일 파일 앱 구조라 MM의 directory-root 모델과 직접 맞지 않는다.

**통합 판단**

초기에는 `MM`의 backend를 유지하고 필요한 command만 추가한다. 장기적으로 `src-tauri/src/lib.rs`가 더 커지면 MA식 계층 분리를 참고해 `domain`, `application`, `inbound`, `infrastructure`로 분리한다.

## 통합 아키텍처 제안

### 제품 모드

통합 앱은 하나의 executable에서 두 가지 모드를 제공한다.

- `Reader mode`: 기본 MM 경험. 디렉터리 탐색, Markdown 읽기, TOC, Mermaid, recent/favorite.
- `Review mode`: 선택한 문서를 MA annotation viewer로 열고 annotation/prompt export를 제공.

Review mode는 별도 페이지 또는 reader panel 안의 tab으로 시작할 수 있다. 첫 단계에서는 현재 문서에만 적용하고, 여러 문서에 걸친 annotation project는 다루지 않는다.

### 프론트엔드 구조

권장 구조:

```text
src/
  components/
    markdown-view.tsx              # 기존 reader 유지
    review/
      annotation-panel.tsx         # annotation 목록 / prompt export
      annotation-viewer.tsx        # MA MarkdownViewer adapter
  lib/
    annotation/                    # MA core 흡수 또는 wrapper
    markdown.ts
    tauri.ts
  store/
    app-store.ts                   # reader/session state
    review-store.ts                # annotation draft state
```

`app-store.ts`에 annotation state를 직접 섞지 않는 편이 좋다. Reader session과 review draft는 lifecycle이 다르다.

### 패키지 통합 방식

MA의 annotation 기능은 현재 workspace package에 있다.

- `@yoophi/markdown-annotation-core`
- `@yoophi/markdown-annotation-react`
- `@yoophi/workspace-auto-refresh`

MM은 현재 독립 프로젝트라 `workspace:*` dependency를 그대로 사용할 수 없다. 선택지는 세 가지다.

| 방식 | 장점 | 단점 | 권장도 |
| --- | --- | --- | --- |
| 필요한 코드만 MM `src/lib/annotation`으로 복사 | 빠르고 독립적 | upstream 동기화 비용 | 높음, 1차 이식 |
| MM을 agentic-workspace monorepo로 편입 | package 재사용 쉬움 | 프로젝트 이동/빌드 영향 큼 | 낮음, 지금은 과함 |
| annotation packages를 별도 npm/git dependency로 분리 | 장기 재사용 좋음 | 배포/버전 관리 필요 | 중간, 안정화 후 |

권장: 1차는 core 순수 함수만 MM 내부로 복사하고, review UI가 안정화되면 package 분리를 재검토한다.

## 단계별 마이그레이션 전략

### Phase 0. 제품 범위 결정

결정할 항목:

- 통합 후 앱 이름과 CLI를 `markmini/mm`로 유지할지, annotation CLI `ma`를 별도 alias로 유지할지.
- Review mode를 기본 노출할지, 숨겨진/선택 기능으로 둘지.
- Annotation 결과를 prompt export까지만 할지, 저장/수정까지 포함할지.

권장 결정:

- 앱/CLI 베이스는 `markmini/mm` 유지.
- Review mode는 선택 문서에서 열 수 있는 부가 기능으로 시작.
- 1차 산출물은 clipboard prompt export까지만.

### Phase 1. Core annotation logic 이식

MA에서 우선 이식할 순수 로직:

- `parseMarkdownToBlocks`
- `detectMermaidBlock`
- `extractTocEntries`
- `stripInlineMarkdown`
- annotation types
- `formatAnnotationsForAgent`
- annotation helper 일부

MM에 추가할 테스트:

- frontmatter line 보정
- fenced code/Mermaid block parsing
- table/list/blockquote parsing
- annotation prompt formatting
- multi-block annotation grouping

완료 기준:

- MM 안에서 Markdown content를 block/source line model로 변환할 수 있다.
- annotation prompt를 UI 없이도 생성할 수 있다.
- `pnpm test`, `pnpm typecheck` 통과.

### Phase 2. Review state와 UI shell 추가

추가할 기능:

- 현재 selected file의 content에서 blocks 생성.
- `review-store.ts` 또는 component-local reducer로 annotation draft 관리.
- Review mode toggle 또는 tab 추가.
- Annotation 목록 panel과 Prompt export panel 추가.
- Clipboard copy 지원.

주의:

- 기존 reader UI를 깨지 않도록 기본 화면은 MM reader를 유지한다.
- review draft는 selected file이 바뀌면 clear하거나 per-document draft map으로 분리한다.
- prompt file path는 MM의 root-relative path와 absolute root를 조합해 표시할지 결정해야 한다.

완료 기준:

- 현재 열린 문서에 annotation draft를 만들지 않아도 prompt preview가 나온다.
- annotation이 없을 때도 “아직 annotation이 없습니다” export가 가능하다.
- 문서 전환 시 review state 정책이 일관된다.

### Phase 3. Annotation viewer 이식

MA에서 이식할 UI:

- `MarkdownViewer`
- `AnnotationInputDialog`
- `buildViewerAnnotationMaps`
- `getSelectionAnchors`
- `segmentTextByAnnotations`
- `scrollToBlock`
- `MarkdownToc` 중 필요한 부분

MM에 맞게 바꿀 부분:

- shadcn/Radix 기반 `components/ui` adapter 작성.
- MA의 base-ui `render` 계약을 MM의 UI primitive에 맞춘다.
- Mermaid expanded dialog가 필요하면 MM dialog/tooltip primitive를 먼저 추가한다.
- 기존 `MarkdownView`와 스타일 충돌을 피한다.

완료 기준:

- block delete/note action이 동작한다.
- selection delete/note/change-request/question/approve가 동작한다.
- multi-block selection이 group annotation으로 묶인다.
- annotation 취소/편집이 가능하다.

### Phase 4. Watcher와 stale selection 연동

이식할 개념:

- MA의 stale selection 판단.
- active document reload 후 annotation draft가 현재 문서에 대해 stale인지 표시.

사용하지 않을 것:

- MA의 단일 document watcher command. MM의 root watcher와 중복된다.

완료 기준:

- 외부에서 현재 문서가 수정되면 MM watcher로 문서 reload가 일어난다.
- Review mode에 draft annotation이 있을 때 reload가 발생하면 사용자에게 stale 가능성을 표시한다.
- 사용자가 draft 유지/삭제/재검토를 선택할 수 있다.

### Phase 5. CLI/window 통합

검토할 MA 기능:

- `ma` wrapper script
- `ma-dev`
- document hash label 기반 focus
- macOS native tabbing

권장:

- `mm` CLI는 유지한다.
- 별도 `ma` CLI를 유지하려면 같은 앱 executable을 review mode query로 열도록 구현한다.
- macOS native tabbing은 nice-to-have로 뒤로 미룬다.

완료 기준:

- `mm file.md`는 기존처럼 파일의 부모 디렉터리를 root로 열고 해당 문서를 선택한다.
- 선택적으로 `mm --review file.md` 또는 `ma file.md`가 같은 앱을 review mode로 열 수 있다.

### Phase 6. Persistence와 실제 문서 수정 여부 결정

1차 통합에서는 저장하지 않는다. 이후 선택지는 다음과 같다.

- localStorage draft 저장: 가장 쉽지만 파일 이동/변경에 취약하다.
- sidecar 저장: `.파일명.annotation.json` 또는 `.파일명.memo` 같은 별도 파일.
- 문서 직접 수정: agent prompt export를 넘어 앱이 Markdown을 직접 patch한다.

권장 순서:

1. clipboard prompt export
2. per-document local draft restore
3. sidecar JSON 저장
4. 문서 직접 수정 또는 agent integration

## Source of Truth 제안

| 영역 | 기준 구현 |
| --- | --- |
| 앱 shell / runtime | MM |
| directory scan / file tree | MM |
| root safety / symlink policy | MM |
| multi-window session | MM |
| basic reader | MM |
| block parser / source line model | MA |
| annotation type / draft model | MA |
| agent prompt formatter | MA |
| review viewer / selection UX | MA |
| watcher | MM root watcher + MA stale helper |
| CLI | MM `mm`, MA `ma`는 optional compatibility |
| backend layering | MM 유지, 장기적으로 MA 계층 구조 참고 |

## 주요 리스크

- Review mode를 기본 reader에 섞으면 MM의 단순하고 빠른 reader UX가 무거워질 수 있다.
- MA package를 `workspace:*`로 직접 추가하면 MM의 독립 프로젝트 구조와 충돌한다.
- MA의 block parser는 완전한 Markdown AST parser가 아니므로 복잡한 nested Markdown에서 source mapping이 부정확할 수 있다.
- `block-0` 같은 parse-order id는 문서 수정 후 annotation 안정성이 낮다.
- MM watcher와 MA document watcher를 모두 쓰면 중복 reload와 상태 race가 생길 수 있다.
- Prompt export는 agent에게 강한 지시를 생성하므로 file path, line range, raw context가 정확해야 한다.

## 권장 첫 작업 목록

1. `docs/`에 통합 제품 범위를 확정하는 짧은 PRD를 작성한다.
2. MA core 순수 함수 이식 후보를 `src/lib/annotation` 단위로 복사하거나 재작성한다.
3. `parseMarkdownToBlocks`와 `formatAnnotationsForAgent` 테스트를 MM Vitest에 추가한다.
4. MM UI에 hidden/experimental Review tab을 추가하되 기본 reader flow는 바꾸지 않는다.
5. Review tab에서 annotation 없이 prompt preview만 먼저 렌더링한다.
6. 이후 block annotation, selection annotation, clipboard copy 순서로 확장한다.

## 검증 기준

통합 작업 중 최소 검증:

```bash
pnpm test
pnpm typecheck
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml
```

Review mode가 들어간 뒤에는 수동 확인도 필요하다.

- 디렉터리 open 후 문서 선택.
- 기존 reader에서 Markdown/TOC/Mermaid 동작.
- Review mode 전환.
- block delete/note annotation.
- selection change-request annotation.
- multi-block selection group annotation.
- prompt export clipboard copy.
- 외부 파일 수정 후 reload/stale 표시.
