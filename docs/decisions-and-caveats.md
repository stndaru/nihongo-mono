# Decisions, caveats, and project history

A record of *why* things are the way they are. The owner gave direct
feedback on many of these — treat them as requirements, not suggestions.

## User-set conventions (do not regress)

- **Bun over npm**, everywhere. (The very first infrastructure correction.)
- **Sans-serif by default for everything** (the owner first asked for serif
  everywhere, then reversed to sans-default — a stored `'serif'` remains an
  explicit pick), with Settings toggles to switch Japanese glyphs and Latin
  text between serif/sans independently. The color theme
  **follows the system by default** (changed from light-default on
  request); stored 'light'/'dark' are explicit user picks.
- **Title Case** on buttons and short UI labels ("Show More", "Common Only").
- **Filter names are controls, and every filter group is multi-select**:
  clicking a group's label (or a quiz section's heading) toggles
  select/deselect-all. The first cut made labels of single-select groups
  merely "clear" — the owner reported that as broken ("clicked Type,
  nothing happens"), so Type/Ends/Trans./POS/Status were converted to
  real multi-selects (Godan+Ichidan together, several POS at once; csv
  URL params, old single-value URLs still valid). Empty selection = no
  constraint for those groups; Level keeps its "empty = nothing shown"
  semantics (`levels=none` URL sentinel) because levels select content.
  Beyond chips are excluded from bulk toggles (they gate heavyweight
  downloads). Quiz Start buttons disable while any required group is
  empty. Sort and the Settings groups stay plain labels.
- Pointer cursor on every clickable element.
- Quiz answers show **furigana**, not a separate kana line; the answered
  verb links to its detail page (opens in a new tab).
- Verb detail: kanji and kana conjugation columns are **aligned** (fixed
  `sm:w-[11em]` kanji column); on mobile the kana stacks under the kanji in
  a smaller font. Rows carry tiny polite/negative icons (Sparkles/Ban), and
  a chip toggles polite forms on/off.
- Conjugation how-to lives in an accordion per row together with a plain-
  English **usage** sentence (e.g. the imperative's "generally too abrupt…"
  note). Keep that register when adding forms.
- The antonym table (`/vocab/antonyms`) is **strictly adjectives** in both
  columns and defaults to **all levels**. Noun/adverb antonym pairs still
  exist in the data and render on word detail pages — they were removed
  from this table twice on request; don't add them back.
- The vocab table's "common" indicator is the rightmost column, after JLPT.
- **Terracotta (Claude-style orange) primary**, and specifically the
  *lighter* light-mode shade `oklch(0.65 0.14 41)` — the owner asked to
  lighten the first attempt. Dark mode: `oklch(0.72 0.13 44)`.
- Branding: tab title **"NihongoMono - Companion"**, open-book favicon in
  the terracotta, OG/Twitter link previews with `public/og.png`.
- Navigation: **Names lives under the Language dropdown** (not top-level);
  **Settings is an icon button at the far right**; phones use a burger
  side-drawer whose section captions must read as labels, not links, and a
  floating search button bottom-right.
- **24px screen margins on mobile** (main, header, footer, drawer).
- Table rows are **click-to-open everywhere**, but text selection and
  modifier clicks must never trigger navigation (`src/lib/row-click.ts`).
- Quiz sessions: **no repeated vocabulary words**; **verbs joinable in the
  vocab quiz in dictionary form** (explicit correction away from stems);
  the **shown word is never the asked answer**; furigana in quizzes is
  smaller, with mid-quiz **Furigana / Word Info toggles**; leaving
  mid-session requires **confirmation** (plus a top-left Exit control).
- Example sentences render **with furigana** and generous type (text-xl on
  detail pages, text-lg in accordions/quiz feedback); ruby floats 2px
  clear of the base glyphs.

## Decision log (chronological, with rationale)

1. **Stack**: TanStack Router SPA (no Start, no Query), Tailwind v4 +
   shadcn/ui, Anime.js v4, no search library, no state library — the spec
   demands "minimal libraries" and the data is small enough to scan.
2. **Conjugations computed, never stored** — keeps data files small and one
   engine authoritative. Kanji/kana surfaces transform independently (来る).
3. **JLPT levels from community lists** (yomitan-jlpt-vocab with exact seq
   ids preferred, elzup as fallback, `extra-words.json` for gaps) because
   jmdict-simplified has no JLPT tags and there are no official lists.
4. **Sense-order POS classification** replaced a fixed precedence map after
   黄色/大人 were mis-tagged na-adjectives.
5. **`usuallyKana` checks the first sense only** after 行く/来る rendered
   as kana (they have rare `uk` senses).
6. **Antonyms**: JMdict `ant` xrefs are sparse and one-directional →
   curated `antonym-overrides.json` + symmetrization of both antonyms and
   see-also links.
7. **Meanings accordion** (jisho-style numbered senses with per-sense
   examples) added on request; top-level "Example Sentences" section (≤3,
   shortest-first) added later — both exist on verb and vocab detail.
8. **Full-dictionary expansion** (user asked for *every* JMdict/ENAMDICT
   entry): two-tier architecture rather than bundling — see
   architecture.md. ENAMDICT arrived as JMnedict on a separate Names page
   because the spec bans proper nouns in the vocab lists.
9. **Jreibun**: requested as an example-sentence source, but its dataset is
   officially unpublished ("準備中"). Credited as planned on the About
   page; revisit when they release.
10. **Performance retrofit** (after the owner hit real slowness): raw-row
    search with capped materialization, 100-row table pages with reset,
    pre-gzipped `.json.gz` data with client-side inflation. Measured
    outcome: Beyond ready ~1.5 s, searches ~100–220 ms, flat heap.
11. **History rewrite** (details under limitations below) — done once,
    pre-publication, to drop the uncompressed data blobs.
12. **Terracotta rebrand + nav shuffle** on request (see conventions).
13. **Clickable rows + mobile drawer** — row clicks guarded against text
    selection; drawer built on Radix Dialog at the 150 ms animation cap.
14. **Example-sentence furigana via kuromoji at build time** — sentences
    contain conjugated/compound words no dictionary lookup covers, so
    IPADIC morphological analysis runs in the pipeline, never the browser.
    Known trade-off: kuromoji occasionally misreads rare proper nouns.
15. **Deconjugation search** ("tabeta" → 食べる) chosen over indexing
    conjugated forms — query-time BFS costs microseconds; indexing would
    multiply the dataset. Incomplete-stem handling ("tabera") added after
    the owner hit a miss.
16. **Command palette** (Ctrl/Cmd+K) searches JLPT tiers instantly; the
    extended indexes are an explicit opt-in ("Include Full Dictionary")
    because they're a multi-MB download.
17. **Quiz round of owner requirements**: no vocab repeats, dictionary-form
    verbs (corrected from stems mid-implementation), never ask the shown
    form, display toggles, leave confirmation, exit button.
18. **Transfer crisis fix** (owner measured 230 MB in dev): example
    furigana became a bracket string (5–10× smaller), and the JLPT tier
    moved out of the JS module graph into packed static `.json.gz`
    (`scripts/pack-jlpt.ts`). Root causes: pretty-printed segment objects,
    and Vite dev JSON modules carrying source + inline sourcemap (2.9 MB →
    24 MB). Result: ~2.1 MB wire for all ten levels + kanji; prod lost its
    megabyte chunks (largest asset now the ~370 KB app bundle).
19. **Per-word learning analytics** (owner request: see encounters and
    accuracy per verb/vocab and find weak spots): the store gained
    additive-only fields — per-word `kind`/`run`, a per-conjugation-form
    tally — still schema v1, old exports import cleanly. New `/progress`
    page (weakest-first word table, form accuracy, session trend) and a
    one-line practice history on detail pages. Status thresholds
    (new/weak/learning/solid) live in `src/lib/progress/analytics.ts` and
    are deliberately simple; change them there, not in the UI.
20. **Kanji pages + kanji data split** (owner request, with an explicit
    "keep it network-efficient" follow-up mid-build): `/kanji` table and
    `/kanji/$char` detail (readings, grade/frequency, KRADFILE component
    cards, JLPT words using the character). The single 10,384-entry
    `kanji.json.gz` was a **400 KB fetch on every word detail page** — it
    became a 127 KB core (JLPT or frequency-ranked, 2,609 chars) plus 16
    ~20 KB codepoint shards fetched only on a core miss or for the Beyond
    chip. Detail pages also gained a **smart back button**: history-back
    when the tab has in-app history (restores the previous page with its
    filters), a "Back to <section>" fallback link otherwise (direct opens
    and the new-tab links used mid-quiz).
21. **Stroke order via KanjiVG, as path strings** (owner request, again
    with an explicit network-efficiency requirement): instead of shipping
    KanjiVG's SVG files, `build-strokes.ts` keeps only the stroke path
    `d` strings in 256 codepoint shards (~11 KB each; 6,702 kanji, 2.7 MB
    total that the browser never fetches wholesale — one shard per
    displayed kanji). The client renders per-stroke frames itself
    (`StrokeOrder.tsx`), shown on kanji detail pages and the kanji cards
    of word detail pages. KanjiVG is CC BY-SA 3.0 → promoted from
    "further references" to a full entry in the About sources list. The
    dashboard stat cards became links into `/progress` sections
    (hash-scrolled after data load) in the same round.
22. **Licensing formalized** (owner asked for a clash audit): the repo had
    no licence at all, which conflicted with the share-alike terms of the
    redistributed derived data. Now: **code MIT (`LICENSE`), data under
    its sources' licences (`LICENSE-DATA.md`)** — CC BY-SA 4.0 (EDRDG) and
    CC BY-SA 3.0 (KanjiVG) kept in separate directories so the two
    share-alike licences never mix in one file; CC BY content (Tatoeba,
    JLPT tags) embeds fine. All npm dependencies are MIT/ISC/Apache-2.0 —
    no copyleft anywhere in the stack. kuromoji/IPADIC got an About-page
    credit (build-time analysis; the dictionary is not redistributed).
23. **Sentence parser as dictionary matching, not kuromoji** (owner
    request for a text-breakdown page): running kuromoji in the browser
    would mean shipping its ~17 MB IPADIC dictionary, so `/parser` is
    greedy longest-match over the JLPT lists + the existing deconjugation
    engine, with an exact-form boundary rule to keep segments honest. The
    prominent accuracy caveat and the kana-only input filter are explicit
    owner requirements, as is the palette's "Break Down as Sentence"
    fallback appearing ONLY for purely-Japanese queries. Known
    limitation at the time: only JLPT-listed words were recognized
    (lifted for smart mode by entry 26's Beyond linking).
24. **Smart Parsing (kuromoji) as an explicit opt-in** — the owner
    first considered auto-downloading on the first Break Down, then
    **changed the plan**: the greedy engine stays the default, and
    kuromoji sits behind a "Smart Parsing" toggle whose confirm
    dialog states the ~17 MB one-time download before anything fetches.
    Don't make the analyzer implicit. The preference persists; a failed
    download falls back to greedy with a notice. Shipping IPADIC to
    browsers made its licence notice a requirement —
    `public/kuromoji/NOTICE.md` travels with the dictionary and the
    About page links it.
25. **Parser polish round** (owner feedback on the first Smart Parsing
    build): renamed "Accurate Parsing" → **"Smart Parsing"** (storage key
    `parser-smart`, legacy key still read); the confirm dialog appears
    **only when a download is actually pending** — already loaded this
    session or previously confirmed → the toggle enables directly;
    clicking a parsed word or a Words Found row opens a **summary popup**
    (conjugation + dictionary form, meanings, kanji used, "Open Detail
    Page" in a new tab) instead of navigating away from the breakdown;
    and a real merge-rule bug was fixed — compound verbs were being glued
    (遊び始めた rendered as one 遊ぶ), now 非自立 verbs merge only after
    a て/で connective, so it splits into 遊び (Stem) + 始めた (Past).
26. **Parser round 3** (owner-reported こと→琴 mislink): homograph
    surfaces now resolve by preference (common, then easier JLPT level;
    verbs still beat vocab) instead of insertion order. **Beyond
    linking**: in smart mode, unlinked content words get an
    exact-surface pass over the extended indexes (~6 MB, loaded on the
    first parse with misses; disclosed in the Smart Parsing dialog) and
    link as lite entries with the Beyond badge — an explicit owner
    request. Scrollbars restyled to a thin theme-aware pill (webkit
    pseudos + Firefox standard props behind a -moz guard).
27. **Reading fallback for variant kanji spellings** (owner-reported:
    温かい showed "no dictionary entry" despite being findable — JMdict
    keys spelling variants by the primary form 暖かい, so surface lookups
    miss every variant spelling in BOTH tiers). Verb/adjective/noun
    lookups now fall back to the token's kuromoji reading (≥2 kana,
    never across word class), conjugated surfaces deconjugate their
    reading first, and form labels are computed against the token's own
    spelling so variant-spelled conjugations still get named forms. The
    owner framed it as "enable full dictionary search on break down" —
    the full-dictionary pass already ran; the actual gap was
    spelling-variant resolution, fixed at the candidate level.

28. **Kanji-detail word list precomputed at pack time** (found by a
    network/perf profile of the production build, not a user report): the
    "Words Using this kanji" section fetched all ten JLPT level files
    (~1.7 MB) just to filter them by `kanjiChars` — the heaviest
    non-opt-in fetch in the app. `pack-jlpt.ts` now emits per-kanji
    `KanjiWordRow` tuples in 64 codepoint shards (~6 KB each,
    pre-sorted), and the page fetches exactly one. Same profile also made
    the parser's Beyond pass fetch only the extended index that actually
    has misses (vocab ~5.5 MB / verbs ~0.6 MB — noun-only miss sets are
    the common case and now skip the verb index). Everything else
    measured healthy: worst main-thread block 195 ms (one-time ext-index
    parse, opt-in path), parses render in 40–90 ms, initial page ~165 KB.

29. **Kanji "Load All Words" reuses the extended indexes** (owner asked
    for a Beyond expansion of the kanji word list, "lightweight and
    network efficient"): a precomputed per-kanji ext index was measured
    first and rejected — ~12 MB committed across shards (478k
    kanji-word pairs; 学 alone has 4,161 words), duplicating data the
    app already ships. Instead the button scans the two ext search
    indexes (~6 MB, disclosed in the tooltip) — the same files the
    palette, Beyond chips, and parser share, in memory after any of
    them loads. Same round: every example sentence got a
    `ParseSentenceLink` icon (opens `/parser?q=` in a new tab), and the
    default typography flipped serif → sans (see conventions).

30. **Kanji JLPT levels switched to the modern 5-level scale**
    (owner-reported: "kanji starts at N4 and N3 has only ~180 — in
    reality kanji starts from N5 and N3 has ~300"). Root cause: the
    kanji dataset shipped KANJIDIC2's `jlpt` field verbatim, which is
    the **pre-2010 four-level scale** (old-4 ≈ new N5; the 2010 reform
    split old-2 into N2+N3), so every level was mislabeled. Fix:
    build-kanji.ts now tags from davidluzgouveia/kanji-data's
    `jlpt_new` (MIT; derived from Jonathan Waller's tanos.co.uk lists —
    the same CC BY source family as the word-level tags): N5 79 ·
    N4 166 · N3 367 · N2 367 · N1 1,232 (2,211 tagged, all 10,384 of
    our kanji covered). The kanji list gained its N5 chip (new default
    level) and lost the old-scale caveats.

31. **Combined Dictionary page + nav restructure** (owner request, with a
    Linear screenshot as the dropdown reference): the header became
    Home · Dictionary · Kanji · Language · Tools, where Language holds
    Verbs + the old Vocab dropdown items and Tools holds Parser/Quiz/
    Progress — dropdown items show a muted name over a bold one-line
    description, in a two-column panel. `/dictionary` merges both JLPT
    datasets into one table ({word, isVerb} rows — ids collide across
    datasets, so the flag rides along) with the two-layer filter system
    the owner specified: types + Level by default, contextual
    sub-filters behind "More Filters" (verb filters only while Verb is
    selected, い/な only while Adjective is). Perf hygiene: 100-row
    paging, one Intl.Collator for the merge sort, sub-filters never
    apply while their parent type is off, ext searches reuse the shared
    cached indexes.

32. **Parser links validate against kuromoji's reading** (owner-reported:
    頃 with furigana ころ linked to the JLPT N1 頃/けい entry — "qing,
    Chinese unit of land area"). Homograph surfaces now resolve in the
    owner-specified order: JLPT entry matching the token's reading
    first, then a Beyond entry that reads correctly, else the original
    closest match stands. Applies only to uninflected non-verb tokens
    (inflected surfaces never read like their dictionary form). Same
    round: the parser textarea grew to four lines by default.

33. **Homepage verb-type cheatsheet** (owner request, content modeled on
    japanese.thetinywisdom.com/learn): a skimmable recall section below
    the dashboard buttons — three cards (godan/ichidan/irregular, each
    with What / Spot It / Conjugate), the いる・える-lookalike trap list
    (帰る 走る 入る… test with the ない form), and a five-form comparison
    table across 書く/食べる/する/来る. Deliberately static content in
    `components/home/VerbCheatsheet.tsx` (these facts don't change with
    the dataset). Phone gotcha encoded in a comment: adjacent
    `whitespace-nowrap` spans with no space between them form ONE
    unbreakable run — the trap list is a flex-wrap row instead.
    Follow-up feedback rounds: card sections got separators + more
    spacing, titles outweigh content (kanji badge + bold title), the
    dashboard buttons collapsed to Start a Quiz / Browse Dictionary /
    View Progress, and the homepage runs roomier (`space-y-10`) than
    other pages on purpose. On phones the buttons render full-width and
    stacked; an `<hr>` separates them from the cheatsheet; and the
    footer gained a GitHub icon link (inline SVG — lucide dropped its
    brand icons) to github.com/stndaru/nihongo-mono.

34. **Every `grid` needs an explicit mobile column** (owner-reported:
    vocab detail and parser pages scrolled horizontally on phones when
    a card held a long gloss). A `grid` with only `sm:grid-cols-*`
    leaves phones on an *implicit auto* column, which grows to the
    widest row's single-line width — Tailwind's `grid-cols-1` is
    `minmax(0, 1fr)` and caps it at the container. All card grids
    (related words, parser Words Found, MC choices, kanji breakdown,
    cheatsheet, progress forms) now carry `grid-cols-1`; keep it on any
    new grid whose cells can hold long text. Same round: the footer
    stacks vertically on phones (`flex-col`, `sm:flex-row`).

35. **Full audit round (tests, perf, network), 2026-07-08.** A full
    functional sweep (29 routes × 2 viewports, list/detail/parser/quiz/
    settings interactions, hostile inputs) found one real bug: queries in
    full-width latin or half-width katakana matched nothing — fixed by
    NFKC normalization at every search entry point (`normalizeQuery`).
    Browser perf (4× CPU throttle, event-timing + longtask observers):
    no interaction over ~56 ms — typing is clean; leave as-is. Network
    audit findings → two structural fixes: (a) `jlpt/ids.json.gz` id→level
    map so detail pages fetch one file instead of scanning N5→N1 (cold N1
    deep link ~700 KB→236 KB; cold Beyond verb ~1.2 MB→64 KB); (b) ext
    detail shards resized 32/128 → 128/512 (~20–70 KB per fetch, was up
    to 263 KB). Deliberately NOT optimized: the 5.5 MB vocab-ext index
    (gloss avg 20 chars — already tight; columnar would save only ~15%
    for major scan-code churn), the names written-form fan-out (a kanji
    search like 田中 pulls ~20 reading buckets / ~3 MB once, then
    HTTP-cached — a dedicated written-form index would duplicate the
    ~8 MB dataset), and kuromoji's 17 MB (already confirm-gated).

36. **Font-size setting (Settings → Typography), 2026-07-08.** Four steps —
    Default 100% / Large 110% / Extra Large 120% / Largest 130% — applied
    as `:root[data-font-size]` bumping the root font-size (the UI is
    rem-based, so everything scales). The **default is the smallest**;
    sizes only go up from the original design (owner requirement). Same
    persistence pattern as the font choices: `nihongo-mono:font-size`,
    attribute set pre-paint in `index.html`, chips restored from
    localStorage on the Settings page. Verifying at the larger scales
    exposed a **pre-existing header overflow** (the nav's intrinsic width
    overflowed 640–720px viewports even at 100%) — fixed by making the
    header `<nav>` `min-w-0 overflow-x-auto` so it scrolls in place, and
    the Resources card title/hostname row got `flex-wrap`. All 24
    width × size combos verified overflow-free.

37. **Kanji/kana + furigana font sizes, 2026-07-08.** The global setting
    was renamed "Global font size" and joined by "Kanji/kana font size"
    (`--ja-scale`, relative to global) and "Furigana font size"
    (`--rt-scale`, relative to the base text) — the owner found Japanese
    text and furigana too small in places. Ja scaling needs BOTH the
    `[lang="ja"]`-scoped `--text-*` variable overrides (Tailwind v4
    utilities read those vars) and the base `calc(1em * var(--ja-scale))`
    rule, plus a nested-`[lang="ja"]` reset against compounding. The
    critical constraint: enlarged furigana must never sit on a
    neighboring kanji. Native ruby overhang does exactly that (13px
    measured), `ruby-overhang: none` is unsupported in Chromium 149, so
    non-default furigana sizes switch `ruby` to an inline-flex column
    stack (width = max(base, reading)). Verified: exact scale math at
    every step, no rt overlap across three ruby-heavy pages × three
    sizes, quiz furigana-hide still wins, 36-combo overflow matrix at
    all-max. Follow-up fix: the flex-stack ruby is an atomic inline box,
    so text-decoration stopped propagating into it and the parser's
    dotted POS underlines disappeared at non-default furigana sizes —
    the POS color now travels as a `--pos-line` custom property and an
    unlayered `.parser-underline` rule (must beat the layered
    `underline` utility) redraws the line as a dotted border in that
    mode; native decoration is untouched at the default size. Second
    follow-up: the flex stack must set its own tight line-heights
    (1.15/1.05) — inheriting the paragraph's `/loose` 2.0 inflated the
    stack, floated the underline ~mid-leading, and collided readings
    with the line above. Verified by a collision sweep (rt vs every
    other ruby/word box) across 8 ruby-heavy pages × 3 size combos.
    Third follow-up: the stack needs `baseline-source: last` — Chrome
    synthesizes a column flex container's baseline from the top row
    (the reading) regardless of DOM order or `order:-1`, so ruby words
    sat exactly one reading-row lower than adjacent plain text.
    `column-reverse` + `baseline-source: last` puts the container
    baseline on the base text (0px spread measured); unsupported
    browsers fall back to `vertical-align: bottom`.

38. **Quiz round (4 features), 2026-07-08.** (1) Feedback "Details" (and
    the conjugation quiz's verb link) opens the parser's
    `WordSummaryDialog` instead of a new tab — mid-session the page must
    stay put; the popup still offers "Open Detail Page". Enter-to-advance
    is suppressed while the popup is open (`summaryOpen` guard) or Enter
    would advance the question underneath it. (2) Next/Finish is
    full-width. (3) Vocab quiz gained `choice-ja` (English shown → pick
    the Japanese word; kind `word`); word options dedupe by surface AND
    gloss, and every session rule (no word repeats, verb inclusion,
    least-seen weighting) applies unchanged. (4) Conjugation quiz gained
    `randomShown` (`?shown=1`): the prompt may be a conjugated form drawn
    from the selected forms + dictionary form. The old "never ask the
    form on screen" rule generalized from the dictionary form to
    whatever is shown; distractors likewise exclude the shown surface.
    All four engine invariants are unit-tested (157 tests).

39. **Homescreen restructure, 2026-07-08.** The verb-type cheatsheet moved
    off the homepage to its own page (`/cheatsheet/verbs`, "Japanese Verb
    Summary") under a new Resources-style **Cheatsheet** list page
    (`/cheatsheet`, in the Language menu — desktop dropdown + mobile
    drawer). The component stays `components/home/VerbCheatsheet.tsx`
    (unchanged; only its mount moved). In its old spot the homepage now
    shows **quick-access shortcut cards** (`components/home/
    QuickAccess.tsx`) — **Essentials (Dictionary, Kanji — the two main
    features; the Kanji tile is a 漢 glyph) first, then Tools, then
    Language** (owner-specified order), icon tile + label + one-line
    description per card. Keep the Tools/Language entries in sync with
    `Header.tsx`'s `LANGUAGE_ITEMS`/`TOOLS_ITEMS` when menus change.

40. **Lighthouse round, 2026-07-08.** Two fixes from a mobile Lighthouse
    audit (homepage 96/100/100/91 before): (1) `public/robots.txt` added —
    without it the SPA fallback (`serve -s`, `vite preview`) returns
    index.html for `/robots.txt`, which Lighthouse parses as an invalid
    robots file (82 "syntax not understood" errors, SEO 91). Now SEO 100.
    (2) The parser's JLPT dictionary load (~1.9 MB over ten files) is
    **intent-gated** (`dictsWanted`): it starts on first textarea
    focus/keystroke or a `?q=` deep link instead of on page view. Parser
    mobile Lighthouse went perf 72 → 95 (LCP/TTI 12.6 s → 2.5 s) and a
    passive visit fetches zero data. Deliberately **left alone**: the
    entry chunk's ~63 KiB "unused JS" (react-dom/Radix/router/wanakana
    interaction paths — wanakana is eager because the always-mounted
    palette needs romaji search on the first keystroke; lazy-loading
    would add latency to core interactions), the single render-blocking
    stylesheet (~12 KiB; inlining critical CSS risks FOUC), and the
    dictionary page's 3.6 s LCP (the fetched table *is* the content;
    CLS 0.077 is within "good").

41. **Measured performance baseline, 2026-07-08.** `docs/
    performance-report.md` records a full-feature 38-action tour at commit
    `7ed5f6f`: 28.92 MB total with every opt-in enabled vs ~2.4 MB
    without; worst spike 16.98 MB (Smart Parsing, confirm-gated); peak
    tour heap 111.7 MB; worst long task 149 ms; repeat visit 3.2 KB;
    0 page errors. The owner wants this snapshot as *proof of
    lightweightness* — when data or routes change materially, re-run the
    methodology in that file and update it rather than letting it rot.

42. **Parser translation providers, 2026-07-08.** The parser's automatic
    ja→en sentence translation uses **Google's unofficial gtx endpoint**
    (`translate.googleapis.com/translate_a/single?client=gtx` — keyless,
    CORS-open, Google quality, a few hundred bytes per request) as
    primary. It's undocumented and revocable, which is why the chain
    continues to **MyMemory** (official free API; daily cap; check
    `responseStatus === 200` because its errors come back as HTTP 200
    with error text in `translatedText`) and terminates in an "Open in
    Google Translate" prefilled link, so the feature degrades to useful
    even fully offline. Owner-confirmed: ja→en only, auto-run per parse
    with no opt-in gate (payloads are ≤100 chars and cached per
    sentence). Implementation notes: gtx `data[0]` is one chunk per
    sentence — concatenate all of them; failures are never cached;
    `translateSentence` takes no caller AbortSignal (combining with the
    per-provider timeout needs `AbortSignal.any`, Baseline 2024 — the
    alive-flag effect pattern covers staleness, and a post-unmount
    resolve just warms the cache); success UI is quiet (no external
    link — the escape hatch belongs to the error state); the skeleton
    loader is the app's first `animate-pulse` use, a deliberate owner
    request.

43. **Parser input UI round, 2026-07-08.** (1) The amber accuracy-caveat
    box became an **"Important Notice" accordion, closed by default**
    (owner request — it dominated the page). Same amber styling, button
    header with chevron, `aria-expanded`, MeaningsAccordion idiom — the
    content is unchanged and still discloses the engine limits. (2) The
    textarea's native `resize-y` corner grip was nearly unhittable once
    the scrollbar appeared, so it's replaced by a **full-width drag
    strip** below the textarea (`startResize` in parser.tsx: pointer
    capture, min clamp 128 px to match `min-h-32`, double-click resets
    to the default height). The textarea is `resize-none` now — don't
    re-add the native grip.

44. **"Non-Verb Vocabulary" rename + mobile Essentials group,
    2026-07-08.** The `/vocab` page was renamed from "Vocabulary" to
    **"Non-Verb Vocabulary"** everywhere it's user-visible (page h1,
    desktop Language dropdown, mobile drawer, homepage quick-access
    card, detail-page "Back to" fallback) — owner request, to stop it
    reading as the same thing as the combined Dictionary. Quiz labels
    ("Vocabulary quiz" etc.) intentionally keep the old word — the vocab
    quiz can include verbs, so "non-verb" would be wrong there. The
    **mobile drawer** also gained an **Essentials** caption grouping
    Dictionary + Kanji (mirroring the homepage's Essentials cards);
    the desktop header deliberately keeps them as top-level links.
    Follow-up the same day: `/verbs` likewise renamed **"Verb
    Vocabulary"** (same surfaces: h1, dropdown, drawer, quick-access
    card, back fallback) for symmetry with Non-Verb Vocabulary; quiz
    labels again unchanged.

45. **Quiz cross-links + option-explainer accordion, 2026-07-08.** (1)
    Session summaries gained "View Progress"; the progress header gained
    "Start a Quiz" (plain `Link`s, no new data). (2) Multiple-choice
    feedback (both quizzes) gained a closed-by-default "The Other
    Options" accordion explaining each unchosen option. Efficiency by
    construction: the conjugation quiz *re-derives* each distractor's
    form by matching its surface against `conjugate()` over the ~22
    forms instead of storing form names in the engine (an ambiguous
    surface honestly lists all matching forms, e.g. ichidan
    potential/passive); the vocab engine now keeps the *source word* per
    meaning option (`choiceWords`, index-aligned with `choices`) — data
    already in memory, so the accordion adds zero fetches and its rows
    render only while open (`FeedbackAccordion` mounts children lazily).

46. **Verb cheatsheet conjugation guide, 2026-07-08.** `/cheatsheet/verbs`
    gained "How to Build Each Conjugation"
    (`components/home/ConjugationGuide.tsx`): one closed-by-default
    accordion row per form (all 22), each showing the godan / ichidan /
    する / 来る rule with pattern, explanation, exceptions, and a live
    example (書く・食べる・する・来る conjugated at render via minimal
    fixtures — `conjugate()` only reads kanji/kana/class). Rules are the
    same `getRule()` cards the quiz and detail pages use — one source of
    truth, no new content to keep in sync. The example line is hidden
    when the pattern is already concrete (する/来る patterns embed their
    own example). Static/no-fetch; row bodies render only while open.

47. **Counters cheatsheet, 2026-07-08.** `/cheatsheet/counters` — static
    content like the verb summary, written for this app but **scoped and
    grouped after Tofugu's counters guide + 350-counter list** (owner-
    provided sources, both credited with links at the bottom of the
    page). Structure: "How Counters Work" prose (the two sentence
    patterns and their nuance, wago vs kango numbers incl. the
    よん/なな/きゅう avoidance readings, 何+counter / いくつ), the つ
    series 1–10, a 17-row must-know table with irregular-reading notes,
    an amber sound-change box (h-row → p/b, k/s/t gemination, はたち,
    the ついたち…とおか dates), and a ~45-row common-counter table.
    Tables follow the repo pattern: `overflow-x-auto` wrapper +
    `min-w-*` so they scroll in place on phones. Readings are plain
    kana columns, not ruby — easier to scan in a table (and ruby rt
    text pollutes `textContent`, bit the verify script again).
    Same-day follow-up (owner feedback): "How Counters Work" was a wall
    of text → now three skimmable cards (sentence patterns / asking how
    many / fallback) with the number-systems background demoted to a
    closed **trivia accordion**; and counter rows **expand into a
    generated counting sequence** (1–25, 30, 50, 70, 100) via
    `src/lib/counters.ts` — `countWith(rule, n)` composes kango numbers
    with the counter's sound-change class (`k/s/t` gemination, `hb` =
    p on 1/6/8/10/100 + b on 3 like 本, `hp` = p after ん/っ and never
    b like 分 — the earlier box wrongly implied さんぶん), plus
    per-counter specials (ひとり/ふたり, よ for 4 on 人/年/時間, はたち,
    さんがい). 52 unit fixtures. Rows stay unexpandable where kango
    counting would mislead (wago-preferred ひと口/ひと皿, calendar
    日/月/時). Measured: the page costs 12.6 KB on the wire; opening
    every expander + the accordion = 0 requests, 0 long tasks, ~10 MB
    heap. Caveat learned: Tailwind `sr-only` is `position:absolute` —
    inside a scrolling table with no positioned ancestor it escapes the
    overflow clip and silently widens the page (fixed with `relative`
    on the `<th>`).

48. **Motion audit → CSS-only animation, Anime.js dropped, 2026-07-09.**
    A full-site animation review (Emil Kowalski craft bar, owner asked
    for "as short as possible") found and fixed: (1) the **Ctrl/Cmd+K
    palette animated** — keyboard-summoned surfaces read any motion as
    input latency, so its open/close animation was removed entirely
    (Raycast precedent); (2) Button used **`transition-all`** → explicit
    `color/background-color/border-color/box-shadow/transform` list at
    100 ms, plus `motion-safe:active:scale-[0.98]` press feedback;
    (3) the quiz **progress bars animated `width`** (layout+paint every
    frame) → `w-full origin-left` + `scaleX()` transform; (4) the
    per-answer quiz-feedback entrance ran through **anime.js on the main
    thread** → a 100 ms CSS keyframe (`.quiz-enter` in `index.css`), and
    since `shake()` was dead code that made `src/lib/animate.ts` and the
    **animejs dependency removable outright** (decision 1's stack line is
    historic); (5) dialogs ran 200 ms, over the site's own 150 ms cap →
    **150 ms in / 100 ms out** with a strong ease-out
    (`--ease-snap: cubic-bezier(0.23,1,0.32,1)`, a Tailwind `@theme`
    utility) — the same asymmetric exit + ease applied to the drawer,
    selects and dropdowns (exits are system responses: snap them);
    (6) the parser tooltip entered as a pure fade from nowhere → fade +
    `zoom-in-95` scaling from `--radix-tooltip-content-transform-origin`;
    (7) **nothing honored `prefers-reduced-motion`** except the deleted
    JS helper → a global clamp in `index.css` (`animation/transition-
    duration: 0.01ms`, `animation-iteration-count: 1` so the skeleton
    pulse can't spin) covers every Radix keyframe and hover transition
    in one place; (8) chevron rotations and table-row hovers standardized
    at 100 ms. Chevrons stay CSS *transitions* (interruptible,
    retargetable mid-toggle) — don't convert them to keyframes.
    Browser-verified (31 Playwright checks incl. palette
    `animationName === 'none'`, `.quiz-enter` at 0.1s, reduced-motion
    clamp at 1e-05s, drawer open/close, zero console errors, no
    horizontal overflow at 390/640/900 px with all font-size keys at
    xxlarge).

49. **Parser homograph fix (よう ≠ 酔う) + quiz option Details popups,
    2026-07-09.** (1) Owner-reported: in どのようにしていますか the
    parser linked よう to 酔う "to get drunk" (N3 verb, kana よう)
    instead of the kana-native N4 noun よう "way / appearing" — the
    `hitScore` tie-break gave verbs an unconditional +100, so a
    kanji-written verb's bare kana reading outranked everything. Fix: a
    key that IS the entry's **display form** (`key === entry.kanji`;
    kana-native words qualify) now scores +101, verbs +100, common +10,
    + JLPT level. Consequences to keep in mind: the two bonuses are
    deliberately near-equal so common/level decides between a native
    kana word and a kanji verb's reading — よう(N4) beats 酔う(N3), but
    帰る (N5) still beats any rarer native かえる; the +1 keeps exact
    cross-type ties off insertion order (the こと/琴 test loops both
    orders). The verb keeps its own written surface (酔う still links
    to 酔う — browser-verified). Both engines benefit (greedy `matchAt`
    and kuromoji `linkToken` share the lookup map). Unit tests cover
    the よう and かえる cases.
    (2) "The Other Options" feedback rows (both quizzes) got a per-row
    **Details button** opening `WordSummaryDialog` — vocab quiz passes
    the distractor's entry (`isVerb` from the `pos === 'verb'` shim so
    verb links go to `/verbs`), conjugation quiz passes its verb with
    that option's surface + form label. The dialog's conjugation prose
    was reworded "In this sentence it appears as…" → "**Here** it
    appears as…" because the popup now also serves quiz rows, not just
    the parser.

