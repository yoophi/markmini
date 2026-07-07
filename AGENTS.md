# AGENTS.md

## 프로젝트 개요

`markmini`는 Tauri v2, React, TypeScript, Vite, Tailwind CSS, Zustand, Rust로 만든 local-first Markdown reader입니다.

이 앱은 로컬 디렉터리의 Markdown 파일을 빠르게 탐색하고 읽는 데 집중합니다. Annotation, 코멘트, 피드백 워크플로우, 문서 편집 UI는 의도적으로 제외합니다.

## 프로젝트 별칭

- `MM`: 현재 프로젝트 `markmini`, 위치는 `/Users/yoophi/project/markmini`.
- `MD`: 참조 프로젝트 `markdeck`, 위치는 `/Users/yoophi/project/markdeck`.
- `MA`: 참조 프로젝트 `markdown-annotator`, 위치는 `/Users/yoophi/project/agentic-workspace/apps/markdown-annotator`.
- `AW`: 참조 프로젝트 `agentic-workbench`, 위치는 `/Users/yoophi/project/agentic-workspace/apps/agentic-workbench`.

## 저장소 구조

- `src/`: React 프론트엔드.
  - `App.tsx`: 메인 레이아웃과 앱 연결.
  - `components/`: Markdown reader, 파일 트리, TOC, Mermaid 렌더링, shadcn 스타일 UI 컴포넌트.
  - `store/`: Zustand 상태, 파일 시스템 watcher 구독, 프론트엔드 워크플로우 로직.
  - `lib/`: Markdown helper, path helper, Tauri command wrapper, 공용 유틸리티.
  - `types/`: 프론트엔드 공용 content 타입.
- `src-tauri/`: Tauri/Rust 백엔드.
  - `src/lib.rs`: Tauri command, session state, 파일 스캔, watcher 설정, CLI 설치 로직, 멀티 윈도우 처리.
  - `src/main.rs`: 앱 entrypoint.
  - `src/bin/mm.rs`: CLI helper binary.
  - `tauri.conf.json` 및 `capabilities/`: Tauri 설정과 권한.
- `docs/`: 구현, 빌드, 브랜치, 상태 관련 문서.
- `public/`: Vite 정적 asset.

## 개발 명령

의존성 설치:

```bash
pnpm install
```

전체 Tauri 앱 개발 실행:

```bash
pnpm tauri dev
```

특정 대상 경로로 실행:

```bash
pnpm tauri dev -- .
pnpm tauri dev -- ./README.md
pnpm tauri dev -- ../some-docs
```

Vite 프론트엔드만 실행:

```bash
pnpm dev
```

`pnpm dev`는 프론트엔드만 확인할 때 사용합니다. Tauri command, 로컬 파일 접근, 파일 시스템 watcher, 멀티 윈도우, CLI 설치에 의존하는 기능은 반드시 `pnpm tauri dev`로 확인해야 합니다.

## 검증

변경을 넘기기 전에 수정 범위에 맞는 검증을 실행합니다.

```bash
pnpm typecheck
pnpm test
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml
```

프론트엔드만 바꾼 경우 보통 `pnpm typecheck`와 `pnpm test`가 최소 기준입니다. Tauri command, 파일 스캔, watcher 동작, CLI 설치, Rust 데이터 모델을 바꾼 경우 `cargo check --manifest-path src-tauri/Cargo.toml`도 포함합니다.

## 구현 지침

- 앱의 local-first Markdown reader 범위를 유지합니다. 명시 요청이 없으면 annotation, feedback, comment, 문서 편집 워크플로우를 추가하지 않습니다.
- 프론트엔드와 백엔드 책임을 분리합니다.
  - Rust는 로컬 파일 시스템 접근, path canonicalization, symlink 안전성, session state, watcher 설정, Tauri command를 담당합니다.
  - React는 렌더링, 사용자 상호작용, 문서 navigation, responsive layout, client-side state를 담당합니다.
- 컴포넌트에서 `invoke`를 직접 호출하지 말고 `src/lib/tauri.ts` wrapper를 통해 Tauri command를 사용합니다.
- 문서 선택, scan state, 로드된 content, 최근 문서, 즐겨찾기, 앱 레벨 UI state에 영향을 주는 공유 프론트엔드 상태는 `src/store/app-store.ts`에 둡니다.
- 로컬 표시용 toggle은 컴포넌트 state를 우선 사용합니다.
- 기존 command contract가 absolute path를 요구하지 않는 한, 프론트엔드로 전달하는 path 값은 root-relative document path로 유지합니다.
- 기존 파일 안전 모델을 유지합니다.
  - Markdown 확장자는 `.md`와 `.markdown`입니다.
  - `.git`, `node_modules`, `target`, `dist`, `.next` 같은 generated/heavy directory는 건너뜁니다.
  - 선택한 root directory 밖을 가리키는 symlink Markdown 파일은 허용하지 않습니다.
- 멀티 윈도우 동작을 유지합니다. Tauri command는 현재 `WebviewWindow`를 받아 window label로 backend state를 찾습니다.
- Tauri event를 추가할 때는 기존 `markmini://...` 상수 근처에서 event name을 중앙 관리하고, 프론트엔드 구독은 `src/store/fs-watcher.ts`에 반영합니다.
- 제품 언어 변경이 명시된 작업이 아니라면 UI 문구는 현재 한국어 인터페이스와 일관되게 유지합니다.

## 테스트 지침

- 단순하지 않은 frontend state transition, file tree 동작, path 처리, Markdown heading extraction, navigation logic에는 Vitest coverage를 추가하거나 갱신합니다.
- Rust 변경은 동작을 독립적으로 검증하고 추론할 수 있도록 작은 pure helper를 선호합니다.
- Tauri 전용 flow가 바뀌면 수동으로 확인합니다.
  - 디렉터리 열기.
  - Markdown 파일 직접 열기.
  - 파일 트리 새로고침.
  - 파일 추가/삭제/이름 변경 후 filesystem watcher 업데이트.
  - root 밖 파일에 대한 symlink 안전성.
  - 앱이 이미 실행 중일 때 다른 경로를 열어 멀티 윈도우 동작 확인.

## 스타일 메모

- 기존 TypeScript 스타일을 따릅니다: functional React component, hook, 의도적으로 await하지 않는 UI handler의 명시적 `void`, 필요한 경우 type-only import.
- `src-tauri/src/lib.rs`의 기존 Rust 스타일을 따릅니다: 명시적 error message, Tauri command의 `Result<_, String>`, path와 filesystem rule을 위한 작은 helper function.
- 새 primitive를 추가하기 전에 `src/components/ui`의 기존 shadcn 스타일 UI primitive를 우선 사용합니다.
- control에 icon이 필요하면 `lucide-react` icon을 사용합니다.
- 집중된 변경을 구현하면서 광범위한 refactor를 피합니다.
- comment는 적게 유지하고, 코드만으로 분명하지 않은 동작에만 사용합니다.

## 문서화

아래 항목을 변경할 때는 `README.md` 또는 `docs/`의 문서를 갱신합니다.

- command-line 사용법,
- build 또는 install 단계,
- 지원하는 Markdown/file traversal 동작,
- 앱 범위 또는 제품 동작,
- 검증 요구사항.
