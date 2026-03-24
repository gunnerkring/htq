# Hours to Qualify Desktop App

This project is set up to produce a **one-click Windows installer** using Electron Builder and NSIS.

## What it does

- Opens the SHARP workbook through a native Windows file dialog
- Reads the `Sharp PPT Data` sheet
- Rebuilds the `Culled Data` logic in TypeScript
- Lets you select pilots for projection
- Runs the HTQ month-by-month roll-forward
- Exports a CSV from the desktop app

## What you need

- Windows 10 or 11
- Node.js 20 LTS or newer
- npm

## Build the one-click installer

Open PowerShell in this folder and run:

```powershell
npm install
npm run dist
```

When it finishes, the installer will be here:

```text
release\Hours-To-Qualify-Setup-1.0.0.exe
```

That `.exe` is configured as a **one-click installer**.

## Fastest way on Windows

Double-click:

```text
build-installer.bat
```

That batch file runs install + build for you.

## Dev run

```powershell
npm install
npm run dev
```

That command now starts the Vite renderer, watch-compiles Electron, and opens the desktop app automatically.

If you only want the browser dev server, run:

```powershell
npm run dev:web
```

## Honest limitation

This package is configured to build the `.exe`, but the `.exe` itself was not compiled inside this environment. It still needs to be built on a Windows machine with Node installed.
