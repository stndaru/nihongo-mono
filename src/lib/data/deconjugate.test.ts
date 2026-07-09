import { describe, expect, it } from 'vitest'
import { deconjugate } from './deconjugate'

/** [conjugated query (hiragana), dictionary form that must be a candidate] */
const CASES: [string, string][] = [
  // ichidan
  ['たべた', 'たべる'],
  ['たべて', 'たべる'],
  ['たべない', 'たべる'],
  ['たべます', 'たべる'],
  ['たべました', 'たべる'],
  ['たべません', 'たべる'],
  ['たべませんでした', 'たべる'],
  ['たべよう', 'たべる'],
  ['たべたい', 'たべる'],
  ['たべたかった', 'たべる'],
  ['たべられる', 'たべる'],
  ['たべさせる', 'たべる'],
  ['たべれば', 'たべる'],
  ['たべたら', 'たべる'],
  ['たべている', 'たべる'],
  // godan sound changes
  ['のんだ', 'のむ'],
  ['いった', 'いく'], // 行く is the った irregular… covered by った→う/つ/る? no — race: いった also maps u/tsu/ru
  ['かいた', 'かく'],
  ['およいだ', 'およぐ'],
  ['はなした', 'はなす'],
  ['まった', 'まつ'],
  ['しんだ', 'しぬ'],
  ['あそんで', 'あそぶ'],
  ['よんで', 'よむ'],
  ['かった', 'かう'],
  ['かえった', 'かえる'],
  // godan stems
  ['のみます', 'のむ'],
  ['かきません', 'かく'],
  ['かかない', 'かく'],
  ['かかなかった', 'かく'],
  ['いけば', 'いく'],
  ['のもう', 'のむ'],
  ['いこう', 'いく'],
  ['かかれる', 'かく'],
  ['のませる', 'のむ'],
  // godan potential (IPADIC lexicalizes these as their own dictionary forms)
  ['いける', 'いく'],
  ['行ける', '行く'],
  ['よめる', 'よむ'],
  ['よめます', 'よむ'],
  // する / くる
  ['した', 'する'],
  ['します', 'する'],
  ['しない', 'する'],
  ['べんきょうした', 'べんきょうする'],
  ['できた', 'できる'],
  ['きた', 'くる'],
  ['きます', 'くる'],
  ['こない', 'くる'],
  ['もってきた', 'もってくる'],
  // い-adjectives
  ['さむかった', 'さむい'],
  ['さむくない', 'さむい'],
  ['さむくなかった', 'さむい'],
  ['さむくて', 'さむい'],
  ['さむければ', 'さむい'],
  ['さむく', 'さむい'],
  ['よかった', 'いい'],
  ['よくない', 'いい'],
  ['かっこよかった', 'かっこいい'],
  // stacked politeness/causative chains
  ['たべさせられました', 'たべる'],
  // mixed kanji+kana input works the same way
  ['食べた', '食べる'],
  ['寒かった', '寒い'],
  // incomplete stems typed mid-conjugation
  ['たべら', 'たべる'], // start of たべられる
  ['たべろ', 'たべる'], // imperative
  ['のみ', 'のむ'], // ます-stem
  ['かか', 'かく'], // ない-stem
  ['食べら', '食べる'],
]

describe('deconjugate', () => {
  for (const [query, expected] of CASES) {
    it(`${query} → ${expected}`, () => {
      expect([...deconjugate(query)]).toContain(expected)
    })
  }

  it('returns nothing for short or unconjugated-looking queries', () => {
    expect(deconjugate('た').size).toBe(0)
    expect(deconjugate('').size).toBe(0)
  })

  it('stays small (candidate cap)', () => {
    expect(deconjugate('たべさせられませんでした').size).toBeLessThanOrEqual(48)
  })
})
