/**
 * Builds src/data/verbs/n{1..5}.json from the cached raw sources:
 * JMdict entries filtered to JLPT-listed verbs, with furigana and examples.
 *
 * Run scripts/download.ts first. Usage: bun scripts/build-verbs.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { toRomaji } from 'wanakana'
import type { VerbClass } from '../src/lib/conjugation'
import type { DatasetMeta, JlptLevel, VerbEntry } from '../src/lib/data/types'
import {
  buildWordIndex,
  expandRow,
  kanjiCharsOf,
  sensesDetail,
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
  type JmdictFile,
  type JmdictSense,
  type JmdictWord,
} from './lib/jmdict'

const CACHE = join(import.meta.dirname, '.cache')
const OUT_DIR = join(import.meta.dirname, '..', 'src', 'data', 'verbs')
const META_PATH = join(import.meta.dirname, '..', 'src', 'data', 'meta.json')

const VERB_CLASSES: ReadonlySet<string> = new Set([
  'v5u', 'v5u-s', 'v5k', 'v5k-s', 'v5g', 'v5s', 'v5t', 'v5n', 'v5b', 'v5m',
  'v5r', 'v5r-i', 'v5aru', 'v1', 'v1-s', 'vk',
] satisfies VerbClass[])

/** Verb-like classes we deliberately don't support yet. */
const SKIPPED_CLASSES = new Set(['vs-s', 'vs-c', 'vn', 'vr', 'vz', 'v5uru', 'v4r', 'v4h', 'v4k', 'v4s', 'v4t', 'v4b', 'v4m', 'v4g', 'v4n'])


console.log('loading sources…')
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



function transitivityOf(senses: JmdictSense[]): VerbEntry['transitivity'] {
  const pos = new Set(senses.flatMap((s) => s.partOfSpeech))
  const vt = pos.has('vt')
  const vi = pos.has('vi')
  if (vt && vi) return 'both'
  if (vt) return 'vt'
  if (vi) return 'vi'
  return null
}


function buildEntry(word: JmdictWord, level: JlptLevel): VerbEntry | null {
  // senses that describe a supported verb class
  const verbSenses = word.sense.filter((s) =>
    s.partOfSpeech.some((p) => VERB_CLASSES.has(p) || p === 'vs-i'),
  )
  const suruSenses = word.sense.filter((s) => s.partOfSpeech.includes('vs'))

  const kanjiForm = displayKanji(word)
  const kanaForm = displayKana(word, kanjiForm?.text)
  if (!kanaForm) return null
  const kana = kanaForm.text

  if (verbSenses.length > 0) {
    const pos = verbSenses[0].partOfSpeech
    const cls = (pos.find((p) => VERB_CLASSES.has(p)) ??
      (pos.includes('vs-i') ? 'vs' : undefined)) as VerbClass | undefined
    if (!cls) return null
    // vs-i entries must actually end in する for the engine to conjugate them
    if (cls === 'vs' && !kana.endsWith('する')) return null
    const kanji = !kanjiForm || usuallyKana(verbSenses) ? kana : kanjiForm.text
    return {
      id: word.id,
      kanji,
      kana,
      romaji: toRomaji(kana),
      furigana: furiganaFor(furiganaIndex, kanji, kana, furiganaMisses),
      gloss: sensesGlosses(verbSenses),
      jlpt: level,
      common: isCommon(word),
      examples: sensesExamples(verbSenses),
      senses: sensesDetail(verbSenses),
      class: cls,
      transitivity: transitivityOf(verbSenses),
      kanjiChars: kanjiCharsOf(kanji),
    }
  }

  if (suruSenses.length > 0) {
    // noun + する compound (勉強 → 勉強する)
    const baseKanji = !kanjiForm || usuallyKana(suruSenses) ? kana : kanjiForm.text
    const kanji = baseKanji + 'する'
    return {
      id: word.id,
      kanji,
      kana: kana + 'する',
      romaji: toRomaji(kana + 'する'),
      furigana: [...furiganaFor(furiganaIndex, baseKanji, kana, furiganaMisses), { t: 'する' }],
      gloss: sensesGlosses(suruSenses),
      jlpt: level,
      common: isCommon(word),
      examples: sensesExamples(suruSenses),
      senses: sensesDetail(suruSenses),
      class: 'vs',
      transitivity: transitivityOf(suruSenses),
      kanjiChars: kanjiCharsOf(kanji),
    }
  }

  const skippedClass = word.sense
    .flatMap((s) => s.partOfSpeech)
    .find((p) => SKIPPED_CLASSES.has(p))
  if (skippedClass) skipped.push(`${word.id} ${kanjiForm?.text ?? kana} (${skippedClass})`)
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
