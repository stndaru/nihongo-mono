# AGENTS.md — how to work on nihongo-mono

Instructions for AI agents (and humans) implementing features here. The
deep context lives in [`docs/`](docs/README.md) — read `architecture.md`,
`data-pipeline.md`, `development.md`, and `decisions-and-caveats.md` before
non-trivial work. This file is the operating checklist.

## Golden rules

1. **Bun, never npm** — installs, scripts, running TS (`bun scripts/foo.ts`).
   Exception: Playwright verification scripts run under **node** (Chromium
   won't launch under Bun on Windows).
2. **Prioritize performance and network efficiency in every decision.**
   This is a static, no-backend site meant to feel instant on mobile:
   - Never import multi-MB JSON through the JS module graph — serve it as
     pre-gzipped static `.json.gz` fetched on demand (this mistake once
     produced a 230 MB dev page).
   - Fetch only what the interaction needs: per-level files, id-routed
     detail lookups (`jlpt/ids.json.gz`), small shards (~20–70 KB), lazy
     opt-ins for anything big (Beyond tier, kuromoji). New data = ask
     "what does a cold deep link download?" and "what does a repeated
     action add up to?"
   - Search large datasets as **raw tuple rows**, materialize only shown
     results (204k entry objects once froze the tab). Keep search inputs
     behind the shared 250 ms debounce + `startTransition`.
   - **Measure before and after**: CDP `encodedDataLength` per action for
     network; event-timing/longtask observers under 4× CPU throttle for
     jank. If something is already at its optimal form, leave it and note
     why in the decision log.
3. **Don't re-break fixed bugs.** `docs/decisions-and-caveats.md` is a
   numbered log of every trap already hit (router search params arrive
   JSON-parsed, ruby `<rt>` pollutes `textContent`, grids need explicit
   `grid-cols-1`, PS 5.1 quirks…). Skim it; add an entry when you fix or
   decide something non-obvious.

## Definition of done — every feature round

Run all of these; a round isn't done until they're green:

```bash
bun run test     # vitest (153+); extend fixtures when touching conjugation/search/quiz logic
bun run lint     # oxlint
bun run build    # vite build && tsc -b — also type-checks scripts/
```

4. **Browser-verify with a fresh Playwright script** (node, ~40 lines,
   against `bunx vite preview --port 4173` — the production build, not dev).
   Assert on visible text/selectors, collect `pageerror`/console errors
   (must be none), screenshot for visual review. Playwright gotchas are
   listed in `docs/development.md`.
5. **Check mobile (390 px) and mid-widths (~640–900 px)**: no horizontal
   page overflow (`scrollWidth <= clientWidth`) — wide content scrolls in
   its own `overflow-x-auto` container. Test at the largest font-size
   setting (`nihongo-mono:font-size = xxlarge`) too; it amplifies layout
   bugs.
6. **Update the docs in the same commit** (see below).
7. Commit on `master` with a body explaining *why*. **Write the message to
   a file and use `git commit -F`** — PowerShell 5.1 mangles quoted
   multi-line `-m` args.

## Documents to update per change

| Changed | Update |
| --- | --- |
| Any behavior/feature | `docs/architecture.md` (the relevant section) |
| Data formats, build scripts, shard counts | `docs/data-pipeline.md` + the sync-pair comments in `src/lib/data/loader.ts` |
| Commands, workflow, test counts, new gotchas | `docs/development.md` |
| Any non-obvious decision, fixed bug, accepted trade-off | `docs/decisions-and-caveats.md` (numbered entry) |
| User-visible features, routes | `README.md` + `docs/README.md` (route map) |

Stale docs are treated as bugs — after multi-part work, grep the docs for
counts/sizes/names you changed (test counts, shard counts, MB figures).

## Implementation conventions

- **Data tiers**: JLPT core (hand-editable JSON in `src/data/`, packed by
  `bun run data:pack`) vs extended "Beyond" tier (built from
  `scripts/.cache/`). Shard counts exist as **sync pairs** between build
  scripts and `src/lib/data/loader.ts` — verbs/vocab ext 128/512, kanji ext
  16, kanji-words 64, strokes 256. Regenerate + commit `public/data` when
  they change.
- **Filters**: every group is multi-select; empty list = no constraint
  (except Level, where empty = nothing shown, URL sentinel `levels=none`);
  group labels toggle select/deselect-all; Beyond chips stay out of bulk
  toggles; state lives in csv URL params.
- **Settings/preferences**: localStorage under `nihongo-mono:*`, applied
  **pre-paint** by the inline script in `index.html` (no flash), default =
  no attribute, helpers in `src/lib/theme.ts`.
- **Search**: normalize queries with `normalizeQuery` (NFKC) at every new
  entry point; latin also matches as kana; conjugated queries deconjugate.
- **UI**: Title Case buttons; `lang="ja"` on all Japanese text; animations
  ≤150 ms; pointer cursor is free from base CSS; `text-balance` against
  orphan words; every example sentence carries a parser link; furigana via
  `<ruby>` (CSS transforms don't work on `rt`).
- **Verification honesty**: distinguish app bugs from test-script
  assumptions before "fixing" the app — several past failures were the
  script's (ruby text interleaving, singular chip labels, Radix dialogs vs
  browser confirms).

## Environment (Windows)

- PowerShell 5.1: no `&&`/ternary; heredocs via files; avoid inline
  multi-line quoting (see `docs/development.md`).
- Playwright lives in the session scratchpad, not the repo; run scripts
  with node; browsers via `bunx playwright install chromium`.
- Temp/scratch files never go in the repo.
