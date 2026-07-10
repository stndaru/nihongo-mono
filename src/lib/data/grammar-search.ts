import { toHiragana } from 'wanakana'
import { normalizeQuery } from './search'
import type { GrammarEntry } from './types'

/**
 * Grammar titles carry connective tildes (〜たことがある) and spaced romaji
 * ("hou ga ii"); queries usually have neither. Both sides are compared with
 * tildes and spaces stripped so "takotogaaru", "ta koto ga aru" and
 * たことがある all match.
 */
function foldKey(s: string): string {
  return s.replace(/[〜～\s]/g, '')
}

/**
 * Ranked substring search over title/kana/romaji/meaning, mirroring
 * searchWords' tiers: exact → prefix → substring → meaning. Empty query
 * returns the list unchanged (already easiest-level-first).
 */
export function searchGrammar(entries: GrammarEntry[], query: string): GrammarEntry[] {
  const q = normalizeQuery(query)
  if (!q) return entries
  return searchGrammarScored(entries, query).map((s) => s.entry)
}

/**
 * Same, keeping scores — the tiers share searchWordsScored's 0–3 scale, so
 * the command palette can merge grammar hits into one ranked word list.
 */
export function searchGrammarScored(
  entries: GrammarEntry[],
  query: string,
): { entry: GrammarEntry; score: number }[] {
  const q = normalizeQuery(query)
  if (!q) return entries.map((entry) => ({ entry, score: 0 }))
  const qFold = foldKey(q)
  const qKana = toHiragana(qFold)

  const scored: { entry: GrammarEntry; score: number }[] = []
  for (const entry of entries) {
    const score = scoreEntry(entry, q, qFold, qKana)
    if (score >= 0) scored.push({ entry, score })
  }
  scored.sort(
    (a, b) => a.score - b.score || a.entry.kana.localeCompare(b.entry.kana, 'ja'),
  )
  return scored
}

/**
 * Folded title/kana/romaji keys, memoized per entry — the entries are the
 * immutable, module-cached lists (loader.ts), so each key is computed once
 * instead of re-folding + re-toHiragana'ing all ~1,000 entries every
 * keystroke. Mirrors search.ts's kanaKey WeakMap.
 */
const foldKeys = new WeakMap<GrammarEntry, { title: string; kana: string; romaji: string }>()

function entryKeys(entry: GrammarEntry): { title: string; kana: string; romaji: string } {
  let keys = foldKeys.get(entry)
  if (keys === undefined) {
    keys = {
      title: foldKey(entry.title),
      kana: toHiragana(foldKey(entry.kana)),
      romaji: foldKey(entry.romaji.toLowerCase()),
    }
    foldKeys.set(entry, keys)
  }
  return keys
}

function scoreEntry(entry: GrammarEntry, q: string, qFold: string, qKana: string): number {
  const { title, kana, romaji } = entryKeys(entry)
  // exact
  if (kana === qKana || title === qFold || romaji === qFold) return 0
  // prefix
  if (kana.startsWith(qKana) || title.startsWith(qFold) || romaji.startsWith(qFold)) return 1
  // substring
  if (kana.includes(qKana) || title.includes(qFold) || romaji.includes(qFold)) return 2
  // meaning keeps its spaces — folding is for the ja/romaji keys only
  const meaning = entry.meaning.toLowerCase()
  if (meaning === q) return 1
  if (meaning.includes(q)) return 3
  return -1
}
