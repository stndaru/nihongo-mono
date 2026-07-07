/**
 * Builds src/data/kanji/kanji.json: KANJIDIC2 entries filtered to the kanji
 * actually used by the verb dataset. Run build-verbs.ts first.
 *
 * Usage: bun scripts/build-kanji.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DatasetMeta, JlptLevel, KanjiEntry, VerbEntry } from '../src/lib/data/types'

const CACHE = join(import.meta.dirname, '.cache')
const DATA_DIR = join(import.meta.dirname, '..', 'src', 'data')
const OUT_DIR = join(DATA_DIR, 'kanji')

interface Kanjidic2Character {
  literal: string
  misc: {
    grade: number | null
    strokeCounts: number[]
    frequency: number | null
    jlptLevel: number | null
  }
  readingMeaning: {
    groups: {
      readings: { type: string; value: string }[]
      meanings: { lang: string; value: string }[]
    }[]
  } | null
}

const usedChars = new Set<string>()
for (const dataset of ['verbs', 'vocab']) {
  for (const level of [5, 4, 3, 2, 1]) {
    let words: VerbEntry[]
    try {
      words = JSON.parse(readFileSync(join(DATA_DIR, dataset, `n${level}.json`), 'utf8'))
    } catch {
      continue // dataset not generated yet
    }
    for (const word of words) for (const c of word.kanjiChars) usedChars.add(c)
  }
}
console.log(`${usedChars.size} distinct kanji used by verbs + vocab`)

const kanjidic: { characters: Kanjidic2Character[] } = JSON.parse(
  readFileSync(join(CACHE, 'kanjidic2.json'), 'utf8'),
)

// KRADFILE: "亜 : ｜ 一 口" — visual component decomposition per kanji
const components = new Map<string, string[]>()
for (const line of readFileSync(join(CACHE, 'kradfile.txt'), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue
  const [char, parts] = line.split(' : ')
  if (char && parts) components.set(char.trim(), parts.trim().split(/\s+/))
}
console.log(`kradfile: ${components.size} decompositions`)

const out: Record<string, KanjiEntry> = {}
for (const ch of kanjidic.characters) {
  if (!usedChars.has(ch.literal)) continue
  const groups = ch.readingMeaning?.groups ?? []
  out[ch.literal] = {
    char: ch.literal,
    meanings: groups.flatMap((g) =>
      g.meanings.filter((m) => m.lang === 'en').map((m) => m.value),
    ),
    on: groups.flatMap((g) =>
      g.readings.filter((r) => r.type === 'ja_on').map((r) => r.value),
    ),
    kun: groups.flatMap((g) =>
      g.readings.filter((r) => r.type === 'ja_kun').map((r) => r.value),
    ),
    components: components.get(ch.literal),
    strokes: ch.misc.strokeCounts[0] ?? 0,
    jlpt: (ch.misc.jlptLevel as JlptLevel | null) ?? null,
    grade: ch.misc.grade ?? null,
    freq: ch.misc.frequency ?? null,
  }
}

const missing = [...usedChars].filter((c) => !out[c])
if (missing.length > 0) console.warn(`not in kanjidic2: ${missing.join(' ')}`)

// stable key order keeps rebuild diffs clean
const sorted = Object.fromEntries(
  Object.keys(out)
    .sort()
    .map((k) => [k, out[k]]),
)
mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(join(OUT_DIR, 'kanji.json'), JSON.stringify(sorted, null, 2) + '\n')

const metaPath = join(DATA_DIR, 'meta.json')
const meta: DatasetMeta = JSON.parse(readFileSync(metaPath, 'utf8'))
meta.kanjiCount = Object.keys(sorted).length
writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n')
console.log(`kanji.json: ${meta.kanjiCount} entries`)
