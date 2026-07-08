# nihongo mono — developer handover docs

This folder is the onboarding path for a new developer (human or AI) taking
over the project. The condensed per-feature operating checklist (gates,
verification, doc updates, performance rules) is [`AGENTS.md`](../AGENTS.md)
at the repo root. Read in this order:

| Doc | What it covers |
| --- | --- |
| [architecture.md](architecture.md) | Stack, routing, the two-tier data model (words, kanji, strokes), search/deconjugation/palette, the sentence parser (greedy + kuromoji Smart Parsing + auto translation), quiz session rules & UI, progress analytics, kanji pages, app shell/navigation, theming & branding, localStorage keys |
| [data-pipeline.md](data-pipeline.md) | Every data source, the build scripts, file formats, licensing obligations, how to regenerate |
| [development.md](development.md) | Commands, environment quirks (Bun, Windows, Playwright), testing, the browser-verification workflow |
| [decisions-and-caveats.md](decisions-and-caveats.md) | Why things are the way they are: user-set conventions, bugs already fixed once (don't reintroduce them), known limitations, planned work |
| [performance-report.md](performance-report.md) | Dated, measured proof of lightweightness: per-action wire bytes across a 38-action full-feature tour, worst-case spikes, heap/RAM, long tasks — re-measure and update after big data or route changes |

## What this project is

A **lightweight, no-login Japanese learning web app** — a fast dictionary +
trainer, not a SaaS. The founding spec was the owner's original project
brief (never committed); scope is captured by the README feature list and
the decision log. Core ideas:

- **Dictionary-like density**: high-density lists, everything searchable and
  filterable (kanji / kana / romaji / English), furigana everywhere.
- **Learning features**: verb conjugation tables (computed at runtime, never
  stored), conjugation & vocabulary quizzes, antonym pairs, adjective
  inflections, kanji pages with KanjiVG stroke-order frames, a sentence
  parser (greedy by default, opt-in kuromoji "Smart Parsing", automatic
  English translation of the parsed sentence), a progress
  analytics page (per-word encounters/accuracy/status, per-form accuracy,
  session trend), an in-app cheatsheet section (currently the Japanese
  verb summary), and a curated external-resources page.
- **No backend**: static hosting only (the owner deploys with
  `bun run start-vps`). All user progress lives in `localStorage` with file
  export/import. All dictionary data is generated JSON committed to the repo.
  The one runtime third-party call is the parser's sentence translation
  (Google gtx → MyMemory, decision 42) — it degrades to an external link
  when unreachable.
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
| `/` | Dashboard: streak, accuracy, recent sessions (the stat cards deep-link into `/progress` sections), plus quick-access shortcut cards — Essentials (Dictionary, Kanji) first, then the navbar's Tools and Language menus |
| `/cheatsheet` | In-app cheatsheet list (Resources-style cards) — currently the Japanese Verb Summary |
| `/cheatsheet/verbs` | The verb-type cheatsheet (godan/ichidan/irregular: what they are, how to spot them incl. the る-trap list, key conjugations) plus a per-form "How to Build Each Conjugation" accordion guide (all 22 forms × 4 verb types, rule + example each, from the shared `getRule()` cards) — used to live on the homepage |
| `/dictionary` | Combined dictionary — every JLPT verb + vocabulary word in one table (+ Beyond on demand). Two-layer filters: word types (Verb/Noun/Adjective/Adverb/Other) + Level always visible; contextual sub-filters (verb class/ending/transitivity, い/な adjectives) and Common Only behind a "More Filters" toggle |
| `/verbs` | Verb Vocabulary list — levels N5–N1 + "Beyond", class/ending/transitivity/common filters |
| `/verbs/$verbId` | Verb detail: meanings accordion, example sentences, full conjugation table with rule cards, kanji breakdown |
| `/vocab` | Non-Verb Vocabulary list — same level model, 14 part-of-speech filters (renamed from "Vocabulary" to avoid confusion with the combined Dictionary) |
| `/vocab/$wordId` | Word detail: meanings, examples, adjective inflections, antonyms/see-also, kanji |
| `/vocab/antonyms` | Side-by-side adjective antonym table (strictly adjectives — user requirement) |
| `/names` | Prefix search over 743k JMnedict proper names (reached via the Language dropdown) |
| `/parser` | Sentence parser: paste kana/kanji text (≤100 chars) for a word-by-word breakdown. Greedy matching by default; confirm-gated "Smart Parsing" opt-in (~17 MB kuromoji) adds furigana, POS-colored underlines, Beyond-tier links, and a reading fallback for variant spellings. Clicking a word opens a summary popup (detail pages open in a new tab); carries an accuracy caveat. An async English translation section loads alongside the breakdown (Google → MyMemory → external-link fallback) |
| `/kanji` | Kanji table — modern JLPT levels N5–N1 + "Beyond", searchable by character, reading, or meaning |
| `/kanji/$char` | Kanji detail: readings, meanings, grade/frequency, KanjiVG stroke-order frames, KRADFILE component cards, every JLPT word using the character — plus a "Load All Words" button that extends the list to the full dictionary (Beyond tier) |
| `/quiz` → `/quiz/session`, `/quiz/vocab` → `/quiz/vocab/session` | Conjugation quiz (optional randomized shown form) and vocabulary quiz (three answer modes incl. EN→JA word pick; can include dictionary-form verbs; JLPT levels only, by design). Sessions have furigana/word-info toggles, word-summary popups in feedback, an Exit control, and a leave-confirmation guard |
| `/progress` | Learning analytics: per-word encounters/accuracy/status (weak → solid), per-conjugation-form accuracy, session accuracy trend, sortable weakest-first word table |
| `/resources` | Hand-picked external learning sites (dictionaries, grammar guides, JLPT practice) — name, description, outbound link per card |
| `/settings` | Theme, font toggles, font sizes (global / kanji & kana / furigana, Default–Largest each), progress export/import/reset |
| `/about` | **Required** data-source attribution (EDRDG licence obligation) |

Navigation: desktop header is Home · Dictionary · Kanji · **Language**
(Linear-style dropdown: Verb Vocabulary / Non-Verb Vocabulary / Antonyms /
Proper Names / Cheatsheet / Resources, each with a one-line description) ·
**Tools** (Sentence Parser / Quiz / Progress); Settings is the gear icon
at far right. The homepage repeats both menus as quick-access shortcut cards. Phones get a burger
side-drawer (Essentials — Dictionary + Kanji, grouped only on mobile —
plus the same Language/Tools sections) and a floating search button.
Detail pages have a back control that returns to the exact previous page
(or the section's table when opened directly / in a new tab).

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
core file plus rare-character shards, a precomputed per-kanji word index
(so detail pages never refetch the level files), and KanjiVG stroke paths
in their own per-codepoint shards fetched one-per-displayed-kanji. Conjugations and
adjective inflections are never stored — they're computed from the entry's
class by `src/lib/conjugation/` at render time, and search deconjugates
queries ("tabeta" finds 食べる) instead of indexing conjugated forms.
