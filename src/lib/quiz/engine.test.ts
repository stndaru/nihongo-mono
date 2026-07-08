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

const verbConfig = (
  forms: QuizConfig['forms'],
  over: Partial<QuizConfig> = {},
): QuizConfig => ({
  levels: [5],
  groups: ['godan', 'ichidan', 'suru', 'kuru'],
  forms,
  modes: ['input'],
  length: 10,
  randomShown: false,
  ...over,
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
      expect(q.shown.kana).toBe(q.verb.kana)
      expect(q.shownForm).toBe('non-past')
    }
  })

  it('randomShown: the shown surface never equals the answer', () => {
    for (let run = 0; run < 20; run++) {
      const questions = generateSession(
        verbConfig(['negative', 'past', 'te', 'volitional'], { randomShown: true }),
        VERBS,
      )
      expect(questions.length).toBeGreaterThan(0)
      for (const q of questions) {
        expect(q.shown.kana).not.toBe(q.answer.kana)
      }
    }
  })

  it('randomShown: non-past can be ASKED when something else is shown', () => {
    let askedNonPast = false
    for (let run = 0; run < 30 && !askedNonPast; run++) {
      const questions = generateSession(
        verbConfig(['non-past', 'past'], { randomShown: true }),
        VERBS,
      )
      askedNonPast = questions.some(
        (q) => q.form === 'non-past' && q.shown.kana !== q.verb.kana,
      )
    }
    expect(askedNonPast).toBe(true)
  })

  it('randomShown: choice options never duplicate the shown surface', () => {
    for (let run = 0; run < 20; run++) {
      const questions = generateSession(
        verbConfig(['negative', 'past', 'te'], { randomShown: true, modes: ['choice'] }),
        VERBS,
      )
      for (const q of questions) {
        expect(q.choices!.map((c) => c.kana)).not.toContain(q.shown.kana)
      }
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

  it("choice-ja: 'word' questions offer the answer among unique word options", () => {
    const pool = [
      ...WORDS,
      word('d', '空', 'そら'),
      word('e', '海', 'うみ'),
      word('f', '花', 'はな'),
    ]
    const questions = generateVocabSession(vocabConfig({ modes: ['choice-ja'] }), pool)
    expect(questions.length).toBe(6)
    expect(new Set(questions.map((q) => q.word.id)).size).toBe(6) // no repeats
    for (const q of questions) {
      expect(q.kind).toBe('word')
      const options = q.wordChoices!
      expect(options).toHaveLength(4)
      // the answer is present exactly once; every option looks distinct
      expect(options.filter((o) => o.id === q.word.id)).toHaveLength(1)
      expect(new Set(options.map((o) => o.kanji)).size).toBe(4)
      expect(new Set(options.map((o) => o.gloss[0])).size).toBe(4)
    }
  })
})
