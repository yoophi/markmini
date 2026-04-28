# markmini

`markmini`는 로컬 Markdown 문서를 빠르게 탐색하고 읽기 위한 Tauri 기반 데스크톱 앱입니다.  
`../markdeck`의 읽기 경험을 바탕으로 더 가볍고 간결한 로컬-first Markdown 워크플로우에 맞춰 구성했습니다.

## 주요 기능

- 로컬 디렉터리 기준 Markdown 파일 탐색
- 파일 탐색 중 발견된 Markdown 문서를 점진적으로 표시
- Markdown 본문 렌더링 (syntax highlighting 포함)
- TOC 표시 및 현재 섹션 추적
- Mermaid 코드 블록 자동 인식 및 렌더링
- 파일 시스템 감시 — 파일 추가·삭제·수정 시 자동 새로고침
- 멀티 윈도우 — 여러 경로를 각각 독립된 창으로 열기
- 루트 디렉터리 밖을 가리키는 symlink Markdown 파일 차단
- Tauri 기반 로컬 데스크톱 실행

제외한 기능:

- Annotation
- 코멘트/피드백 워크플로우
- 새 문서 생성·이름 변경·삭제 UI

## 화면 구성

- 왼쪽: 현재 루트 하위 Markdown 문서 트리
- 가운데: Markdown reader
- 오른쪽: 현재 문서의 TOC

좁은 화면에서는 문서 트리가 슬라이드 패널로 전환됩니다.

## 실행 방식

아래처럼 경로를 넘겨 실행할 수 있습니다.

```bash
markmini .
markmini /some/path
markmini ./path/file.md
```

동작 규칙은 다음과 같습니다.

- 디렉터리를 넘기면 해당 디렉터리를 루트로 사용합니다.
- Markdown 파일을 넘기면 파일의 부모 디렉터리를 루트로 사용하고, 해당 파일을 초기 문서로 엽니다.
- 인자가 없으면 현재 작업 디렉터리를 기준으로 시작합니다.

### 멀티 윈도우

이미 실행 중인 상태에서 다른 경로로 다시 실행하면 **새 창**이 열립니다.

```bash
markmini ~/docs &       # 첫 번째 창
markmini ~/projects     # 두 번째 창 (같은 프로세스)
```

각 창은 독립된 파일 목록과 watcher를 가지며, 창을 닫으면 해당 세션이 정리됩니다.

## 파일 탐색 및 안전성

- Markdown 확장자는 `.md`, `.markdown`을 인식합니다.
- `.git`, `node_modules`, `target`, `dist`, `.next` 디렉터리는 탐색에서 제외합니다.
- 접근할 수 없는 디렉터리는 건너뛰고 가능한 문서를 계속 표시합니다.
- symlink가 선택한 루트 디렉터리 밖을 가리키면 문서 목록과 읽기 경로에서 제외합니다.
- 파일 추가·삭제·이름 변경은 watcher가 감지해 문서 트리를 새로고침합니다.

## 개발 실행

```bash
pnpm install
pnpm tauri dev
```

특정 경로를 넘겨 개발 실행:

```bash
pnpm tauri dev -- .
pnpm tauri dev -- ../markdeck
pnpm tauri dev -- ./docs/example.md
```

프론트엔드만 확인할 때:

```bash
pnpm dev
```

단, Tauri command와 파일 watcher가 필요한 기능은 `pnpm tauri dev`에서 확인해야 합니다.

## 검증

PR을 열기 전에는 아래 순서로 로컬 검증을 실행합니다.

```bash
pnpm test
pnpm typecheck
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

빌드·설치·macOS Gatekeeper 대응과 aggregate validation script는 [빌드 및 설치 가이드](./docs/build-and-install.md)를 참고하세요.

## 기술 스택

- Tauri v2
- React
- TypeScript
- Vite
- Tailwind CSS
- Tailwind Typography
- Zustand
- shadcn 스타일 컴포넌트
- `react-markdown` + `remark-gfm` + `rehype-highlight`
- `mermaid`
- `notify` (파일 시스템 감시)
- `tauri-plugin-single-instance` (멀티 윈도우)

## 문서

- [빌드 및 설치 가이드](./docs/build-and-install.md)
- [구현 설계 문서](./docs/implementation-plan.md)
