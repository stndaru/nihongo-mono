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
import type { DatasetMeta, ExampleSentence, JlptLevel, VerbEntry } from '../src/lib/data/types'
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

const KANJI_CHAR_RE = /[㐀-鿿豈-﫿]/gu

console.log('loading sources…')
const jmdict: JmdictFile = JSON.parse(readFileSync(join(CACHE, 'jmdict.json'), 'utf8'))
const furiganaIndex = loadFuriganaIndex(CACHE)
const jlptRows = loadJlptRows(CACHE)
const versions: Record<string, string> = JSON.parse(
  readFileSync(join(CACHE, 'versions.json'), 'utf8'),
)
console.log(`jmdict ${jmdict.words.length} words, jlpt ${jlptRows.length} rows`)

// --- indexes ---------------------------------------------------------------
const byKanjiText = new Map<string, JmdictWord[]>()
const byKanaText = new Map<string, JmdictWord[]>()
for (const word of jmdict.words) {
  for (const k of word.kanji) {
    const list = byKanjiText.get(k.text)
    if (list) list.push(word)
    else byKanjiText.set(k.text, [word])
  }
  for (const k of word.kana) {
    const list = byKanaText.get(k.text)
    if (list) list.push(word)
    else byKanaText.set(k.text, [word])
  }
}

function findWord(expression: string, reading: string): JmdictWord | undefined {
  const hasKanji = KANJI_CHAR_RE.test(expression)
  KANJI_CHAR_RE.lastIndex = 0
  const candidates =
    (hasKanji ? byKanjiText.get(expression) : byKanaText.get(expression)) ?? []
  if (candidates.length === 0) return undefined
  const readingMatches = candidates.filter((w) => w.kana.some((k) => k.text === reading))
  const pool = readingMatches.length > 0 ? readingMatches : candidates
  return pool.find(isCommon) ?? pool[0]
}

// --- entry builders --------------------------------------------------------
const furiganaMisses: string[] = []
const unmatched: string[] = []
const skipped: string[] = []

function sensesGlosses(senses: JmdictSense[]): string[] {
  const gloss: string[] = []
  for (const s of senses) {
    const text = s.gloss[0]?.text
    if (text && !gloss.includes(text)) gloss.push(text)
    if (gloss.length === 3) break
  }
  return gloss
}

function sensesExamples(senses: JmdictSense[]): ExampleSentence[] {
  const all: ExampleSentence[] = []
  for (const s of senses) {
    for (const ex of s.examples) {
      const ja = ex.sentences.find((x) => x.lang === 'jpn')?.text
      const en = ex.sentences.find((x) => x.lang === 'eng')?.text
      if (ja && en) all.push({ ja, en })
    }
  }
  // shortest Japanese sentences read easiest in a compact UI
  all.sort((a, b) => a.ja.length - b.ja.length)
  return all.slice(0, 3)
}

function transitivityOf(senses: JmdictSense[]): VerbEntry['transitivity'] {
  const pos = new Set(senses.flatMap((s) => s.partOfSpeech))
  const vt = pos.has('vt')
  const vi = pos.has('vi')
  if (vt && vi) return 'both'
  if (vt) return 'vt'
  if (vi) return 'vi'
  return null
}

function kanjiCharsOf(kanji: string): string[] {
  return [...new Set(kanji.match(KANJI_CHAR_RE) ?? [])]
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
  // Only the primary sense decides kana-only display: 行く has a rare
  // uk-tagged later sense but is normally written in kanji.
  const usuallyKana = (senses: JmdictSense[]) => senses[0]?.misc.includes('uk') ?? false

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

/**
 * Normalizes a raw list row into one or more (expression, reading) pairs:
 * strips parenthetical usage hints, expands "在る; 有る" / "回る、回す"
 * multi-variant cells, and drops 〜/～ pattern rows (auxiliaries, not verbs).
 */
function expandRow(expression: string, reading: string): [string, string][] {
  if (/[~～〜]/.test(expression)) return []
  const clean = (s: string) => s.replace(/[（(][^）)]*[）)]/g, '').trim()
  const exprs = clean(expression).split(/\s*[;、,]\s*/).filter(Boolean)
  const readings = clean(reading).split(/\s*[;、,]\s*/).filter(Boolean)
  return exprs.map((e, i) => [e, readings[i] ?? readings[0] ?? e])
}

const byId = new Map<string, VerbEntry>()
for (const row of jlptRows) {
  for (const [expression, reading] of expandRow(row.expression, row.reading)) {
    let word = findWord(expression, reading)
    // "コピーする" rows list the noun+する compound; JMdict holds the noun
    if (!word && expression.endsWith('する')) {
      word = findWord(expression.slice(0, -2), reading.replace(/する$/, ''))
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
  // preserve kanjiCount if build-kanji ran before on this dataset
  meta.kanjiCount = (JSON.parse(readFileSync(META_PATH, 'utf8')) as DatasetMeta).kanjiCount
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
