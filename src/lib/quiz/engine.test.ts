import { describe, expect, it } from 'vitest'
import type { VerbEntry, VocabEntry } from '@/lib/data/types'
import type { QuizConfig } from './config'
import { generateSession } from './engine'
import { generateVocabSession, verbQuizWords } from './vocab-engine'
import type { VocabQuizConfig } from './vocab-config'

const verb = (id: string, kanji: string, kana: string, cls: VerbEntry['class']): VerbEntry => ({
  id,
  kanji,
  kana,
  romaji: '',
  furigana: [{ t: kanji, r: kana }],
  gloss: [`gloss ${id}`],
  jlpt: 5,
  common: true,
  examples: [],
  senses: [],
  kanjiChars: [],
  class: cls,
  transitivity: null,
})

const word = (id: string, kanji: string, kana: string): VocabEntry => ({
  id,
  kanji,
  kana,
  romaji: '',
  furigana: [{ t: kanji, r: kana }],
  gloss: [`gloss ${id}`],
  jlpt: 5,
  common: true,
  examples: [],
  senses: [],
  kanjiChars: [],
  pos: 'noun',
})

const VERBS = [
  verb('1', '食べる', 'たべる', 'v1'),
  verb('2', '書く', 'かく', 'v5k'),
  verb('3', '飲む', 'のむ', 'v5m'),
]

const verbConfig = (forms: QuizConfig['forms']): QuizConfig => ({
  levels: [5],
  groups: ['godan', 'ichidan', 'suru', 'kuru'],
  forms,
  modes: ['input'],
  length: 10,
})

describe('generateSession (verbs)', () => {
  it('never asks for the form already shown (non-past = dictionary form)', () => {
    expect(generateSession(verbConfig(['non-past']), VERBS)).toHaveLength(0)
  })

  it('answers never equal the displayed dictionary surface', () => {
    const questions = generateSession(verbConfig(['non-past', 'negative', 'past']), VERBS)
    expect(questions.length).toBeGreaterThan(0)
    for (const q of questions) {
      expect(q.answer.kana).not.toBe(q.verb.kana)
    }
  })
})

const vocabConfig = (over: Partial<VocabQuizConfig> = {}): VocabQuizConfig => ({
  levels: [5],
  pos: ['noun', 'adj-i', 'adj-na', 'adverb'],
  modes: ['input', 'choice'],
  length: 10,
  verbs: false,
  ...over,
})

describe('generateVocabSession', () => {
  const WORDS = [word('a', '水', 'みず'), word('b', '山', 'やま'), word('c', '川', 'かわ')]

  it('never repeats a word — small pools end the session early', () => {
    const questions = generateVocabSession(vocabConfig(), WORDS)
    expect(questions).toHaveLength(3)
    expect(new Set(questions.map((q) => q.word.id)).size).toBe(3)
  })

  it('includes dictionary-form verbs only when configured', () => {
    const verbWords = verbQuizWords(VERBS)
    expect(verbWords.map((v) => v.kanji)).toEqual(['食べる', '書く', '飲む'])
    const withVerbs = generateVocabSession(vocabConfig({ verbs: true }), WORDS, verbWords)
    expect(withVerbs.length).toBe(6)
    expect(withVerbs.some((q) => q.verb)).toBe(true)
    const without = generateVocabSession(vocabConfig(), WORDS, verbWords)
    expect(without.some((q) => q.verb)).toBe(false)
  })
})
