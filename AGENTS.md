# AGENTS.md

Japanese learning SPA: React 19 + TypeScript, TanStack Router (file-based),
Tailwind v4, Vite 8, Bun. Static hosting, no backend; all data is
pre-gzipped JSON under `public/data/`. Deep docs: [docs/](docs/README.md).

## Commands

```bash
bun install          # ALWAYS bun, never npm
bun run dev          # dev server :5173
bun run test         # vitest — must stay green
bun run lint         # oxlint — must stay clean
bun run build        # vite build && tsc -b — must pass (type-checks scripts/ too)
bun run data:pack    # after any hand edit under src/data/
bun run data:build   # full dataset regen (needs scripts/.cache/)
```

## Definition of done (every change)

1. `bun run test` + `bun run lint` + `bun run build` green.
2. Browser-verify with a fresh Playwright script run under **node** (not
   Bun — Chromium won't launch under Bun on Windows) against
   `bunx vite preview --port 4173`: zero `pageerror`/console errors,
   assert on visible content, screenshot.
3. No horizontal page overflow at 390 px and 640–900 px widths, including
   with the font-size keys (`nihongo-mono:font-size` / `font-ja-size` /
   `font-furigana-size`) at `"xxlarge"`. Wide content scrolls inside its
   own `overflow-x-auto` container.
4. Update docs in the same commit:
   - behavior/features → `docs/architecture.md`; data formats/scripts →
     `docs/data-pipeline.md`; workflow/gotchas → `docs/development.md`
   - any non-obvious decision, fixed bug, or trade-off → numbered entry in
     `docs/decisions-and-caveats.md`
   - user-visible features/routes → `README.md` + `docs/README.md`
5. Commit to `master`; write the message to a temp file and use
   `git commit -F <file>` (PowerShell 5.1 mangles multi-line `-m`).

## Performance & network efficiency — first-class requirements

- Never import multi-MB JSON through the JS module graph; serve static
  `.json.gz`, fetch on demand.
- New data must answer: what does a cold deep link download? What does a
  repeated action add up to? Fetch per level/shard (~20–70 KB), route by
  id (`jlpt/ids.json.gz`), gate anything big behind an explicit opt-in.
- Search big datasets as raw tuple rows; materialize only rendered rows.
  Keep search behind the shared 250 ms debounce + `startTransition`.
- Measure, don't guess: CDP `encodedDataLength` per action; event-timing +
  longtask observers at 4× CPU throttle. If already optimal, leave it and
  log why in `decisions-and-caveats.md`.

## Conventions

- Shard counts are sync pairs between build scripts and
  `src/lib/data/loader.ts` (verbs/vocab ext 128/512, kanji ext 16,
  kanji-words 64, strokes 256). Changing one = regenerate + commit
  `public/data/`.
- Filters: multi-select everywhere; empty = no constraint (Level excepted:
  empty = nothing, URL sentinel `levels=none`); labels toggle all; state in
  csv URL params. TanStack Router JSON-parses search params (`?levels=5`
  arrives as number) — normalize with `String()` in `validateSearch`.
- Settings: localStorage `nihongo-mono:*`, applied pre-paint by the inline
  script in `index.html`; default = no attribute; helpers in `src/lib/theme.ts`.
- Search queries: NFKC-normalize (`normalizeQuery`) at every new entry point.
- UI: Title Case buttons; `lang="ja"` on Japanese text; animations ≤150 ms;
  `<ruby>` for furigana (CSS transforms don't work on `rt`; `<rt>` text
  pollutes `textContent` — assert on glosses in tests).

## Never

- Never use npm, or run Playwright under Bun.
- Never commit scratch/temp files or `scripts/.cache/`.
- Never ship KANJIDIC2's own `jlpt` field (pre-2010 scale) — kanji levels
  come from `jlpt_new` (see data-pipeline.md).
- Never re-introduce a bug logged in `docs/decisions-and-caveats.md` — skim
  it before structural changes; "simplifying" past its warnings has
  repeatedly re-broken things.
- Never "fix" the app for a failing verification script without first
  checking the script's assumptions (ruby interleaving, chip labels, Radix
  dialogs vs browser confirms have all produced false alarms).
