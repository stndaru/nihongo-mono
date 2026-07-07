/**
 * Entry builders shared by the JLPT-tier scripts (build-verbs, build-vocab)
 * and the extended-tier script (build-extended), so both tiers are shaped by
 * exactly the same rules.
 */
import { toRomaji } from 'wanakana'
import type { VerbClass } from '../../src/lib/conjugation'
import type { VerbEntry, VocabEntry, WordLevel } from '../../src/lib/data/types'
import {
  kanjiCharsOf,
  sensesDetail,
  sensesExamples,
  sensesGlosses,
  usuallyKana,
} from './build-common'
import { furiganaFor, type FuriganaIndex } from './furigana'
import {
  displayKana,
  displayKanji,
  isCommon,
  xrefTargets,
  type JmdictSense,
  type JmdictWord,
} from './jmdict'
import { classifyPos, tagsOfPos, VERB_CLASSES } from './pos'

export interface EntryCtx {
  furiganaIndex: FuriganaIndex
  furiganaMisses: string[]
}

export function transitivityOf(senses: JmdictSense[]): VerbEntry['transitivity'] {
  const pos = new Set(senses.flatMap((s) => s.partOfSpeech))
  const vt = pos.has('vt')
  const vi = pos.has('vi')
  if (vt && vi) return 'both'
  if (vt) return 'vt'
  if (vi) return 'vi'
  return null
}

/**
 * Builds a conjugatable verb entry: a supported-class verb, or a noun+する
 * compound synthesized from its vs senses. Returns null when the word is
 * neither (the caller decides whether that's worth logging).
 */
export function buildVerbEntry(
  word: JmdictWord,
  level: WordLevel,
  ctx: EntryCtx,
): VerbEntry | null {
  // senses that describe a supported verb class
  const verbSenses = word.sense.filter((s) =>
    s.partOfSpeech.some((p) => VERB_CLASSES.has(p) || p === 'vs-i'),
  )
  const suruSenses = word.sense.filter((s) => s.partOfSpeech.includes('vs'))

  const kanjiForm = displayKanji(word)
  const kanaForm = displayKana(word, kanjiForm?.text)
  if (!kanaForm) return null
  const kana = kanaForm.text

  if (verbSenses.length > 0) {
    const pos = verbSenses[0].partOfSpeech
    const cls = (pos.find((p) => VERB_CLASSES.has(p)) ??
      (pos.includes('vs-i') ? 'vs' : undefined)) as VerbClass | undefined
    if (!cls) return null
    // vs-i entries must actually end in する for the engine to conjugate them
    if (cls === 'vs' && !kana.endsWith('する')) return null
    const gloss = sensesGlosses(verbSenses)
    if (gloss.length === 0) return null
    const kanji = !kanjiForm || usuallyKana(verbSenses) ? kana : kanjiForm.text
    return {
      id: word.id,
      kanji,
      kana,
      romaji: toRomaji(kana),
      furigana: furiganaFor(ctx.furiganaIndex, kanji, kana, ctx.furiganaMisses),
      gloss,
      jlpt: level,
      common: isCommon(word),
      examples: sensesExamples(verbSenses),
      senses: sensesDetail(verbSenses),
      class: cls,
      transitivity: transitivityOf(verbSenses),
      kanjiChars: kanjiCharsOf(kanji),
    }
  }

  if (suruSenses.length > 0) {
    // noun + する compound (勉強 → 勉強する)
    const gloss = sensesGlosses(suruSenses)
    if (gloss.length === 0) return null
    const baseKanji = !kanjiForm || usuallyKana(suruSenses) ? kana : kanjiForm.text
    const kanji = baseKanji + 'する'
    return {
      id: word.id,
      kanji,
      kana: kana + 'する',
      romaji: toRomaji(kana + 'する'),
      furigana: [
        ...furiganaFor(ctx.furiganaIndex, baseKanji, kana, ctx.furiganaMisses),
        { t: 'する' },
      ],
      gloss,
      jlpt: level,
      common: isCommon(word),
      examples: sensesExamples(suruSenses),
      senses: sensesDetail(suruSenses),
      class: 'vs',
      transitivity: transitivityOf(suruSenses),
      kanjiChars: kanjiCharsOf(kanji),
    }
  }

  return null
}

export interface BuiltVocab {
  entry: VocabEntry
  /** raw antonym / see-also xref targets, resolved to ids by the caller */
  ant: [string, string?][]
  syn: [string, string?][]
}

export function buildVocabEntry(
  word: JmdictWord,
  level: WordLevel,
  ctx: EntryCtx,
): BuiltVocab | null {
  const pos = classifyPos(word)
  if (!pos) return null

  const posTags = tagsOfPos(pos)
  const senses = word.sense.filter((s) => s.partOfSpeech.some((t) => posTags.has(t)))
  const gloss = sensesGlosses(senses)
  if (gloss.length === 0) return null

  const kanjiForm = displayKanji(word)
  const kanaForm = displayKana(word, kanjiForm?.text)
  if (!kanaForm) return null
  const kana = kanaForm.text
  const kanji = !kanjiForm || usuallyKana(senses) ? kana : kanjiForm.text
  return {
    entry: {
      id: word.id,
      kanji,
      kana,
      romaji: toRomaji(kana),
      furigana: furiganaFor(ctx.furiganaIndex, kanji, kana, ctx.furiganaMisses),
      gloss,
      jlpt: level,
      common: isCommon(word),
      examples: sensesExamples(senses),
      senses: sensesDetail(senses),
      kanjiChars: kanjiCharsOf(kanji),
      pos,
    },
    ant: senses.flatMap((s) => xrefTargets(s.antonym)),
    syn: senses.flatMap((s) => xrefTargets(s.related)),
  }
}
