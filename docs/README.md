# nihongo mono — developer handover docs

This folder is the onboarding path for a new developer (human or AI) taking
over the project. Read in this order:

| Doc | What it covers |
| --- | --- |
| [architecture.md](architecture.md) | Stack, routing, the two-tier data model, search/perf design, typography & theming |
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
  inflections, kanji breakdowns.
- **No backend**: static hosting only. All user progress lives in
  `localStorage` with file export/import. All dictionary data is generated
  JSON committed to the repo.
- **Coverage**: JLPT-tagged core (bundled) + the *entire* JMdict and
  JMnedict as an opt-in extended tier (fetched on demand) — see
  architecture.md, this split is the most important design in the app.

## Route map (all under TanStack Router file-based routing, `src/routes/`)

| Route | Purpose |
| --- | --- |
| `/` | Dashboard: streak, accuracy, recent sessions |
| `/verbs` | Verb list — levels N5–N1 + "Beyond", class/ending/transitivity/common filters |
| `/verbs/$verbId` | Verb detail: meanings accordion, example sentences, full conjugation table with rule cards, kanji breakdown |
| `/vocab` | Vocabulary list — same level model, 14 part-of-speech filters |
| `/vocab/$wordId` | Word detail: meanings, examples, adjective inflections, antonyms/see-also, kanji |
| `/vocab/antonyms` | Side-by-side adjective antonym table (strictly adjectives — user requirement) |
| `/names` | Prefix search over 743k JMnedict proper names |
| `/quiz` → `/quiz/session` | Conjugation quiz and vocabulary quiz (JLPT levels only, by design) |
| `/settings` | Theme, font toggles, progress export/import/reset |
| `/about` | **Required** data-source attribution (EDRDG licence obligation) |

## The one-paragraph mental model

JLPT-listed words (~9.6k) are the curated learning core: rich, pretty-printed
JSON under `src/data/`, bundled per level by Vite. Everything else — ~228k
more JMdict entries and 743k names — lives pre-gzipped under `public/data/`
and is fetched only when the user opts in (the "Beyond" level chip or the
Names page). Extended data is searched as **raw tuple rows** and only the
top matches are ever turned into objects; materializing the whole index
froze the tab once already (see decisions-and-caveats.md). Conjugations and
adjective inflections are never stored — they're computed from the entry's
class by `src/lib/conjugation/` at render time.
