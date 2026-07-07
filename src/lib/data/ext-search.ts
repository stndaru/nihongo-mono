import { toHiragana } from 'wanakana'
import { classGroup, type VerbClass } from '@/lib/conjugation'
import { deconjugate } from './deconjugate'
import { CODE_TO_POS, CODE_TO_TRANS } from './ext-format'
import { pairFurigana } from './furigana'
import type { VerbFilterState, VocabFilterState } from './search'
import type { VerbEntry, VerbIndexRow, VocabEntry, VocabIndexRow } from './types'

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
  const q = query.trim().toLowerCase()

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

export function searchVocabRows(
  rows: VocabIndexRow[],
  query: string,
  f: VocabFilterState,
  limit: number,
): ExtResult<VocabEntry> {
  const posCode = f.pos ? Object.entries(CODE_TO_POS).find(([, p]) => p === f.pos)?.[0] : undefined
  return scan(
    rows,
    query,
    limit,
    (r) => (!posCode || r[4] === posCode) && (!f.commonOnly || r[5] === 1),
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
      if (f.group && classGroup(r[4] as VerbClass) !== f.group) return false
      if (f.ending === 'ru' && !r[2].endsWith('る')) return false
      if (f.ending === 'other' && r[2].endsWith('る')) return false
      if (f.trans && r[5] !== 'b' && r[5] !== (f.trans === 'vt' ? 't' : 'i')) return false
      if (f.commonOnly && r[6] !== 1) return false
      return true
    },
    (r) => [r[1], r[2], r[7] ?? r[2], r[3], r[6]],
    matVerb,
  )
}
