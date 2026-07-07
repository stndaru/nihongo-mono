# nihongo mono（日本語 mono）

A fast, lightweight Japanese verb dictionary and conjugation trainer.
No login, no server — your study progress lives in your browser and can be
exported as a file.

**Features**

- **Verb list** — 2,800+ JLPT-tagged verbs in a dense, spreadsheet-style table.
  Search by kanji, kana, romaji, or English; filter by level, verb class
  (godan/ichidan/する/来る), る-ending, transitivity, and commonness. The
  "Beyond" level adds every other conjugatable JMdict verb (23,000+).
- **Verb detail** — every conjugation (22 forms, computed at runtime), with
  per-form "how to build it" rule cards, example sentences, and a kanji
  breakdown.
- **Conjugation quiz** — pick levels, forms, verb types, session length, and
  answer mode: typed input (romaji auto-converts to kana via wanakana) and/or
  multiple choice. Instant feedback with the conjugation rule for that verb
  class. Least-practiced verbs appear more often.
- **Vocabulary** — 6,800+ JLPT-tagged words (nouns, adjectives, adverbs,
  expressions…) with meanings, examples, antonym pairs, and adjective
  inflections; the "Beyond" level extends the list to the full JMdict
  (204,000+ entries).
- **Proper names** — prefix search over all 743,000+ JMnedict (ENAMDICT)
  surnames, given names, places, companies, and other proper nouns.
- **Progress** — day streak, accuracy, and per-verb stats in localStorage;
  export/import as JSON (merge or replace) to move between browsers.

> **Contributing or taking over?** Start with the handover docs in
> [`docs/`](docs/README.md) — architecture, data pipeline, development
> workflow, and the decision/caveat history.

## Stack

React 19 · TanStack Router (file-based, per-route code splitting) ·
Tailwind CSS v4 · shadcn/ui · Anime.js v4 (animations capped at 150 ms) ·
wanakana · Vite 8 · Bun.

## Development

```bash
bun install
bun run dev        # dev server
bun run test       # conjugation engine + streak unit tests (vitest)
bun run lint       # oxlint
bun run build      # production build (vite build && tsc -b)
```

## Data pipeline

Word and kanji data are generated JSON in two tiers. The JLPT tier is
committed under `src/data/`, one pretty-printed (hand-editable) file per
level, bundled per level so the app only downloads what you browse. The
extended tier — every remaining JMdict entry plus all JMnedict names — is
too large to bundle, so it's written pre-gzipped under `public/data/`
(compact search indexes plus id-sharded detail files, `.json.gz` inflated
in the browser via `DecompressionStream`) and fetched on demand. Search
over the extended index runs on the raw rows and only materializes the
matches it shows, so enabling "Beyond" stays responsive.

```bash
bun run data:download   # fetch JMdict, JMnedict, KANJIDIC2, JmdictFurigana, JLPT lists → scripts/.cache/
bun run data:build      # regenerate src/data/ (JLPT tier) and public/data/ (extended tier + names)
```

The build is idempotent and writes review logs (`furigana-misses.txt`,
`unmatched-verbish.txt`, `skipped-classes.txt`) into `scripts/.cache/`.
Generated JSON is pretty-printed and hand-editable; edits persist until the
next regeneration.

Sources: [JMdict](https://www.edrdg.org/jmdict/j_jmdict.html),
[JMnedict/ENAMDICT](https://www.edrdg.org/enamdict/enamdict_doc.html) &
[KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project) via
[jmdict-simplified](https://github.com/scriptin/jmdict-simplified) (EDRDG
licence), [JmdictFurigana](https://github.com/Doublevil/JmdictFurigana),
Tanaka Corpus/[Tatoeba](https://tatoeba.org/) examples (CC BY 2.0 FR), and
community JLPT lists ([elzup/jlpt-word-list](https://github.com/elzup/jlpt-word-list),
based on Jonathan Waller's lists, CC BY). Full attribution is on the app's
About page.

## Deploying

Static hosting only — build and serve `dist/`. SPA fallback rewrites for deep
links are included for Netlify (`public/_redirects`) and Vercel
(`vercel.json`); on other hosts, rewrite all paths to `/index.html`.
