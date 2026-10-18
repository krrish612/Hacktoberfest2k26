# ShutterProof

Local-first, Windows-first desktop app that keeps a wedding photographer's gear
records, proof of purchase, and warranty details together — so a repair packet is
ready when equipment needs service.

Everything stays on the machine. There are no accounts, no cloud service, no
telemetry, and no network calls except to a **local** model server you run
yourself.

## Status

- **Stage 1** — app shell and the gear-passport screen.
- **Stage 2** — a local SQLite records store: create, edit, and delete gear;
  attach receipts, warranty PDFs, and serial photos; keep an ownership timeline;
  back up and restore the whole store to a folder.
- **Stage 3 (current)** — read a receipt on this device with a local Ollama
  model and turn it into suggested fields you review before saving.

Still to come: printing, and a signed Windows release.

## What you can do today

- Keep a gear record per camera, lens, or flash, with make/model, category, a
  masked serial number, purchase details, and warranty information.
- Attach a receipt, a warranty document, and a serial-number photo to each record.
  Attachments are validated by content signature (PDF/JPEG/PNG) and capped at 25 MB.
- Record an ownership timeline: purchase, warranty start, inspections, repairs,
  transfers, and notes.
- **Read a receipt**: pick a PDF, JPEG, or PNG and a local model suggests the
  seller, purchase date, item, price, currency, serial number, and any warranty
  wording it can see. Each suggestion carries its own confidence and any warnings;
  you review and correct them in the editor before anything is saved.
- **Export a repair packet**: review the gear summary, purchase and warranty
  details, and the timeline and files you choose, then save everything as a
  single ZIP (`repair-summary.html` plus an `evidence/` folder) wherever you pick.
  The full serial number is left out unless you opt in, and the originals are
  copied, never moved or deleted.
- Back up the database and every original into a plain folder, and restore it.

## Privacy model

- All records and originals live in the app's private data directory on this
  device.
- Receipt reading uses **Ollama running on localhost** (`127.0.0.1`). The receipt
  image or text is sent to that local process only — never to a remote service.
- The frontend never talks to Ollama directly and never touches the filesystem or
  database: every action goes through a validated Rust (Tauri) command.
- Warranty dates are **never** filled in automatically. The model is instructed
  not to infer dates, and you enter and confirm them yourself.
- Repair-packet export runs entirely on this device. The ZIP is written straight
  to the file you choose, and nothing is uploaded.

## Stack

- **Tauri 2** desktop shell (Rust)
- **React 18 + TypeScript** frontend (Vite)
- **Rust 2021** backend; all disk, database, and model access lives behind
  validated `async` Tauri commands (`rusqlite` with bundled SQLite; `reqwest`
  for localhost Ollama)
- A **local Ollama** server with a vision model for receipt reading

## Prerequisites

- **Node.js 20+** and npm (verified with Node 24)
- **Rust** toolchain (`rustup`, stable) with the `x86_64-pc-windows-msvc` target
  (Rust 1.85+ recommended — the PDF reader pulls a recent `lopdf`)
- **Microsoft C++ Build Tools** (Desktop development with C++)
- **WebView2 Runtime** — preinstalled on current Windows 10/11; the bundle falls
  back to the WebView2 bootstrapper on older machines
- **Ollama** (optional) — only needed for receipt reading; everything else works
  without it. See “Reading a receipt” below.

Rust is only needed for the desktop shell. The UI runs in a browser without it,
against an in-memory adapter that leaves the disk untouched (receipt reading is
desktop-only).

## Install and run

```bash
npm install

# Browser preview (no Rust, no Ollama):
npm run dev            # http://localhost:1420

# Desktop app (requires the Rust toolchain):
npm run tauri:dev
```

The UI detects the Tauri webview and shows the runtime in the left rail. In a
browser it reads “Browser preview”, stores records in memory, and reports that
receipt reading, backup, and restore are desktop-only.

## Reading a receipt