50. **Beyond links must agree with kuromoji's reading (屋/や ≠ 屋/おく),
    2026-07-09.** Owner-reported: in 帽子屋をでた (smart mode) the 屋
    token — correctly read や by kuromoji, correct furigana shown — got
    Beyond-linked to 屋/おく "house". Two stacked causes: (1)
    `entryReadsAs` trusted any reading shorter than 2 kana (a guard
    copied from the *lookup* paths, where searching by bare single kana
    is noise — but *checking* against one is exact), so おく "read as"
    や; (2) `findVocabRowsBySurface` kept only the first index row per
    surface with no reading input, so it could only ever return the
    おく homograph. Fixes: `entryReadsAs` now compares whenever a
    reading exists; `collectUnlinkedSurfaces` returns a
    `readings` map (kuromoji reading per uninflected surface) that
    `findVocabRowsBySurface` uses to upgrade a hit to the first row
    reading that way; and `linkBeyondWords` dropped its
    reading-contradicting "closest" fallback for fresh links — an
    unlinked token with correct furigana beats the wrong homograph.
    The ≥2-kana guards on reading *lookups* stay (bare や as a search
    key would hit 矢 "arrow"); the JLPT tier needs none of this (no
    single-kanji reading homographs in the lists today — 屋 isn't
    listed at all). Verified on real data: 帽子屋をでた links 屋 to
    屋/や "shop" (Suffix + Beyond badges). Unit tests cover the
    lookup preference and the reject-contradiction path.

