/**
 * Builds src/data/vocab/n{1..5}.json: JLPT-listed nouns, adjectives, and
 * adverbs from JMdict, with furigana and examples.
 *
 * Run scripts/download.ts first. Usage: bun scripts/build-vocab.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { toRomaji } from 'wanakana'
import type { DatasetMeta, JlptLevel, VocabEntry, VocabPos } from '../src/lib/data/types'
import {
  buildWordIndex,
  expandRow,
  kanjiCharsOf,
  sensesGlosses,
  sensesExamples,
  usuallyKana,
} from './lib/build-common'
import { furiganaFor, loadFuriganaIndex } from './lib/furigana'
import { loadJlptRows } from './lib/jlpt'
import {
  displayKana,
  displayKanji,
  isCommon,
  xrefTargets,
  type JmdictFile,
  type JmdictWord,
} from './lib/jmdict'

const CACHE = join(import.meta.dirname, '.cache')
const OUT_DIR = join(import.meta.dirname, '..', 'src', 'data', 'vocab')
const META_PATH = join(import.meta.dirname, '..', 'src', 'data', 'meta.json')

/** JMdict PoS tag → our vocab category. Order sets precedence within a sense:
 *  きれい (adj-na + n) counts as an adjective, and n+adv hybrids like 今日
 *  count as nouns, matching how textbooks categorize them. Pure adverbs
 *  (ゆっくり, とても) still land in adverb. */
const POS_MAP: [string, VocabPos][] = [
  ['adj-i', 'adj-i'],
  ['adj-ix', 'adj-i'], // よい/いい special class
  ['adj-na', 'adj-na'],
  ['n', 'noun'],
  ['n-t', 'noun'], // temporal nouns (今日, 毎朝…)
  ['adv', 'adverb'],
  ['adv-to', 'adverb'],
]

console.log('loading sources…')
const jmdict: JmdictFile = JSON.parse(readFileSync(join(CACHE, 'jmdict.json'), 'utf8'))
const furiganaIndex = loadFuriganaIndex(CACHE)
const jlptRows = loadJlptRows(CACHE)
const index = buildWordIndex(jmdict.words)
console.log(`jmdict ${jmdict.words.length} words, jlpt ${jlptRows.length} rows`)

const furiganaMisses: string[] = []

/** Raw xref targets per entry id, resolved to ids after all entries exist. */
const rawXrefs = new Map<string, { ant: [string, string?][]; syn: [string, string?][] }>()

function buildEntry(word: JmdictWord, level: JlptLevel): VocabEntry | null {
  let pos: VocabPos | undefined
  for (const sense of word.sense) {
    const hit = POS_MAP.find(([tag]) => sense.partOfSpeech.includes(tag))
    if (hit) {
      pos = hit[1]
      break
    }
  }
  if (!pos) return null

  const posTags = new Set(
    POS_MAP.filter(([, category]) => category === pos).map(([tag]) => tag),
  )
  const senses = word.sense.filter((s) => s.partOfSpeech.some((t) => posTags.has(t)))

  const kanjiForm = displayKanji(word)
  const kanaForm = displayKana(word, kanjiForm?.text)
  if (!kanaForm) return null
  const kana = kanaForm.text
  const kanji = !kanjiForm || usuallyKana(senses) ? kana : kanjiForm.text
  rawXrefs.set(word.id, {
    ant: senses.flatMap((s) => xrefTargets(s.antonym)),
    syn: senses.flatMap((s) => xrefTargets(s.related)),
  })
  return {
    id: word.id,
    kanji,
    kana,
    romaji: toRomaji(kana),
    furigana: furiganaFor(furiganaIndex, kanji, kana, furiganaMisses),
    gloss: sensesGlosses(senses),
    jlpt: level,
    common: isCommon(word),
    examples: sensesExamples(senses),
    kanjiChars: kanjiCharsOf(kanji),
    pos,
  }
}

const byId = new Map<string, VocabEntry>()
for (const row of jlptRows) {
  for (const [expression, reading] of expandRow(row.expression, row.reading)) {
    let word = index.find(expression, reading)
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
let antCount = 0
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
  if (antonyms.length > 0) {
    entry.antonyms = antonyms
    antCount++
  }
  if (synonyms.length > 0) entry.synonyms = synonyms
}
console.log(`${antCount} words with in-dataset antonyms`)

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
