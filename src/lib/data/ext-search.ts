import { toHiragana } from 'wanakana'
import { classGroup, type VerbClass } from '@/lib/conjugation'
import { deconjugate } from './deconjugate'
import { CODE_TO_POS, CODE_TO_TRANS } from './ext-format'
import { pairFurigana } from './furigana'
import { constrains, normalizeQuery, type VerbFilterState, type VocabFilterState } from './search'
import type {
  KanjiWordRow,
  VerbEntry,
  VerbIndexRow,
  VocabEntry,
  VocabIndexRow,
} from './types'

/**
 * Search over the extended tier's raw index rows. The index holds ~200k
 * entries, so nothing here may allocate per row: rows are scored as plain
 * tuples and only the winners are materialized into entries. (A first cut
 * materialized every row up-front — 200k objects with furigana arrays plus a
 * kana-conversion per row froze the tab.)
 */

export interface ExtResult<T> {
  entries: T[]
  /** matches before the cap, so the UI can say "showing X of Y" */
  total: number
}

/** Same ranking as searchWords: exact 0 · deconjugated 0.5 · prefix 1 · substring 2 · gloss 3. */
function scoreRow(
  kanji: string,
  hira: string,
  gloss: string,
  q: string,
  qKana: string,
  deconj: Set<string>,
): number {
  if (hira === qKana || kanji === q) return 0
  if (deconj.size > 0 && (deconj.has(hira) || deconj.has(kanji))) return 0.5
  if (hira.startsWith(qKana) || kanji.startsWith(q)) return 1
  if (hira.includes(qKana) || kanji.includes(q)) return 2
  const lower = gloss.toLowerCase()
  if (lower === q || lower === `to ${q}`) return 1
  if (lower.includes(q)) return 3
  return -1
}

/**
 * Generic scan: `filter` and `read` see the raw row; only the capped result
 * set goes through `materialize`.
 */
function scan<R, T>(
  rows: R[],
  query: string,
  limit: number,
  filter: (row: R) => boolean,
  read: (row: R) => [kanji: string, kana: string, hira: string, gloss: string, common: 0 | 1],
  materialize: (row: R) => T,
): ExtResult<T> {
  const q = normalizeQuery(query)

  if (!q) {
    // no query: rows are pre-sorted common-first at build time
    const picked: R[] = []
    let total = 0
    for (const row of rows) {
      if (!filter(row)) continue
      total++
      if (picked.length < limit) picked.push(row)
    }
    return { entries: picked.map(materialize), total }
  }

  const qKana = toHiragana(q)
  const deconj = deconjugate(qKana)
  const scored: { row: R; score: number; common: 0 | 1; kana: string }[] = []
  for (const row of rows) {
    if (!filter(row)) continue
    const [kanji, kana, hira, gloss, common] = read(row)
    const score = scoreRow(kanji, hira, gloss, q, qKana, deconj)
    if (score >= 0) scored.push({ row, score, common, kana })
  }
  scored.sort(
    (a, b) => a.score - b.score || b.common - a.common || a.kana.localeCompare(b.kana, 'ja'),
  )
  return {
    total: scored.length,
    entries: scored.slice(0, limit).map((s) => materialize(s.row)),
  }
}

// list rows have no senses/examples/kanji breakdown — the detail page loads
// the full entry from its shard
const EMPTY: never[] = []

function matVocab(row: VocabIndexRow): VocabEntry {
  const [id, kanji, kana, gloss, pos, common] = row
  return {
    id: String(id),
    kanji,
    kana,
    romaji: '',
    furigana: pairFurigana(kanji, kana),
    gloss: [gloss],
    jlpt: 0,
    common: common === 1,
    examples: EMPTY,
    senses: EMPTY,
    kanjiChars: EMPTY,
    pos: CODE_TO_POS[pos] ?? 'other',
  }
}

function matVerb(row: VerbIndexRow): VerbEntry {
  const [id, kanji, kana, gloss, cls, trans, common] = row
  return {
    id: String(id),
    kanji,
    kana,
    romaji: '',
    furigana: pairFurigana(kanji, kana),
    gloss: [gloss],
    jlpt: 0,
    common: common === 1,
    examples: EMPTY,
    senses: EMPTY,
    kanjiChars: EMPTY,
    class: cls as VerbClass,
    transitivity: CODE_TO_TRANS[trans] ?? null,
  }
}

/** Extra type preferences per queried surface (sentence-parser context). */
export interface SurfacePreferences {
  /** counter-position surfaces (146本): prefer pos=ct rows */
  counters?: ReadonlySet<string>
  /** reading candidates of katakana surfaces (イチョウ → いちょう): a
   *  katakana spelling signals the kana-native word (the ginkgo, not 胃腸
   *  rendered in katakana), so prefer rows written entirely in kana */
  kanaNative?: ReadonlySet<string>
}

export interface VocabSurfaceHits {
  /** best row per queried surface */
  entries: Map<string, VocabEntry>
  /** the first few rows per queried surface — homograph alternatives for
   *  the summary popup (胃腸/医長/… for いちょう) */
  alternates: Map<string, VocabEntry[]>
}

/** popup alternatives cap is 4; +1 leaves room for the chosen entry itself */
const MAX_SURFACE_ALTERNATES = 5

