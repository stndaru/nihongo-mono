# nihongo mono（日本語 mono）

A fast, lightweight Japanese verb dictionary and conjugation trainer.
No login, no server — your study progress lives in your browser and can be
exported as a file.

**Features**

- **Verb list** — 2,700+ JLPT-tagged verbs in a dense, spreadsheet-style table.
  Search by kanji, kana, romaji, or English; filter by level, verb class
  (godan/ichidan/する/来る), る-ending, transitivity, and commonness.
- **Verb detail** — every conjugation (22 forms, computed at runtime), with
  per-form "how to build it" rule cards, example sentences, and a kanji
  breakdown.
- **Conjugation quiz** — pick levels, forms, verb types, session length, and
  answer mode: typed input (romaji auto-converts to kana via wanakana) and/or
  multiple choice. Instant feedback with the conjugation rule for that verb
  class. Least-practiced verbs appear more often.
- **Progress** — day streak, accuracy, and per-verb stats in localStorage;
  export/import as JSON (merge or replace) to move between browsers.

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

Verb and kanji data are generated JSON committed under `src/data/`, one file
per JLPT level so the app only downloads the levels you browse.

```bash
bun run data:download   # fetch JMdict, KANJIDIC2, JmdictFurigana, JLPT lists → scripts/.cache/
bun run data:build      # regenerate src/data/verbs/n*.json, kanji/kanji.json, meta.json
```

The build is idempotent and writes review logs (`furigana-misses.txt`,
`unmatched-verbish.txt`, `skipped-classes.txt`) into `scripts/.cache/`.
Generated JSON is pretty-printed and hand-editable; edits persist until the
next regeneration.

Sources: [JMdict](https://www.edrdg.org/jmdict/j_jmdict.html) &
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
