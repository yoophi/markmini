# markmini 구현 설계 문서

## 목표

`markmini`는 `../markdeck`의 읽기 경험을 바탕으로 다시 구성한, 더 가볍고 간결한 Tauri 기반 데스크톱 Markdown 뷰어입니다.

애플리케이션은 아래와 같은 명령행 실행 방식을 지원해야 합니다.

- `markmini .`
- `markmini /some/path`
- `markmini ./path/file.md`

## 제품 방향

- 로컬 Markdown 문서를 빠르게 탐색하고 읽는 경험에 집중합니다.
- `markdeck`의 핵심 읽기 기능은 유지합니다.
  - Markdown 렌더링
  - TOC 표시
  - Mermaid 코드 블록 렌더링
- Annotation 및 피드백 워크플로우는 제외합니다.
- 화면은 더 단순한 2패널 구조를 기본으로 합니다.
  - 왼쪽: 문서 목록 / 파일 트리
  - 오른쪽: 문서 리더 + 고정 TOC

## 기술 스택

- 데스크톱 셸: Tauri v2
- 프론트엔드: React + TypeScript + Vite
- 스타일링: Tailwind CSS
- UI 기반: shadcn 스타일 컴포넌트
- 상태 관리: Zustand
- Markdown: `react-markdown` + `remark-gfm`
- Mermaid: `mermaid`

## 아키텍처

### Rust 백엔드

주요 책임은 다음과 같습니다.

- 네이티브 프로세스에서 실행 인자를 읽습니다.
- 초기 대상 경로를 해석합니다.
  - 현재 디렉터리
  - 특정 디렉터리
  - 특정 Markdown 파일
- 해석된 대상을 앱 세션으로 정규화합니다.
  - `root_dir`
  - `selected_file`
- 프론트엔드에서 사용할 명령을 제공합니다.
  - 초기 세션 상태 조회
  - 루트 하위 Markdown 파일 목록 조회
  - Markdown 파일 읽기

동작 규칙은 다음과 같습니다.

- 대상이 디렉터리이면 해당 경로를 `root_dir`로 사용합니다.
- 대상이 Markdown 파일이면 부모 디렉터리를 `root_dir`로 사용하고, 해당 파일을 `selected_file`로 설정합니다.
- 인자가 없으면 현재 작업 디렉터리를 기본값으로 사용합니다.
- `markdeck`의 annotation 관련 데이터 구조는 가져오지 않습니다.

### React 프론트엔드

주요 책임은 다음과 같습니다.

- 백엔드가 제공한 초기 세션 상태로 부팅합니다.
- 현재 루트 경로 아래의 Markdown 파일 목록을 표시합니다.
- 선택된 문서를 불러와 렌더링합니다.
- 제목 구조를 추출해 TOC를 표시합니다.
- Mermaid fenced code block을 감지해 시각적으로 렌더링합니다.

상태 모델은 다음과 같습니다.

- session
  - 루트 디렉터리
  - 파일 목록
  - 선택된 파일
- document
  - 본문 내용
  - headings
  - 로딩 / 오류 상태
- ui
  - 작은 화면에서의 사이드바 표시 상태

## UX 메모

- 전체 시각 방향은 `markdeck`보다 더 정돈되고 더 압축된 형태를 지향합니다.
- 불필요한 UI 크롬을 줄이고 읽기 중심으로 구성합니다.
- 일반적인 대시보드 느낌보다는 절제된 에디토리얼 톤을 사용합니다.
- 좁은 화면에서는 파일 목록을 슬라이드 패널로 전환합니다.

## 구현 순서

1. Tauri + React 앱을 스캐폴딩합니다.
2. Tailwind와 shadcn 스타일 기본 컴포넌트를 추가합니다.
3. Rust 명령과 실행 인자 해석 로직을 구현합니다.
4. Zustand 스토어와 프론트엔드 데이터 흐름을 구성합니다.
5. `markdeck`의 Markdown, TOC, Mermaid 동작을 단순화해서 이식합니다.
6. `typecheck`와 `build`로 최종 검증합니다.
