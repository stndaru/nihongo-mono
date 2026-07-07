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

// Keep in sync with KANJI_EXT_SHARDS in src/lib/data/loader.ts.
const KANJI_EXT_SHARDS = 16

mkdirSync(OUT_DIR, { recursive: true })

let count = 0
for (const dataset of ['verbs', 'vocab'] as const) {
  for (const level of [5, 4, 3, 2, 1]) {
    const data = JSON.parse(readFileSync(join(DATA_DIR, dataset, `n${level}.json`), 'utf8'))
    writeJsonGz(join(OUT_DIR, `${dataset}-n${level}.json.gz`), data)
    count++
  }
}

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
  `packed ${count} level files + kanji core (${Object.keys(core).length}) ` +
    `+ ${KANJI_EXT_SHARDS} ext shards (${
      Object.keys(kanji).length - Object.keys(core).length
    }) into public/data/`,
)
