/**
 * Packs the hand-editable JLPT tier (src/data, pretty-printed, committed)
 * into the pre-gzipped runtime copies the app actually fetches
 * (public/data/jlpt/*.json.gz). Serving these as static .gz files instead
 * of importing JSON through the JS module graph keeps multi-MB datasets
 * out of Vite's transform pipeline (dev modules carried pretty-printing
 * plus an inline sourcemap — a 2.9 MB file ballooned to 24 MB).
 *
 * Run after build-verbs/build-vocab/build-kanji, or after hand-editing
 * anything under src/data. Usage: bun scripts/pack-jlpt.ts
 */
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { writeJsonGz } from './lib/gzip-out'

const DATA_DIR = join(import.meta.dirname, '..', 'src', 'data')
const PUBLIC_DATA = join(import.meta.dirname, '..', 'public', 'data')
const OUT_DIR = join(PUBLIC_DATA, 'jlpt')

// Keep in sync with KANJI_EXT_SHARDS / KANJI_WORDS_SHARDS in src/lib/data/loader.ts.
const KANJI_EXT_SHARDS = 16
const KANJI_WORDS_SHARDS = 64

mkdirSync(OUT_DIR, { recursive: true })

interface PackedWord {
  id: string
  kana: string
  gloss: string[]
  furigana: unknown[]
  jlpt: number
  common: boolean
  kanjiChars: string[]
}

let count = 0
const allWords: { word: PackedWord; isVerb: boolean }[] = []
const idLevels: Record<'verbs' | 'vocab', Record<string, number[]>> = { verbs: {}, vocab: {} }
for (const dataset of ['verbs', 'vocab'] as const) {
  for (const level of [5, 4, 3, 2, 1]) {
    const data = JSON.parse(readFileSync(join(DATA_DIR, dataset, `n${level}.json`), 'utf8'))
    writeJsonGz(join(OUT_DIR, `${dataset}-n${level}.json.gz`), data)
    for (const word of data as PackedWord[]) allWords.push({ word, isVerb: dataset === 'verbs' })
    idLevels[dataset][level] = (data as PackedWord[]).map((w) => Number(w.id)).sort((a, b) => a - b)
    count++
  }
}

// id → level routing map (~17 KB): detail pages resolve any word id with one
// level-file (or ext-shard) fetch instead of scanning N5→N1. An id missing
// from this map is extended-tier. Shape mirrors loadIdLevels in loader.ts.
writeJsonGz(join(OUT_DIR, 'ids.json.gz'), idLevels)

// Grammar points: explicit n{level}.json filenames only — inventory.json in
// the same directory is the reconciliation worksheet, never packed. A level
// not yet authored packs as [] so every runtime file exists mid-catalogue
// (loadGrammarLevel/findGrammar in loader.ts stay uniform).
let grammarCount = 0
for (const level of [5, 4, 3, 2, 1]) {
  const src = join(DATA_DIR, 'grammar', `n${level}.json`)
  const data = existsSync(src) ? JSON.parse(readFileSync(src, 'utf8')) : []
  if (!existsSync(src)) console.warn(`grammar n${level}.json missing — packing []`)
  writeJsonGz(join(OUT_DIR, `grammar-n${level}.json.gz`), data)
  grammarCount += (data as unknown[]).length
}

// "Words using this kanji" index for the kanji detail page: precomputed here
// so the page fetches one small codepoint shard instead of all ten level
// files (~1.7 MB) just to filter them by character. Rows are pre-sorted
// (easiest level, then common, then kana) and carry only what the table
// renders — keep the tuple shape in sync with KanjiWordRow in types.ts.
const byKanji = new Map<string, { row: unknown[]; common: boolean; kana: string; jlpt: number }[]>()
for (const { word, isVerb } of allWords) {
  for (const char of word.kanjiChars) {
    let rows = byKanji.get(char)
    if (!rows) byKanji.set(char, (rows = []))
    rows.push({
      row: [word.id, isVerb ? 1 : 0, word.jlpt, word.kana, word.gloss.join('; '), word.furigana],
      common: word.common,
      kana: word.kana,
      jlpt: word.jlpt,
    })
  }
}
const wordShards: Record<string, unknown[][]>[] = Array.from(
  { length: KANJI_WORDS_SHARDS },
  () => ({}),
)
for (const [char, rows] of byKanji) {
  rows.sort(
    (a, b) =>
      b.jlpt - a.jlpt ||
      Number(b.common) - Number(a.common) ||
      a.kana.localeCompare(b.kana, 'ja'),
  )
  wordShards[(char.codePointAt(0) ?? 0) % KANJI_WORDS_SHARDS][char] = rows.map((r) => r.row)
}
const wordsDir = join(PUBLIC_DATA, 'kanji-words')
mkdirSync(wordsDir, { recursive: true })
wordShards.forEach((shard, n) => writeJsonGz(join(wordsDir, `${n}.json.gz`), shard))

// Kanji ships in two tiers so no page pays for all 10,384 entries at once
// (the single full file was a 400 KB fetch on every detail page):
// - core (JLPT-listed or frequency-ranked) — what word pages and the kanji
//   list actually use
// - the rest, sharded by codepoint for the detail-page fallback and the
//   opt-in Beyond chip
type KanjiEntry = { char: string; jlpt: number | null; freq: number | null }
const kanji: Record<string, KanjiEntry> = JSON.parse(
  readFileSync(join(DATA_DIR, 'kanji', 'kanji.json'), 'utf8'),
)
const core: Record<string, KanjiEntry> = {}
const shards: Record<string, KanjiEntry>[] = Array.from({ length: KANJI_EXT_SHARDS }, () => ({}))
for (const [char, entry] of Object.entries(kanji)) {
  if (entry.jlpt !== null || entry.freq !== null) core[char] = entry
  else shards[(char.codePointAt(0) ?? 0) % KANJI_EXT_SHARDS][char] = entry
}
writeJsonGz(join(OUT_DIR, 'kanji-core.json.gz'), core)
const extDir = join(PUBLIC_DATA, 'kanji-ext')
mkdirSync(extDir, { recursive: true })
shards.forEach((shard, n) => writeJsonGz(join(extDir, `words-${n}.json.gz`), shard))
// the pre-split single file is superseded — drop it if a checkout still has it
const legacy = join(OUT_DIR, 'kanji.json.gz')
if (existsSync(legacy)) rmSync(legacy)

console.log(
  `packed ${count} level files + grammar (${grammarCount}) + kanji core (${Object.keys(core).length}) ` +
    `+ ${KANJI_EXT_SHARDS} ext shards (${
      Object.keys(kanji).length - Object.keys(core).length
    }) + ${KANJI_WORDS_SHARDS} kanji-word shards (${byKanji.size} kanji) into public/data/`,
)
