/**
 * Builds the proper-names dataset from JMnedict (the successor of ENAMDICT):
 * every entry, as compact rows bucketed by the first kana of the reading so
 * the client only ever fetches the bucket a query needs.
 *
 *   public/data/names/manifest.json   { count, buckets: { key: count } }
 *   public/data/names/kanji-map.json  first kanji char → bucket keys
 *   public/data/names/{key}.json      NameRow[] — [kanji, kana, types, romanization]
 *
 * Bucket keys are 'u' + the hex codepoint of the first hiragana-normalized
 * kana character (filenames stay ASCII). Usage: bun scripts/build-names.ts
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { toHiragana } from 'wanakana'
import { writeJsonGz } from './lib/gzip-out'
import type { DatasetMeta, NameRow } from '../src/lib/data/types'

const CACHE = join(import.meta.dirname, '.cache')
const DATA_DIR = join(import.meta.dirname, '..', 'src', 'data')
const OUT_DIR = join(import.meta.dirname, '..', 'public', 'data', 'names')

interface JmnedictWord {
  id: string
  kanji: { text: string }[]
  kana: { text: string }[]
  translation: { type: string[]; translation: { lang: string; text: string }[] }[]
}

/** Same normalization the client applies to queries — keep the two in sync. */
export function nameBucketKey(kanaFirstChar: string): string {
  const cp = toHiragana(kanaFirstChar).codePointAt(0) ?? 0
  return `u${cp.toString(16)}`
}

console.log('loading jmnedict…')
const jmnedict: { words: JmnedictWord[] } = JSON.parse(
  readFileSync(join(CACHE, 'jmnedict.json'), 'utf8'),
)
console.log(`${jmnedict.words.length} name entries`)

const buckets = new Map<string, NameRow[]>()
const kanjiMap = new Map<string, Set<string>>()
let count = 0

for (const word of jmnedict.words) {
  const kana = word.kana[0]?.text
  if (!kana) continue
  const kanji = word.kanji[0]?.text ?? ''
  const types = [...new Set(word.translation.flatMap((t) => t.type))].join(',')
  const gloss = word.translation
    .flatMap((t) => t.translation.filter((g) => g.lang === 'eng').map((g) => g.text))
    .slice(0, 2)
    .join('; ')
  if (!gloss) continue

  const key = nameBucketKey(kana[0])
  let bucket = buckets.get(key)
  if (!bucket) buckets.set(key, (bucket = []))
  bucket.push([kanji, kana, types, gloss])
  count++

  if (kanji) {
    const first = kanji[0]
    let keys = kanjiMap.get(first)
    if (!keys) kanjiMap.set(first, (keys = new Set()))
    keys.add(key)
  }
}

rmSync(OUT_DIR, { recursive: true, force: true })
mkdirSync(OUT_DIR, { recursive: true })

const collator = new Intl.Collator('ja')
const manifest: { count: number; buckets: Record<string, number> } = { count, buckets: {} }
for (const [key, rows] of [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  rows.sort((a, b) => collator.compare(a[1], b[1]) || collator.compare(a[0], b[0]))
  manifest.buckets[key] = rows.length
  writeJsonGz(join(OUT_DIR, `${key}.json.gz`), rows)
}
writeJsonGz(join(OUT_DIR, 'manifest.json.gz'), manifest)
writeJsonGz(
  join(OUT_DIR, 'kanji-map.json.gz'),
  Object.fromEntries([...kanjiMap.entries()].map(([ch, keys]) => [ch, [...keys].sort()])),
)

const metaPath = join(DATA_DIR, 'meta.json')
const meta: DatasetMeta = JSON.parse(readFileSync(metaPath, 'utf8'))
meta.namesCount = count
writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n')

console.log(`done. ${count} names in ${buckets.size} buckets | ${kanjiMap.size} first-kanji keys`)
