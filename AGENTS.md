# ShutterProof — agent notes

## Commit granularity

Create a small local Git commit after roughly every **20 lines of newly added or
changed source code**.

- Count actual source lines only. Do **not** count blank lines, comments,
  generated files (`dist/`, `src-tauri/icons/`, `package-lock.json`), or
  documentation such as README/AGENTS.
- If the 20-line mark falls in the middle of an edit, finish that edit before
  committing.
- Before each commit, inspect the diff and stage only the related ShutterProof
  changes. Keep each commit scoped to one small, coherent change.
- Use a clear, conventional commit message: `type: short imperative summary`.
- Never push. Do not amend the existing scaffold commit. Do not reset, rebase,
  or discard changes.
- If unrelated changes or any Git problem appear, stop and report before
  committing.

## Verify before committing

```bash
npm run typecheck      # tsc --noEmit
npm run build          # typecheck + vite production build
```

`npm run lint` is declared but ESLint is not yet configured.

Rust/Tauri compile checks require the Rust toolchain and MSVC Build Tools, which
are not installed on this machine yet (see README prerequisites).

## Documentation sync

`docs/PROJECT_OVERVIEW.md` is the living overview of the codebase. Update it in
the **same change** that touches the code it describes.

- Whenever you add, remove, or change a module under `src/` or `src-tauri/src/`,
  a script in `package.json`, or a setting in `src-tauri/tauri.conf.json`, update
  the matching section of `docs/PROJECT_OVERVIEW.md` before the change is done.
- Sections to check: 2 (structure), 3 (key components), 5 (getting started), and
  6 (api/usage).
- Keep edits small and plain. Add a line when a module appears; remove one when
  it goes.
- Never put api keys, tokens, or personal data in the doc.
- `.github/workflows/docs-sync.yml` flags a source change that lands without a
  doc change, so drift is visible on the pull request or push.

## Scope discipline

Build work proceeds in stages. Stay within the current stage; do not pull
forward later-stage features (persistence, file import, OCR/AI, export,
auth, telemetry, cloud).
