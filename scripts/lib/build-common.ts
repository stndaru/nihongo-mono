/** Shared helpers for the dataset build scripts. */
import type { ExampleSentence, WordSense } from '../../src/lib/data/types'
import { isCommon, type JmdictSense, type JmdictWord } from './jmdict'
import { sentenceFurigana } from './reading'

export const KANJI_CHAR_RE = /[㐀-鿿豈-﫿]/gu

export interface WordIndex {
  find: (expression: string, reading: string) => JmdictWord | undefined
  findById: (seq: string) => JmdictWord | undefined
}

export function buildWordIndex(words: JmdictWord[]): WordIndex {
  const byId = new Map<string, JmdictWord>(words.map((w) => [w.id, w]))
  const byKanjiText = new Map<string, JmdictWord[]>()
  const byKanaText = new Map<string, JmdictWord[]>()
  for (const word of words) {
    for (const k of word.kanji) {
      const list = byKanjiText.get(k.text)
      if (list) list.push(word)
      else byKanjiText.set(k.text, [word])
    }
    for (const k of word.kana) {
      const list = byKanaText.get(k.text)
      if (list) list.push(word)
      else byKanaText.set(k.text, [word])
    }
  }
  return {
    find(expression, reading) {
      const hasKanji = KANJI_CHAR_RE.test(expression)
      KANJI_CHAR_RE.lastIndex = 0
      const candidates =
        (hasKanji ? byKanjiText.get(expression) : byKanaText.get(expression)) ?? []
      if (candidates.length === 0) return undefined
      const readingMatches = candidates.filter((w) =>
        w.kana.some((k) => k.text === reading),
      )
      const pool = readingMatches.length > 0 ? readingMatches : candidates
      return pool.find(isCommon) ?? pool[0]
    },
    findById(seq) {
      return byId.get(seq)
    },
  }
}

/**
 * Normalizes a raw list row into one or more (expression, reading) pairs:
 * strips parenthetical usage hints, expands "在る; 有る" / "回る、回す"
 * multi-variant cells, and drops 〜/～ pattern rows (affixes, not words).
 */
export function expandRow(expression: string, reading: string): [string, string][] {
  if (/[~～〜]/.test(expression)) return []
  const clean = (s: string) => s.replace(/[（(][^）)]*[）)]/g, '').trim()
  const exprs = clean(expression).split(/\s*[;、,]\s*/).filter(Boolean)
  const readings = clean(reading).split(/\s*[;、,]\s*/).filter(Boolean)
  return exprs.map((e, i) => [e, readings[i] ?? readings[0] ?? e])
}

export function sensesGlosses(senses: JmdictSense[]): string[] {
  const gloss: string[] = []
  for (const s of senses) {
    const text = s.gloss[0]?.text
    if (text && !gloss.includes(text)) gloss.push(text)
    if (gloss.length === 3) break
  }
  return gloss
}

/** Attaches ruby segments (requires initReading() in the calling script). */
function withFurigana(ex: { ja: string; en: string }): ExampleSentence {
  const f = sentenceFurigana(ex.ja)
  return f ? { ...ex, f } : ex
}

export function sensesExamples(senses: JmdictSense[]): ExampleSentence[] {
  const all: { ja: string; en: string }[] = []
  for (const s of senses) {
    for (const ex of s.examples) {
      const ja = ex.sentences.find((x) => x.lang === 'jpn')?.text
      const en = ex.sentences.find((x) => x.lang === 'eng')?.text
      if (ja && en) all.push({ ja, en })
    }
  }
  // shortest Japanese sentences read easiest in a compact UI
  all.sort((a, b) => a.ja.length - b.ja.length)
  return all.slice(0, 3).map(withFurigana)
}

export function kanjiCharsOf(kanji: string): string[] {
  return [...new Set(kanji.match(KANJI_CHAR_RE) ?? [])]
}

/**
 * Full per-sense meanings for the detail page: every sense keeps its own
 * glosses and up to 2 of its own example sentences.
 */
export function sensesDetail(senses: JmdictSense[]): WordSense[] {
  return senses.slice(0, 8).map((s) => ({
    gloss: s.gloss.slice(0, 5).map((g) => g.text),
    examples: s.examples
      .map((ex) => ({
        ja: ex.sentences.find((x) => x.lang === 'jpn')?.text ?? '',
        en: ex.sentences.find((x) => x.lang === 'eng')?.text ?? '',
      }))
      .filter((e) => e.ja && e.en)
      .slice(0, 2)
      .map(withFurigana),
  }))
}

/** Only the primary sense decides kana-only display (行く has a rare uk sense). */
export function usuallyKana(senses: JmdictSense[]): boolean {
  return senses[0]?.misc.includes('uk') ?? false
}
