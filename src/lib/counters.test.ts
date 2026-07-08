import { describe, expect, it } from 'vitest'
import { countWith, type CounterRule } from './counters'

const HON: CounterRule = { kana: 'ほん', cls: 'hb' }
const HIKI: CounterRule = { kana: 'ひき', cls: 'hb' }
const HAI: CounterRule = { kana: 'はい', cls: 'hb' }
const FUN: CounterRule = { kana: 'ふん', cls: 'hp' }
const HO: CounterRule = { kana: 'ほ', cls: 'hp' }
const HAKU: CounterRule = { kana: 'はく', cls: 'hp' }
const KAI: CounterRule = { kana: 'かい', cls: 'k' }
const SATSU: CounterRule = { kana: 'さつ', cls: 's' }
const SAI: CounterRule = { kana: 'さい', cls: 's', special: { 20: 'はたち' } }
const TOU: CounterRule = { kana: 'とう', cls: 't' }
const MAI: CounterRule = { kana: 'まい', cls: 'none' }
const NIN: CounterRule = { kana: 'にん', cls: 'none', four: 'よ', special: { 1: 'ひとり', 2: 'ふたり' } }
const NEN: CounterRule = { kana: 'ねん', cls: 'none', four: 'よ' }
const JIKAN: CounterRule = { kana: 'じかん', cls: 'none', four: 'よ', nine: 'く' }

describe('countWith', () => {
  it.each<[CounterRule, number, string]>([
    // 本: the textbook h→p/b counter
    [HON, 1, 'いっぽん'],
    [HON, 2, 'にほん'],
    [HON, 3, 'さんぼん'],
    [HON, 4, 'よんほん'],
    [HON, 6, 'ろっぽん'],
    [HON, 8, 'はっぽん'],
    [HON, 10, 'じゅっぽん'],
    [HON, 21, 'にじゅういっぽん'],
    [HON, 23, 'にじゅうさんぼん'],
    [HON, 30, 'さんじゅっぽん'],
    [HON, 100, 'ひゃっぽん'],
    [HIKI, 3, 'さんびき'],
    [HIKI, 6, 'ろっぴき'],
    [HAI, 3, 'さんばい'],
    // 分: p after ん — never b
    [FUN, 1, 'いっぷん'],
    [FUN, 2, 'にふん'],
    [FUN, 3, 'さんぷん'],
    [FUN, 4, 'よんぷん'],
    [FUN, 5, 'ごふん'],
    [FUN, 7, 'ななふん'],
    [FUN, 10, 'じゅっぷん'],
    [HO, 3, 'さんぽ'],
    [HAKU, 3, 'さんぱく'],
    [HAKU, 4, 'よんぱく'],
    // k: geminates on 1/6/8/10/100
    [KAI, 1, 'いっかい'],
    [KAI, 6, 'ろっかい'],
    [KAI, 8, 'はっかい'],
    [KAI, 16, 'じゅうろっかい'],
    [KAI, 100, 'ひゃっかい'],
    // s/t: geminate 1/8/10 only
    [SATSU, 6, 'ろくさつ'],
    [SATSU, 8, 'はっさつ'],
    [SATSU, 100, 'ひゃくさつ'],
    [TOU, 1, 'いっとう'],
    [TOU, 10, 'じゅっとう'],
    [SAI, 8, 'はっさい'],
    [SAI, 11, 'じゅういっさい'],
    [SAI, 20, 'はたち'],
    [SAI, 25, 'にじゅうごさい'],
    // none: plain concatenation, standard 4/7/9
    [MAI, 4, 'よんまい'],
    [MAI, 10, 'じゅうまい'],
    [MAI, 30, 'さんじゅうまい'],
    [MAI, 100, 'ひゃくまい'],
    // 人: wago 1–2, よ for every 4
    [NIN, 1, 'ひとり'],
    [NIN, 2, 'ふたり'],
    [NIN, 3, 'さんにん'],
    [NIN, 4, 'よにん'],
    [NIN, 14, 'じゅうよにん'],
    [NIN, 24, 'にじゅうよにん'],
    [NIN, 100, 'ひゃくにん'],
    [NEN, 4, 'よねん'],
    [JIKAN, 4, 'よじかん'],
    [JIKAN, 9, 'くじかん'],
  ])('%#: reads %d correctly', (rule, n, expected) => {
    expect(countWith(rule, n)).toBe(expected)
  })
})
