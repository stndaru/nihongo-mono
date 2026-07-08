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
  greedy dictionary matching (JLPT words only, honest caveat box on the
  page); smart mode is kuromoji + heuristic linking — homographs resolve
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

- Product scope: `Specification.md` (repo root).
- Licensing text shown to users: `src/routes/about.tsx`; repo licences:
  `LICENSE` (code, MIT) + `LICENSE-DATA.md` (per-directory data licences).
- Dataset counts/dates: `src/data/meta.json` (generated).
- The owner's standing preferences that outlive any one feature: this file
  and the "User-set conventions" list above.
