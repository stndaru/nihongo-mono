// relative (not @/) so the scripts/ tsconfig project can consume this file too
import type { VerbClass } from '../conjugation'

/**
 * One ruby segment: `t` is the surface text, `r` its reading.
 * `r` is absent for runs already written in kana.
 * 食べる → [{t:"食", r:"た"}, {t:"べる"}]
 */
export interface FuriganaSegment {
  t: string
  r?: string
}

export interface ExampleSentence {
  ja: string
  en: string
}

export type JlptLevel = 1 | 2 | 3 | 4 | 5

/** Fields shared by verbs and (future) vocabulary entries. */
export interface WordBase {
  /** JMdict sequence number — stable, used as the route param. */
  id: string
  /** Display form; equals `kana` for kana-only words (e.g. する). */
  kanji: string
  kana: string
  /** Precomputed for latin search. */
  romaji: string
  furigana: FuriganaSegment[]
  /** Up to 3 senses. */
  gloss: string[]
  jlpt: JlptLevel
  /** From JMdict priority tags (news1/ichi1/spec1/gai1). */
  common: boolean
  /** Up to 3, from the Tanaka corpus via JMdict. */
  examples: ExampleSentence[]
  /** Unique kanji characters used — keys into the kanji dataset. */
  kanjiChars: string[]
}

export interface VerbEntry extends WordBase {
  class: VerbClass
  transitivity: 'vt' | 'vi' | 'both' | null
}

export type VocabPos = 'noun' | 'adj-i' | 'adj-na' | 'adverb'

export interface VocabEntry extends WordBase {
  pos: VocabPos
}

export interface KanjiEntry {
  char: string
  meanings: string[]
  /** On'yomi readings (katakana). */
  on: string[]
  /** Kun'yomi readings (hiragana). */
  kun: string[]
  strokes: number
  jlpt: JlptLevel | null
  /** School grade (1–6 kyouiku, 8 jouyou, 9/10 jinmeiyou). */
  grade: number | null
  /** Newspaper frequency rank (1 = most frequent), null if unranked. */
  freq: number | null
}

export interface DatasetMeta {
  generated: string
  sources: Record<string, string>
  verbCounts: Record<`n${JlptLevel}`, number>
  vocabCounts?: Record<`n${JlptLevel}`, number>
  kanjiCount: number
}
