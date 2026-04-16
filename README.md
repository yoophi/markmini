# markmini

`markmini`는 로컬 Markdown 문서를 빠르게 열어 읽기 위한 Tauri 기반 데스크톱 뷰어입니다.  
`../markdeck`의 읽기 경험을 바탕으로 더 가볍고 간결한 구조로 다시 구성했습니다.

## 주요 기능

- 로컬 디렉터리 기준 Markdown 파일 탐색
- Markdown 본문 렌더링 (syntax highlighting 포함)
- TOC 표시 및 현재 섹션 추적
- Mermaid 코드 블록 자동 인식 및 렌더링
- 파일 시스템 감시 — 파일 추가·삭제·수정 시 자동 새로고침
- 멀티 윈도우 — 여러 경로를 각각 독립된 창으로 열기
- Tauri 기반 로컬 데스크톱 실행

제외한 기능:

- Annotation
- 코멘트/피드백 워크플로우

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

빌드·설치·macOS Gatekeeper 대응 등 자세한 내용은 [빌드 및 설치 가이드](./docs/build-and-install.md)를 참고하세요.

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
