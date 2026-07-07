# Development workflow

## Commands

```bash
bun install             # deps (ALWAYS bun, never npm — user requirement)
bun run dev             # Vite dev server (localhost:5173)
bun run test            # vitest: conjugation engine, adjective inflection, streak (33 tests)
bun run lint            # oxlint
bun run build           # vite build && tsc -b  (this order — routeTree.gen.ts must exist before tsc)
bun run data:download   # sources → scripts/.cache/
bun run data:build      # regenerate all datasets (see data-pipeline.md)
bunx tsc -b             # type-check only (covers app AND scripts/ project)
```

## Environment quirks (Windows dev box)

- **Bun, not npm** — for installs, scripts, and running TS files directly
  (`bun scripts/foo.ts`). Scripts are also type-checked by `tsc -b`, so keep
  them warning-free (`TS6133` unused imports fail the build).
- **Playwright cannot launch Chromium under Bun on Windows** (debug-pipe
  timeout). Browser-verification scripts are run with **node**. Playwright
  is installed in the session scratchpad, not in the repo; chromium comes
  from `bunx playwright install chromium`.
- PowerShell 5.1 mangles embedded double quotes when passing multi-line args
  to native commands — write commit messages to a file and `git commit -F`.

## The definition of done used so far

Every feature round ended with all of:

1. `bunx tsc -b` clean, `bun run lint` clean, `bun run test` green.
2. `bun run build` succeeds.
3. **Browser verification with a Playwright script** (run under node)
   against the dev server: navigate the changed pages, assert on visible
   text/selectors, collect `pageerror` events (must be none), and take
   screenshots for visual review. Past scripts live in the session
   scratchpad (`ext-check.mjs`, `perf-check.mjs` patterns) — write a fresh
   one per round; it's ~40 lines.
4. Conventional commit on `main` with a body explaining *why*.

Playwright gotchas learned the hard way:

- `hasText` matching includes `<rt>` ruby text — 広い renders as text
  "広ひろい", so match on kana or use more specific locators.
- "Usually kana" words never show their kanji (きれい not 綺麗) — assert on
  what actually renders.
- Debounced search (150 ms) needs `waitForFunction` on result content, not
  fixed sleeps.

## Testing philosophy

- The conjugation engine is the highest-value unit-test surface:
  table-driven fixtures per verb class + every irregular (行く, ある,
  くださる, 問う, くれる, する, 来る…). Extend fixtures when touching
  `src/lib/conjugation/`.
- Adjective inflection and streak logic also have suites.
- UI is verified by the Playwright round, not unit tests.

## Recurring foot-guns (fixed once — don't re-break)

- **TanStack Router JSON-parses search params**: `?levels=5` arrives as the
  *number* 5. Every `validateSearch` normalizes with
  `String(search.levels ?? '')` before regex-testing. Any new search param
  that looks numeric needs the same treatment.
- Level filter regexes are `[0-5]` on the list pages (0 = Beyond) but `[1-5]`
  in quiz config — this asymmetry is intentional.
- Never allow an empty level selection (toggle handlers guard against it).
- `EXT_LIMIT`, table `PAGE`, shard counts, and the ext wire format all have
  comments explaining their constraints — read them before "simplifying".
- New UI text: Title Case buttons, `lang="ja"` on Japanese text, pointer
  cursor comes free from base CSS, animations ≤150 ms.

## Deploying

Static hosting only: build and serve `dist/`. SPA fallback rewrites exist
for Netlify (`public/_redirects`) and Vercel (`vercel.json`). The
`public/data/*.json.gz` files are fetched at runtime — any static host
works since decompression happens client-side (`DecompressionStream`,
baseline-2023 browsers).
