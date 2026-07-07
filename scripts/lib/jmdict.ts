/** Minimal types for the jmdict-simplified JSON shape (observed 3.6.x). */

export interface JmdictKanji {
  common: boolean
  text: string
  tags: string[]
}

export interface JmdictKana {
  common: boolean
  text: string
  tags: string[]
  appliesToKanji: string[]
}

export interface JmdictExampleSentence {
  lang: string
  text: string
}

export interface JmdictExample {
  source: { type: string; value: string }
  text: string
  sentences: JmdictExampleSentence[]
}

export interface JmdictSense {
  partOfSpeech: string[]
  appliesToKanji: string[]
  appliesToKana: string[]
  misc: string[]
  /** cross-references: [targetText, maybeReading?, maybeSenseNum?] */
  related: (string | number)[][]
  antonym: (string | number)[][]
  gloss: { lang: string; text: string }[]
  examples: JmdictExample[]
}

/** Extracts (text, reading?) pairs from xref arrays. */
export function xrefTargets(xrefs: (string | number)[][]): [string, string?][] {
  return xrefs.map((x) => {
    const texts = x.filter((p): p is string => typeof p === 'string')
    return [texts[0], texts[1]] as [string, string?]
  }).filter(([t]) => Boolean(t))
}

export interface JmdictWord {
  id: string
  kanji: JmdictKanji[]
  kana: JmdictKana[]
  sense: JmdictSense[]
}

export interface JmdictFile {
  version: string
  dictDate: string
  words: JmdictWord[]
}

/** Kanji/kana forms marked search-only or rare — not for display. */
const HIDDEN_TAGS = new Set(['sK', 'sk', 'rK', 'rk', 'ik', 'iK', 'oK', 'ok'])

export function displayKanji(word: JmdictWord): JmdictKanji | undefined {
  const visible = word.kanji.filter((k) => !k.tags.some((t) => HIDDEN_TAGS.has(t)))
  return visible.find((k) => k.common) ?? visible[0]
}

export function displayKana(word: JmdictWord, forKanji?: string): JmdictKana | undefined {
  const visible = word.kana.filter(
    (k) =>
      !k.tags.some((t) => HIDDEN_TAGS.has(t)) &&
      (forKanji === undefined ||
        k.appliesToKanji.includes('*') ||
        k.appliesToKanji.includes(forKanji)),
  )
  return visible.find((k) => k.common) ?? visible[0]
}

export function isCommon(word: JmdictWord): boolean {
  return word.kanji.some((k) => k.common) || word.kana.some((k) => k.common)
}
