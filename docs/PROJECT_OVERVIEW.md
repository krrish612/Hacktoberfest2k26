# shutterproof - project overview

a plain-english guide to what this app is, how the code is laid out, and why
things were built the way they were.

> note: this document is written in lower case on purpose. code snippets keep
> their real casing so you can copy them.

---

## 1. project overview

shutterproof is a local-first desktop app for solo wedding photographers. it
keeps a "gear passport" for every camera body, lens, flash, card, and so on that
the photographer owns, and helps them build a repair packet when something needs
fixing.

what it does:

- records gear details (name, category, brand, model, serial, purchase info).
- keeps a warranty status that is only ever shown from confirmed data.
- stores evidence files (receipts, photos, screenshots) against a gear item.
- keeps an ownership timeline of important milestones.
- prepares and exports a repair packet (a zip) that a photographer can send with
  an item.
- reads a receipt image or pdf with a local model to suggest field values.

core principle: everything stays on the device. there is no cloud, no account,
no telemetry. receipt reading is done by a model running locally through ollama,
and the model output is only ever a suggestion the photographer reviews. the app
never invents a warranty date.

stage: this build reports `stage-3-extraction` through the `app_info` command.
stage 1 was the ui shell, stage 2 added records and file storage, stage 3 added
local receipt reading.

---

## 2. code structure

```
shutterproof/
  index.html                 vite entry point
  package.json               front-end scripts and deps
  vite.config.ts             dev server on fixed port 1420
  tsconfig.json              strict typescript
  README.md                  user-facing readme
  docs/
    PROJECT_OVERVIEW.md      this file
  scripts/
    make-icons.mjs           regenerates the app icons
  .github/
    workflows/
      release.yml            windows installer build on tags
  src/                       react front end (the webview ui)
    main.tsx                 mounts react into #root
    App.tsx                  top-level shell and dialog wiring
    types.ts                 shared domain types
    data/
      sample.ts              sample records for the browser preview
    lib/
      api.ts                 picks the real or memory backend
      memory-api.ts          in-browser backend used outside tauri
      dialog.ts              open/save file dialogs wrapper
      extraction.ts          preset + confidence helpers for receipt fields
      format.ts              money/date/serial formatting helpers
      warranty.ts            warranty status derivation
      tauri.ts               tauri detection and app info
    state/
      RecordsProvider.tsx    records state, actions, loading/error/notice
    components/              ui building blocks
    styles/
      app.css                design tokens and layout
  src-tauri/                 rust / tauri back end (the desktop shell)
    Cargo.toml               crate config and deps
    tauri.conf.json          window, csp, bundle targets
    capabilities/
      default.json           allowed tauri permissions
    icons/                   app icons
    src/
      main.rs                binary entry, calls run()
      lib.rs                 module wiring and command registration
      commands.rs            tauri command handlers
      state.rs               shared app state and init
      db.rs                  sqlite open + migrations
      files.rs               evidence file storage on disk
      backup.rs              backup create/restore
      archive.rs             dependency-free zip writer
      packet.rs              repair-packet report and archive assembly
      document.rs            reads text out of pdf files
      extract.rs             builds extraction suggestions
      ollama.rs              talks to local ollama
      models.rs              wire types shared with the front end
      validate.rs            input validation
      error.rs               app error type and safe messages
```

the split is simple: `src/` is the interface, `src-tauri/` is the engine. the
front end never talks to the network itself. it only calls rust commands.

---

## 3. key components

### front end

**`src/App.tsx`**
- what: the app shell. holds which view is open, which dialog is showing, and
  wires the sidebar, editor, passport, and dialogs together.
- why: keeping the wiring in one place makes the data flow easy to follow, and
  there is only one screen, so a router would be overkill.
- depends on: `RecordsProvider`, `AppShell`, `GearEditor`, `GearPassport`,
  `ExtractDialog`, `ConfirmDialog`, `Toast`.

**`src/state/RecordsProvider.tsx`**
- what: loads records on start and exposes actions (create, update, delete,
  attach evidence, build packet) plus `loading`, `error`, and `notice` state.
- why: a single context keeps every component reading the same list, so the ui
  never shows two different versions of the same record. it also centralises
  error handling so a failed command shows a message instead of crashing.
- depends on: `lib/api.ts`, `types.ts`.

**`src/lib/api.ts`**
- what: the one place that decides whether to call the real tauri backend or the
  in-browser `memory-api`. it checks `isTauri()` and picks accordingly.
- why: the ui can run in a plain browser for fast iteration without a full rust
  build, while production uses the real backend. one switch, no scattered
  feature checks.

**`src/lib/memory-api.ts`**
- what: an in-memory stand-in for the backend used only in the browser preview.
- why: lets you work on the ui (layout, states, flows) without compiling rust.
- trade-off: it cannot exercise file storage, backup/restore, or ollama, so
  those flows must be tested in the real desktop app.

**`src/lib/warranty.ts`**
- what: turns a gear record into a warranty view: `unknown`, `none`, `active`,
  `expiring`, or `expired`.
- why: a warranty status is only reported from data the user confirmed. if the
  date is not confirmed, the result is `unknown`, never a guess. this was a
  deliberate product rule, not a technical shortcut.
