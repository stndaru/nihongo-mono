import { toHiragana } from 'wanakana'
import { fetchJsonGz } from './fetch-gz'
import type { NameRow } from './types'

/**
 * Search over the JMnedict proper-name dataset (successor of ENAMDICT).
 * 743k entries live in public/data/names, bucketed by the first kana of the
 * reading, so a query only ever downloads the bucket(s) it can match:
 * matching is by the *beginning* of a name, on its reading or written form.
 */

export interface NameResult {
  kanji: string
  kana: string
  types: string[]
  gloss: string
}

const KANJI_RE = /[㐀-鿿豈-﫿]/u

/** Mirrors nameBucketKey in scripts/build-names.ts. */
function bucketKey(char: string): string {
  const cp = toHiragana(char).codePointAt(0) ?? 0
  return `u${cp.toString(16)}`
}

interface Bucket {
  rows: NameRow[]
  /** hiragana-normalized readings, aligned with rows */
  hira: string[]
}

const bucketCache = new Map<string, Promise<Bucket>>()

function loadBucket(key: string): Promise<Bucket> {
  let cached = bucketCache.get(key)
  if (!cached) {
    cached = fetchJsonGz<NameRow[]>(`names/${key}.json.gz`)
      .catch(() => [] as NameRow[]) // no such bucket → no matches
      .then((rows) => ({ rows, hira: rows.map((r) => toHiragana(r[1])) }))
    bucketCache.set(key, cached)
  }
  return cached
}

let kanjiMapCache: Promise<Record<string, string[]>> | null = null
let manifestCache: Promise<{ count: number; buckets: Record<string, number> }> | null = null

export function loadNamesManifest() {
  manifestCache ??= fetchJsonGz<{ count: number; buckets: Record<string, number> }>(
    'names/manifest.json.gz',
  )
  return manifestCache
}

export interface NameSearchOutcome {
  results: NameResult[]
  /** total prefix matches before the cap */
  total: number
}

const LIMIT = 300

export async function searchNames(query: string): Promise<NameSearchOutcome> {
  const q = query.trim()
  if (!q) return { results: [], total: 0 }
  const first = [...q][0]

  let matches: NameRow[]
  if (KANJI_RE.test(first)) {
    // written-form search: the map says which reading buckets contain names
    // that start with this kanji
    kanjiMapCache ??= fetchJsonGz<Record<string, string[]>>('names/kanji-map.json.gz')
    const keys = (await kanjiMapCache)[first] ?? []
    const buckets = await Promise.all(keys.map(loadBucket))
    matches = buckets.flatMap((b) => b.rows.filter((r) => r[0].startsWith(q)))
  } else {
    // reading search — romaji/katakana queries normalize to hiragana
    const qh = toHiragana(q.toLowerCase())
    const bucket = await loadBucket(bucketKey([...qh][0]))
    matches = bucket.rows.filter((_, i) => bucket.hira[i].startsWith(qh))
  }

  matches.sort((a, b) => a[1].length - b[1].length || (a[1] < b[1] ? -1 : 1))
  return {
    total: matches.length,
    results: matches.slice(0, LIMIT).map(([kanji, kana, types, gloss]) => ({
      kanji,
      kana,
      types: types ? types.split(',') : [],
      gloss,
    })),
  }
}

/** JMnedict name-type tags → readable labels (from the file's tag table). */
export const NAME_TYPE_LABELS: Record<string, string> = {
  surname: 'Surname',
  fem: 'Female Given Name',
  masc: 'Male Given Name',
  given: 'Given Name',
  person: 'Person',
  place: 'Place',
  station: 'Station',
  company: 'Company',
  organization: 'Organization',
  group: 'Group',
  product: 'Product',
  work: 'Work',
  char: 'Character',
  fict: 'Fiction',
  creat: 'Creature',
  dei: 'Deity',
  myth: 'Mythology',
  leg: 'Legend',
  relig: 'Religion',
  ev: 'Event',
  obj: 'Object',
  doc: 'Document',
  serv: 'Service',
  ship: 'Ship',
  oth: 'Other',
  unclass: 'Unclassified',
}
