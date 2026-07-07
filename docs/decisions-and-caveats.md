# Decisions, caveats, and project history

A record of *why* things are the way they are. The owner gave direct
feedback on many of these — treat them as requirements, not suggestions.

## User-set conventions (do not regress)

- **Bun over npm**, everywhere. (The very first infrastructure correction.)
- **Serif by default for everything**, with Settings toggles to switch
  Japanese glyphs and Latin text to sans independently. Light mode is the
  default theme.
- **Title Case** on buttons and short UI labels ("Show More", "Common Only").
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
- Navigation: **Names lives under the Vocab dropdown** (not top-level);
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
- Quizzes deliberately exclude the Beyond tier.
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
- `performance.memory`-style dev measurements were taken on the dev server;
  production is lighter but hasn't been profiled separately.

## Planned / discussed but not built

- **Kanji detail pages** (`/kanji/$char`): `KanjiBreakdown` has a comment
  marking where cards become links; KanjiVG is the planned stroke-order
  source (already listed on the About page). `kanji.json` already contains
  all 10,384 KANJIDIC2 entries, so the data is ready.
- **Jreibun example sentences** once their dataset is published.

## Where the authoritative statements live

- Product scope: `Specification.md` (repo root).
- Licensing text shown to users: `src/routes/about.tsx`.
- Dataset counts/dates: `src/data/meta.json` (generated).
- The owner's standing preferences that outlive any one feature: this file
  and the "User-set conventions" list above.
