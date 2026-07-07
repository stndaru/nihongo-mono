# Development workflow

## Commands

```bash
bun install             # deps (ALWAYS bun, never npm — user requirement)
bun run dev             # copies the kuromoji dict to public/, then Vite dev server (localhost:5173)
bun run test            # vitest: conjugation engine, adjective inflection, deconjugation, quiz rules, progress store, sentence parser (142 tests)
bun run lint            # oxlint
bun run build           # copy-kuromoji, then vite build && tsc -b (this order — routeTree.gen.ts must exist before tsc)
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
  what actually renders. Kana-only words also render **no `<ruby>` element
  at all** — don't wait on `ruby` selectors for words like ある.
- Debounced search (150 ms) needs `waitForFunction` on result content, not
  fixed sleeps.
- **Quiz feedback swallows Enter for its first 200 ms** (deliberate app
  behavior so the submitting Enter can't skip feedback). Scripts must wait
  ~300 ms after feedback appears before pressing Enter, or the session
  looks "frozen" on question 1 — this burned a whole debugging session.
- Radix dialogs/drawers animate for 150 ms and unmount only after the exit
  animation — screenshot or count elements ~300 ms after open/close, not
  immediately.
- Vite dev **hot-reloads while you edit** — a Playwright run started right
  after file edits can hit mid-reload states. Re-run before diagnosing.
- To drive a quiz session from a script, go straight to
  `/quiz/session?levels=5&forms=te,past&modes=input&length=3` — the default
  config mixes in multiple-choice questions, which a type-and-Enter loop
  can't answer. Detect the summary via its "By conjugation" heading. To
  test `/progress` UI states, seed `nihongo-mono:progress:v1` with
  `addInitScript` instead of grinding real quizzes.
- `vite.config.ts` changes need a **dev-server restart**; HMR does not
  apply them (measured a config change as a no-op for a while).
- When measuring network transfer, `response.body()` returns the
  **decoded** body — the dev server serves `.json.gz` with
  Content-Encoding, so bodies look inflated; real wire cost is the .gz
  size on disk.
- Scroll assertions need a viewport **shorter than the page**: with the
  default 900-px-tall page and little seeded data, the page fits entirely
  and `scrollIntoView` is a no-op — the "did it scroll" check times out
  even though the feature works. Also, a target section near the bottom
  can never reach the viewport top; assert "scrolled and visible", not
  "at top".

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
  Shard counts now exist in **three pairs** that must stay in sync with
  `src/lib/data/loader.ts`: verbs/vocab ext (32/128, `build-extended.ts`),
  kanji ext (16, `pack-jlpt.ts`), strokes (256, `build-strokes.ts`).
- **Never import multi-MB JSON through the JS module graph** — fetch it as
  static `.json.gz` (see architecture.md, "Tier 1"). This single mistake
  produced a 230 MB dev page.
- CSS transforms don't apply to `rt` (ruby text) — use relative
  positioning to nudge furigana.
- New UI text: Title Case buttons, `lang="ja"` on Japanese text, pointer
  cursor comes free from base CSS, animations ≤150 ms.
- After hand-editing anything under `src/data/`, run `bun run data:pack` —
  the app serves the packed copies, not the pretty files.
- `public/kuromoji/` is **gitignored** — `scripts/copy-kuromoji.ts` (run by
  `dev`/`build`) copies it from node_modules. A deploy built without that
  step breaks Smart Parsing (it degrades to the greedy engine with a
  notice, but still). The deep kuromoji imports are pinned in
  `vite.config.ts` `optimizeDeps.include`.

## Deploying

Static hosting only: build and serve `dist/`. SPA fallback rewrites exist
for Netlify (`public/_redirects`) and Vercel (`vercel.json`); the owner
also deploys to a VPS with `bun run start-vps` (`serve -s dist -l 4050`).
The `public/data/*.json.gz` files are fetched at runtime — any static host
works since decompression happens client-side (`DecompressionStream`,
baseline-2023 browsers) with a magic-byte fallback when a server already
inflates them.
