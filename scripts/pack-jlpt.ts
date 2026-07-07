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
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { writeJsonGz } from './lib/gzip-out'

const DATA_DIR = join(import.meta.dirname, '..', 'src', 'data')
const OUT_DIR = join(import.meta.dirname, '..', 'public', 'data', 'jlpt')

mkdirSync(OUT_DIR, { recursive: true })

let count = 0
for (const dataset of ['verbs', 'vocab'] as const) {
  for (const level of [5, 4, 3, 2, 1]) {
    const data = JSON.parse(readFileSync(join(DATA_DIR, dataset, `n${level}.json`), 'utf8'))
    writeJsonGz(join(OUT_DIR, `${dataset}-n${level}.json.gz`), data)
    count++
  }
}
writeJsonGz(
  join(OUT_DIR, 'kanji.json.gz'),
  JSON.parse(readFileSync(join(DATA_DIR, 'kanji', 'kanji.json'), 'utf8')),
)
console.log(`packed ${count} level files + kanji into public/data/jlpt/`)
