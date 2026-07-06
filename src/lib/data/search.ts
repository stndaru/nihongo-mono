import { toHiragana } from 'wanakana'
import { classGroup, type ClassGroup } from '@/lib/conjugation'
import type { VerbEntry } from './types'

export interface VerbFilterState {
  group?: ClassGroup
  /** 'ru' = dictionary form ends in る, 'other' = it doesn't */
  ending?: 'ru' | 'other'
  trans?: 'vt' | 'vi'
  commonOnly?: boolean
}

export function filterVerbs(verbs: VerbEntry[], f: VerbFilterState): VerbEntry[] {
  return verbs.filter((v) => {
    if (f.group && classGroup(v.class) !== f.group) return false
    if (f.ending === 'ru' && !v.kana.endsWith('る')) return false
    if (f.ending === 'other' && v.kana.endsWith('る')) return false
    if (f.trans && v.transitivity !== f.trans && v.transitivity !== 'both') return false
    if (f.commonOnly && !v.common) return false
    return true
  })
}

/**
 * Ranked substring search over kanji/kana/romaji/gloss.
 * Latin queries also match as kana, so "tabe", "たべ", "食べ" and "eat"
 * all find 食べる.
 */
export function searchVerbs(verbs: VerbEntry[], query: string): VerbEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return verbs
  // converts romaji → kana and katakana → hiragana in one step
  const qKana = toHiragana(q)

  const scored: { verb: VerbEntry; score: number }[] = []
  for (const verb of verbs) {
    const score = scoreVerb(verb, q, qKana)
    if (score >= 0) scored.push({ verb, score })
  }
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      Number(b.verb.common) - Number(a.verb.common) ||
      a.verb.kana.localeCompare(b.verb.kana, 'ja'),
  )
  return scored.map((s) => s.verb)
}

/** Hiragana-normalized readings so katakana verbs (コピーする) match too. */
const kanaKeys = new WeakMap<VerbEntry, string>()

function kanaKey(verb: VerbEntry): string {
  let key = kanaKeys.get(verb)
  if (key === undefined) {
    key = toHiragana(verb.kana)
    kanaKeys.set(verb, key)
  }
  return key
}

function scoreVerb(verb: VerbEntry, q: string, qKana: string): number {
  const kana = kanaKey(verb)
  // exact
  if (kana === qKana || verb.kanji === q || verb.romaji === q) return 0
  // prefix
  if (kana.startsWith(qKana) || verb.kanji.startsWith(q) || verb.romaji.startsWith(q)) return 1
  // substring
  if (kana.includes(qKana) || verb.kanji.includes(q) || verb.romaji.includes(q)) return 2
  // meaning
  for (const g of verb.gloss) {
    const lower = g.toLowerCase()
    if (lower === q || lower === `to ${q}`) return 1
    if (lower.includes(q)) return 3
  }
  return -1
}
