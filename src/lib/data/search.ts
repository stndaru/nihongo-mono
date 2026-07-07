import { toHiragana } from 'wanakana'
import { classGroup, type ClassGroup } from '@/lib/conjugation'
import { deconjugate } from './deconjugate'
import type { VerbEntry, VocabEntry, VocabPos, WordBase } from './types'

/**
 * Filter groups are multi-select: an empty (or absent) list means "no
 * constraint" — the standard chips convention, and what makes the filter
 * labels' select-all/deselect-all toggle meaningful.
 */
export interface VerbFilterState {
  groups?: ClassGroup[]
  /** 'ru' = dictionary form ends in る, 'other' = it doesn't */
  endings?: ('ru' | 'other')[]
  trans?: ('vt' | 'vi')[]
  commonOnly?: boolean
}

/** True when the list actually constrains (non-empty). */
export function constrains<T>(list: readonly T[] | undefined): list is readonly T[] {
  return list !== undefined && list.length > 0
}

/**
 * Query normalization shared by every search entry point. NFKC folds
 * full-width latin (ＴＡＢＥＲＵ — a common leftover from typing with the
 * IME on) and half-width katakana into the forms the indexes store;
 * wanakana alone converts neither.
 */
export function normalizeQuery(query: string): string {
  return query.normalize('NFKC').trim().toLowerCase()
}

export function filterVerbs(verbs: VerbEntry[], f: VerbFilterState): VerbEntry[] {
  return verbs.filter((v) => {
    if (constrains(f.groups) && !f.groups.includes(classGroup(v.class))) return false
    if (constrains(f.endings) && !f.endings.includes(v.kana.endsWith('る') ? 'ru' : 'other'))
      return false
    if (
      constrains(f.trans) &&
      v.transitivity !== 'both' &&
      !f.trans.includes(v.transitivity as 'vt' | 'vi')
    )
      return false
    if (f.commonOnly && !v.common) return false
    return true
  })
}

export interface VocabFilterState {
  pos?: VocabPos[]
  commonOnly?: boolean
}

export function filterVocab(words: VocabEntry[], f: VocabFilterState): VocabEntry[] {
  return words.filter((w) => {
    if (constrains(f.pos) && !f.pos.includes(w.pos)) return false
    if (f.commonOnly && !w.common) return false
    return true
  })
}

/**
 * Ranked substring search over kanji/kana/romaji/gloss.
 * Latin queries also match as kana, so "tabe", "たべ", "食べ" and "eat"
 * all find 食べる — and conjugated queries deconjugate, so "tabeta" and
 * "samukatta" find 食べる and 寒い. Works for any word type.
 */
export function searchWords<T extends WordBase>(words: T[], query: string): T[] {
  return searchWordsScored(words, query).map((s) => s.word)
}

/** Same, keeping scores — lets callers merge ranked lists (command palette). */
export function searchWordsScored<T extends WordBase>(
  words: T[],
  query: string,
): { word: T; score: number }[] {
  const q = normalizeQuery(query)
  if (!q) return words.map((word) => ({ word, score: 0 }))
  // converts romaji → kana and katakana → hiragana in one step
  const qKana = toHiragana(q)
  // candidate dictionary forms of a conjugated query — computed once
  const deconj = deconjugate(qKana)

  const scored: { word: T; score: number }[] = []
  for (const word of words) {
    const score = scoreWord(word, q, qKana, deconj)
    if (score >= 0) scored.push({ word, score })
  }
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      Number(b.word.common) - Number(a.word.common) ||
      a.word.kana.localeCompare(b.word.kana, 'ja'),
  )
  return scored
}

/** Hiragana-normalized readings so katakana words (コピーする) match too. */
const kanaKeys = new WeakMap<WordBase, string>()

function kanaKey(word: WordBase): string {
  let key = kanaKeys.get(word)
  if (key === undefined) {
    key = toHiragana(word.kana)
    kanaKeys.set(word, key)
  }
  return key
}

function scoreWord(word: WordBase, q: string, qKana: string, deconj: Set<string>): number {
  const kana = kanaKey(word)
  // exact
  if (kana === qKana || word.kanji === q || word.romaji === q) return 0
  // the query is a conjugated form of this word ("tabeta" → 食べる)
  if (deconj.size > 0 && (deconj.has(kana) || deconj.has(word.kanji))) return 0.5
  // prefix
  if (kana.startsWith(qKana) || word.kanji.startsWith(q) || word.romaji.startsWith(q)) return 1
  // substring
  if (kana.includes(qKana) || word.kanji.includes(q) || word.romaji.includes(q)) return 2
  // meaning
  for (const g of word.gloss) {
    const lower = g.toLowerCase()
    if (lower === q || lower === `to ${q}`) return 1
    if (lower.includes(q)) return 3
  }
  return -1
}
