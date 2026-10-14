# ShutterProof

Local-first, Windows-first desktop app that keeps a wedding photographer's gear
records, proof of purchase, and warranty details in one place.

This repository currently contains **stage 2: a local SQLite records store**. You
can create, edit, and delete gear; attach receipts, warranty PDFs, and serial
photos; keep an ownership timeline; and back up or restore the whole store to a
folder on disk. There is still no OCR, AI, autofill, export, authentication,
analytics, or cloud service — those arrive in later stages.

## Stack

- **Tauri 2** desktop shell (Rust)
- **React 18 + TypeScript** frontend (Vite)
- **Rust 2021** backend; all disk and database access lives behind validated
  `async` Tauri commands (`rusqlite` with a bundled SQLite)

## Prerequisites

- **Node.js 20+** and npm (verified with Node 24)
- **Rust** toolchain (`rustup`, stable) with the `x86_64-pc-windows-msvc` target
- **Microsoft C++ Build Tools** (Desktop development with C++)
- **WebView2 Runtime** — preinstalled on current Windows 10/11; the bundle falls
  back to the WebView2 bootstrapper on older machines

Rust is only needed for the desktop shell. The UI runs in a browser without it,
against an in-memory adapter that leaves the disk untouched.

## Run

```bash
npm install

# Browser preview (no Rust required):
npm run dev            # http://localhost:1420

# Desktop app (requires the Rust toolchain):
npm run tauri:dev
```

The UI detects the Tauri webview and shows the runtime in the left rail footer.
In a browser it reads "Browser preview", stores records in memory, and reports
that backup and restore are desktop-only.

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

## Where your data lives

Records and attached originals are stored in the app's private data folder
(`records.db` plus an `evidence/` directory). Attached files are validated by
extension, content signature, and a 25 MB size cap, streamed to a temp file,
hashed with SHA-256, then moved into place atomically. Warranty dates are only
ever what you type and confirm — nothing is inferred.

The **Local data** panel in the app backs up the database and every original into
a plain folder you choose, and restores that folder in place (the previous store
is kept aside as `.previous`). Backups are ordinary folders you can move to
another drive.

## Project layout

```
index.html                 CSP meta and Vite entry
src/
  main.tsx                 React root
  App.tsx                  Shell wiring, states, and dialogs
  types.ts                 Shared domain types (frontend + Rust wire format)
  data/sample.ts           Sample records seeding the browser adapter
  lib/
    api.ts                 Records contract: Tauri invoke or memory adapter
    memory-api.ts          In-memory adapter for browser preview
    dialog.ts              Native file and folder pickers
    format.ts              Money, date, serial masking, bytes
    warranty.ts            Warranty status derivation
    tauri.ts               IPC presence check + app_info fetch
  state/RecordsProvider.tsx  Records state, actions, loading/error/notice
  components/              AppShell, Sidebar, GearPassport, editor, panels
  styles/app.css           Design tokens and the visual system
src-tauri/
  Cargo.toml               tauri 2 + rusqlite, thiserror, uuid, sha2, chrono
  tauri.conf.json          Window, CSP, bundle targets and icons
  capabilities/default.json  core + dialog pickers (no FS/shell/HTTP)
  src/
    lib.rs                 Module wiring and the Tauri builder
    commands.rs            Validated command entry points (async, spawn_blocking)
    db.rs                  Schema and parameterized repositories
    files.rs               Signature checks and atomic file import
    backup.rs              Folder backup and staged restore
    state.rs               App state: db handle and private paths
    models.rs, error.rs    Wire types and AppError
    validate.rs            Input validation and the warranty rule
scripts/make-icons.mjs     Dependency-free icon generator
```

## Design notes

Pale surfaces, charcoal text, and a single muted sage accent. An archival serif
carries the gear's identity, a quiet humanist sans handles everything else, and
monospace is reserved for machine identifiers (serial, file hash). Serial
numbers are always masked to the last four characters.

## Stage 2 scope

Included: local SQLite records, full gear CRUD with a warranty-confirmation
check, evidence attach and removal with signature validation, ownership-timeline
entries, clear loading/empty/success/error states, and folder backup/restore.

Deliberately excluded (next stages): open-model receipt extraction, export and
printing, and the Windows release pipeline.
