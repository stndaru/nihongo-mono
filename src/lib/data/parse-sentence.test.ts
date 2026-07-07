import { describe, expect, it } from 'vitest'
import type { VerbEntry, VocabEntry } from './types'
import {
  buildParserDicts,
  isJapaneseOnly,
  parseSentence,
  stripNonJapanese,
  uniqueWords,
} from './parse-sentence'

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

const word = (
  id: string,
  kanji: string,
  kana: string,
  pos: VocabEntry['pos'] = 'noun',
): VocabEntry => ({
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
  pos,
})

const DICTS = buildParserDicts(
  [verb('v1', '食べる', 'たべる', 'v1'), verb('v2', '行く', 'いく', 'v5k-s')],
  [
    word('w1', '旅行', 'りょこう'),
    word('w2', '料理', 'りょうり'),
    word('w3', 'やはり', 'やはり', 'adverb'),
    word('w4', '楽しい', 'たのしい', 'adj-i'),
    word('w5', 'の', 'の', 'particle'),
    word('w6', '木', 'き'), // single-kanji noun — must match; its kana き must not
  ],
)

describe('stripNonJapanese / isJapaneseOnly', () => {
  it('removes latin, digits, and full-width latin', () => {
    expect(stripNonJapanese('abc食べるxyz123ＡＢＣ')).toBe('食べる')
  })
  it('keeps kana, kanji, and Japanese punctuation', () => {
    const s = '旅行の楽しみは、何といっても！'
    expect(stripNonJapanese(s)).toBe(s)
  })
  it('isJapaneseOnly rejects mixed and empty input', () => {
    expect(isJapaneseOnly('食べるtabe')).toBe(false)
    expect(isJapaneseOnly('')).toBe(false)
    expect(isJapaneseOnly('食べた。')).toBe(true)
  })
})

describe('parseSentence', () => {
  it('matches plain nouns and adverbs', () => {
    const segs = parseSentence('旅行やはり', DICTS)
    expect(segs.map((s) => s.word?.entry.id)).toEqual(['w1', 'w3'])
  })

  it('recognizes conjugated verbs and names the form', () => {
    const [seg] = parseSentence('食べた', DICTS)
    expect(seg.word?.entry.id).toBe('v1')
    expect(seg.word?.formLabel).toBe('Past')
    expect(seg.word?.surface).toBe('食べた')
  })

  it('recognizes conjugated い-adjectives', () => {
    const [seg] = parseSentence('楽しかった', DICTS)
    expect(seg.word?.entry.id).toBe('w4')
    expect(seg.word?.formLabel).toBe('Past')
  })

  it('splits compound conjugations at honest boundaries', () => {
    // 食べていた: only 食べて is an exact form of 食べる — the rest stays plain
    const segs = parseSentence('食べていた', DICTS)
    expect(segs[0].word?.entry.id).toBe('v1')
    expect(segs[0].text).toBe('食べて')
    expect(segs[0].word?.formLabel).toBe('Te form')
  })

  it('prefers the longest match', () => {
    // 楽しい must win over any shorter accidental match
    const segs = parseSentence('楽しい旅行', DICTS)
    expect(segs.map((s) => s.word?.entry.id)).toEqual(['w4', 'w1'])
  })

  it('single kana only matches particles, never nouns', () => {
    const segs = parseSentence('きの', DICTS)
    // き (kana of 木) must NOT match; の (particle) must
    expect(segs[0].word).toBeUndefined()
    expect(segs[0].text).toBe('き')
    expect(segs[1].word?.entry.id).toBe('w5')
  })

  it('single kanji words still match', () => {
    const [seg] = parseSentence('木', DICTS)
    expect(seg.word?.entry.id).toBe('w6')
  })

  it('treats punctuation as plain text', () => {
    const segs = parseSentence('旅行、料理。', DICTS)
    expect(segs.map((s) => s.text)).toEqual(['旅行', '、', '料理', '。'])
    expect(segs[1].word).toBeUndefined()
  })

  it('kana spellings of dictionary words match too', () => {
    const [seg] = parseSentence('たべた', DICTS)
    expect(seg.word?.entry.id).toBe('v1')
    expect(seg.word?.formLabel).toBe('Past')
  })
})

describe('uniqueWords', () => {
  it('dedupes by entry and surface, keeps first-appearance order', () => {
    const segs = parseSentence('旅行の旅行を食べる食べた', DICTS)
    const words = uniqueWords(segs)
    expect(words.map((w) => `${w.entry.id}:${w.surface}`)).toEqual([
      'w1:旅行',
      'w5:の',
      'v1:食べる',
      'v1:食べた',
    ])
  })
})
