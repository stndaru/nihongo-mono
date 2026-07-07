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

/** One dictionary sense: its glosses plus example sentences for that sense. */
export interface WordSense {
  gloss: string[]
  examples: ExampleSentence[]
}

export type JlptLevel = 1 | 2 | 3 | 4 | 5

/**
 * A word's level: a JLPT level, or 0 for the extended tier — entries from
 * the full JMdict that appear on no JLPT list ("beyond JLPT").
 */
export type WordLevel = JlptLevel | 0

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
  jlpt: WordLevel
  /** From JMdict priority tags (news1/ichi1/spec1/gai1). */
  common: boolean
  /** Up to 3, from the Tanaka corpus via JMdict. */
  examples: ExampleSentence[]
  /** All dictionary senses with their own examples (detail-page accordion). */
  senses: WordSense[]
  /** Unique kanji characters used — keys into the kanji dataset. */
  kanjiChars: string[]
}

export interface VerbEntry extends WordBase {
  class: VerbClass
  transitivity: 'vt' | 'vi' | 'both' | null
}

export type VocabPos =
  | 'noun'
  | 'adj-i'
  | 'adj-na'
  | 'adverb'
  | 'expression'
  | 'interjection'
  | 'pronoun'
  | 'particle'
  | 'conjunction'
  | 'counter'
  | 'prefix'
  | 'suffix'
  /** verb classes the conjugation engine doesn't support (archaic 二段/四段 etc.) */
  | 'verb'
  | 'other'

export interface VocabEntry extends WordBase {
  pos: VocabPos
  /** ids of antonyms that exist in this dataset (JMdict ant xrefs) */
  antonyms?: string[]
  /** ids of related/see-also words in this dataset (JMdict xrefs) */
  synonyms?: string[]
}

export interface KanjiEntry {
  char: string
  meanings: string[]
  /** On'yomi readings (katakana). */
  on: string[]
  /** Kun'yomi readings (hiragana). */
  kun: string[]
  /** Visual components from KRADFILE (radical decomposition). */
  components?: string[]
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
  /** Beyond-JLPT tier sizes (full JMdict, served from public/data). */
  extended?: { verbs: number; vocab: number }
  /** JMnedict proper-name entries (served from public/data/names). */
  namesCount?: number
}

/**
 * Compact list row of the extended tier's search index
 * (public/data/vocab-ext/index.json). Detail entries live in id-hash shards.
 * `pos`/`trans` use the short codes from ext-format.ts; `hira` is present
 * only when the hiragana reading differs from `kana` (katakana words), so
 * search never has to kana-convert 200k rows in the browser.
 */
export type VocabIndexRow = [
  id: number,
  kanji: string,
  kana: string,
  gloss: string,
  pos: string,
  common: 0 | 1,
  hira?: string,
]

export type VerbIndexRow = [
  id: number,
  kanji: string,
  kana: string,
  gloss: string,
  cls: string,
  trans: '' | 't' | 'i' | 'b',
  common: 0 | 1,
  hira?: string,
]

/** One JMnedict proper-name row: [kanji ('' if kana-only), kana, types csv, romanization]. */
export type NameRow = [kanji: string, kana: string, types: string, gloss: string]
