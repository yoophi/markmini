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

복사 직후 macOS가 `com.apple.provenance` 확장 속성을 붙여 Gatekeeper가 실행을 차단합니다. 이 속성을 제거해야 Finder/Dock에서 정상 실행됩니다:

```bash
xattr -cr /Applications/markmini.app
```

> **왜 필요한가?** macOS는 공증(notarization)되지 않은 앱이 `/Applications`로 복사되면 provenance 속성을 추가합니다. 이 속성이 있으면 Finder에서 더블클릭 시 "개발자를 확인할 수 없습니다" 오류가 발생합니다. 터미널에서 바이너리를 직접 실행하면(`/Applications/markmini.app/Contents/MacOS/markmini`) Gatekeeper를 우회하므로 문제가 없지만, 일반적인 앱 실행 방식을 위해서는 속성 제거가 필요합니다.

빌드·설치를 한 번에 하려면:

```bash
APPLE_SIGNING_IDENTITY="-" pnpm tauri build \
  && cp -R src-tauri/target/release/bundle/macos/markmini.app /Applications/ \
  && xattr -cr /Applications/markmini.app
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