- key detail: `EXPIRING_WINDOW_DAYS = 60`.

```ts
// src/lib/warranty.ts - why we never guess
export function warrantyView(gear: Gear, now: Date = new Date()): WarrantyView {
  if (!gear.warrantyConfirmed) {
    return { status: "unknown", label: "Not confirmed", daysRemaining: null, confirmed: false };
  }
  // ...only after confirmation do we compute a real status
}
```

**`src/lib/format.ts`**
- what: display helpers for money, dates, byte sizes, and serial numbers.
- why: keeps formatting in one place so every screen shows values the same way.
- key detail: `maskSerial` hides all but the last four characters of a serial so
  a full identifier is never shown on screen.

**`src/lib/extraction.ts`**
- what: maps a receipt extraction into editor presets and per-field confidence
  labels.
- why: the ui treats model output as suggestions. these helpers decide how a
  suggestion is shown and how confident it looks.

**`src/components/`**
- `AppShell.tsx` / `Sidebar.tsx` - page frame and navigation.
- `GearEditor.tsx` - the create/edit form.
- `GearPassport.tsx` - the read view for one gear item.
- `WarrantyPanel.tsx` - shows warranty status.
- `OwnershipTimeline.tsx` - the milestone list.
- `EvidenceTray.tsx` - attached files.
- `PrepareRepairPacket.tsx` - reviews and exports the repair packet: pick files
  and history, opt in to the full serial, and save a zip.
- `ExtractDialog.tsx` - runs receipt reading and shows suggestions for review.
- `LocalDataPanel.tsx` - shows where data lives and backup actions.
- `Section.tsx`, `DetailList.tsx`, `Icon.tsx` - small shared pieces.
- `ConfirmDialog.tsx`, `Toast.tsx` - confirmation and feedback.
- why: each piece owns one job, so a screen is a short list of named parts
  instead of one large file.

### back end

**`src-tauri/src/lib.rs`**
- what: declares the modules and registers commands with tauri's
  `generate_handler!`.
- why: a single registration point means it is obvious what the ui can call.

**`src-tauri/src/commands.rs`**
- what: the tauri command handlers the front end invokes, e.g. `app_info`,
  `ollama_status`, `extract_receipt`, `export_repair_packet`, and the record
  commands.
- why: commands stay thin. they validate, call into a module, and return a
  result. the real work lives in the modules below.
- key detail: `export_repair_packet` loads only the records that belong to the
  requested gear, so a selection cannot pull in another gear's files.

**`src-tauri/src/db.rs`**
- what: opens the sqlite database and runs migrations.
- why: sqlite keeps the app local-first with a single file and no server. all
  statements are parameterised, foreign keys are on, and wal mode is enabled.

```rust
// src-tauri/src/db.rs - safe query shape
let mut stmt = conn.prepare("select id, name from gear where id = ?1")?;
```

**`src-tauri/src/files.rs`**
- what: stores evidence files on disk and hashes them (sha256).
- why: files live next to the database rather than inside it, which keeps the
  database small and lets a user copy evidence out without special tools.

**`src-tauri/src/backup.rs`**
- what: creates and restores backups of the app data.
- why: a local app still needs a safety net. backups are simple copies, so a
  user can always recover their records.

**`src-tauri/src/archive.rs`**
- what: a tiny, dependency-free zip writer (stored entries only) with its own
  crc-32.
- why: a packet only holds an html report and already-compressed files, so a full
  archive crate was not needed. keeping the writer in-repo avoids a new
  dependency and its license.
- key detail: entry names are validated (no `..`, no separators, no leading
  slash) so nothing can escape the archive.

**`src-tauri/src/packet.rs`**
- what: builds the repair-packet report and the zip. it escapes every record
  value for html, masks the serial number unless the photographer opts in, and
  copies evidence files verbatim.
- why: keeping all packet logic in one place makes the safety rules (ownership,
  html escaping, path containment, size cap) easy to audit and test.
- key detail: `MAX_PACKET_BYTES` caps a packet, and a stored file name is only
  rejoined onto the evidence directory after separators and `..` are rejected.

**`src-tauri/src/document.rs`**
- what: extracts text from pdf files before any read.
- why: it checks the file size before reading so an oversized file cannot hang
  or exhaust memory (this was a real fix in commit `0ecd64b`).

**`src-tauri/src/ollama.rs`**
- what: the only module that talks to a model. it checks the local server and
  posts the image to `POST /api/chat`.
- why: isolating model access here keeps the privacy promise easy to audit. the
  server address defaults to `http://127.0.0.1:11434` and the default model is
  `qwen2.5vl:7b` (`Qwen2.5-VL-7B-Instruct`, apache-2.0). requests use
  `temperature: 0` and a json `format` schema so answers are structured.
- overrides: `SHUTTERPROOF_OLLAMA_URL` and `SHUTTERPROOF_OLLAMA_MODEL`.
- key detail: it first checks `GET /api/version` and `GET /api/tags`, so the ui
  can tell the user whether the model is ready.

