# ShutterProof

Local-first, Windows-first desktop app that keeps a wedding photographer's gear
records, proof of purchase, and warranty details in one place.

This repository currently contains **stage 1: the app shell and gear-passport UI
backed by sample data**. There is no persistence, file import, OCR, AI, export,
authentication, analytics, or cloud service yet — those arrive in later stages.

## Stack

- **Tauri 2** desktop shell (Rust)
- **React 18 + TypeScript** frontend (Vite)
- **Rust 2021** backend with a single read-only `app_info` command

## Prerequisites

- **Node.js 20+** and npm (verified with Node 24)
- **Rust** toolchain (`rustup`, stable) with the `x86_64-pc-windows-msvc` target
- **Microsoft C++ Build Tools** (Desktop development with C++)
- **WebView2 Runtime** — preinstalled on current Windows 10/11; the bundle falls
  back to the WebView2 bootstrapper on older machines

Rust is only needed for the desktop shell. The UI runs in a browser without it.

## Run

```bash
npm install

# Browser preview (no Rust required):
npm run dev            # http://localhost:1420

# Desktop app (requires the Rust toolchain):
npm run tauri:dev
```

The UI detects the Tauri webview and shows the runtime in the left rail footer.
In a browser it reads "Browser preview" and simply skips the `app_info` call.

## Build

```bash
npm run typecheck      # tsc --noEmit
npm run build          # typecheck + vite production build (dist/)
npm run tauri:build    # signed-ready Windows bundles (nsis + msi)
```

Bundle icons live in `src-tauri/icons/`. To regenerate them:

```bash
node scripts/make-icons.mjs
```

## Project layout

```
index.html                 CSP meta and Vite entry
src/
  main.tsx                 React root
  App.tsx                  Shell wiring and gear selection
  types.ts                 Shared domain types (frontend + Rust wire format)
  data/sample.ts           Stage-1 sample records
  lib/
    format.ts              Money, date, serial masking, bytes
    warranty.ts            Warranty status derivation
    tauri.ts               IPC presence check + app_info fetch
  components/              AppShell, Sidebar, GearPassport, panels, dialog
  styles/app.css           Design tokens and the visual system
src-tauri/
  Cargo.toml               tauri 2 + serde, release profile
  build.rs
  tauri.conf.json          Window, CSP, bundle targets and icons
  capabilities/default.json  core-only capability (no FS/shell/HTTP)
  icons/                   Generated bundle icons
  src/main.rs, src/lib.rs  app_info command + run()
scripts/make-icons.mjs     Dependency-free icon generator
```

## Design notes

Pale surfaces, charcoal text, and a single muted sage accent. An archival serif
carries the gear's identity, a quiet humanist sans handles everything else, and
monospace is reserved for machine identifiers (serial, file hash). Serial
numbers are always masked to the last four characters.

## Stage 1 scope

Included: app shell, gear-passport screen, sample data, repair-packet preview
dialog, accessible markup, keyboard focus, reduced-motion support.

Deliberately excluded (next stages): SQLite records and file import, open-model
receipt extraction, and the Windows release pipeline.
