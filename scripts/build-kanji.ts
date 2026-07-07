/**
 * Builds src/data/kanji/kanji.json: every KANJIDIC2 entry, so the extended
 * (full-JMdict) tier's detail pages can break down any word's kanji.
 * Run build-verbs.ts first.
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
console.log(`${usedChars.size} distinct kanji used by JLPT verbs + vocab (coverage check)`)

const kanjidic: { characters: Kanjidic2Character[] } = JSON.parse(
  readFileSync(join(CACHE, 'kanjidic2.json'), 'utf8'),
)

// Modern 5-level JLPT tags (post-2010). KANJIDIC2's own jlpt field is the
// OLD 4-level scale (no N5; "N3" there is ~181 chars) — shipping it as-is
// mislabeled every kanji level. davidluzgouveia/kanji-data carries
// per-kanji jlpt_new derived from Jonathan Waller's community lists
// (tanos.co.uk, CC BY — the same source family as our word-level tags):
// N5 79 · N4 166 · N3 367 · N2 367 · N1 1,232.
const jlptNew = new Map<string, JlptLevel>()
{
  const raw: Record<string, { jlpt_new: number | null }> = JSON.parse(
    readFileSync(join(CACHE, 'jlpt-kanji.json'), 'utf8'),
  )
  for (const [char, v] of Object.entries(raw)) {
    if (v.jlpt_new !== null) jlptNew.set(char, v.jlpt_new as JlptLevel)
  }
  console.log(`jlpt-kanji: ${jlptNew.size} kanji with modern N5–N1 tags`)
}

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
    // modern 5-level tag — NOT ch.misc.jlptLevel, which is the old 4-level scale
    jlpt: jlptNew.get(ch.literal) ?? null,
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
try {
  const versions = JSON.parse(readFileSync(join(CACHE, 'versions.json'), 'utf8'))
  if (versions['davidluzgouveia/kanji-data'])
    meta.sources['davidluzgouveia/kanji-data'] = versions['davidluzgouveia/kanji-data']
} catch {
  // versions.json absent (download step skipped) — keep prior recording
}
writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n')
console.log(`kanji.json: ${meta.kanjiCount} entries`)
