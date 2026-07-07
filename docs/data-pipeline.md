# Data pipeline

Everything under `src/data/` and `public/data/` is generated. Never edit
`public/data/` by hand (it's minified+gzipped bulk); `src/data/` is
pretty-printed and *may* be hand-edited, but edits are lost on the next
rebuild — durable fixes belong in the curated override files (below) or the
scripts.

## Commands

```bash
bun run data:download   # fetch all sources → scripts/.cache/ (gitignored, idempotent, --force to refetch)
bun run data:build      # build-verbs → build-vocab → build-kanji → build-extended → build-names
```

Order matters: `build-extended.ts` reads the generated JLPT files to know
which ids are already covered, and `build-kanji.ts` reads them for a
coverage warning. Each script also updates `src/data/meta.json` (dataset
date, source versions, counts — surfaced on the About page).

## Sources (and why each exists)

| Source | Cache file | Used for |
| --- | --- | --- |
| [jmdict-simplified](https://github.com/scriptin/jmdict-simplified) releases, **`jmdict-examples-eng` variant** | `jmdict.json` (~122 MB) | All word entries. The examples variant embeds Tanaka Corpus/Tatoeba example sentences per sense — that's where every example sentence comes from |
| same releases, `jmnedict-all` | `jmnedict.json` | 743k proper names (JMnedict is the XML-era successor of ENAMDICT) |
| same releases, `kanjidic2-en` | `kanjidic2.json` | Kanji meanings/readings/strokes/grade/freq — **all** entries ship (10,384) so extended words get breakdowns |
| [JmdictFurigana](https://github.com/Doublevil/JmdictFurigana) | `furigana.json` | Per-character ruby segmentation keyed `(text\|reading)`. File starts with a UTF-8 BOM — the loader strips it |
| [stephenmk/yomitan-jlpt-vocab](https://github.com/stephenmk/yomitan-jlpt-vocab) CSVs | `yomitan-n*.csv` | JLPT levels **with exact JMdict sequence ids** — seq-id matching beats text matching, always try `row.seq` first |
| [elzup/jlpt-word-list](https://github.com/elzup/jlpt-word-list) CSVs | `jlpt-n*.csv` | Additional JLPT rows (text-matched). Both lists derive from Jonathan Waller/tanos.co.uk |
| KRADFILE (`kradzip.zip` from edrdg.org) | `kradfile.txt` | Kanji component decomposition. Ships **EUC-JP** — decoded with `new TextDecoder('euc-jp')` (works in Bun); kradfile + kradfile2 concatenated |
| `scripts/extra-words.json` | (committed, hand-curated) | Compound words missing from every public JLPT list (小説家, 懐中電灯, 連れて行く…). Format: `["kanji","kana",level]` |
| `scripts/antonym-overrides.json` | (committed, hand-curated) | Antonym pairs JMdict lacks (~55 pairs: 広い↔狭い…). Format: pairs of `["kanji","kana"]` |
| kuromoji (npm devDependency, IPADIC) | — | Example-sentence furigana at build time (`scripts/lib/reading.ts` → `ExampleSentence.f`). Build scripts must `await initReading()` before building entries |

**Not available (yet):** Jreibun example sentences — the project's data
download is officially "in preparation" (its sentences on Jisho.org come
from a partnership, not a public file). Credited on the About page as
planned; when they publish, wire it in as another example source.
**Deliberately excluded from word lists:** proper names stay on the Names
page only (spec says no proper nouns in vocab).

## Script tour (`scripts/`)

- `download.ts` — GitHub-release + raw fetchers, 429 retry with backoff,
  unzips with fflate, records versions in `.cache/versions.json`.
- `lib/jmdict.ts` — minimal jmdict-simplified types + form pickers.
  `displayKanji`/`displayKana` skip forms tagged sK/sk/rK/rk/ik/iK/oK/ok
  (search-only/rare — never display them).
- `lib/pos.ts` — **the** part-of-speech classifier. `classifyPos` respects
  each sense's own tag order (JMdict orders tags by significance): 黄色
  `["n","adj-no","adj-na"]` is a noun, 綺麗 `["adj-na"]` an adjective. A
  fixed precedence map got 黄色/大人 wrong once — don't go back. Supported
  verb classes are deliberately absent (they belong to the verbs dataset);
  unsupported classes (二段/四段 archaic, vs-s, vz…) classify as `'verb'`.
- `lib/entry.ts` — `buildVerbEntry` / `buildVocabEntry`, shared by the JLPT
  and extended builders so both tiers obey identical rules (usually-kana
  display, sense filtering, gloss/example caps, noun+する synthesis).
- `lib/jlpt.ts` — merges yomitan (seq-first), elzup, and extra-words rows.
- `lib/build-common.ts` — word index (`find` prefers common entries;
  `findById` for seq matching), row expansion (strips parentheticals,
  expands "在る; 有る" cells, drops 〜 affix rows, ゆっくりと → ゆっくり
  と-particle fallback), gloss/example/sense extractors. `usuallyKana`
  checks **only the first sense** — 行く has a rare `uk` sense that made it
  display as kana once.
- `build-verbs.ts` / `build-vocab.ts` — JLPT tier. Vocab resolves
  antonym/see-also xrefs to ids that exist in the dataset, merges the
  overrides file, then **symmetrizes** both relations (JMdict xrefs are
  often one-way).
- `build-extended.ts` — the Beyond tier; see architecture.md for the output
  contract. Also resolves ext xrefs against both tiers.
- `build-names.ts` — buckets by first reading kana (hiragana-normalized hex
  codepoint filenames), plus a first-kanji→buckets map for written-form
  queries. One row per entry (primary kanji + primary kana form).
- `lib/gzip-out.ts` — `writeJsonGz`; all `public/data` output goes through
  it (level-9 gzip).

Review logs land in `scripts/.cache/`: `furigana-misses*.txt`,
`unmatched-verbish.txt`, `skipped-classes.txt` — check them after a rebuild.

## Formats worth memorizing

- Word ids are JMdict sequence numbers (7-digit strings in entries, numbers
  in extended index rows) and double as route params. The same id can exist
  in both the verbs and vocab datasets (勉強 the noun / 勉強する the verb).
- `FuriganaSegment { t, r? }` — `r` absent for kana runs. Conjugated forms
  get runtime ruby from `pairFurigana` (common-suffix stripping).
- JLPT levels are **community estimates** (no official lists since 2010) —
  the About page says so; keep that honesty.

## Licensing (non-negotiable)

All EDRDG files (JMdict, JMnedict, KANJIDIC2, KRADFILE) require attribution
under the EDRDG licence — that's what `/about` is for; keep it accurate
when adding sources. Tatoeba examples are CC BY 2.0 FR; JLPT lists CC BY
(tanos.co.uk). The About page must name the sources, licences, and dataset
generation date (`meta.json`).
