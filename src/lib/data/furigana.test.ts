import { describe, expect, it } from 'vitest'
import { parseFurigana } from './furigana'

describe('parseFurigana (bracket wire format)', () => {
  it('parses annotated runs between plain text', () => {
    expect(parseFurigana('もっと｜果物[くだもの]を｜食[た]べるべきです。')).toEqual([
      { t: 'もっと' },
      { t: '果物', r: 'くだもの' },
      { t: 'を' },
      { t: '食', r: 'た' },
      { t: 'べるべきです。' },
    ])
  })

  it('handles bases with embedded kana (取り扱い)', () => {
    expect(parseFurigana('｜取り扱[とりあつか]いに｜注意[ちゅうい]')).toEqual([
      { t: '取り扱', r: 'とりあつか' },
      { t: 'いに' },
      { t: '注意', r: 'ちゅうい' },
    ])
  })

  it('passes through strings with no annotations', () => {
    expect(parseFurigana('ここにいます。')).toEqual([{ t: 'ここにいます。' }])
  })
})
