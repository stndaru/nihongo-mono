import { describe, expect, it } from 'vitest'
import { normalizeQuery, searchWords } from './search'
import type { WordBase } from './types'

const word = (kanji: string, kana: string, romaji: string, gloss: string[]): WordBase => ({
  id: kanji,
  kanji,
  kana,
  romaji,
  furigana: [{ t: kanji }],
  gloss,
  senses: [],
  kanjiChars: [],
  jlpt: 5,
  common: true,
  examples: [],
})

const POOL = [
  word('食べる', 'たべる', 'taberu', ['to eat']),
  word('飲む', 'のむ', 'nomu', ['to drink']),
  word('コピーする', 'コピーする', 'kopiisuru', ['to copy']),
]

describe('normalizeQuery', () => {
  it('folds full-width latin to ascii', () => {
    expect(normalizeQuery('ＴＡＢＥＲＵ')).toBe('taberu')
  })
  it('folds half-width katakana to full-width', () => {
    expect(normalizeQuery('ｺﾋﾟｰ')).toBe('コピー')
  })
  it('trims and lowercases', () => {
    expect(normalizeQuery('  TaBeRu  ')).toBe('taberu')
  })
})

describe('searchWords with denormalized input', () => {
  it('full-width romaji finds the word', () => {
    expect(searchWords(POOL, 'ＴＡＢＥＲＵ').map((w) => w.kanji)).toContain('食べる')
  })
  it('half-width katakana finds the word', () => {
    expect(searchWords(POOL, 'ｺﾋﾟｰ').map((w) => w.kanji)).toContain('コピーする')
  })
  it('plain queries still work', () => {
    expect(searchWords(POOL, 'nonda').map((w) => w.kanji)).toContain('飲む')
  })
})
