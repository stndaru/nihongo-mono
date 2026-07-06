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
  gloss: { lang: string; text: string }[]
  examples: JmdictExample[]
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
