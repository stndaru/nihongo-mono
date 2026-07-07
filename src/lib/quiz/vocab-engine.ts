import type { VocabEntry } from '@/lib/data/types'
import { shuffle } from './distractors'
import type { VocabQuizConfig } from './vocab-config'

/**
 * - reading: kanji word shown (no furigana), type the kana reading
 * - recall:  English meaning shown (kana-only word), type the word
 * - meaning: word shown with furigana, pick the English meaning
 */
export type VocabQuestionKind = 'reading' | 'recall' | 'meaning'

export interface VocabQuestion {
  word: VocabEntry
  kind: VocabQuestionKind
  /** gloss options for 'meaning'; includes the answer, pre-shuffled */
  choices?: string[]
}

/** First gloss is the canonical quiz answer for meaning questions. */
export function answerGloss(word: VocabEntry): string {
  return word.gloss[0] ?? ''
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
 * (weight 1/(1+seen)); pass `seenCount` from the progress store.
 */
export function generateVocabSession(
  config: VocabQuizConfig,
  words: VocabEntry[],
  seenCount: (wordId: string) => number = () => 0,
): VocabQuestion[] {
  const pool = words.filter((w) => config.pos.includes(w.pos) && w.gloss.length > 0)
  if (pool.length === 0) return []

  const weights = pool.map((w) => 1 / (1 + seenCount(w.id)))
  const totalWeight = weights.reduce((a, b) => a + b, 0)

  const pickWord = (): VocabEntry => {
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
    const word = pickWord()
    if (used.has(word.id) && used.size < pool.length) continue
    used.add(word.id)
    const mode = config.modes[Math.floor(Math.random() * config.modes.length)]
    const kind: VocabQuestionKind =
      mode === 'choice' ? 'meaning' : word.kanji !== word.kana ? 'reading' : 'recall'
    questions.push({
      word,
      kind,
      choices: kind === 'meaning' ? buildGlossChoices(word, pool) : undefined,
    })
  }
  return questions
}
