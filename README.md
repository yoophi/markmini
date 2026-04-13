# markmini

`markmini`는 로컬 Markdown 문서를 빠르게 열어 읽기 위한 Tauri 기반 데스크톱 뷰어입니다.  
`../markdeck`의 읽기 경험을 바탕으로 더 가볍고 간결한 구조로 다시 구성했습니다.

## 주요 기능

- 로컬 디렉터리 기준 Markdown 파일 탐색
- Markdown 본문 렌더링
- TOC 표시 및 현재 섹션 추적
- Mermaid 코드 블록 렌더링
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

## 개발 실행

의존성 설치:

```bash
pnpm install
```

개발 모드 실행:

```bash
pnpm tauri dev
```

특정 경로를 넘겨 개발 실행:

```bash
pnpm tauri dev -- .
pnpm tauri dev -- ../markdeck
pnpm tauri dev -- ./docs/example.md
```

## 검증 명령

```bash
pnpm typecheck
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml
```

## 기술 스택

- Tauri v2
- React
- TypeScript
- Vite
- Tailwind CSS
- Tailwind Typography
- Zustand
- shadcn 스타일 컴포넌트
- `react-markdown`
- `remark-gfm`
- `mermaid`

## 문서

- 구현 설계 문서: [docs/implementation-plan.md](./docs/implementation-plan.md)