**`src-tauri/src/extract.rs`**
- what: turns a raw model answer into `Extraction` suggestions with per-field
  confidence and warnings.
- why: the ui should never trust raw model text. shaping it here keeps the
  contract clean and testable. it does not invent values, only carries what the
  model returned.

**`src-tauri/src/models.rs`**
- what: the wire types shared with the front end. field names are camelCase to
  line up with `src/types.ts`.
- why: one source of truth for the shape of every message across the bridge.

**`src-tauri/src/error.rs`**
- what: the app error type with safe messages.
- why: errors reaching the ui must not leak paths or internals, so messages are
  written to be safe by default.

**`src-tauri/src/validate.rs`**
- what: input validation for records.
- why: bad data is rejected at the edge, before it ever reaches the database.

---

## 4. code snippets

**privacy: the front end never calls the network.** only rust does, and only to
`127.0.0.1`.

```jsonc
// src-tauri/tauri.conf.json (csp, trimmed)
"csp": "default-src 'self'; connect-src 'self' ipc: http://ipc.localhost"
```

**suggestions only.** a receipt field carries a confidence and a quote, and it
stays `pending` until the photographer accepts it.

```rust
// src-tauri/src/models.rs
pub struct ExtractedField {
    pub key: String,
    pub label: String,
    pub value: String,
    pub confidence: f64,
    pub evidence_quote: Option<String>,
}
```

**graceful browser preview.** app info returns null outside tauri instead of
throwing.

```ts
// src/lib/tauri.ts
export async function fetchAppInfo(): Promise<AppInfo | null> {
  if (!isTauri()) return null;
  try {
    return await invoke<AppInfo>("app_info");
  } catch {
    return null;
  }
}
```

---

## 5. getting started

requirements:

- node.js 18+ and npm.
- rust stable toolchain with the `x86_64-pc-windows-msvc` target.
- visual studio build tools with the c++ workload (msvc).
- optional: ollama running locally with `qwen2.5vl:7b` pulled, for receipt
  reading.

install and run:

```bash
npm install
npm run dev          # ui only, opens in a browser using the memory backend
npm run tauri:dev    # full desktop app with the rust backend
```

build an installer (windows):

```bash
npm run tauri:build
```

outputs: an msi and an nsis setup exe under
`src-tauri/target/release/bundle/`.

checks:

```bash
npm run typecheck    # tsc --noEmit
npm run build        # typecheck + vite production build
npm run lint         # declared but eslint is not configured yet
```

rust checks:

```bash
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test  --manifest-path src-tauri/Cargo.toml
```

where data lives: `%APPDATA%\app.shutterproof.desktop\` holds `records.db`,
plus `backups\`, `evidence\`, and `tmp\`. no environment secrets or api keys are
needed; the app stores no keys.

---

## 6. api / usage examples

the front end talks to rust through `invoke`. a few useful commands:

```ts
import { invoke } from "@tauri-apps/api/core";

const info = await invoke("app_info");
// { name: "shutterproof", version: "0.1.0", stage: "stage-3-extraction" }

const status = await invoke("ollama_status");
// { available, model, modelPresent, version, message }

const extraction = await invoke("extract_receipt", { evidenceId });
// { id, status: "pending", fields: [...], warnings: [...] }

const packet = await invoke("export_repair_packet", {
  gearId,
  evidenceIds,
  eventIds,
  includeSerial: false,
  destPath, // chosen with the native save dialog
});
// { path, byteSize, fileCount, includedSerial, createdAt }
```

`export_repair_packet` writes a zip holding `repair-summary.html` and an
`evidence/` folder. it accepts only records owned by `gearId`, keeps the serial
number masked unless `includeSerial` is true, and writes to a temporary file
before the final archive.

checking whether the model is ready (rust side):

- `GET http://127.0.0.1:11434/api/version` -> is ollama up?
- `GET http://127.0.0.1:11434/api/tags` -> is the model pulled?
- `POST http://127.0.0.1:11434/api/chat` -> the actual read, with
  `{ messages: [{ role, content, images: [base64] }], stream: false,
  format: <json schema>, options: { temperature: 0 } }`.

if the model is not available, receipt reading is disabled and manual entry
still works. suggestions are always reviewable and never auto-applied.

---

## 7. keeping this doc in sync

this file is versioned next to the code so it can change with it. the process is
light on purpose:

- when a key file changes (`src/lib/*`, `src/state/*`, `src-tauri/src/*`,
  `tauri.conf.json`), update the matching section here in the same change.
- use small, plain updates. add a line when a new module appears; remove a line
  when one goes away.
- useful follow-up prompts:
  - "update docs/PROJECT_OVERVIEW.md based on recent code changes."
  - "list any sections here that no longer match the code and fix them."
  - "add a section explaining <feature/flow>."
- watch for drift in these spots:
  - the default model name or ollama url in `ollama.rs`.
  - the csp line in `tauri.conf.json`.
  - the bundle targets in `tauri.conf.json`.
  - the scripts block in `package.json`.
- the release workflow (`.github/workflows/release.yml`) builds unsigned
  windows installers on `v*` tags. if the build steps change, update section 5.

nothing in this file should ever contain api keys, tokens, or personal data.
