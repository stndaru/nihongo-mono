# nihongo mono（日本語 mono）

A fast, lightweight Japanese verb dictionary and conjugation trainer.
No login, no server — your study progress lives in your browser and can be
exported as a file.

**Features**

- **Dictionary** — every verb and vocabulary word in one combined table,
  with layered filters: word type (verb/noun/adjective/adverb/other) and
  JLPT level up front, contextual sub-filters (verb class, ending,
  transitivity; い/な adjectives) behind a "More Filters" toggle, and the
  full JMdict via the "Beyond" level.
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
- **Kanji** — a browsable table (JLPT levels + "Beyond", 10,000+ KANJIDIC2
  characters) and detail pages with on/kun readings, KRADFILE radical
  breakdown, KanjiVG stroke-order frames, grade/frequency info, and every
  JLPT word that uses the character — expandable to every full-dictionary
  word with "Load All Words".
- **Search everywhere** — a Ctrl/Cmd+K command palette plus per-page search;
  queries match kanji, kana, romaji, English, and **conjugated forms**
  ("tabeta" finds 食べる).
- **Sentence parser** — paste a Japanese sentence (kana/kanji, up to 100
  characters) and get a clickable word-by-word breakdown: conjugated verbs
  identified with their exact form, hover tooltips, and a summary popup per
  word (meanings, conjugation + dictionary form, the kanji used, detail
  page in a new tab). Heuristic dictionary matching by default (honest
  accuracy caveat); an opt-in **Smart Parsing** mode downloads the kuromoji
  morphological analyzer (~17 MB one-time, confirm-gated) for
  analyzer-grade segmentation, furigana on every word, POS-colored
  underlines, links to full-dictionary entries beyond the JLPT lists
  (marked "Beyond"), and reading-based matching of variant kanji spellings
  (温かい finds the 暖かい entry). Every example sentence in the app links
  into the parser (small icon, opens a new tab).
- **Verb-type cheatsheet** — the homepage carries a skimmable summary of
  the three verb types (godan/ichidan/する・来る): how to spot each
  (including the 帰る/走る ichidan-lookalike trap list) and how each
  conjugates, with a side-by-side form table.
- **Progress** — day streak, accuracy, and per-word stats in localStorage,
  with a dedicated analytics page: encounters and accuracy per word,
  weak/learning/solid status, per-conjugation-form accuracy, and a session
  trend chart. Export/import as JSON (merge or replace) to move between
  browsers.

> **Contributing or taking over?** Start with the handover docs in
> [`docs/`](docs/README.md) — architecture, data pipeline, development
> workflow, and the decision/caveat history.

## Stack

React 19 · TanStack Router (file-based, per-route code splitting) ·
Tailwind CSS v4 · shadcn/ui · Anime.js v4 (animations capped at 150 ms) ·
wanakana · kuromoji (build-time furigana + the parser's lazy-loaded Smart
Parsing mode) · Vite 8 · Bun.

## Development

```bash
bun install
bun run dev        # dev server (first copies the kuromoji dict into public/)
bun run test       # unit tests: conjugation, deconjugation, quiz rules, progress store, sentence parser (vitest)
bun run lint       # oxlint
bun run build      # production build (vite build && tsc -b)
```

## Data pipeline

Word and kanji data are generated JSON in two tiers. The JLPT tier is
committed under `src/data/`, one pretty-printed (hand-editable) file per
level; `bun run data:pack` gzips it into `public/data/jlpt/`, which is what
the app fetches per level — so it only downloads what you browse, and the
multi-MB JSON stays out of the JS bundle. The extended tier — every
remaining JMdict entry plus all JMnedict names — is also served pre-gzipped
under `public/data/` (compact search indexes plus id-sharded detail files,
`.json.gz` inflated in the browser via `DecompressionStream`) and fetched
on demand. Search over the extended index runs on the raw rows and only
materializes the matches it shows, so enabling "Beyond" stays responsive.

```bash
bun run data:download   # fetch JMdict, JMnedict, KANJIDIC2, KRADFILE, JmdictFurigana, KanjiVG, JLPT lists → scripts/.cache/
bun run data:build      # regenerate src/data/ (JLPT tier) and public/data/ (runtime tiers)
bun run data:pack       # re-gzip src/data into public/data/jlpt after hand edits
```

The build is idempotent and writes review logs (`furigana-misses.txt`,
`unmatched-verbish.txt`, `skipped-classes.txt`) into `scripts/.cache/`.
Generated JSON is pretty-printed and hand-editable; edits persist until the
next regeneration.

Sources: [JMdict](https://www.edrdg.org/jmdict/j_jmdict.html),
[JMnedict/ENAMDICT](https://www.edrdg.org/enamdict/enamdict_doc.html) &
[KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project) via
[jmdict-simplified](https://github.com/scriptin/jmdict-simplified) (EDRDG
licence), [KRADFILE](https://www.edrdg.org/krad/kradinf.html) (EDRDG),
[JmdictFurigana](https://github.com/Doublevil/JmdictFurigana),
[KanjiVG](https://kanjivg.tagaini.net/) stroke-order data (CC BY-SA 3.0),
Tanaka Corpus/[Tatoeba](https://tatoeba.org/) examples (CC BY 2.0 FR), and
community JLPT lists
([stephenmk/yomitan-jlpt-vocab](https://github.com/stephenmk/yomitan-jlpt-vocab),
[elzup/jlpt-word-list](https://github.com/elzup/jlpt-word-list), based on
Jonathan Waller's lists, CC BY). Full attribution is on the app's About
page.

## Deploying

Static hosting only — build and serve `dist/`. SPA fallback rewrites for deep
links are included for Netlify (`public/_redirects`) and Vercel
(`vercel.json`); on other hosts, rewrite all paths to `/index.html`.

## Licence

The **source code** is [MIT](LICENSE). The **generated dictionary data**
(under `src/data/` and `public/data/`) remains under its sources' licences —
CC BY-SA 4.0 (EDRDG licence) for the JMdict/JMnedict/KANJIDIC2/KRADFILE-derived
files and CC BY-SA 3.0 for the KanjiVG-derived stroke data, with CC BY
content (Tatoeba sentences, JLPT tags) embedded. Deployments also serve the
kuromoji IPADIC dictionary (for the parser's Smart Parsing mode) — its
licence notice ships alongside it at `public/kuromoji/NOTICE.md`.
Per-directory breakdown in [LICENSE-DATA.md](LICENSE-DATA.md); user-facing
attribution on the app's About page. All runtime and build dependencies are
permissively licensed (MIT/ISC/Apache-2.0), so nothing in the stack
conflicts with this split.
