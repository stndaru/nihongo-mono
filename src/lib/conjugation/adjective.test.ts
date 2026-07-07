import { describe, expect, it } from 'vitest'
import { inflectAdjective, type AdjectiveForm } from './adjective'

function expectKana(
  word: { kanji: string; kana: string },
  type: 'adj-i' | 'adj-na',
  expected: Partial<Record<AdjectiveForm, string>>,
) {
  for (const [form, kana] of Object.entries(expected) as [AdjectiveForm, string][]) {
    expect(inflectAdjective(word, type, form)?.kana, `${word.kana} → ${form}`).toBe(kana)
  }
}

describe('i-adjectives', () => {
  it('高い — all forms', () => {
    const takai = { kanji: '高い', kana: 'たかい' }
    expectKana(takai, 'adj-i', {
      'non-past': 'たかい',
      'non-past-polite': 'たかいです',
      negative: 'たかくない',
      'negative-polite': 'たかくないです',
      past: 'たかかった',
      'past-polite': 'たかかったです',
      'past-negative': 'たかくなかった',
      'past-negative-polite': 'たかくなかったです',
      te: 'たかくて',
      adverbial: 'たかく',
      'conditional-ba': 'たかければ',
    })
    expect(inflectAdjective(takai, 'adj-i', 'attributive')).toBeNull()
    expect(inflectAdjective(takai, 'adj-i', 'negative')?.kanji).toBe('高くない')
  })

  it('いい — inflects on よ', () => {
    expectKana({ kanji: 'いい', kana: 'いい' }, 'adj-i', {
      'non-past': 'いい',
      negative: 'よくない',
      past: 'よかった',
      'past-negative': 'よくなかった',
      te: 'よくて',
      adverbial: 'よく',
      'conditional-ba': 'よければ',
    })
  })

  it('かっこいい — compound of いい', () => {
    expectKana({ kanji: 'かっこいい', kana: 'かっこいい' }, 'adj-i', {
      negative: 'かっこよくない',
      past: 'かっこよかった',
    })
  })

  it('かわいい — regular despite ending in いい', () => {
    expectKana({ kanji: '可愛い', kana: 'かわいい' }, 'adj-i', {
      negative: 'かわいくない',
      past: 'かわいかった',
    })
  })
})

describe('na-adjectives', () => {
  it('静か — all forms', () => {
    expectKana({ kanji: '静か', kana: 'しずか' }, 'adj-na', {
      'non-past': 'しずかだ',
      'non-past-polite': 'しずかです',
      negative: 'しずかじゃない',
      'negative-polite': 'しずかじゃないです',
      past: 'しずかだった',
      'past-polite': 'しずかでした',
      'past-negative': 'しずかじゃなかった',
      'past-negative-polite': 'しずかじゃなかったです',
      te: 'しずかで',
      adverbial: 'しずかに',
      'conditional-ba': 'しずかなら',
      attributive: 'しずかな',
    })
  })
})
