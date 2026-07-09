/**
 * Regenerates the `f` (furigana) string of every grammar example from its
 * `ja` sentence and rewrites src/data/grammar/n{1..5}.json in place.
 *
 * `f` is ALWAYS machine-derived — authors and reviewers write only `ja`/`en`,
 * and the integrity test (grammar-data.test.ts) fails when `f` doesn't
 * re-concatenate to `ja`, so an edited sentence can't ship a stale reading.
 * Idempotent; run any time after editing grammar content:
 *   bun run data:grammar   (this script, then pack-jlpt.ts)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { GrammarEntry } from '../src/lib/data/types'
import { initReading, sentenceFurigana } from './lib/reading'

const GRAMMAR_DIR = join(import.meta.dirname, '..', 'src', 'data', 'grammar')

await initReading()

let files = 0
let sentences = 0
for (const level of [5, 4, 3, 2, 1]) {
  const path = join(GRAMMAR_DIR, `n${level}.json`)
  if (!existsSync(path)) continue
  const entries: GrammarEntry[] = JSON.parse(readFileSync(path, 'utf8'))
  for (const entry of entries) {
    for (const example of entry.examples) {
      const f = sentenceFurigana(example.ja)
      if (f) example.f = f
      else delete example.f
      sentences++
    }
  }
  // match the 2-space pretty format of the other committed src/data files
  writeFileSync(path, JSON.stringify(entries, null, 2) + '\n')
  files++
}

console.log(`furigana regenerated for ${sentences} sentences across ${files} grammar files`)
