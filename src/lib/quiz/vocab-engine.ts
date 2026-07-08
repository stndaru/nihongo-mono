import type { VerbEntry, VocabEntry } from '@/lib/data/types'
import { shuffle } from './distractors'
import type { VocabQuizConfig } from './vocab-config'

/**
 * - reading: kanji word shown (no furigana), type the kana reading
 * - recall:  English meaning shown (kana-only word), type the word
 * - meaning: word shown with furigana, pick the English meaning
 * - word:    English meaning shown, pick the Japanese word
 */
export type VocabQuestionKind = 'reading' | 'recall' | 'meaning' | 'word'

export interface VocabQuestion {
  word: VocabEntry
  kind: VocabQuestionKind
  /** the word is a verb (dictionary form); detail links go to the verb page */
  verb?: boolean
  /** gloss options for 'meaning'; includes the answer, pre-shuffled */
  choices?: string[]
  /** word options for 'word'; includes the answer, pre-shuffled */
  wordChoices?: VocabEntry[]
}

/** First gloss is the canonical quiz answer for meaning questions. */
export function answerGloss(word: VocabEntry): string {
  return word.gloss[0] ?? ''
}

/**
 * Verbs (dictionary form: 食べる, 飲む…) as vocabulary-quiz words. Ids stay
 * the verb's id so progress stats pool with the conjugation quiz.
 */
export function verbQuizWords(verbs: VerbEntry[]): VocabEntry[] {
  return verbs.map((verb) => ({
    id: verb.id,
    kanji: verb.kanji,
    kana: verb.kana,
    romaji: verb.romaji,
    furigana: verb.furigana,
    gloss: verb.gloss,
    jlpt: verb.jlpt,
    common: verb.common,
    examples: verb.examples,
    senses: [],
    kanjiChars: [],
    pos: 'verb',
  }))
}

/**
 * Options for 'word' (English shown, pick the Japanese word): the answer
 * plus 3 distractor words, same part of speech preferred, deduped by both
 * surface and gloss so no option looks like — or means — the same thing.
 */
function buildWordChoices(word: VocabEntry, pool: VocabEntry[]): VocabEntry[] {
  const seenSurface = new Set([word.kanji, word.kana])
  const seenGloss = new Set([answerGloss(word).toLowerCase()])
  const distractors: VocabEntry[] = []
  const ordered = [
    ...shuffle(pool.filter((w) => w.pos === word.pos && w.id !== word.id)),
    ...shuffle(pool.filter((w) => w.pos !== word.pos)),
  ]
  for (const other of ordered) {
    const gloss = answerGloss(other).toLowerCase()
    if (!gloss || seenSurface.has(other.kanji) || seenSurface.has(other.kana) || seenGloss.has(gloss))
      continue
    seenSurface.add(other.kanji)
    seenSurface.add(other.kana)
    seenGloss.add(gloss)
    distractors.push(other)
    if (distractors.length === 3) break
  }
  return shuffle([word, ...distractors])
}

function buildGlossChoices(word: VocabEntry, pool: VocabEntry[]): string[] {
  const answer = answerGloss(word)
  const seen = new Set([answer.toLowerCase()])
  const distractors: string[] = []
  // prefer distractors of the same part of speech, fall back to any word
  const ordered = [
    ...shuffle(pool.filter((w) => w.pos === word.pos && w.id !== word.id)),
    ...shuffle(pool.filter((w) => w.pos !== word.pos)),
  ]
  for (const other of ordered) {
    const gloss = answerGloss(other)
    if (!gloss || seen.has(gloss.toLowerCase())) continue
    seen.add(gloss.toLowerCase())
    distractors.push(gloss)
    if (distractors.length === 3) break
  }
  return shuffle([answer, ...distractors])
}

/**
 * Builds a vocabulary quiz session. Less-seen words are drawn more often
 * (weight 1/(1+seen)); pass `seenCount` from the progress store. A word is
 * asked at most once per session — small pools give short sessions instead
 * of repeats.
 */
export function generateVocabSession(
  config: VocabQuizConfig,
  words: VocabEntry[],
  verbWords: VocabEntry[] = [],
  seenCount: (wordId: string) => number = () => 0,
): VocabQuestion[] {
  type PoolItem = { word: VocabEntry; verb: boolean }
  const pool: PoolItem[] = [
    ...words
      .filter((w) => config.pos.includes(w.pos) && w.gloss.length > 0)
      .map((word) => ({ word, verb: false })),
    ...(config.verbs
      ? verbWords.filter((w) => w.gloss.length > 0).map((word) => ({ word, verb: true }))
      : []),
  ]
  if (pool.length === 0) return []
  const glossPool = pool.map((p) => p.word)

  const weights = pool.map((p) => 1 / (1 + seenCount(p.word.id)))
  const totalWeight = weights.reduce((a, b) => a + b, 0)

  const pick = (): PoolItem => {
    let r = Math.random() * totalWeight
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i]
      if (r <= 0) return pool[i]
    }
    return pool[pool.length - 1]
  }

  const questions: VocabQuestion[] = []
  const used = new Set<string>()
  const maxAttempts = config.length * 20
  for (let attempt = 0; questions.length < config.length && attempt < maxAttempts; attempt++) {
    // never repeat a word within a session — a small pool ends it early
    if (used.size >= pool.length) break
    const { word, verb } = pick()
    if (used.has(word.id)) continue
    used.add(word.id)
    const mode = config.modes[Math.floor(Math.random() * config.modes.length)]
    const kind: VocabQuestionKind =
      mode === 'choice'
        ? 'meaning'
        : mode === 'choice-ja'
          ? 'word'
          : word.kanji !== word.kana
            ? 'reading'
            : 'recall'
    questions.push({
      word,
      kind,
      verb: verb || undefined,
      choices: kind === 'meaning' ? buildGlossChoices(word, glossPool) : undefined,
      wordChoices: kind === 'word' ? buildWordChoices(word, glossPool) : undefined,
    })
  }
  return questions
}
