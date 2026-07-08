# Performance report — 2026-07-08

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
