/**
 * Builds src/data/vocab/n{1..5}.json: JLPT-listed nouns, adjectives, and
 * adverbs from JMdict, with furigana and examples.
 *
 * Run scripts/download.ts first. Usage: bun scripts/build-vocab.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DatasetMeta, JlptLevel, VocabEntry } from '../src/lib/data/types'
import { buildWordIndex, expandRow } from './lib/build-common'
import { buildVocabEntry, type EntryCtx } from './lib/entry'
import { loadFuriganaIndex } from './lib/furigana'
import { loadJlptRows } from './lib/jlpt'
import { type JmdictFile, type JmdictWord } from './lib/jmdict'

const CACHE = join(import.meta.dirname, '.cache')
const OUT_DIR = join(import.meta.dirname, '..', 'src', 'data', 'vocab')
const META_PATH = join(import.meta.dirname, '..', 'src', 'data', 'meta.json')

console.log('loading sources…')
const jmdict: JmdictFile = JSON.parse(readFileSync(join(CACHE, 'jmdict.json'), 'utf8'))
const furiganaIndex = loadFuriganaIndex(CACHE)
const jlptRows = loadJlptRows(CACHE)
const index = buildWordIndex(jmdict.words)
console.log(`jmdict ${jmdict.words.length} words, jlpt ${jlptRows.length} rows`)

const furiganaMisses: string[] = []
const ctx: EntryCtx = { furiganaIndex, furiganaMisses }

/** Raw xref targets per entry id, resolved to ids after all entries exist. */
const rawXrefs = new Map<string, { ant: [string, string?][]; syn: [string, string?][] }>()

function buildEntry(word: JmdictWord, level: JlptLevel): VocabEntry | null {
  const built = buildVocabEntry(word, level, ctx)
  if (!built) return null
  rawXrefs.set(word.id, { ant: built.ant, syn: built.syn })
  return built.entry
}

const byId = new Map<string, VocabEntry>()
for (const row of jlptRows) {
  for (const [expression, reading] of expandRow(row.expression, row.reading)) {
    // exact sequence id from the source beats text matching
    let word = row.seq ? index.findById(row.seq) : undefined
    word ??= index.find(expression, reading)
    // "ゆっくりと" rows include the と particle; JMdict lists the bare adverb
    if (!word && expression.endsWith('と')) {
      word = index.find(expression.slice(0, -1), reading.replace(/と$/, ''))
    }
    if (!word) continue
    const entry = buildEntry(word, row.level)
    if (!entry) continue
    const existing = byId.get(entry.id)
    // easiest level wins when lists overlap
    if (!existing || entry.jlpt > existing.jlpt) byId.set(entry.id, entry)
  }
}

// resolve antonym/synonym xrefs to ids of words that exist in the dataset,
// so every reference the UI renders is clickable
for (const entry of byId.values()) {
  const raw = rawXrefs.get(entry.id)
  if (!raw) continue
  const resolve = (targets: [string, string?][]): string[] => [
    ...new Set(
      targets
        .map(([text, reading]) => index.find(text, reading ?? text)?.id)
        .filter((id): id is string => Boolean(id) && id !== entry.id && byId.has(id!)),
    ),
  ]
  const antonyms = resolve(raw.ant)
  const synonyms = resolve(raw.syn)
  if (antonyms.length > 0) entry.antonyms = antonyms
  if (synonyms.length > 0) entry.synonyms = synonyms
}

// curated pairs JMdict lacks (hand-editable; see antonym-overrides.json)
const overrides: { pairs: [string, string][][] } = JSON.parse(
  readFileSync(join(import.meta.dirname, 'antonym-overrides.json'), 'utf8'),
)
const overrideMisses: string[] = []
for (const [a, b] of overrides.pairs) {
  const idA = index.find(a[0], a[1])?.id
  const idB = index.find(b[0], b[1])?.id
  if (!idA || !idB || !byId.has(idA) || !byId.has(idB)) {
    overrideMisses.push(`${a[0]} ↔ ${b[0]}`)
    continue
  }
  const entryA = byId.get(idA)!
  if (!entryA.antonyms?.includes(idB)) entryA.antonyms = [...(entryA.antonyms ?? []), idB]
}

// relations are mutual: if A lists B, B lists A (JMdict xrefs are often one-way)
function symmetrize(key: 'antonyms' | 'synonyms') {
  for (const entry of byId.values()) {
    for (const otherId of entry[key] ?? []) {
      const other = byId.get(otherId)
      if (other && !other[key]?.includes(entry.id)) {
        other[key] = [...(other[key] ?? []), entry.id]
      }
    }
  }
}
symmetrize('antonyms')
symmetrize('synonyms')

const antCount = [...byId.values()].filter((e) => e.antonyms?.length).length
console.log(
  `${antCount} words with antonyms | ${overrideMisses.length} override pairs unresolved${
    overrideMisses.length ? ': ' + overrideMisses.join(', ') : ''
  }`,
)

mkdirSync(OUT_DIR, { recursive: true })
const vocabCounts = {} as NonNullable<DatasetMeta['vocabCounts']>
for (const level of [5, 4, 3, 2, 1] as const) {
  const entries = [...byId.values()]
    .filter((e) => e.jlpt === level)
    .sort((a, b) => a.kana.localeCompare(b.kana, 'ja'))
  vocabCounts[`n${level}`] = entries.length
  writeFileSync(join(OUT_DIR, `n${level}.json`), JSON.stringify(entries, null, 2) + '\n')
  console.log(`n${level}.json: ${entries.length} words`)
}

const meta: DatasetMeta = JSON.parse(readFileSync(META_PATH, 'utf8'))
meta.vocabCounts = vocabCounts
writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + '\n')

writeFileSync(join(CACHE, 'furigana-misses-vocab.txt'), furiganaMisses.join('\n') + '\n')
console.log(`done. total ${byId.size} words | furigana misses ${furiganaMisses.length}`)