51. **Compound merging in smart mode (非常に, 参加者), 2026-07-09.**
    Owner-reported on 様々な講師の…非常に充実した回となった。: IPADIC
    tokenizes more granularly than JMdict lexemes, so smart mode split
    非常に into 非常 (mislinked to "emergency") + に and 参加者 into
    参加+者 — while greedy mode's longest-match already got 非常に
    right (it's a listed N4 adverb). Fix: `scanCompound` re-joins two
    bounded POS patterns, **triple-gated** (pattern + exact dictionary
    entry for the joined surface + entry kana equals the joined
    kuromoji reading — the honest-boundary rule of decisions 23/25
    applied to merging; the 83 listed expressions / 54 に-final entries
    can't over-merge because the pattern gate runs first). P1 noun runs
    (≤3 tokens, ≤16 chars; 接尾 continues but never starts; noun+noun
    included deliberately — 質疑応答 needs it and the dictionary gate
    bounds it). P2 adverbial に only after 形容動詞語幹/副詞可能 stems
    (学校に never merges; 非自立 excluded everywhere so よう in
    どのように keeps decision 49's behavior). JLPT compounds merge
    synchronously; unlisted ones ride as `CompoundCandidate`s and
    `linkBeyondWords` merges them when the ext index has a
    reading-consistent entry — on a miss nothing changes (参加 keeps
    its JLPT link; never trade a real link for a blob). Owner display
    choice: merged word + a **Parts** section in the summary dialog
    (each component with its own link, clickable — swaps the dialog,
    Back returns; internal state, so the quiz parents are untouched).
    Consequence: a merged Beyond compound replaces its component in
    Words Found (参加 folds into 参加者's Parts) — intended. な-merging
    deliberately omitted (様々な renders correctly as a な-adjective).
    Perf/network measured (CDP): repeat Break Down adds 0 wire bytes;
    the vocab ext index is fetched exactly once (a candidate can now
    trigger that fetch on sentences that previously had no misses —
    accepted: smart mode is already the multi-MB opt-in and the index
    is cached); zero long tasks on a re-parse at 4× CPU throttle.
    Verified on the owner's sentence: 参加者・勉強会・質疑応答・非常に
    all merge with correct furigana and glosses; greedy mode unchanged.

52. **Single-kanji reading fallback removed + voice-suffix chains,
    2026-07-09.** Two owner reports. (1) 集 in 問題集 tagged as 週
    "week": the variant-spelling reading fallback (附近→付近) looked up
    bare しゅう and hit 週's kana key. The variant assumption only holds
    for multi-character surfaces — a lone kanji shares its reading with
    unrelated words (集/週/州) — so `linkToken` and `beyondCandidates`
    now skip reading lookups for 1-char surfaces; the Beyond pass finds
    them by exact surface instead (集 → 集/しゅう "collection", Suffix
    Beyond). Also added IPADIC's `ナイ形容詞語幹` (問題, 仕方 — ordinary
    content nouns) to the compound-head whitelist so 問題+集 merges to
    問題集. (2) 悩まされた split at れる ("Past of れる" as its own
    word): IPADIC tags the voice suffixes as 動詞・接尾, which the verb
    chain never absorbed. `chainEnd` now absorbs 動詞・接尾 tokens whose
    base is in the closed set れる/られる/せる/させる — purely
    inflectional, never independent verbs, so unconditional absorption
    is safe, unlike 非自立 compound tails (decision 25). Other 接尾
    verbs (がる, めく) derive new words and stay separate. Long chains
    beyond the 22 named forms get the generic "Conjugated" label
    (existing behavior). Verified on real data: 文法の問題集を買った。
    (問題集 merged, no "week" anywhere) and 彼は頭痛に悩まされた。(one
    verb segment, no standalone れる).

53. **Homograph alternatives in the word popup ("Could Also Be"),
    2026-07-09.** Owner-reported on 乗っているうちに…: うち linked to
    the N5 kana-native noun "one's house" when the sentence means 内
    "while/inside". The tie-break (decision 49) has no sentence
    context, so for kana homographs it will sometimes pick wrong — and
    for kana-only surfaces even kuromoji's reading can't disambiguate
    (both entries read うち). Instead of trying to guess harder, the
    popup now offers the runners-up: `buildParserDicts` keeps a second
    map (`alternates`) of **contested keys only** (≥2 claimants, best
    first — uncontested keys are pruned, so the map stays small), and
    every linked word carries `alternatives`: the other entries that
    claim its exact written form (うち → 内; kana かえる → the other
    かえる verbs). Conjugated surfaces get the same treatment through
    the deconjugator — every alternative must reproduce the surface via
    a named form (いった offers 言った next to 行った), the same honesty
    bar as the primary link. Boundaries: (a) reading-only claimants are
    NOT alternatives — a kanji surface pins the word, so 集 never
    offers 週 (decision 52's rule); a kanji-written 行った therefore
    has no alternatives; (b) function-word tokens get none in smart
    mode — kuromoji's POS already pinned the class, so は/に don't
    offer 歯/二 (in both engines single-kana content words are also
    blocked by the `acceptable` rule); (c) capped at 4, sorted by
    `hitScore`; (d) a reading-swap (頃 read ころ) keeps the displaced
    surface claimant reachable as an alternative. UI: a "Could Also Be"
    section in WordSummary between Meaning and Parts, reusing the Parts
    swap mechanic (click → dialog shows that entry, Back returns).
    Quiz-feedback words never carry alternatives, so those popups are
    unchanged. Zero network cost (JLPT lists are already in memory;
    Beyond-tier entries are deliberately not scanned for alternatives)
    and O(1) map lookups per linked word at parse time.

54. **Parser input: 120-char cap, digits allowed, auto-growing box,
    2026-07-09.** Owner request, three parts. (1) Cap raised 100 → 120
    (`MAX_SENTENCE_LEN`, now exported from parse-sentence.ts and shared
    with the palette's "Break Down as Sentence" gate, which previously
    hard-coded 100). 120 was chosen against the real ceilings: the
    MyMemory translation fallback rejects queries over 500 bytes and
    Japanese is 3 bytes/char in UTF-8, so ~166 chars is the hard limit
    — 120 (360 bytes) stays safely inside, and the ?q= URL stays
    ~1.1 KB percent-encoded. Verified live: a 120-char sentence
    translates, parses in both engines, and round-trips through ?q=.
    Don't raise past ~160 without reworking the translation provider
    chain (see the "cons of raising the limit" analysis: MyMemory
    breaks first, then URL shareability, then main-thread parse cost).
    (2) Digits allowed in the input — ASCII 0-9 and full-width ０-９
    (dates, counters: 2026年, ３人). At the time Latin stayed rejected
    (superseded by decision 73). Digits parse
    as plain/annotated tokens, never link, and are **skipped by the
    Beyond pass** (kuromoji 名詞・数 tokens can't be dictionary entries;
    querying them would force the ext scan to run to the end of its
    rows for nothing). The input eligibility gate additionally requires at
    least one kana/kanji so the palette doesn't offer to "break down"
    a pure number like 123 (side effect: pure-punctuation strings no
    longer count as Japanese either — correct, they aren't sentences).
    (3) The input textarea auto-grows to fit its content on paste/
    typing/?q= restore (grow-only, so a manually enlarged box never
    snaps back mid-typing); the drag handle still resizes both ways
    and double-click still resets. Verified at 390px/xxlarge: grows
    130→214px on a 120-char paste with no inner scrollbar, drag adds
    height, double-click resets, no horizontal overflow.

55. **Lexicalized potentials: 行ける links 行く "Potential", not 生ける,
    2026-07-09.** Owner-reported on …新幹線「のぞみ」なら、2時間半くらい
    で行ける。: 行ける tagged as 生ける "to arrange (flowers)" (N1),
    ignoring the kanji 行. Two root causes. (a) IPADIC *lexicalizes*
    godan potentials — 行ける tokenizes as its own dictionary form
    (base 行ける), which no JLPT list carries, so the variant-spelling
    reading fallback looked up bare いける and hit 生ける's kana key.
    (b) `deconjugate` had no godan-potential rule at all (e-row + る →
    u-row), so nothing could trace 行ける back to 行く in either
    engine. Fixes: the rule was added to `deconjugate` (also improves
    dictionary search: querying 行ける now finds 行く), and
    `verbSegment` gained a kanji-preserving step BEFORE the reading
    fallback: when the chain's base misses the verb map, deconjugate
    the BASE (行ける → 行く, kanji intact) and link with proof — the
    entry must reproduce the surface as a named form ("Potential"), or
    the surface must provably be a form of the lexicalized base itself
    (行けない — negative of the ichidan-conjugating 行ける), which gets
    the generic "Conjugated" label since potential-negative isn't one
    of the 22 named forms. Kana surfaces stay genuinely ambiguous:
    いける still links 生ける (its own dictionary form wins), but
    dict-form verb surfaces now ALSO run the conjugated-alternatives
    scan, so いける/かえる offer 行く "Potential"/買う "Potential" in
    the popup's Could Also Be (decision 53 machinery). 生ける written
    with its own kanji is untouched (exact base hit runs first).
    Accepted trade-offs: a lexicalized potential that is ALSO a real
    lexeme links the base verb when the lexeme isn't JLPT-listed
    (もてる → 持つ "Potential" — defensible, the derivation is real);
    potentials of Beyond-only verbs still rely on the ext pass as
    before. Verified on the owner's sentence in both engines: popup
    shows 行く + Potential badge + kanji 行, no "arrange" anywhere.

56. **Reading swaps must respect the written form: 名 ≠ 姪,
    2026-07-09.** Owner-reported on 会員は現在20名で…: 名 (the counter
    めい) tagged as 姪 "niece" (N2). The JLPT surface hit (名/な
    "name", N3) contradicts kuromoji's reading めい, and the
    reading-consistent swap (decision 50) looked up bare めい — landing
    on 姪 through its kana key, an entry whose KANJI contradicts the
    written surface. Fix: both swap sites — `linkToken`'s JLPT swap and
    `linkBeyondWords`' misread repair (whose ext lookup matches rows by
    kana too, so the めい query could equally return 姪) — now require
    the replacement to be *written as this surface* or *kana-native*
    (kanji === kana, nothing to conflict; the ころ-for-頃 shape keeps
    working). The kanji pins the word — the same principle as decisions
    52 and 55, now applied to swaps. Result chain on the owner's
    sentence: the 姪 swap is rejected, 名/な stands but is flagged
    misread, the Beyond repair finds the ext entry written 名 reading
    めい, and the popup shows 名/めい "counter for people" (Counter +
    Beyond badges). When the ext index lacks a same-surface
    reading-consistent entry, the original JLPT link stands (existing
    decision-50 behavior) — wrong reading but right written form, and
    never a different kanji. The multi-char reading *fallback* for
    variant spellings (温かい → 暖かい, where differing kanji is the
    point) is deliberately untouched — the gate applies to swaps that
    REPLACE a surface-claiming link, not to fallbacks for surfaces
    nothing claims.

57. **Katakana homographs + counter positions (イチョウ, 146本),
    2026-07-09.** Two owner reports. (1) イチョウ (the ginkgo) linked
    to 胃腸 "stomach and intestines" with no alternatives: the katakana
    surface matches nothing directly, its hiragana reading いちょう
    matches many ext rows, and the first common row won. Fixes: the
    ext lookup (`findVocabRowsBySurface`) now takes per-surface
    preferences and returns per-surface row lists — a katakana
    surface's reading candidate prefers **kana-native rows**
    (kanji === kana; a katakana spelling signals the kana-native word,
    not a kanji word rendered in katakana), so イチョウ links the
    ginkgo, and every Beyond link now carries the other
    reading-consistent rows as popup alternatives (胃腸, 医長, …) —
    the "Could Also Be" machinery of decision 53 extended to the
    Beyond tier. (2) 本 in 146本 tagged as plain "book": a suffix noun
    right after a 名詞・数 token is a **counter position**
    (`TokenInfo.counter`). When a real counter entry written as that
    surface exists, it replaces the noun and the noun demotes to the
    first alternative (20名 → 名/めい "counter for people" with 名/な
    "name" as alternative — this generalizes decision 56's repair).
    For 本 there is NO counter entry anywhere in the data: JMdict
    keeps 本's counter sense inside the same entry as "book" (N5), the
    ext tier excludes JLPT-listed ids, and the JLPT copy carries only
    the book sense — so the noun link stands with `counterUse`, which
    renders a "Counter here" badge (tooltip + popup) and an honest
    usage note ("comes right after a number, so it works as a
    counter — the meanings below describe the standalone word"). No
    hardcoded per-word knowledge; the signal is kuromoji's token
    context. Performance: the ext scan is still one pass (the
    `satisfied` early-exit was removed — any surface absent from the
    index already forced a full scan in practice, and the per-row work
    is Set membership, lighter than the scored search scans of
    decision 10); alternate lists are capped at 5 rows per queried
    surface. Counter-position tokens that are already JLPT-linked add
    their surface to the Beyond query set, which can newly trigger the
    (opt-in, HTTP-cached, session-singleton) vocab index fetch on
    sentences with no other misses — the same accepted delta as
    decisions 51/53.

58. **Parser direction tabs: JP→EN and EN→JP, 2026-07-09.** Owner
    request. The parser gained a direction toggle: the default
    Japanese → English tab is the existing feature untouched; the new
    English → Japanese tab takes English input (≤200 chars,
    `MAX_EN_SENTENCE_LEN` — ~200 bytes, MyMemory-safe; `stripNonEnglish`
    filters to printable ASCII + common typographic punctuation),
    machine-translates it to Japanese (`translateToJapanese`, the same
    Google gtx → MyMemory chain with a direction-keyed cache), shows
    the generated Japanese with a provenance note, and runs it through
    the SAME breakdown pipeline. Owner constraints, honored by
    construction: the two tabs are fully independent — each has its own
    input state and URL param (?q= vs ?en=, active tab in ?dir=), and
    the parse pipeline was extracted into a `useBreakdown` hook
    instantiated once per tab, so results live side by side and
    switching never recomputes, resets, or transfers anything. A
    permanent warning on the EN tab says incoherent input or
    other languages produce an inaccurate translation and breakdown
    (same-day follow-up: shortened to a muted one-liner — "English
    input only — machine-translated to Japanese, then broken down" —
    with the full accuracy caveat moved into the Important Notice,
    which now also states the tool parses and never fixes input).
    The generated Japanese is stripped/trimmed to the parser cap (with
    a visible "trimmed" note) and an empty-after-strip result is an
    error state with an external Google Translate link. The JP tab's
    Translation section is hidden on the EN tab (the English is the
    user's own input); its state still keys off ?q=, so it survives
    tab round-trips. Network: one extra translation request per
    committed EN sentence (cached per direction+sentence for the
    session); the breakdown costs are identical to the JP tab's.

59. **Parser perf re-audit + transition-rendered results, 2026-07-09.**
    Owner-requested audit after decisions 49–58 (full numbers in the
    performance report's 2026-07-09 addendum). CPU: every new parser
    path is cheap — `buildParserDicts` 7.6 ms including the alternates
    map (907 contested keys), greedy parse WITH alternatives ~1 ms, and
    the full-pass ext scan over 204k rows is **7.5 ms** (decision 57's
    early-exit removal measured: the 100–220 ms figure of decision 10
    describes *scored search* scans, not this membership scan — no
    guard or restoration needed). Network: repeat parses and tab
    switches are 0 requests; warm-session sentences cost only their
    single translation request; the 24 MB cold-start remains entirely
    inside the pre-existing opt-ins. The one real finding: committing
    a breakdown rendered dozens of ruby+tooltip spans in one blocking
    React commit — a 61 ms long task at 4× CPU throttle for greedy
    (183 ms for smart, which adds kuromoji's synchronous tokenize).
    Fix: `useBreakdown` publishes results inside `startTransition`, so
    React time-slices the commit — greedy re-parse now produces **zero**
    long tasks at 4× throttle, smart drops to a single 129 ms task that
    is almost entirely kuromoji's tokenize (~32 ms unthrottled, a
    one-off click response). Moving tokenize to a worker is the next
    lever if it ever matters; not worth the complexity today.

60. **Outage recovery: same-text retries + no rejected-promise caching,
    2026-07-09.** Owner-requested edge-case test (both translation
    providers unreachable) found the degraded states themselves were
    correct — JP→EN keeps its fully-local breakdown and shows the
    Translation error card; EN→JP stops cleanly with an error and the
    external-link workaround — but **recovery was broken for identical
    input**: the translation effects key off the URL params (?q=/?en=),
    so re-committing unchanged text after an outage changed nothing and
    never re-fired the fetch (the EN error even said "try again").
    Fixes: (a) per-tab `attempt` counters passed into `useTranslation`
    / `useEnToJa`; the main Break Down button bumps the active tab's
    counter when its current translation state is an error and the text
    is unchanged, the EN error's "try again" is now a real button, and
    the JP Translation section gained a "Try Again" button — a retry
    with previously-successful text is a session-cache hit, so counters
    never cause refetch spam. (b) The same audit exposed the wider
    class in loader.ts: five promise caches (`verbCache`/`vocabCache`
    per level, both ext index singletons, `kanjiCoreCache`, and
    `idLevelCache`'s null fallback) cached REJECTED promises forever —
    one transient failure would permanently kill that data (Beyond
    linking, kanji cards, detail routing) until a full reload. All now
    self-clear on failure, matching the pattern the shard caches and
    kuromoji already used. (c) A failed JLPT dictionary load left the
    parser button stuck on "Loading dictionary…" — the load effect now
    catches and resets `dictsWanted`, so the next textarea focus or
    keystroke retries. Verified with Playwright route-blocking both
    providers / the ext index / the JLPT files: 13 checks — every
    degraded state renders, and every path recovers after the outage
    ends, including same-text retries in both tabs, the ext index
    refetching on the next parse, and the dictionary reloading on
    refocus.

61. **Explanatory の is grammar, not 野, 2026-07-09.** Owner reported a
    recurring smart-mode mistag: the の of the explanatory のだ/のです
    construction (使えばいいのですか, 購入したいのですが — see Tofugu's
    explanatory-んです article) linked to 野 "field; hidden interior
    part" (N3). Root cause: IPADIC tags this の (and its contraction
    ん) as 名詞・非自立 — a *noun* — so `linkToken` skipped the
    function-word gate and the bare-kana lookup found 野, whose kana is
    の. Greedy mode was never affected (`acceptable()` already blocks
    single-kana matches to non-particles). Rule (`isExplanatoryNo`):
    a 名詞・非自立 token whose surface is exactly の or ん is
    reclassified as a particle — gray rendering, skipped by the Beyond
    pass, and routed through `linkToken`'s function-word branch, so it
    may link to a real の *particle* entry if the lists ever carry one
    (same behavior as the possessive 助詞 の) but never to a noun
    sharing its kana. Deliberately keyed to the surface: other 非自立
    nouns (こと, よう) are real listed words and must keep linking
    (decision 49's よう test and the こと homograph test pin this).
    Covers every use of the tag — のです/のだ/のですが, sentence-final
    の, and the nominalizer (走るのが好き) — since 非自立 by definition
    marks the grammatical use; a content-word 野 arrives as its own
    kanji surface (名詞・一般) and still links normally.

62. **Cheatsheet linguistic review, 2026-07-09.** Owner-requested
    Japanese-accuracy review of both cheatsheets (one reviewer agent per
    page). Four content fixes, no logic changes: (a) the imperative
    form's usage note claimed it "can be softened by adding kudasai" —
    factually wrong (ください never attaches to the imperative; polite
    requests are 〜てください, built from the TE-form) — rewritten in
    `FORM_LABELS`, which also fixes every verb detail page and quiz
    feedback card since all render the same shared constant; (b) the
    counters page's k/s/t gemination bullet said "1, 8, and 10" but
    k-row counters also geminate on 6 (六回 ろっかい) — the page's own
    generated sequences already showed this, so the rule contradicted
    the data next to it; (c) 羽 gained a notes field (ろっぱ/はっぱ as
    common alternates for 6/8 — the plain ろくわ/はちわ the generator
    emits remain valid and more common, so the sequence itself stands);
    (d) full-width （） around an English aside normalized to
    half-width. The audits also hand-verified with no findings: the
    entire counter-sequence generator (every sound-change class, tens/
    hundreds compounding, ひとり/よにん/はたち/さんがい specials), all
    22 conjugation-form explanations and exception notes, the godan
    endings table, and the る-trap list. 歩+4 (よんぽ) was investigated
    and kept — dual-valid per counter references.

63. **Grammar Points dataset: original content, curated union, stable
    slugs, 2026-07-09.** New Language-section feature (`/grammar` list +
    `/grammar/$slug` detail) covering the JLPT N5–N1 grammar points.
    Ground rules, in rough order of importance: (a) **all shipped prose
    and example sentences are original content** — jlptsensei and Bunpro
    contributed only the *inventory* (which points exist, their level, a
    one-line meaning hint), reconciled as a curated union with the full
    audit trail committed at `src/data/grammar/inventory.json` (every row
    carries `resolution: kept / merged-into / vocab-folded` plus level-
    conflict notes; when the sites disagreed on level, the easier level
    won by default). (b) **Slugs are level-free and never renamed once
    committed** — review can re-level a point (the entry moves between
    n{level}.json files) without breaking relations or URLs; homographs
    get semantic suffixes (と "and" vs と conditional). (c) `findGrammar`
    **loads all five level files** (~a few hundred KB gz total, each
    Map-promise-cached per decision 60) instead of an ids map: relations
    cross levels, and the detail page needs other levels anyway to render
    its relation cards; grammar data is fetched only by `/grammar*`
    routes. `pack-jlpt.ts` packs missing level files as `[]` so runtime
    lookups stay uniform mid-catalogue, and packs only the explicit
    `n{1..5}.json` filenames (inventory.json is a worksheet, not
    entries). (d) **Example furigana (`f`) is always machine-derived
    from `ja`** by `bun run data:grammar`; the integrity suite
    (`scripts/grammar-data.test.ts`) fails when `f` doesn't
    re-concatenate to `ja`, so an edited sentence cannot ship a stale
    reading — a kuromoji misreading is fixed by rewording the sentence,
    never by hand-editing `f`. (e) Content is authored per level and
    then reviewed by the japanese-expert agent in fixed no-overlap
    chunks of 30 points (owner-specified protocol), which also authors
    the two final example sentences per point; reviewers edit only
    string values. Scope cuts for v1: no Beyond tier, no command-palette
    integration (would fetch grammar data outside grammar pages — lifted
    by owner request in decision 65), no progress/practice integration. **Shipped complete 2026-07-10**: all
    1,031 points (N5 119 / N4 189 / N3 248 / N2 208 / N1 267), 2,062
    original example sentences. Protocol evolved by owner instruction
    mid-flight: review chunks 30 (N5, sonnet) → ~100 (N4, opus) → 150
    (N3–N1, opus), and from N3 on at most 2 subagents ran concurrently;
    japanese-expert.md was temporarily switched to opus for N4–N1 and
    restored to sonnet after. A recurring review finding worth knowing:
    kuromoji's machine furigana misreads context-dependent kanji
    (counter rendaku/gemination like 三千円/一冊, 一人/二人, 者=もの vs
    しゃ, 術=すべ, 間=あいだ, 中=じゅう, 方=かた, 大勢) — per rule (d)
    these were always fixed by rewording or writing the word in kana,
    never by hand-editing `f`; sentences in the shipped set were
    spot-verified after every regeneration.

64. **Mixed-script sizing + structure-notation bracket rules,
    2026-07-10.** Two owner-reported rendering bugs, fixed structurally.
    (a) `lang="ja"` switches to the Japanese font (whose Latin glyphs
    render visibly larger) and applies the ja font-size setting — so
    putting it on a whole mixed string bloats its Latin part ("Verb" in
    a structure chip, an English gloss in the quiz's "you answered"
    line). The shared `JaText` component (`src/components/ui/ja-text.tsx`)
    wraps **only the Japanese runs** in `lang="ja"` spans; use it for any
    mixed Japanese/Latin string, and keep plain `lang="ja"` only on
    known-pure-Japanese content. (b) Grammar `structure` lines are
    chip-split on ＋ at bracket depth 0 (`GrammarStructure` never splits
    inside （…） or ［…］), and the data must keep every bracket pair
    within one chip: （…） marks an optional element, English prose
    belongs in ［…］ annotations (never in （…）), and a plus inside an
    ［…］ annotation is written as ASCII `+` (full-width ＋ is the chip
    separator). A japanese-expert sweep (opus, max 2 concurrent)
    normalized all 1,031 points against these rules (65 entries
    changed); `scripts/grammar-data.test.ts` now fails on any structure
    line whose brackets would split across chips, so the cut-off-bracket
    bug can't be reintroduced by future authoring.

65. **Grammar points in the command palette, 2026-07-10** (owner request,
    lifting decision 63's v1 scope cut). The palette searches the 1,031
    grammar points alongside JLPT words: hits are tagged GRAMMAR beside
    the level badge and open `/grammar/$slug`. `searchGrammarScored`
    (grammar-search.ts) keeps the same 0–3 score tiers as
    `searchWordsScored`, so the three lists merge into one ranking (ties
    go to common words — grammar counts as non-common). The five grammar
    level files (~539 KB gz total, one-time) load with the word levels on
    the palette's **first open** — still never on cold page load, still
    promise-cached with the grammar routes (opening the palette after
    visiting `/grammar` costs 0 extra requests, and vice versa). Grammar
    stays out of the per-page word tables and the parser — the palette is
    the only cross-surface entry point. Perf pass (tester → improver →
    QA, same day): grammar keystroke cost 3.9–4.5 ms → 0.2–0.68 ms via a
    per-entry fold-key WeakMap in grammar-search.ts (mirrors search.ts's
    `kanaKey`), and the one-time first-search-of-session spike (~296 ms
    at 4× CPU — mostly the pre-existing word `kanaKey` fill) → ~74 ms by
    pre-warming the caches with a throwaway search on the palette's
    first open. The warmup is a deliberate `setTimeout(0)` macrotask,
    NOT `requestIdleCallback` — rIC starves on hidden tabs and loses the
    race against a fast first keystroke (both measured); it runs in the
    post-open reading gap, once per session, results discarded.

66. **Smart parser: benefactive helpers break the て chain + いただけ
    lattice repair, 2026-07-10** (owner report: 待っていただけませんか
    tagged "Conjugated form of 待つ"). Two-part fix in parse-sentence.ts.
    (a) `chainEnd` no longer absorbs BENEFACTIVE 非自立 verbs after a
    て/で connective (いただく／くださる／もらう／くれる／あげる／やる
    and their IPADIC-lexicalized potentials): they carry their own
    meaning (who does/receives the favor), are all JLPT-listed words,
    and no named form of the head verb can reproduce the merged blob
    (honest-boundary rule). They now head their own segment — 待って +
    ください, 見て + いただきました. Purely ASPECTUAL helpers (いる,
    ある, おく, しまう, みる, いく, くる) keep merging: 食べている stays
    one word, pinned by tests. (b) IPADIC itself mis-tokenizes
    〜ていただけません as て+い［いる］+た+だけ+ませ…, so the chain
    legitimately built 待っていた and stranded ませんか. `repairItadake`
    re-joins that run into いただけ（る）before segmentation; the guard
    is a ます auxiliary DIRECTLY after the particle だけ, which no real
    sentence produces (ます needs a verb stem) — genuine ていた+だけ+だ
    ("it's just that…") is untouched, also pinned by a test. The greedy
    engine never had this bug (its identifyVerbForm proof already
    rejected 待っていた).

67. **Kana-native expressions outrank kanji-written verbs on all-kana
    surfaces, 2026-07-10** (owner report: (寝ては)いけません linked to
    生ける "to arrange flowers" N1, no alternatives). A kana surface never
    pins a kanji-written entry (decision 52's converse): 生ける's polite
    negative would be written 生けません, so fully-kana いけません belongs
    to the kana-native いけない expression (N3, "must not"). New
    `kanaNativeWord` in parse-sentence.ts: an all-kana surface that IS a
    kana-written (kanji===kana) expression/い-adjective entry — or whose
    ません↔ない sibling is (both attach to the same stem there; guarded so
    a bare stranded ません can't claim the ない entry) — links to that
    entry in both engines, with the displaced verb kept reachable via
    alternatives. `conjugatedAlternatives` also gained smart mode's
    lexicalized-base fallback (いけません → いける → 行く earns the
    generic "Conjugated" label the primary path already used), so the
    popup now offers 生ける AND 行く under "Could Also Be". Kanji
    surfaces are untouched: 生けました still links 生ける (pinned by
    test + browser check). Greedy's mangling of ては as は+い ("yes") is
    the pre-existing, disclosed greedy limitation — not addressed.

68. **Parser "Scan Image": opt-in on-device OCR via tesseract-wasm,
    2026-07-11** (owner feature request). A "Scan Image" chip beside Smart
    Parsing opens an inline panel with three inputs — clipboard paste
    (button via `navigator.clipboard.read()` where it exists, else a
    Ctrl+V window listener that works everywhere incl. Firefox), file
    upload, and a live getUserMedia viewfinder dialog (falling back to a
    native-camera `capture` input on touch devices, then to a disabled
    button whose tooltip names the reason — insecure context vs no API).
    Decisions and their whys:
    - **Engine: `tesseract-wasm`** (robertknight, BSD-2) over Tesseract.js
      (2× the wrapper for the same engine) and PaddleOCR-on-ONNX (better
      photo accuracy but ~15–25 MB + a detection/recognition pipeline).
      Worker-based `OCRClient`, SIMD auto-detected. The engine files are
      **copied from node_modules to `public/ocr/engine/` (gitignored)** by
      `scripts/copy-tesseract.ts` in the dev/build chains — the worker
      resolves its wasm relative to its own URL, so the three files live
      together, and an explicit `workerURL` avoids Vite dev's pre-bundle
      worker breakage. Vite also emits a duplicate hashed worker+wasm
      asset pair into dist (from the lib's internal `new URL` default) —
      dead weight, never fetched, accepted.
    - **Models: tessdata_fast jpn+eng, pre-gzipped and COMMITTED** under
      `public/ocr/models/` (owner choice: deterministic builds, no
      build-time network; gzip 2.47→1.5 MB / 4.11→2.0 MB). Loaded per
      active tab with byte progress (`content-length`; done clamped —
      hosts that mark .gz with Content-Encoding stream inflated bytes
      against a compressed total). Apache-2.0 + BSD notices in
      `public/ocr/NOTICE.md`, credited on About.
    - **Gating mirrors Smart Parsing**: consent dialog announcing the
      sizes, sticky `nihongo-mono:parser-ocr`, dialog skipped once
      confirmed; the panel (one lazy chunk holding tesseract-wasm and all
      OCR code) eager-loads engine + active-tab model on mount so the
      first scan doesn't stack waits. The route frees the worker's wasm
      heap on unmount through a static `handle.ts` registry — importing
      the engine there would defeat the code split. tesseract-wasm's
      typings are hidden by its exports map (no `types` condition) — local
      declaration in `src/lib/ocr/tesseract-wasm.d.ts`.
    - **Mode-aware filtering**: JA tab keeps only parser-allowed Japanese
      then strips ALL whitespace (Tesseract's spurious CJK gaps;
      JA_ALLOWED deliberately keeps `\s` so `stripNonJapanese` alone is
      not enough); EN tab keeps English and collapses layout whitespace.
      Result ≤ cap → auto-commit to `?q=`/`?en=` (safe pre-dicts; the
      breakdown effect re-runs when they arrive); over → the textarea
      holds it (EDIT_CEILING 2000), Break Down blocks with a destructive
      counter, the user edits down. Committed URL params keep the old
      caps.
    - **Preprocessing**: EXIF-aware decode, downscale to ≤2000 px longest
      side (recognition time scales with area; LSTM gains nothing above).
      Accuracy measured on rendered fixtures: exact at 28/64 px Meiryo &
      Yu Gothic; a 42 px Yu Gothic render dropped/confused 2 chars —
      Tesseract-typical, disclosed by the panel's "works best on clear,
      horizontal printed text" hint, and the editable-textarea flow exists
      precisely so users fix OCR errors before breakdown. Vertical
      Japanese and handwriting are out of scope (jpn_vert is a separate
      model with known issues).
    - **No cancel API** in tesseract-wasm: closing the panel
      mid-recognition drops the result via a run counter and the worker
      idles to completion; scans are serialized by a busy flag. A denied
      camera permission is remembered per session (re-prompting hits a
      browser-suppressed prompt and hangs).
    - Camera capture states are explicit (`starting/streaming/denied/
      no-device/failed`), each with an escape hatch (Upload Instead / Try
      Again); `playsInline` is mandatory on iOS. Panel entrance is 150 ms
      ease-snap fade+zoom-from-95%, suppressed when the chip was
      keyboard-activated (`event.detail === 0`, decision 48); progress
      bars animate `transform: scaleX` only.
    - **Furigana breaks Tesseract's Japanese line segmentation** (owner
      report: 日曜日どこも… scanned from an app example sentence lost
      日曜日ど). Measured with the exact sentence rendered with/without
      ruby: plain text is near-perfect at every size; with ruby the
      damage varies by scale (42 px kept everything, 28 px dropped 日曜日
      entirely and leaked stray furigana kana in, 84 px worse) and
      canvas-upscaling the failing image ×2/×3 does NOT rescue it — the
      kanji under the ruby are never recognized, so post-hoc box
      filtering can't recover them either. OCRClient exposes no
      setVariable/PSM to tune. Accepted as an engine-level limitation:
      the panel hint discloses it ("Furigana … can confuse detection")
      and points at the review accordion, which exists precisely to
      catch these misses.
    - **Crop-before-scan** (owner request): every acquired image (paste,
      upload, drop, camera capture) parks in a crop dialog before OCR so
      distractions get cut away — clutter measurably confuses Tesseract.
      Library: **react-image-crop** (~5 KB gz, zero deps, CSS-transform
      dragging, touch + keyboard handles) — cropperjs rejected as ~6×
      heavier, hand-rolling rejected for a11y/touch cost; it and its CSS
      live inside the lazy OcrPanel chunk (zero initial-load impact,
      verified per build). The selection defaults to the full frame so
      "just scan it" stays one click, and a near-full selection skips
      the canvas re-encode entirely (cropToBlob returns the source
      blob); real crops cut at natural resolution, keeping PNG for PNG
      sources (crisp screenshot text) and JPEG 0.92 otherwise. One
      parked image at a time — a newer acquisition replaces it. The
      dialog is optional per user: a "Crop before scanning" checkbox
      (sticky `nihongo-mono:parser-ocr-crop`, default on) skips it for
      acquisitions when unchecked. The stored last scan can also be
      **re-cropped** ("Crop & Rescan" in the review accordion, keeps
      the blob for this) — always dialogs regardless of the checkbox,
      carries a discreet "replaces the stored scan" note, and the
      cropped result overwrites the slot; successive crops compound by
      design.
    - **Rotate in the crop dialog** (owner follow-up): a Rotate button
      turns the image 90° clockwise per click (cycling to 0° at four).
      The preview swaps to a canvas-rotated copy (`rotateToBlob`,
      downscaled to the OCR's 2000 px ceiling so 12 MP photos don't
      re-encode full-size per click) — CSS-transforming the img is NOT
      an option: react-image-crop reads its overlay geometry from the
      img's layout box. The scan bakes rotation + crop from the
      ORIGINAL blob at full resolution in one canvas pass
      (`cropToBlob(source, crop, quarterTurns)`); the no-re-encode
      shortcut applies only at 0°. Each rotate resets the selection to
      full frame (the axes swap). Found while testing: the img-level
      `max-h-[55vh]` had NEVER applied — react-image-crop's stylesheet
      sets `max-height: inherit` on the child img with higher
      specificity, so tall images overflowed the dialog and pushed the
      footer off-screen. The cap now lives on ReactCrop's root
      (inherited down, the library's intended API) and the crop
      DialogContent got `max-h + overflow-y-auto` as a safety net.
    - **Review accordion "Use as Input"** (owner request): puts the RAW
      detected text through the normal typing filter into the textarea
      and flips to the text view — deliberately NO auto-breakdown
      (choosing raw over the cleaned result means the user wants to fix
      it up first). Both opt-in consent dialogs (Smart Parsing + Scan
      Image) share a restyled shape: tinted feature-icon header,
      one-line pitch, and the one-time-download size in a highlighted
      primary-tinted callout box (plus a shield privacy line for OCR) —
      the size is the thing the user is consenting to, so it gets the
      visual emphasis.
    - **Scan surface layout** (owner feedback round): the drop zone is
      the primary affordance — a large dashed click-to-browse target
      (icon + "Drag & drop an image here", drag-over highlight +
      label swap) that absorbed the separate Upload button and the old
      awkward "…or drag an image here" hint line; Paste Image and Open
      Camera stay as buttons. The X close icon (read as "dismiss")
      became an explicit "← Back to Text" ghost button. Icon-only
      CopyButton (`components/ui/copy-button.tsx`, transient ✓ swap as
      the state feedback) on the Breakdown heading (copies the
      broken-down sentence, reconstructed from segments so it's
      engine-agnostic) and on the review accordion's raw detected text.
    - **Scan Image is a VIEW TOGGLE, not an add-on** (owner revision): the
      chip sits on the direction-tabs row (with the input controls, not
      among the parse actions — it swaps what the input area IS) and flips
      between the textarea and the scan surface; never both at once. The
      **Smart Parsing chip later joined it there** (owner report: it was
      unreachable in scan view, where scans auto-break-down and its
      engine choice still applies) — the tabs row now groups the two
      sticky feature chips, and the text view's controls row keeps just
      the counter + Break Down. The
      panel mounts once and is then only `hidden`-toggled, and the typed
      text lives in route state — an accidental toggle loses neither the
      image nor the input. Pastes are ignored while hidden (`visible`
      prop; pasting an image into the textarea must not secretly scan)
      and hiding force-closes the viewfinder (camera light). A finished
      scan NEVER auto-flips the view (a surprise swap read as confusing
      — owner feedback superseding the earlier flip-on-commit): the
      drop zone itself becomes the success surface (green check,
      "Scanned — N characters added", auto-resets after 2.5 s) while
      the committed breakdown renders below the panel; over-limit shows
      its trim notice pointing at Back to Text. The type↔scan swap
      animates the incoming view with a 120 ms fade + 3 px rise via
      WAAPI — the views are display-toggled so a CSS animation class
      can't replay, making this the app's one JS-driven motion; it
      checks prefers-reduced-motion itself (the global CSS clamp can't
      reach WAAPI) and skips keyboard activation. One image slot: each
      scan revokes and overwrites the last. A "Review last scan"
      accordion (collapsed by default) shows the stored image and the
      RAW detected text before script filtering, so misreads can be
      spotted.

69. **The negative te is two forms: なくて and ないで, split platform-wide,
    2026-07-11** (owner request; initially asked for the quiz, then widened
    so the quiz needs no unique logic). `te-negative-naide` is a new
    first-class `ConjugationForm` (23 total) — it conjugates in the engine
    (negative + で per class), rows in the verb-detail table and the
    cheatsheet's conjugation guide, gets its own rule card, and is a
    separately selectable quiz chip. Because everything is data-driven
    through the exhaustive form records, the quiz prompt ("Negative te
    ないで · without doing so"), answer checking, distractors, summary, and
    progress tracking all just work with zero special-casing.
    - **The id `te-negative` keeps meaning なくて** and only its label
      changed ("Negative te なくて", hint "not doing so"): stored progress
      (`nihongo-mono:progress:v1` form tallies + session records), saved
      quiz configs, and shared `?forms=` URLs predate the split and stay
      valid without migration — everything that id ever measured WAS
      なくて answers. Old configs quiz なくて only until the user also
      ticks the new ないで chip (explicit, not silently expanded).
    - Labels follow the `Conditional ば`/`Conditional たら` precedent —
      English name + the Japanese morpheme, short enough for the setup
      chips and detail-table rows at mobile widths.
    - **ある has no ないで form** (`ARU_MISSING`): stative ある takes
      なくて only, so the row hides on its detail page and the quiz never
      asks it (null conjugations are skipped by the session generator).
    - Quiz answer feedback for either form teaches the difference at the
      moment of answering — the pair is the most confusable in the
      system: the asked type is explained inside the answer card, and
      the sibling (with THIS verb's surface, e.g. 書かないで under a
      書かなくて answer) sits in its own dashed box below under a
      "Similar form — don't confuse" header. The first cut listed both
      surfaces side by side inside the card, which read as two answers
      (owner report) — the sibling must be visually separated and
      labeled. The なくて rule card's watch-out points to ないで for
      "without doing so"/requests and vice versa.
    - The parser's `identifyVerbForm` iterates the form list, so parsed
      ないで surfaces now label themselves correctly for free.

70. **Google Drive progress sync — client-only, draw.io-style, 2026-07-11**
    (owner feature request with an explicit security mandate). Settings →
    Cloud sync links the user's own Google Drive: a `Nihongo Mono` folder
    in My Drive root holds one `progress.json`, auto-synced after every
    finished quiz session and on app load, browser ↔ Google directly —
    the static host is never involved (verified by the CSP allowlist
    itself). Feature hides entirely when `VITE_GOOGLE_CLIENT_ID` is unset
    (`.env.example`; owner console steps in `docs/google-drive-setup.md`).
    - **Auth: GIS token model** (`accounts.google.com/gsi/client`,
      `initTokenClient`/`requestAccessToken`), scope **`drive.file` only**
      — the app can touch only files it created; a stolen token could
      never read the rest of a Drive. The access token lives in
      **module memory only** (never persisted — a unit test asserts the
      stored meta stays token-free); tokens last ~1 h and don't survive
      reloads, so non-interactive syncs still ATTEMPT a silent GIS
      request (with an existing grant + session Google grants it without
      UI — the draw.io behavior) under an 8 s timeout; anything needing
      the user (blocked popup, revoked, signed out) lands in a
      `needs-reauth` status that one click fixes. First cut threw
      immediately without attempting — every fresh page session then
      required a manual click, found by the Playwright round.
    - **Sync = pull-merge-push with a THREE-WAY merge** (`merge3.ts`).
      The additive import merge (`mergeProgress`) would double every
      counter on every sync once local and remote share history — caught
      while writing the steady-state test. Each successful sync stores
      the agreed state (`drive-sync:base:v1`); the next computes
      `remote + (local − base)` per counter, sessions by multiset diff,
      streak by most-recent timeline with a high-water `best`. Anchoring
      on remote makes another device's "start fresh" reset propagate
      instead of resurrecting. `decideUse` is the one place the additive
      merge is correct (two independent histories meeting once) and it
      anchors base at the remote it merged from. No base (first sync /
      storage loss) falls back to the additive merge once.
    - **Second-browser decision gate** (owner spec): existing Drive
      progress parks the link as `decisionPending` — persisted, surviving
      reloads, hard-gating every auto/load sync until the user picks
      **Use Drive Progress** (merge) or **Start Fresh** (this browser
      overwrites Drive; requires a checkbox — "I understand… permanently
      replaced" — before the destructive button enables, per the owner's
      misclick requirement). Dismissing keeps the gate closed; a failed
      reset reverts to pending so a later auto-sync can't quietly
      resurrect what the user chose to discard.
    - **Failure matrix** → statuses: 401/revoked → needs-reauth (token
      forgotten); 403 rate limits/429 → in-sync exponential backoff
      (1–16 s + jitter, 5 attempts) then a retry-on-next-trigger error;
      `storageQuotaExceeded` → explicit "Drive is out of storage"; fetch
      failure → offline with a one-shot `online`-event retry; 404 →
      folder/file recreated (adopting a file another device already
      recreated instead of clobbering it); unreadable/oversized remote →
      `remote-invalid` with an explicit "Overwrite Drive copy" recovery.
      Remote JSON is untrusted input: 1 MB cap before `JSON.parse`, then
      the import path's `parseImported`/`migrate`.
    - **Async + visible**: syncs are fire-and-forget behind a
      single-flight engine (a trigger mid-sync queues exactly one rerun);
      the engine writes merged data to localStorage and fires an event
      the ProgressProvider re-reads from (no re-save loop). Status lives
      in a ~0.5 kB `useSyncExternalStore` store: full status line in
      Settings, a small pill on the progress header and both quiz
      summaries. Everything else — engine, Drive REST, Google's script —
      is behind dynamic imports; the GIS script loads only for linked
      users or on the consent click. Multi-tab: last-write-wins, no
      storage listeners (the merge is reload-safe); accepted caveat.
    - **CSP shipped with the feature** (`scripts/gen-csp.ts` in the build
      chain): `script-src 'self' 'wasm-unsafe-eval' <FOUC hash>
      accounts.google.com`, `connect-src` allowlisting only Google +
      the two translation origins, `frame-src accounts.google.com`,
      `object-src 'none'`, `frame-ancestors 'self'`. The inline-script
      hash is recomputed from the BUILT dist/index.html every build, so
      editing the FOUC script can't silently break the policy; the script
      writes `dist/_headers` (Cloudflare + Netlify) and keeps
      `vercel.json` in lockstep. `'wasm-unsafe-eval'` is required or the
      CSP would break tesseract-wasm OCR (it does not allow JS eval).
      No default-src/style-src on purpose: Radix inline styles and the
      self-hosted workers must keep working; scripts and egress are the
      token-theft vectors.
    - **Testing**: real OAuth can't run in CI, so browser tests fake
      Google at the NETWORK layer (Playwright route interception serving
      a fake gsi/client script + fake Drive API) — the production code
      path runs unmodified and no test hook ships in the bundle. 15
      end-to-end checks + 36 unit tests (merge3 idempotence/deltas/reset
      propagation, error classification, meta/token invariant, engine
      transition table via injected deps). Real-account checklist in
      `docs/google-drive-setup.md`.
    - **/cloud-sync consent & privacy page** (owner follow-up): a
      dedicated route explaining the sync in plain language — folder
      location (My Drive › Nihongo Mono › progress.json) with an explicit
      "don't move/rename/edit/delete it" warning, the drive.file scope
      limits, what data is synced (stats only, no PII), user controls
      (disconnect, myaccount revoke, folder deletion, file backups), and
      the legal notes: as-is/no-warranty + liability limitation, Google
      ToS/Privacy links + non-affiliation, user's own account/quota
      responsibility, MIT auditability. Linked from the connect dialog
      ("by continuing you agree…", new tab so consent context survives),
      the Settings section, and About; it doubles as the privacy-policy
      URL the Google consent-screen branding form requires. Settings
      also shows the folder path + tamper warning whenever linked
      (constants shared from `sync/constants.ts` so the UI doesn't pull
      the lazy Drive layer).
    - **Sync surfaces beyond Settings** (owner follow-up): a shared
      `SyncNowButton` (dashboard stat row with the status pill;
      `/progress` header and its empty state) runs the interactive
      `manualSync()` on click — null when not linked, disabled while
      syncing or while the second-browser decision is pending (the
      decision gate stays authoritative; the pill links to Settings).
      Auto-sync also fires on quiz-session mount (both quiz routes) and
      on entering `/progress`, so the numbers shown are reconciled
      cross-device before a session starts or stats are read — all via
      `requestAutoSync()` (silent, single-flighted, zero requests when
      not linked or undecided).
    - **Sign-in retention (owner follow-up: "it keeps logging me out",
      revised twice)**: tokens are ~1 h; GIS silent re-mint depends on
      third-party-cookie state, so a reload could not reliably stay
      signed in from memory alone. The retention stack is now: (1) the
      token persists in **localStorage**
      (`nihongo-mono:drive-sync:token:v1`) — reloads AND full browser
      restarts reuse it with zero Google traffic (owner widened this
      twice: first sessionStorage for reloads, then localStorage for
      restarts). This is an owner-approved relaxation of the original
      memory-only invariant; the exposure envelope: Google's ≤1 h token
      lifetime, the 24 h idle sign-out, expired blobs self-delete on
      read, hash-pinned CSP bounding script injection and egress,
      drive.file blast radius — and /cloud-sync's token wording was
      updated to stay honest. The link META must still never carry a
      token (unit-pinned); (2) **automatic callers never contact Google
      sign-in at all** (owner rule, added after mobile surprise-popups:
      GIS's "silent" flow — `requestAccessToken` with `prompt: ''` —
      opens a REAL login popup whenever Google decides interaction is
      needed, so every auto-sync trigger was popping login UI on a
      signed-out phone). Non-interactive `getToken` only reuses the
      persisted token and otherwise throws AuthRequiredError → the UI
      shows the "sign in to resume sync" warning; `requestAccessToken`
      runs ONLY from clicks (Sync Now, Sign in, Connect), where a popup
      is gesture-sanctioned. Consequence, accepted by the owner: past
      the token's ~1 h life the app WAITS in the warning state instead
      of renewing itself — the earlier pre-expiry silent renewal and
      silent re-mint were removed because they were the popup source;
      (3) **24 h idle sign-out (owner
      rule)**: `syncInactiveTooLong` in meta.ts — when the last
      successful sync is >24 h old, auto-sync stands down (bootstrap
      gates before even loading the engine; the engine double-checks and
      drops the token) and status goes needs-reauth until an explicit
      interactive sync. Google-required sign-outs (revoked, signed out,
      cookie/popup blocking) still land in needs-reauth immediately —
      that residual is irreducible client-only, since refresh tokens
      would need a server.
    - **Trigger throttle (abuse guard)**: with sync firing on load,
      quiz start/finish, and route entry, `autoSync`/`manualSync` skip
      when the last sync SUCCEEDED within a cooldown
      (`AUTO_SYNC_COOLDOWN_MS` 30 s / `MANUAL_SYNC_COOLDOWN_MS` 5 s)
      AND local data is unchanged since (compared against the success
      snapshot). New local data always syncs immediately — quiz results
      are never delayed — and failures never start a cooldown, so
      recovery clicks always run. Click-mashing Sync Now or scripted
      route-remount loops collapse to zero Google requests; the
      single-flight + rerun-queue handles concurrency, and Drive-side
      rate limits still get the backoff ladder.

71. **Dialogs are left-aligned on every viewport + export asks first, 2026-07-11.**
    The shadcn `DialogHeader` default (`text-center sm:text-left`) centered
    every dialog title/description on phones while dialog bodies stayed
    left-aligned — reported twice (the OCR crop dialog, then the Drive
    connect dialog). Fixed at the source: the base class in
    `src/components/ui/dialog.tsx` is now `text-left` unconditionally, and
    the per-instance `text-left` overrides that patched around it (crop
    dialog header, the two parser opt-in descriptions) were removed. Don't
    reintroduce the responsive centering — it guarantees this bug returns
    in the next dialog. Same round: "Export Progress" no longer downloads
    on first click; it opens a confirmation dialog showing what's included
    (word/session counts) and the exact file name
    (`progressFileName()` in `transfer.ts`), matching the app's rule that
    anything leaving the browser (Drive connect, OCR/Smart-Parsing
    downloads, resets) is click-confirmed with the size/consequence
    visible.

72. **Offline access — opt-in whole-app precache, 2026-07-12.** Settings
    gains an "Offline access" section: one click downloads every
    same-origin file (~68 MB: app shell + all datasets incl. the Beyond
    tier and names, kuromoji, the OCR engine + models) into Cache
    Storage, and a service worker (`public/sw.js`) serves the app with
    no connection across tab closes and browser restarts.
    - **Opt-in only**: the worker is registered the moment the user
      clicks download, never before — users who don't enable it get no
      service worker, no cache, no behavior change at all. "Remove
      Offline Data" unregisters the worker and deletes the cache.
    - **Manifest** (`scripts/gen-offline-manifest.ts`, end of the build
      chain): the full dist file list + byte sizes + a version hash →
      `dist/offline-manifest.json`. Settings reads it to state the exact
      size up front, drive byte-accurate progress, and detect a stale
      copy after a deploy ("Update Offline Copy"; the old copy keeps
      working until then). Already available → the button is disabled
      (owner requirement).
    - **Worker strategy**: cross-origin requests are NEVER intercepted —
      Google sign-in, the Drive API, and translation keep their exact
      behavior, and the sync engine's own offline handling stays
      authoritative. `/assets/*` (content-hashed) are cache-first;
      everything else same-origin is network-first with cache fallback
      (online users always see the live version); SPA navigations fall
      back to the cached index.html. `/data|/kuromoji|/ocr` (stable
      names) are written through on successful fetches; index.html and
      the hashed assets are NOT — they only change together via the
      explicit update flow, so the snapshot can't tear.
    - **Torn-download safety**: index.html is written LAST
      (`downloadOrder`); a failed FIRST download rolls everything back,
      a failed update leaves the previous copy fully working. After a
      successful update, entries absent from the new manifest are
      pruned. `navigator.storage.persist()` is requested and its verdict
      shown honestly ("protected from automatic cleanup" vs the
      browser-may-evict caveat); a cache the browser cleared is detected
      on the settings page (`cacheIntact`) and offered for re-download.
    - **Cache matching gotcha (cost a debugging session)**: every
      `cache.match` uses `{ ignoreVary: true }`. Servers send
      `Vary: Origin`, and Vite's `crossorigin` module scripts send an
      `Origin` header while the precache's plain fetches don't — with
      default Vary matching every cached chunk MISSES offline and the
      app renders a blank shell. Each URL has exactly one entry, so
      Vary matching is pure downside here. Don't remove it.
    - **Quiz/sync edge cases verified end-to-end**: a full quiz session
      runs offline (all level data precached) and records to
      localStorage; the sync pill shows its normal offline/sign-in state
      without popups or crashes; back online, one Sync Now uploads the
      offline-made progress. Connecting Drive with the worker active is
      byte-identical to without (cross-origin passthrough).

73. **Sentence parser accepts Latin for IME/names, keeps it visible, but
    excludes it from analysis, 2026-07-14.** The JP textarea previously ran every
    controlled `onChange` through `stripNonJapanese`. Microsoft IME must first
    place Roman letters in that controlled value before converting them, so
    even the first `m` was replaced with an empty string; pasted Roman names
    were also removed from `?q=` before whole-sentence translation, changing
    the source sentence and producing inaccurate results. The responsibilities
    are now separate: `stripJapaneseInput` accepts the existing Japanese set
    plus ASCII/full-width A–Z for editing, URL state, and translation.
    `segmentMixedSentence` withholds each Latin run from the greedy/kuromoji
    callback, then reinserts it at the same position as `literal: 'latin'`.
    Those literals render as untagged gray context with a tooltip explaining
    "Latin characters" and "not analyzed"; because they carry no word, token,
    or compound metadata, they can never enter Beyond lookup or Words Found. A
    commit and palette handoff still require at least one kana/kanji character; pure
    Latin/digits/punctuation remain ineligible, romaji is not transliterated,
    and the full mixed value counts against the existing 120-character cap.
    EN→JP results keep Roman names in the displayed translation (`JaText`
    scopes mixed fonts) and the same display-only breakdown literals. Automatic
    Japanese OCR cleaning deliberately keeps dropping Latin page-label noise;
    restoring raw OCR via "Use as Input" uses the wider input filter. No new
    data, runtime request, provider, CSP origin, or tokenizer behavior.
    Verification: 404 unit tests; fresh Node Playwright against the production
    preview covered sequential IME-style letters, mixed palette/deep links,
    basic + Smart literal rendering/tag exclusion, EN→JP mixed display, and
    390/768 px `xxlarge` layouts with zero overflow, page errors, or console errors.

74. **PP-OCRv3 Mobile rejected as the browser OCR replacement,
    2026-07-19** (owner decision after research + grilling). Replacing
    `tesseract-wasm` is technically possible through PaddleOCR.js/ONNX, but
    PP-OCRv3 fails the agreed entry bar: its Japanese detector + recognizer
    archives are 12.27 MiB before the roughly 6.7 MB gzip browser runtime
    (current Japanese Tesseract first use is ~3.45 MB), and an exploratory
    paired corpus measured worse Japanese CER (24.324% vs 14.054%) and
    English CER (3.320% vs 0.830%). Both engines failed furigana; PP-OCRv3
    also regressed the mixed Japanese/English fixture to 38.5% CER while
    Tesseract was exact. The full sourced evidence and benchmark limitations
    live in `docs/ocr-ppocrv3-feasibility.md`.
    - Tesseract remains the production engine. PP-OCRv3 foundation work must
      not begin, and its "mobile" label is not evidence of a smaller browser
      payload.
    - Any future replacement must recognize mixed Japanese/English and
      materially improve furigana. Horizontal printed text, screenshots, and
      ordinary phone photos are in scope; whole-page vertical manga and
      handwriting remain out of scope for an engine-replacement benchmark.
    - Compatibility must preserve iOS Safari and Firefox. Single-threaded
      WASM is the floor; WebGPU may only be an optional acceleration path.
    - Default size gates are **≤4 MB first use** and **≤7.3 MB total offline
      OCR assets**. Exceeding either requires at least a **25% relative
      held-out CER reduction**, with no mixed-script or furigana regression.
    - After assets are available, the slowest supported phone must meet
      **≤3 s first scan** and **≤1 s warm-scan p95**, with inference off the
      main thread. Peak renderer memory may be at most **50 MB above the
      Tesseract baseline**, with zero crashes/OOMs across repeated scans and
      12 MP inputs after the existing 2,000 px downscale.
    - A disposable benchmark branch may temporarily carry both engines for
      paired measurement. Production ships only the winner—no duplicate
      fallback payload—and removes Tesseract only after every gate passes.

75. **Cropped vertical Japanese OCR uses explicit direction, geometry-aware
    `jpn_vert`, and an app-owned worker, 2026-08-09** (owner feature request and ship decision after research +
    grilling). This is one user-selected logical region per scan—a speech
    balloon or narration box—not automatic whole-page manga OCR. Multiple
    columns inside that crop are ordered right-to-left/top-to-bottom. Stylized
    sound effects, page/panel detection, and handwriting remain out of scope.
    - Japanese Scan Image now has a persistent Horizontal/Vertical selector on
      both the main surface and crop dialog. English remains horizontal-only.
      First use of Vertical has its own measured-download confirmation and
      lazily fetches official tessdata_fast `jpn_vert`; horizontal users pay no
      model cost. The 2,033,120-byte gzip is 1.94 MiB, 64,032 bytes below the
      agreed 2 MiB first-use ceiling, and adds 1.94 MiB to offline assets versus
      the 3 MiB ceiling. No OCR dependency or external endpoint was added.
    - The high-level `OCRClient` could not configure page segmentation. An
      app-owned module worker now wraps low-level `OCREngine`, loads the same
      pinned runtime/WASM, and sets `tessedit_pageseg_mode` after every
      `loadImage` because that call resets it. Cropped Text Block (the default)
      is geometry-aware: a very tall single column (height at least 4Ã— width)
      remains upright with native vertical-block PSM 5, while wider regions
      rotate counter-clockwise for PSM 6. Automatic maps to PSM 3 after the
      same rotation used by the wider path.
      Those curated Advanced Settings persist only for the current image and
      its rescans. Direction remains outside the disclosure and persists across
      restarts.
    - Vertical parser input uses returned line boxes to order columns and drops
      only small adjacent overlapping lines that look like furigana. Raw engine
      text remains available under Review last scan. These are heuristics, not
      a manga layout engine; the README carries the limitation instead of adding
      recurring UI warnings.
    - `ImageData` must be structured-cloned into the worker, matching the old
      client. An attempted transferable backing buffer preserved dimensions but
      corrupted pixels in Chromium: clean horizontal text and manga text both
      became plausible-looking nonsense. That false path also produced a 3.33 s
      benchmark and triggered the pre-agreed performance pause; the owner chose
      to ship, then final regression verification found and removed the transfer.
      Do not "optimize" this copy without a paired exact-recognition fixture.
    - The corrected functional/accuracy floor passed: the official model loads,
      worker scans do not crash, the original clean two-column fixture produced
      exact parser text (`今日は良い天気漫画を読みます`), the owner's tightly
      cropped narration box produced its expected two columns in order, and the
      horizontal fixture remained exact. The copyrighted supplied page remains
      local and uncommitted; the tiny synthetic corpus is not evidence of broad
      manga accuracy, hence the README limitation remains.
    - Corrected production-preview timing on the clean two-column fixture was
      0.435 s cold and 0.339 s warm on the desktop browser, both below the 3 s / 1 s
      ceilings. The slowest supported phone and 4× CPU p95 were not available in
      this browser harness, so mobile certification is not claimed. Treat the
      small corpus and variable real-world OCR accuracy as accepted limitations,
      not evidence that whole-page manga OCR is supported.
    - A reported isolated-column failure returned plausible but unrelated text
      even though the preview was clear. A deterministic production-preview
      repro found that blanket rotation + PSM 6 was the cause: padding,
      automatic layout, 2Ã—/3Ã— scaling, and rotated single-line PSM 7 did not
      recover the crop. Native upright PSM 5 read the reported column exactly,
      but applying it globally regressed one character in the wider two-column
      narration. `getOcrScanPlan` therefore selects the native path only for the
      narrow geometry and preserves the established rotated path elsewhere.
      The reported column, full narration, and synthetic two-column fixture all
      then produced exact raw and parser text. The narrow fresh-context scan was
      0.570 s in the desktop production preview; no asset or dependency changed.
    - A later reported two-column speech-bubble crop failed for a separate
      reason: the higher-resolution input included generous white space, a
      bubble outline connected to the crop edge, and small screentone clusters.
      The existing rotated PSM 6 returned only a fragment; forcing native PSM 5
      returned nothing. Tightening the same source crop recovered the complete
      `君のことが好きみたいなんだ`, proving margin segmentation, not the
      `jpn_vert` model or reading-order filter, was the failing boundary.
      Vertical Cropped Text Blocks at least 2.5 times as tall as wide now derive
      padded bounds from substantial dark components when the center is
      predominantly light; edge-connected outlines and tiny screentone/dust
      components are ignored.
      Wider blocks and dark/ambiguous regions bypass preprocessing so the known
      wider path is not changed. Two exact runs of the reported bubble plus the
      isolated-column and clean synthetic two-column fixtures passed at
      0.620-0.649 s. There is no new request/model/dependency; the lazy OcrPanel
      grew 0.78 kB gzip, within the existing payload gates.
    - Final 390 px verification with all three font-size settings at Largest
      exposed a pre-existing 4 px header overflow: rem-scaled phone padding plus
      the icon controls exceeded the scrollbar-adjusted viewport. The phone
      header now uses the existing `px-4` spacing at every breakpoint; 390 and
      768 px checks report document width no greater than viewport width.

## Known limitations / accepted trade-offs

- **Beyond browsing is capped**: only the top 1,000 extended matches render
  per query (note shown in the UI). Browsing all 204k alphabetically past
  the cap isn't possible — search is the intended path. Raising the cap is
  a perf decision, not a bug fix.
- Extended list rows are "lite": no examples/senses until the detail page
  loads the shard; whole-word ruby from `pairFurigana` instead of
  JmdictFurigana segmentation. Extended entries have `romaji: ''` — romaji
  queries still work via kana conversion.
- Names have **no detail pages** (a row shows everything JMnedict knows)
  and match by prefix only, on the first character's bucket.
- **Kanji JLPT levels are community estimates on the modern 5-level
  scale** (like the word lists — no official lists exist post-2010).
  KANJIDIC2's own `jlpt` field is the pre-2010 four-level scale and must
  never be shipped directly (see decision 30 — it mislabeled every level
  once).
- Quizzes deliberately exclude the Beyond tier.
- **Sentence parser accuracy is bounded by design**: the default engine is
  greedy dictionary matching (JLPT words only; the page's "Important
  Notice" accordion discloses it); smart mode is kuromoji + heuristic linking — homographs resolve
  by kuromoji's reading where available (decision 32) and by frequency
  otherwise, and the reading fallback can in principle link a same-reading
  homophone. Word-by-word breakdowns of incoherent input stay unreliable
  in both engines — that's disclosed, not fixable at this scope.
- Archaic verb classes (二段/四段, vs-s, vz…) are vocab entries
  (`pos: 'verb'`, badge "Verb (archaic)") — the engine doesn't conjugate
  them.
- The names/extended data is one row per entry using the **primary**
  kanji/kana form; alternate spellings of a name are separate JMnedict
  entries or dropped variants.
- Git history was **rewritten once** (before anything was pushed) to squash
  the two full-coverage data commits: the intermediate ~145 MB of
  uncompressed `public/data/*.json` never existed in the surviving history,
  so clones stay small. Those files were generated artifacts — fully
  reproducible with `bun run data:download && bun run data:build` — which is
  why dropping them was safe. Commit hashes quoted in notes written before
  the rewrite no longer resolve.
- The production build was profiled once (decision 28: CDP wire bytes +
  long-task observer per page/action); re-run that methodology after big
  data or route changes rather than trusting dev-server numbers.

## Planned / discussed but not built

- **Jreibun example sentences** once their dataset is published.

## Where the authoritative statements live

- Product scope: the README feature list plus this file — the founding
  spec was the owner's original project brief and was never committed.
- Licensing text shown to users: `src/routes/about.tsx`; repo licences:
  `LICENSE` (code, MIT) + `LICENSE-DATA.md` (per-directory data licences).
- Dataset counts/dates: `src/data/meta.json` (generated).
- The owner's standing preferences that outlive any one feature: this file
  and the "User-set conventions" list above.
