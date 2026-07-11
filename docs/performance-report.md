# Performance report — 2026-07-08 (addenda 2026-07-09, 2026-07-10)

> **Addendum, 2026-07-09** — see [the section at the end](#addendum-2026-07-09--parser-audit-after-decisions-4958)
> for a re-audit of the parser after the homograph/compound/counter/EN-tab
> work (decisions 49–58) and the `startTransition` render optimization it
> produced. The parser rows in the table below predate those changes.

A measured snapshot proving the app's lightweightness: one continuous
browser session exercised every major feature (38 actions, all pages, every
opt-in enabled) while recording bytes over the wire per action, JS heap,
long tasks, and OS-level process RAM. Re-run this after big data or route
changes and compare.

| | |
| --- | --- |
| **Date/time** | 2026-07-08 15:27 UTC+7 (08:27 UTC) |
| **Version** | commit `7ed5f6f` (after the Lighthouse round: robots.txt, intent-gated parser dictionary) |
| **Build** | `bun run build`, Vite 8 production bundle — entry 397 KB (127 KB gzip) + 60 route/vendor chunks, CSS 70 KB (12 KB gzip) |
| **Environment** | Windows 11, headless Chromium (Playwright under node) against `vite preview` on localhost — unthrottled; wire bytes are gzip-encoded transfer (CDP `encodedDataLength`) |

## Headline numbers

| Metric | Value |
| --- | --- |
| Cold homepage load | **173.6 KB** over 16 requests, FCP 160 ms (unthrottled; mobile-throttled Lighthouse same day: FCP 2.2 s, perf 96) |
| Entire 38-action power tour, **every opt-in enabled** | **28.92 MB** over 557 requests |
| Same tour **without opt-ins** (no Beyond, no Smart Parsing, no name searches) | **≈ 2.4 MB** |
| Worst single action (max data fetch spike) | **Smart Parsing enable: 16.98 MB** (kuromoji analyzer — opt-in, confirm-gated with the size stated, one-time; HTTP-cached afterwards) |
| Biggest single file fetch | `kuromoji/dict/tid_pos.dat.gz` **5.64 MB** (inside the opt-in above) |
| Biggest app-data fetch | `vocab-ext/index.json.gz` **5.34 MB** (the full-JMdict search index — only on the opt-in "Beyond" level / "Include Full Dictionary") |
| Biggest non-opt-in action | `/vocab/antonyms` first visit: **1.03 MB** (adjective data across all levels) |
| Peak JS heap during the tour | **111.7 MB** (moment kuromoji finished building); settles back to 7–30 MB after GC |
| Heaviest possible resident state | JS heap **242 MB**, renderer working set **535 MB**, whole browser tree **714 MB** — full 234k-entry dictionary + kuromoji tokenizer live at once |
| Baseline for comparison | plain homepage: renderer **85 MB** working set, JS heap **3.8 MB** (an empty Chromium tab alone is ~50–80 MB) |
| Worst long (main-thread-blocking) task | **149 ms** (rendering the single-kana names search "あ"); every other action ≤ 101 ms, most actions zero long tasks |
| Repeat visit (same browser, warm HTTP cache) | **3.2 KB** to reopen `/dictionary` — every data file revalidates at ~127 bytes |
| Page errors across the whole tour | **0** |

**Reading:** a normal JLPT-focused study session (browse, search, quiz,
parse, progress) costs ~2–3 MB total and stays under ~40 MB of JS heap.
The multi-MB figures only exist behind explicit opt-ins that state their
cost before downloading, are fetched exactly once, and come back from the
HTTP cache (~0 KB) on every later visit.

## Per-action log (chronological, one session)

Requests/bytes are what that action alone put on the wire. Heap is sampled
after the action (GC timing makes it fluctuate — trust the trend, not
adjacent deltas). "lt" = long tasks count / worst duration.

| Action | Req | Wire | Max single fetch | Heap | lt |
| --- | ---: | ---: | ---: | ---: | --- |
| Cold load `/` (homepage) | 16 | 173.6 KB | 123 KB (entry JS) | 3.8 MB | 0 |
| Nav `/dictionary` (default levels) | 19 | 178.3 KB | 120.6 KB | 8.0 MB | 1/63ms |
| Nav `/verbs` | 18 | 7.3 KB | 2.9 KB | 10.1 MB | 1/72ms |
| Nav `/vocab` | 18 | 6.9 KB | 2.5 KB | 14.6 MB | 0 |
| Nav `/vocab/antonyms` | 21 | 1,055.1 KB | 410.3 KB | 25.1 MB | 1/58ms |
| Nav `/kanji` | 18 | 133.8 KB | 127 KB (kanji-core) | 29.4 MB | 0 |
| Nav `/names` | 16 | 6.9 KB | 2.2 KB | 28.2 MB | 0 |
| Nav `/cheatsheet` | 16 | 5.3 KB | 1.7 KB | 30.3 MB | 0 |
| Nav `/cheatsheet/verbs` | 17 | 8.6 KB | 3.6 KB | 32.7 MB | 1/62ms |
| Nav `/resources` | 16 | 6.3 KB | 1.8 KB | 34.8 MB | 0 |
| Nav `/quiz` | 18 | 9.0 KB | 2.5 KB | 37.3 MB | 0 |
| Nav `/quiz/vocab` | 18 | 6.0 KB | 1.7 KB | 36.4 MB | 0 |
| Nav `/progress` | 18 | 9.2 KB | 3.8 KB | 38.6 MB | 0 |
| Nav `/settings` | 17 | 7.8 KB | 2.3 KB | 40.9 MB | 0 |
| Nav `/about` | 15 | 6.8 KB | 2.8 KB | 43.0 MB | 0 |
| Dictionary: all JLPT levels | 8 | 534.6 KB | 209.9 KB | 55.9 MB | 0 |
| Dictionary: enable **Beyond** (opt-in) | 2 | 6,072 KB | 5,466.3 KB | 89.0 MB | 1/85ms |
| Dictionary: search "taberu" over 234k entries | 0 | 0 | — | 48.9 MB | 1/96ms |
| Dictionary: search full-width ＴＡＢＥＲＵ (NFKC edge) | 0 | 0 | — | 73.5 MB | 1/52ms |
| Kanji list + search 水 | 18 | 3.0 KB | 0.2 KB | 8.0 MB | 0 |
| Kanji detail 食 (strokes + words) | 22 | 33.1 KB | 13.5 KB | 12.2 MB | 0 |
| Kanji detail 議 | 25 | 90.1 KB | 21.1 KB | 16.8 MB | 0 |
| Kanji detail 鬱 (rare, ext shard) | 26 | 63.5 KB | 21.2 KB | 21.0 MB | 0 |
| Kanji 議: Load All Words (indexes cached) | 2 | 0.2 KB | — | 53.8 MB | 1/101ms |
| Names search "やまだ" | 1 | 160.9 KB | 160.9 KB | 7.8 MB | 2/66ms |
| Names search "田中" (kanji → reading fan-out) | 21 | 3,190.1 KB | 343 KB | 58.5 MB | 0 |
| Names search "あ" (densest single bucket) | 1 | 391 KB | 391 KB | 69.9 MB | 1/149ms |
| Palette: open + search "nomu" | 10 | 1.2 KB | — | 16.7 MB | 1/50ms |
| Palette: Include Full Dictionary (indexes cached) | 2 | 0.2 KB | — | 48.3 MB | 2/81ms |
| Palette: full-dict search "せんたくき" | 0 | 0 | — | 48.3 MB | 0 |
| Parser: 100-char sentence, greedy engine | 30 | 16.3 KB | 8.1 KB | 66.7 MB | 0 |
| Parser: enable **Smart Parsing** (opt-in) | 15 | 17,386.5 KB | 5,777.6 KB | 105.8 MB | 1/63ms |
| Parser: smart re-parse | 0 | 0 | — | 106.8 MB | 0 |
| Conjugation quiz: 3-question input session | 24 | 26.3 KB | 14.3 KB | 111.7 MB | 0 |
| Vocab quiz: 3-question choice session | 25 | 10.6 KB | 4.1 KB | 7.3 MB | 0 |
| Progress page (with fresh session data) | 28 | 4.3 KB | 0.2 KB | 20.5 MB | 0 |
| Settings: all three font sizes → Largest | 17 | 2.9 KB | 0.2 KB | 23.3 MB | 0 |
| Dictionary revisit at Largest fonts | 19 | 3.2 KB | 0.2 KB | 28.3 MB | 0 |

The small ~3–9 KB costs on "should be free" actions are Vite chunk fetches
(first visit to a route loads its code-split chunk, 0.2–4 KB gzip each) and
~127-byte cache revalidations — no data file is ever re-downloaded within a
session or across visits (verified: repeat `/dictionary` = 3.2 KB total).

## Worst-case analysis

- **Maximum single spike**: enabling Smart Parsing (16.98 MB). Explicitly
  confirm-gated with the size named in the dialog, remembered via
  `localStorage`, and served from the HTTP cache on every later visit
  (the re-parse row above: 0 requests). The largest file within it
  (5.64 MB `tid_pos.dat.gz`) is also the largest fetch the app can ever
  make.
- **Maximum app-data spike**: the Beyond opt-in (6.07 MB, dominated by the
  5.34 MB vocab extended index). Fetched once per browser, shared by the
  dictionary, palette, kanji "Load All Words", and the parser's Beyond
  linking (the tour shows all four; only the first paid).
- **Scan Image opt-in** (added after this tour, decision 68): confirm-gated
  like Smart Parsing — ~1.8 MB engine wasm + 1.5 MB (Japanese) or 2.0 MB
  (English) model, one-time, HTTP-cached. Zero initial-chunk impact
  (verified per build: `tesseract` and `react-image-crop` — the ~5 KB gz
  crop-before-scan widget — appear only in the lazy OcrPanel chunks; the
  parser route chunk stays ~37 kB raw). Recognition runs in a Web Worker,
  so the main thread never blocks; images are downscaled to ≤2000 px
  before OCR, and crop dragging is CSS-transform only.
- **Maximum non-opt-in action**: the antonyms page (1.03 MB — it needs
  adjectives from every level to build pairs). Second place: names kanji
  search 田中 (3.19 MB) — names *is* opt-in-shaped (a dedicated page for a
  743k-entry dataset), and kanji queries fan out across reading buckets;
  kana prefix searches fetch exactly one bucket (161–391 KB).
- **Main thread**: no action produced a long task over 149 ms, and 26 of
  38 actions produced none at all — no perceptible freeze anywhere in the
  tour (threshold for "janky" is usually a 200 ms+ block).
- **Memory**: the absolute ceiling (everything resident at once) is a
  535 MB renderer — comparable to a typical news-site tab — and only
  reachable by enabling every opt-in in one sitting. Close the tab and
  it's gone; nothing persists but localStorage preferences (< 10 KB).

## Methodology / reproducing

Production build served with `bunx vite preview --port 4173`; headless
Chromium driven by a Playwright script run under node (see
`docs/development.md` for the node-not-Bun quirk). Wire bytes from CDP
`Network.loadingFinished.encodedDataLength` (i.e. gzip transfer size, what
a real network pays); heap from CDP `Performance.getMetrics`
(`JSHeapUsedSize`); long tasks from a buffered `PerformanceObserver`
injected before each page load; process RAM sampled from the OS
(`Get-Process` working sets) while a second script held the app at its
heaviest state. Lighthouse (mobile preset) run the same day for the
throttled scores quoted above: homepage 96/100/100/100, dictionary 86,
parser 95.

## Addendum 2026-07-09 — parser audit after decisions 49–58

The parser gained homograph alternatives, compound merging, counter
positions, per-surface ext preferences, and the EN→JP direction tab. This
re-audit measures what those changed. Same methodology (production build,
`vite preview`, CDP under node); micro-benchmarks via a temporary vitest
probe over the real data files.

### CPU micro-benchmarks (Node, real data: 2,829 verbs / 6,817 vocab / 204,021 ext rows)

| Path | Cost | Notes |
| --- | ---: | --- |
| `buildParserDicts` (full JLPT) | 7.6 ms | once per page mount; includes the new `alternates` map — 907 contested keys next to a 16,560-key lookup |
| `parseSentence` greedy, 77 chars | 0.9 ms | **with** per-word alternatives (direct + conjugated scans) |
| `deconjugate` (worst-case stacked chain) | 6 µs | |
| `findVocabRowsBySurface`, full pass over 204k rows | 7.5 ms | decision 57 removed the early-exit to collect alternates — measured, the full membership pass is 7.5 ms, nothing like the 100–220 ms *scored* search scans of decision 10; no guard needed |
| `collectUnlinkedSurfaces` | < 0.01 ms | |

### Network (CDP wire bytes per action, one warm session)

| Action | Req | Wire |
| --- | ---: | ---: |
| `/parser` page view (no parse) | 21 | 189.6 KB |
| First smart Break Down, everything cold (JLPT dicts + kuromoji + ext vocab index + translation) | 26 | 24.03 MB — all inside the existing opt-ins, one-time, HTTP-cached |
| Repeat the same Break Down | 0 | 0 KB |
| New sentence, warm session | 0 | 0.5 KB (the ja→en translation request only) |
| EN tab: Translate & Break Down, warm | 0 | 0.2 KB (the en→ja translation request only) |
| Tab switches (JP↔EN, ×3) | 0 | 0 KB — the two tabs' pipelines are separate hook instances; switching renders existing state |

### Main thread (4× CPU throttle, re-parse of a ~30-char sentence)

Attribution: the greedy engine parses in ~1 ms, so its 61 ms long task was
the **React commit** of the results UI (dozens of ruby + tooltip spans in
one blocking render). Fix shipped with this audit: `useBreakdown` sets its
result inside `startTransition`, letting React time-slice the commit.

| | before | after |
| --- | --- | --- |
| Greedy re-parse | 1 × 61 ms | **no long tasks** |
| Smart re-parse | 1 × 183 ms | 1 × 129 ms |

The remaining smart-mode task is kuromoji's synchronous `tokenize`
(~32 ms unthrottled) — a one-off click response, not animation jank;
moving it to a worker is the next lever if it ever matters. Zero page
errors throughout; all 290 unit tests, lint, and build green before and
after the change.

## Addendum 2026-07-10 — Grammar Points network audit

The new Grammar Points dataset (decision 63: 1,031 points, 2,062 example
sentences across five level files) was measured with the same CDP
`encodedDataLength` methodology against the production preview.

| Action | Wire |
| --- | ---: |
| `/grammar` first visit (default = N5 chip only) | 47 KB (`grammar-n5.json.gz`) — 1 request |
| Toggle all five level chips (full 1,031-point table) | 539 KB total: n5 47 / n4 90 / n3 125 / n2 114 / n1 163 KB — exactly 5 requests, ever |
| Detail page (`findGrammar` loads all five levels for cross-level relation cards) | same five files — already session-cached after a list visit |
| Repeat `/grammar` visit with all levels, same session | 0.6 KB (revalidations) |
| Any non-grammar route | 0 KB — the loaders live in the route chunks; grammar data is fetched only on `/grammar*` or the palette's first open |
| Palette first open (decision 65: grammar joins the word levels) | +539 KB over the word files, one-time — shares the grammar routes' promise cache, so a session that visited `/grammar` first pays 0 extra (and vice versa); cold page load still fetches nothing |

Palette search CPU (same-day tester → improver → QA pass, 4× CPU
throttle): grammar adds 0.2–0.68 ms per keystroke after the fold-key
WeakMap memoization (was 3.9–4.5 ms unmemoized); the one-time
first-search-of-session warmup (word `kanaKey` fill + wanakana +
deconjugate — ~296 ms at 4×, ~75 ms real) now runs as a throwaway
search in the post-open gap, cutting the first visible keystroke to
~74 ms at 4×. Steady-state searches 50–80 ms at 4× (unthrottled well
under the 100 ms bar); main bundle +0.09 KB gz; b2de650's
splitTokens/JaText rendering measured cost-free (6.6 µs worst-case
structure render, no DOM growth).

Within the app's bars: the default visit (47 KB) is far under the ~1 MB
non-opt-in ceiling, the full catalogue is a deliberate five-chip action
comparable to enabling all word levels, per-level promise caches
self-clear on failure (decision 60), and repeats cost ~0. Verified in the
2026-07-10 full-feature Playwright pass (20/20 checks incl. zero
pageerrors and 390 px/xxlarge overflow).

## Addendum 2026-07-11 — full sweep after OCR, the negative-te split, and the parser chip row

Full tester → improver → QA pass (same methodology) covering the Scan
Image OCR feature, the 23rd conjugation form (`te-negative-naide`), the
parser tabs-row chips, and the resources additions. **Clean bill of
health — nothing introduced by those changes:**

- Bundle: `index` 390.58 kB (123.79 gz, no growth); parser route chunk
  ~37 kB unchanged. `react-image-crop` and the tesseract engine appear
  ONLY in the lazy `OcrPanel` chunk (grep + runtime-fetch verified); the
  cold parser view never requests it, and the wasm/models download only
  after the consent dialog.
- Cold navigation: every measured route (home, parser, quiz, quiz
  session, verb detail, cheatsheet, resources, progress) 104–156 ms FCP,
  178–406 kB wire, zero long tasks except the cheatsheet (below).
- Interactions at 4× CPU throttle: greedy Break Down 79 ms warm, quiz
  question→feedback 69 ms (incl. the Similar-form box and the
  23-form OtherConjugationOptions scan), RuleCheatsheet expand
  49–93 ms — all zero long tasks.

One improvement shipped from the sweep: **`/cheatsheet/verbs` cold
mount** (the app's heaviest non-opt-in commit; pre-existing) — the
below-fold `ConjugationGuide` now mounts one frame after first paint via
`startTransition` in a post-mount effect (the decision-59 idiom). Worst
long task at 4× throttle 374 → 333 ms, FCP 780 → 740 ms on the measuring
machine; CLS 0.00000 (the guide is the section's last child — inserting
it cannot move preceding siblings). Attribution measured before fixing:
the dominant ~300 ms is the **above-fold ruby-heavy verb cards**, left
untouched deliberately — deferring above-fold content would trade a
one-time static-page cost for a visible pop; the comparison table was
likewise kept in the first commit (borderline-fold, and deferring it
merely relocated the work into a new long task). QA'd 18/18 browser
checks (guide completeness, accordion + keyboard behavior, zero CLS,
390 px/xxlarge overflow, zero pageerrors); 340 unit tests, tsc, lint,
build green.
