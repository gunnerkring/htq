# Hours to Qualify Desktop App

Electron desktop app for importing SHARP workbooks, projecting pilot hours to qualification, reviewing sortie load, and exporting reports.

## Supported Workbook Formats

- `.xlsx`
- `.xlsm`

`.xls` is no longer accepted. The app now parses workbooks with `exceljs` so the release build does not ship the unresolved `xlsx` dependency vulnerability.

## Local Development

Requirements:

- Node.js 20 LTS or newer
- npm

Run the desktop app:

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm test
npm run typecheck
npm run build
```

## Packaging Commands

Windows:

```bash
npm run dist
npm run dist:portable
npm run dist:all
```

macOS:

```bash
npm run dist:mac
npm run dist:mac:dir
npm run dist:mac:universal
```

Release artifacts are written to `release/`.

## Free Release Right Now

If you want users to download the app without paying for Apple or Windows signing yet, use the unsigned release path.

Local commands:

```bash
npm run release:free:mac
npm run release:free:windows
```

GitHub Actions:

- Run `.github/workflows/free-release.yml` manually, or
- push a tag like `free-v1.0.0`

That workflow builds:

- unsigned macOS universal `.dmg` and `.zip`
- unsigned Windows `x64` installer and portable `.exe`

This is free to produce, but users will see security warnings on first open.

### What macOS users will see

- macOS will warn that the app is from an unidentified developer.
- Users can still open it by right-clicking the app and choosing `Open`, then confirming.
- If they opened it once and got blocked, they can also go to `System Settings > Privacy & Security` and allow it there.

### What Windows users will see

- Microsoft Defender SmartScreen may warn that the app is from an unknown publisher.
- Users can still choose `More info` and then `Run anyway`.

### Best Free Distribution Format

If you want the least confusing free download:

- macOS: share the `.zip` and include the unsigned install steps
- Windows: share the `x64` installer `.exe` and include the SmartScreen steps

I recommend putting those steps directly in the GitHub Release notes the first time you publish.

## Production Release Requirements

### macOS universal

Broad distribution on macOS requires:

- Apple Developer Program membership
- A Developer ID Application signing certificate
- Notarization credentials

The release workflow supports any of these notarization credential sets:

- `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
- `APPLE_KEYCHAIN`, `APPLE_KEYCHAIN_PROFILE`

macOS signing expects:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`

Run a release-ready local check/build:

```bash
npm run release:mac:universal
```

### Windows

Broad distribution on Windows requires code signing. This repo supports either:

- Standard certificate import via `WIN_CSC_LINK` + `WIN_CSC_KEY_PASSWORD`
- Standard certificate import via `CSC_LINK` + `CSC_KEY_PASSWORD`
- Azure Trusted Signing via:
  - `AZURE_ENDPOINT`
  - `AZURE_CODE_SIGNING_ACCOUNT_NAME`
  - `AZURE_CERTIFICATE_PROFILE_NAME`
  - `AZURE_PUBLISHER_NAME`
  - `AZURE_TENANT_ID`
  - `AZURE_CLIENT_ID`
  - `AZURE_CLIENT_SECRET`

Run a release-ready local check/build:

```bash
npm run release:windows
```

## GitHub Actions Release Workflow

The repo includes `.github/workflows/release.yml`.

It will:

1. run tests and a production build on Linux
2. build signed + notarized macOS universal artifacts on `macos-14`
3. build signed Windows installer + portable artifacts on `windows-2022`
4. upload artifacts on every manual or tag-triggered run
5. attach artifacts to a GitHub Release when a `v*` tag is pushed

## Release Assets

Build resources live in `build/`:

- `icon.icns`
- `icon.ico`
- `entitlements.mac.plist`
- `entitlements.mac.inherit.plist`

If you want to regenerate icons after a branding change:

```bash
npm run icons
```