1. Install [Ollama](https://ollama.com) and start it.
2. Pull the vision model once:

   ```bash
   ollama pull qwen2.5vl:7b
   ```

3. In the app, click **Read a receipt**, then **Choose a receipt file**.

The dialog checks the local model first and tells you exactly what is missing if
it is not ready. When it reads a file, it shows each field with a confidence bar
and a plain-language label (“Looks clear”, “Check this”, “Unsure”), plus warnings
for anything it could not read. **Review in editor** opens the record form
pre-filled with the suggestions — nothing is saved until you save it.

The model name and server URL are configurable:

| Variable | Default | Purpose |
| --- | --- | --- |
| `SHUTTERPROOF_OLLAMA_MODEL` | `qwen2.5vl:7b` | Which vision model to ask |
| `SHUTTERPROOF_OLLAMA_URL` | `http://127.0.0.1:11434` | Where Ollama listens |

## Build

```bash
npm run typecheck      # tsc --noEmit
npm run build          # typecheck + vite production build (dist/)
npm run tauri:build    # Windows bundles (nsis + msi), unsigned
```

Bundle icons live in `src-tauri/icons/`. To regenerate them:

```bash
node scripts/make-icons.mjs
```

## Where your data lives

Records and attached originals are stored in the app's private data folder
(`records.db` plus an `evidence/` directory). Attached files are validated by
content signature and a 25 MB size cap, streamed to a temp file, hashed with
SHA-256, then moved into place atomically. Warranty dates are only ever what you
type and confirm — nothing is inferred.

The **Local data** panel backs up the database and every original into a plain
folder you choose, and restores that folder in place (the previous store is kept
aside as `.previous`). Backups are ordinary folders you can move to another drive.

The **Prepare repair packet** flow writes a single ZIP to a location you pick. It
holds a readable `repair-summary.html` report plus an `evidence/` folder with
copies of the files you selected. Stored originals are read-only inputs; the
packet never changes or removes them. A packet is capped at 200 MB so a large
selection cannot produce an unshareable file. If a selected file is missing or
over the size limit, export stops and names the file so you can fix the selection.

## Release and packaging

`npm run tauri:build` produces unsigned installers (`nsis` and `msi`) in
`src-tauri/target/release/bundle/`. They are **not code-signed**, so Windows
SmartScreen will warn on first run. Signing requires a certificate you provide
yourself; no signing credentials are configured in this repository.

A GitHub Actions workflow (`.github/workflows/release.yml`) builds these bundle
artifacts on a Windows runner for tags matching `v*` and can attach them to a
release. It performs no signing and needs no secrets.

## Verification status

- `npm run typecheck` and `npm run build` (frontend) pass.
- The Rust/Tauri side compiles here: `cargo fmt --check`, `cargo clippy ... -D
  warnings`, and `cargo test` pass, and `npm run tauri:build` produces the
  unsigned `nsis` and `msi` bundles. The interactive desktop UI has not been
  driven end to end.
- `npm run lint` is declared but ESLint is not configured yet.
- Receipt reading has not been exercised against a live Ollama model in this
  environment.
- Repair-packet export is covered by unit tests (HTML escaping, serial-number
  opt-in, evidence ownership, and ZIP contents); saving through the native dialog
  has not been exercised interactively.

## Limitations

- **Scanned PDFs** have no text layer. The app says so and asks for a photo
  instead; it does not rasterise PDF pages.
- Receipt reading needs a local model that can read documents (the default is a
  vision model). Quality depends on that model and the photo.
- Suggestions are never auto-applied: you confirm every value, and warranty dates
  are always manual.
- No printing yet; the packet is a ZIP you can print from your usual tools.
- No accounts, sync, telemetry, or cloud features — by design.

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
    extraction.ts          Maps reviewed suggestions onto record fields
    format.ts              Money, date, serial masking, bytes
    warranty.ts            Warranty status derivation
    tauri.ts               IPC presence check + app_info fetch
  state/RecordsProvider.tsx  Records state, actions, loading/error/notice
  components/              AppShell, Sidebar, GearPassport, editor, dialogs, panels
  styles/app.css           Design tokens and the visual system
src-tauri/
  Cargo.toml               tauri 2, rusqlite, reqwest, base64, pdf-extract, ...
  tauri.conf.json          Window, CSP, bundle targets and icons
  capabilities/default.json  core + dialog pickers (no FS/shell/HTTP)
  src/
    lib.rs                 Module wiring and the Tauri builder
    commands.rs            Validated command entry points (async, spawn_blocking)
    db.rs                  Schema and parameterized repositories
    files.rs               Signature checks and atomic file import
    backup.rs              Folder backup and staged restore
    archive.rs             Dependency-free ZIP writer (stored entries + CRC-32)
    packet.rs              Repair-packet report, file assembly, and safety checks
    state.rs               App state: db handle and private paths
    ollama.rs              Local-only Ollama client (status + chat)
    document.rs            Reads a receipt PDF text layer or image bytes
    extract.rs             Prompt, JSON schema, and validation of suggestions
    models.rs, error.rs    Wire types and AppError
    validate.rs            Input validation and the warranty rule
scripts/make-icons.mjs     Dependency-free icon generator
```

## Design notes

Pale surfaces, charcoal text, and a single muted sage accent. An archival serif
carries the gear's identity, a quiet humanist sans handles everything else, and
monospace is reserved for machine identifiers (serial, file hash). Serial numbers
are always masked to the last four characters.

## Licenses and third-party notices

- The app's own source is unlicensed/private as configured in this repository.
- **Ollama** and the default model **Qwen2.5-VL-7B-Instruct** run locally. The
  default model is published under **Apache-2.0**, which permits commercial use;
  check your chosen model's license before commercial deployment.
- **pdf-extract** (MIT) reads embedded PDF text; it does not perform OCR.
- Rust crates used: `tauri`, `rusqlite` (bundled SQLite, public domain),
  `reqwest`, `base64`, `serde`, `serde_json`, `thiserror`, `uuid`, `sha2`, `hex`,
  `chrono`.
- The repair-packet ZIP writer is **dependency-free** (`src-tauri/src/archive.rs`):
  it writes stored entries and a CRC-32 itself rather than pulling in an archive
  crate, so the feature adds no third-party license and no new dependency.
  you can see it
