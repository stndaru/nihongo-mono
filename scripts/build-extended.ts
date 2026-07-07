/**
 * Builds the extended tier: every JMdict entry that isn't already on a JLPT
 * list, as verbs (conjugatable classes + する compounds) and vocabulary
 * (every other part of speech). Because this tier is ~200k entries it is NOT
 * bundled by Vite — it's written minified to public/data and fetched lazily:
 *
 *   public/data/verbs-ext/index.json     compact search rows (VerbIndexRow[])
 *   public/data/verbs-ext/words-{n}.json full entries, sharded by id % 32
 *   public/data/vocab-ext/index.json     compact search rows (VocabIndexRow[])
 *   public/data/vocab-ext/words-{n}.json full entries, sharded by id % 128
 *
 * Run build-verbs.ts and build-vocab.ts first (their output defines what is
 * "already covered"). Usage: bun scripts/build-extended.ts
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { toHiragana } from 'wanakana'
import {
  INDEX_GLOSS_MAX,
  POS_TO_CODE,
  TRANS_TO_CODE,
} from '../src/lib/data/ext-format'
import type {
  DatasetMeta,
  VerbEntry,
  VerbIndexRow,
  VocabEntry,
  VocabIndexRow,
} from '../src/lib/data/types'
import { buildWordIndex } from './lib/build-common'
import { buildVerbEntry, buildVocabEntry, type EntryCtx } from './lib/entry'
import { loadFuriganaIndex } from './lib/furigana'
import { writeJsonGz } from './lib/gzip-out'
import { initReading } from './lib/reading'
import type { JmdictFile } from './lib/jmdict'

const CACHE = join(import.meta.dirname, '.cache')
const DATA_DIR = join(import.meta.dirname, '..', 'src', 'data')
const PUB_DIR = join(import.meta.dirname, '..', 'public', 'data')

export const VERB_SHARDS = 32
export const VOCAB_SHARDS = 128

function jlptIds(dataset: 'verbs' | 'vocab'): Set<string> {
  const ids = new Set<string>()
  for (const level of [5, 4, 3, 2, 1]) {
    const words: { id: string }[] = JSON.parse(
      readFileSync(join(DATA_DIR, dataset, `n${level}.json`), 'utf8'),
    )
    for (const w of words) ids.add(w.id)
  }
  return ids
}

console.log('loading sources…')
await initReading() // example-sentence furigana (kuromoji)
const jmdict: JmdictFile = JSON.parse(readFileSync(join(CACHE, 'jmdict.json'), 'utf8'))
const furiganaIndex = loadFuriganaIndex(CACHE)
const index = buildWordIndex(jmdict.words)
const jlptVerbIds = jlptIds('verbs')
const jlptVocabIds = jlptIds('vocab')
console.log(
  `jmdict ${jmdict.words.length} words | already covered: ${jlptVerbIds.size} verbs, ${jlptVocabIds.size} vocab`,
)

const ctx: EntryCtx = { furiganaIndex, furiganaMisses: [] }
const verbs: VerbEntry[] = []
const vocab: VocabEntry[] = []
const rawXrefs = new Map<string, { ant: [string, string?][]; syn: [string, string?][] }>()

for (const word of jmdict.words) {
  if (!jlptVerbIds.has(word.id)) {
    const verb = buildVerbEntry(word, 0, ctx)
    if (verb) verbs.push(verb)
  }
  if (!jlptVocabIds.has(word.id)) {
    const built = buildVocabEntry(word, 0, ctx)
    if (built) {
      vocab.push(built.entry)
      if (built.ant.length > 0 || built.syn.length > 0) {
        rawXrefs.set(built.entry.id, { ant: built.ant, syn: built.syn })
      }
    }
  }
}
console.log(`built ${verbs.length} extended verbs, ${vocab.length} extended vocab`)

// resolve antonym/see-also targets to ids that exist somewhere in the app
// (either tier), so links on extended detail pages always resolve
const extVocabIds = new Set(vocab.map((e) => e.id))
const knownVocabId = (id: string) => extVocabIds.has(id) || jlptVocabIds.has(id)
for (const entry of vocab) {
  const raw = rawXrefs.get(entry.id)
  if (!raw) continue
  const resolve = (targets: [string, string?][]): string[] => [
    ...new Set(
      targets
        .map(([text, reading]) => index.find(text, reading ?? text)?.id)
        .filter((id): id is string => Boolean(id) && id !== entry.id && knownVocabId(id!)),
    ),
  ]
  const antonyms = resolve(raw.ant)
  const synonyms = resolve(raw.syn)
  if (antonyms.length > 0) entry.antonyms = antonyms
  if (synonyms.length > 0) entry.synonyms = synonyms
}

// common words first, then Japanese collation — the list page shows rows in
// index order until the user searches
const collator = new Intl.Collator('ja')
const byCommonThenKana = (a: { common: boolean; kana: string }, b: typeof a) =>
  Number(b.common) - Number(a.common) || collator.compare(a.kana, b.kana)
verbs.sort(byCommonThenKana)
vocab.sort(byCommonThenKana)

function writeTier<T extends VerbEntry | VocabEntry>(
  dir: string,
  entries: T[],
  shards: number,
  toRow: (e: T) => unknown[],
) {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  writeJsonGz(join(dir, 'index.json.gz'), entries.map(toRow))
  const byShard = new Map<number, Record<string, T>>()
  for (const e of entries) {
    const n = Number(e.id) % shards
    let shard = byShard.get(n)
    if (!shard) byShard.set(n, (shard = {}))
    shard[e.id] = e
  }
  for (let n = 0; n < shards; n++) {
    writeJsonGz(join(dir, `words-${n}.json.gz`), byShard.get(n) ?? {})
  }
}

const indexGloss = (g: string) =>
  g.length > INDEX_GLOSS_MAX ? g.slice(0, INDEX_GLOSS_MAX - 1) + '…' : g

/** Hiragana key, but only when it differs from the reading (katakana words). */
const hiraOf = (kana: string): [string] | [] => {
  const hira = toHiragana(kana)
  return hira === kana ? [] : [hira]
}

writeTier(join(PUB_DIR, 'verbs-ext'), verbs, VERB_SHARDS, (v): VerbIndexRow => [
  Number(v.id),
  v.kanji,
  v.kana,
  indexGloss(v.gloss[0]),
  v.class,
  (v.transitivity ? TRANS_TO_CODE[v.transitivity] : '') as VerbIndexRow[5],
  v.common ? 1 : 0,
  ...hiraOf(v.kana),
])
writeTier(join(PUB_DIR, 'vocab-ext'), vocab, VOCAB_SHARDS, (w): VocabIndexRow => [
  Number(w.id),
  w.kanji,
  w.kana,
  indexGloss(w.gloss[0]),
  POS_TO_CODE[w.pos],
  w.common ? 1 : 0,
  ...hiraOf(w.kana),
])

const metaPath = join(DATA_DIR, 'meta.json')
const meta: DatasetMeta = JSON.parse(readFileSync(metaPath, 'utf8'))
meta.extended = { verbs: verbs.length, vocab: vocab.length }
writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n')

writeFileSync(join(CACHE, 'furigana-misses-extended.txt'), ctx.furiganaMisses.join('\n') + '\n')
console.log(
  `done. verbs-ext ${verbs.length} | vocab-ext ${vocab.length} | furigana misses ${ctx.furiganaMisses.length}`,
)