/**
 * Exact-surface lookups for the sentence parser's Beyond linking: one pass
 * over the raw rows, materializing only the handful of matches. Rows are
 * common-first, so ties keep the earliest row; `readings` (kuromoji's
 * hiragana reading per surface, when known) outranks everything — 屋 read
 * や must return 屋/や "shop", not whichever 屋 row comes first (屋/おく) —
 * and `prefer` breaks reading ties by row type (counter / kana-native).
 * The pass no longer early-exits: it also collects per-surface alternate
 * lists for the popup, and in practice any surface absent from the index
 * (most sentences have one) already forced a full scan — the per-row work
 * is Set membership, far lighter than the scored search scans (decision 10).
 */
export function findVocabRowsBySurface(
  rows: VocabIndexRow[],
  surfaces: ReadonlySet<string>,
  readings?: ReadonlyMap<string, string>,
  prefer?: SurfacePreferences,
): VocabSurfaceHits {
  if (surfaces.size === 0) return { entries: new Map(), alternates: new Map() }
  const best = new Map<string, { row: VocabIndexRow; score: number }>()
  const lists = new Map<string, VocabIndexRow[]>()
  const rowReading = (row: VocabIndexRow) => row[6] ?? row[2]
  const scoreFor = (surface: string, row: VocabIndexRow): number => {
    const wanted = readings?.get(surface)
    let score = 0
    if (!wanted || rowReading(row) === wanted) score += 2
    if (prefer?.counters?.has(surface)) {
      if (row[4] === 'ct') score += 1
    } else if (prefer?.kanaNative?.has(surface)) {
      if (row[1] === row[2]) score += 1
    } else {
      score += 1 // no type preference — nothing to distinguish
    }
    return score
  }
  const consider = (surface: string, row: VocabIndexRow) => {
    const score = scoreFor(surface, row)
    const prev = best.get(surface)
    if (!prev || score > prev.score) best.set(surface, { row, score })
    const list = lists.get(surface)
    if (!list) lists.set(surface, [row])
    else if (list.length < MAX_SURFACE_ALTERNATES) list.push(row)
  }
  for (const row of rows) {
    if (surfaces.has(row[1])) consider(row[1], row)
    if (row[2] !== row[1] && surfaces.has(row[2])) consider(row[2], row)
  }
  return {
    entries: new Map([...best].map(([s, b]) => [s, matVocab(b.row)])),
    alternates: new Map([...lists].map(([s, l]) => [s, l.map(matVocab)])),
  }
}

export function findVerbRowsBySurface(
  rows: VerbIndexRow[],
  surfaces: ReadonlySet<string>,
): Map<string, VerbEntry> {
  if (surfaces.size === 0) return new Map()
  const hits = new Map<string, VerbIndexRow>()
  for (const row of rows) {
    if (hits.size >= surfaces.size) break
    if (surfaces.has(row[1]) && !hits.has(row[1])) hits.set(row[1], row)
    if (surfaces.has(row[2]) && !hits.has(row[2])) hits.set(row[2], row)
  }
  return new Map([...hits].map(([surface, row]) => [surface, matVerb(row)]))
}

/**
 * Every extended-tier word whose written form uses the kanji — the kanji
 * detail page's "Load All Words". Returns table-ready KanjiWordRow tuples
 * (jlpt 0 → Beyond badge), common first then kana order; furigana is
 * whole-word ruby via pairFurigana, materialized only for actual hits.
 */
export function findWordRowsByKanji(
  verbRows: VerbIndexRow[],
  vocabRows: VocabIndexRow[],
  char: string,
): KanjiWordRow[] {
  const hits: { row: KanjiWordRow; common: 0 | 1; kana: string }[] = []
  for (const r of verbRows) {
    if (r[1].includes(char))
      hits.push({
        row: [String(r[0]), 1, 0, r[2], r[3], pairFurigana(r[1], r[2])],
        common: r[6],
        kana: r[2],
      })
  }
  for (const r of vocabRows) {
    if (r[1].includes(char))
      hits.push({
        row: [String(r[0]), 0, 0, r[2], r[3], pairFurigana(r[1], r[2])],
        common: r[5],
        kana: r[2],
      })
  }
  hits.sort((a, b) => b.common - a.common || a.kana.localeCompare(b.kana, 'ja'))
  return hits.map((h) => h.row)
}

export function searchVocabRows(
  rows: VocabIndexRow[],
  query: string,
  f: VocabFilterState,
  limit: number,
): ExtResult<VocabEntry> {
  const posCodes = constrains(f.pos)
    ? new Set(
        Object.entries(CODE_TO_POS)
          .filter(([, p]) => f.pos!.includes(p))
          .map(([code]) => code),
      )
    : null
  return scan(
    rows,
    query,
    limit,
    (r) => (!posCodes || posCodes.has(r[4])) && (!f.commonOnly || r[5] === 1),
    (r) => [r[1], r[2], r[6] ?? r[2], r[3], r[5]],
    matVocab,
  )
}

export function searchVerbRows(
  rows: VerbIndexRow[],
  query: string,
  f: VerbFilterState,
  limit: number,
): ExtResult<VerbEntry> {
  return scan(
    rows,
    query,
    limit,
    (r) => {
      if (constrains(f.groups) && !f.groups.includes(classGroup(r[4] as VerbClass))) return false
      if (constrains(f.endings) && !f.endings.includes(r[2].endsWith('る') ? 'ru' : 'other'))
        return false
      if (
        constrains(f.trans) &&
        r[5] !== 'b' &&
        !f.trans.some((t) => r[5] === (t === 'vt' ? 't' : 'i'))
      )
        return false
      if (f.commonOnly && r[6] !== 1) return false
      return true
    },
    (r) => [r[1], r[2], r[7] ?? r[2], r[3], r[6]],
    matVerb,
  )
}
