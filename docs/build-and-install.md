# 빌드 및 설치

## 사전 요구 사항

- [Rust](https://rustup.rs/) (1.77.2 이상)
- [Node.js](https://nodejs.org/) (18 이상)
- [pnpm](https://pnpm.io/)
- macOS: Xcode Command Line Tools (`xcode-select --install`)

## 개발 모드

```bash
pnpm install
pnpm tauri dev
```

특정 경로를 넘겨 실행:

```bash
pnpm tauri dev -- ../my-docs
pnpm tauri dev -- ./README.md
```

## 프로덕션 빌드

### macOS (서명 없이 로컬용)

macOS에서 코드 서명·공증 없이 빌드하는 방법은 두 가지입니다.

#### 바이너리만 빌드

```bash
pnpm tauri build -- --no-bundle
```

`src-tauri/target/release/markmini` 실행 파일만 생성됩니다. `.app` 번들 없이 터미널에서 직접 사용할 때 적합합니다.

#### .app 번들 생성

```bash
APPLE_SIGNING_IDENTITY="-" pnpm tauri build
```

`APPLE_SIGNING_IDENTITY="-"`는 ad-hoc 서명을 사용합니다. 생성물:

| 경로 | 설명 |
|------|------|
| `src-tauri/target/release/markmini` | CLI 바이너리 |
| `src-tauri/target/release/bundle/macos/markmini.app` | macOS 앱 번들 |
| `src-tauri/target/release/bundle/dmg/markmini_*.dmg` | DMG 디스크 이미지 |

## 설치

### /Applications에 설치

```bash
cp -R src-tauri/target/release/bundle/macos/markmini.app /Applications/
```

### Gatekeeper 허용 (macOS Sequoia 이상)

공증(notarization)되지 않은 앱은 macOS가 Finder 실행을 차단합니다. macOS Sequoia(15.x)부터는 `com.apple.provenance` 확장 속성이 SIP에 의해 보호되어 `xattr -cr`로도 제거되지 않습니다.

**Finder 우클릭으로 허용하기 (권장):**

1. Finder에서 `/Applications/markmini.app`을 **우클릭** (또는 Control+클릭)
2. 컨텍스트 메뉴에서 **"열기"** 선택
3. 경고 대화상자에서 **"열기"** 클릭

한 번만 하면 이후로는 더블클릭으로도 정상 실행됩니다.

**시스템 설정에서 허용하기:**

1. Finder에서 더블클릭 시도 (차단됨)
2. **시스템 설정 > 개인정보 보호 및 보안** 이동
3. 하단의 "markmini" 차단 알림에서 **"확인 없이 열기"** 클릭

> **참고:** 터미널에서 바이너리를 직접 실행하면(`/Applications/markmini.app/Contents/MacOS/markmini` 또는 `markmini <path>`) Gatekeeper를 거치지 않으므로 이 과정이 필요 없습니다.

빌드·설치를 한 번에 하려면:

```bash
APPLE_SIGNING_IDENTITY="-" pnpm tauri build \
  && cp -R src-tauri/target/release/bundle/macos/markmini.app /Applications/
```

### PATH에 CLI 바이너리 등록

터미널에서 `markmini <path>`로 바로 실행하려면 심볼릭 링크를 만듭니다:

```bash
ln -sf "$(pwd)/src-tauri/target/release/markmini" /usr/local/bin/markmini
```

## 검증

```bash
pnpm typecheck          # TypeScript 타입 체크
pnpm build              # Vite 프론트엔드 빌드
cargo check --manifest-path src-tauri/Cargo.toml  # Rust 컴파일 체크
```
