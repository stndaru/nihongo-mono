/**
 * Builds src/data/verbs/n{1..5}.json from the cached raw sources:
 * JMdict entries filtered to JLPT-listed verbs, with furigana and examples.
 *
 * Run scripts/download.ts first. Usage: bun scripts/build-verbs.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DatasetMeta, JlptLevel, VerbEntry } from '../src/lib/data/types'
import { buildWordIndex, expandRow } from './lib/build-common'
import { buildVerbEntry, type EntryCtx } from './lib/entry'
import { loadFuriganaIndex } from './lib/furigana'
import { loadJlptRows } from './lib/jlpt'
import { UNSUPPORTED_VERB_CLASSES } from './lib/pos'
import { initReading } from './lib/reading'
import { displayKanji, type JmdictFile, type JmdictWord } from './lib/jmdict'

const CACHE = join(import.meta.dirname, '.cache')
const OUT_DIR = join(import.meta.dirname, '..', 'src', 'data', 'verbs')
const META_PATH = join(import.meta.dirname, '..', 'src', 'data', 'meta.json')

console.log('loading sources…')
await initReading() // example-sentence furigana (kuromoji)
const jmdict: JmdictFile = JSON.parse(readFileSync(join(CACHE, 'jmdict.json'), 'utf8'))
const furiganaIndex = loadFuriganaIndex(CACHE)
const jlptRows = loadJlptRows(CACHE)
const versions: Record<string, string> = JSON.parse(
  readFileSync(join(CACHE, 'versions.json'), 'utf8'),
)
console.log(`jmdict ${jmdict.words.length} words, jlpt ${jlptRows.length} rows`)

const index = buildWordIndex(jmdict.words)

// --- entry builders --------------------------------------------------------
const furiganaMisses: string[] = []
const unmatched: string[] = []
const skipped: string[] = []

const ctx: EntryCtx = { furiganaIndex, furiganaMisses }

function buildEntry(word: JmdictWord, level: JlptLevel): VerbEntry | null {
  const entry = buildVerbEntry(word, level, ctx)
  if (entry) return entry
  const skippedClass = word.sense
    .flatMap((s) => s.partOfSpeech)
    .find((p) => UNSUPPORTED_VERB_CLASSES.has(p))
  if (skippedClass) {
    skipped.push(`${word.id} ${displayKanji(word)?.text ?? word.kana[0]?.text} (${skippedClass})`)
  }
  return null
}

// --- main ------------------------------------------------------------------


const byId = new Map<string, VerbEntry>()
for (const row of jlptRows) {
  for (const [expression, reading] of expandRow(row.expression, row.reading)) {
    // exact sequence id from the source beats text matching
    let word = row.seq ? index.findById(row.seq) : undefined
    word ??= index.find(expression, reading)
    // "コピーする" rows list the noun+する compound; JMdict holds the noun
    if (!word && expression.endsWith('する')) {
      word = index.find(expression.slice(0, -2), reading.replace(/する$/, ''))
    }
    if (!word) {
      // only verb-ish rows are interesting in the miss log
      if (/[うくぐすつぬぶむる]$/.test(expression)) {
        unmatched.push(`${expression}|${reading} (n${row.level})`)
      }
      continue
    }
    const entry = buildEntry(word, row.level)
    if (!entry) continue
    const existing = byId.get(entry.id)
    // easiest level wins when lists overlap
    if (!existing || entry.jlpt > existing.jlpt) byId.set(entry.id, entry)
  }
}

mkdirSync(OUT_DIR, { recursive: true })
const verbCounts = {} as DatasetMeta['verbCounts']
for (const level of [5, 4, 3, 2, 1] as const) {
  const entries = [...byId.values()]
    .filter((e) => e.jlpt === level)
    .sort((a, b) => a.kana.localeCompare(b.kana, 'ja'))
  verbCounts[`n${level}`] = entries.length
  writeFileSync(join(OUT_DIR, `n${level}.json`), JSON.stringify(entries, null, 2) + '\n')
  console.log(`n${level}.json: ${entries.length} verbs`)
}

const meta: DatasetMeta = {
  generated: new Date().toISOString().slice(0, 10),
  sources: versions,
  verbCounts,
  kanjiCount: 0, // filled by build-kanji.ts
}
try {
  // preserve what the other build scripts contributed
  const prev = JSON.parse(readFileSync(META_PATH, 'utf8')) as DatasetMeta
  meta.kanjiCount = prev.kanjiCount
  meta.vocabCounts = prev.vocabCounts
} catch {
  /* first run */
}
writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + '\n')

writeFileSync(join(CACHE, 'furigana-misses.txt'), furiganaMisses.join('\n') + '\n')
writeFileSync(join(CACHE, 'unmatched-verbish.txt'), unmatched.join('\n') + '\n')
writeFileSync(join(CACHE, 'skipped-classes.txt'), skipped.join('\n') + '\n')
console.log(
  `done. total ${byId.size} verbs | furigana misses ${furiganaMisses.length} | unmatched verb-ish rows ${unmatched.length} | skipped classes ${skipped.length}`,
)
