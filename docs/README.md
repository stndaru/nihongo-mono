# nihongo mono — developer handover docs

This folder is the onboarding path for a new developer (human or AI) taking
over the project. Read in this order:

| Doc | What it covers |
| --- | --- |
| [architecture.md](architecture.md) | Stack, routing, the two-tier data model, search/deconjugation/palette, quiz session rules & UI, app shell/navigation, theming & branding, localStorage keys |
| [data-pipeline.md](data-pipeline.md) | Every data source, the build scripts, file formats, licensing obligations, how to regenerate |
| [development.md](development.md) | Commands, environment quirks (Bun, Windows, Playwright), testing, the browser-verification workflow |
| [decisions-and-caveats.md](decisions-and-caveats.md) | Why things are the way they are: user-set conventions, bugs already fixed once (don't reintroduce them), known limitations, planned work |

## What this project is

A **lightweight, no-login Japanese learning web app** — a fast dictionary +
trainer, not a SaaS. The product spec lives in `Specification.md` at the
repo root; it predates everything and still governs scope. Core ideas:

- **Dictionary-like density**: high-density lists, everything searchable and
  filterable (kanji / kana / romaji / English), furigana everywhere.
- **Learning features**: verb conjugation tables (computed at runtime, never
  stored), conjugation & vocabulary quizzes, antonym pairs, adjective
  inflections, kanji pages with KanjiVG stroke-order frames, and a progress
  analytics page (per-word encounters/accuracy/status, per-form accuracy,
  session trend).
- **No backend**: static hosting only (the owner deploys with
  `bun run start-vps`). All user progress lives in `localStorage` with file
  export/import. All dictionary data is generated JSON committed to the repo.
- **Coverage**: JLPT-tagged core + the *entire* JMdict and JMnedict as an
  opt-in extended tier — all served as pre-gzipped static files, fetched on
  demand — see architecture.md, this split is the most important design in
  the app.
- **Search everywhere**: list pages, and a Ctrl/Cmd+K command palette
  (header button on desktop, floating button on phones). Queries match
  kanji/kana/romaji/English and **conjugated forms** ("tabeta" → 食べる).

## Route map (all under TanStack Router file-based routing, `src/routes/`)

| Route | Purpose |
| --- | --- |
| `/` | Dashboard: streak, accuracy, recent sessions (the stat cards deep-link into `/progress` sections) |
| `/verbs` | Verb list — levels N5–N1 + "Beyond", class/ending/transitivity/common filters |
| `/verbs/$verbId` | Verb detail: meanings accordion, example sentences, full conjugation table with rule cards, kanji breakdown |
| `/vocab` | Vocabulary list — same level model, 14 part-of-speech filters |
| `/vocab/$wordId` | Word detail: meanings, examples, adjective inflections, antonyms/see-also, kanji |
| `/vocab/antonyms` | Side-by-side adjective antonym table (strictly adjectives — user requirement) |
| `/names` | Prefix search over 743k JMnedict proper names (reached via the Vocab dropdown) |
| `/parser` | Sentence parser: paste kana/kanji text (≤100 chars), get a clickable word-by-word breakdown with tooltips; greedy matching by default, opt-in kuromoji "Accurate Parsing" (~17 MB, confirm-gated); carries an accuracy caveat |
| `/kanji` | Kanji table — old-scale JLPT levels N4–N1 + "Beyond", searchable by character, reading, or meaning |
| `/kanji/$char` | Kanji detail: readings, meanings, grade/frequency, KanjiVG stroke-order frames, KRADFILE component cards, every JLPT word using the character |
| `/quiz` → `/quiz/session`, `/quiz/vocab` → `/quiz/vocab/session` | Conjugation quiz and vocabulary quiz (JLPT levels only, by design; vocab quiz can include dictionary-form verbs). Sessions have furigana/word-info toggles, an Exit control, and a leave-confirmation guard |
| `/progress` | Learning analytics: per-word encounters/accuracy/status (weak → solid), per-conjugation-form accuracy, session accuracy trend, sortable weakest-first word table |
| `/settings` | Theme, font toggles, progress export/import/reset |
| `/about` | **Required** data-source attribution (EDRDG licence obligation) |

Navigation: desktop header (Vocab dropdown holds All Vocabulary / Antonyms /
Proper Names; Kanji, Quiz, Progress follow; Settings is the gear icon at far
right); phones get a burger side-drawer and a floating search button. Detail
pages have a back control that returns to the exact previous page (or the
section's table when opened directly / in a new tab).

## The one-paragraph mental model

JLPT-listed words (~9.6k) are the curated learning core: rich,
pretty-printed JSON under `src/data/` (the hand-editable source of truth),
packed by `bun run data:pack` into `public/data/jlpt/*.json.gz` — which is
what the app fetches per level. Everything else — ~228k more JMdict entries
and 743k names — also lives pre-gzipped under `public/data/` and is fetched
only when the user opts in (the "Beyond" level chip, the Names page, or the
palette's "Include Full Dictionary"). Nothing bulky goes through the JS
module graph (that once produced a 230 MB dev page). Extended data is
searched as **raw tuple rows** and only the top matches are ever turned
into objects; materializing the whole index froze the tab once already
(see decisions-and-caveats.md). Kanji follows the same split — a ~127 KB
core file plus rare-character shards, with KanjiVG stroke paths in their
own per-codepoint shards fetched one-per-displayed-kanji. Conjugations and
adjective inflections are never stored — they're computed from the entry's
class by `src/lib/conjugation/` at render time, and search deconjugates
queries ("tabeta" finds 食べる) instead of indexing conjugated forms.
