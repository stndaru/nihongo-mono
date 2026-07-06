import { describe, expect, it } from 'vitest'
import { conjugate, conjugateAll } from './conjugate'
import {
  CONJUGATION_FORMS,
  type ConjugatableVerb,
  type ConjugationForm,
} from './types'

type Expected = Partial<Record<ConjugationForm, string>>

function v(kanji: string, kana: string, cls: ConjugatableVerb['class']): ConjugatableVerb {
  return { kanji, kana, class: cls }
}

/** Assert kana surfaces for the given forms. */
function expectKana(verb: ConjugatableVerb, expected: Expected) {
  for (const [form, kana] of Object.entries(expected) as [ConjugationForm, string][]) {
    expect(conjugate(verb, form)?.kana, `${verb.kana} → ${form}`).toBe(kana)
  }
}

/** Assert kanji surfaces for the given forms. */
function expectKanji(verb: ConjugatableVerb, expected: Expected) {
  for (const [form, kanji] of Object.entries(expected) as [ConjugationForm, string][]) {
    expect(conjugate(verb, form)?.kanji, `${verb.kanji} → ${form}`).toBe(kanji)
  }
}

describe('godan (regular rows)', () => {
  it('書く (v5k) — all forms', () => {
    const kaku = v('書く', 'かく', 'v5k')
    expectKana(kaku, {
      'non-past': 'かく',
      'non-past-polite': 'かきます',
      negative: 'かかない',
      'negative-polite': 'かきません',
      past: 'かいた',
      'past-polite': 'かきました',
      'past-negative': 'かかなかった',
      'past-negative-polite': 'かきませんでした',
      te: 'かいて',
      'te-negative': 'かかなくて',
      stem: 'かき',
      potential: 'かける',
      passive: 'かかれる',
      causative: 'かかせる',
      'causative-passive': 'かかせられる',
      volitional: 'かこう',
      'volitional-polite': 'かきましょう',
      imperative: 'かけ',
      prohibitive: 'かくな',
      'conditional-ba': 'かけば',
      'conditional-tara': 'かいたら',
      tai: 'かきたい',
    })
    expectKanji(kaku, {
      negative: '書かない',
      past: '書いた',
      te: '書いて',
      potential: '書ける',
    })
  })

  it('泳ぐ (v5g)', () => {
    expectKana(v('泳ぐ', 'およぐ', 'v5g'), {
      'non-past-polite': 'およぎます',
      negative: 'およがない',
      past: 'およいだ',
      te: 'およいで',
      potential: 'およげる',
      volitional: 'およごう',
      'conditional-tara': 'およいだら',
    })
  })

  it('話す (v5s)', () => {
    expectKana(v('話す', 'はなす', 'v5s'), {
      'non-past-polite': 'はなします',
      negative: 'はなさない',
      past: 'はなした',
      te: 'はなして',
      potential: 'はなせる',
      passive: 'はなされる',
      'causative-passive': 'はなさせられる',
    })
  })

  it('待つ (v5t)', () => {
    expectKana(v('待つ', 'まつ', 'v5t'), {
      'non-past-polite': 'まちます',
      negative: 'またない',
      past: 'まった',
      te: 'まって',
      potential: 'まてる',
      imperative: 'まて',
    })
  })

  it('死ぬ (v5n)', () => {
    expectKana(v('死ぬ', 'しぬ', 'v5n'), {
      'non-past-polite': 'しにます',
      negative: 'しなない',
      past: 'しんだ',
      te: 'しんで',
      volitional: 'しのう',
      'conditional-ba': 'しねば',
    })
  })

  it('遊ぶ (v5b)', () => {
    expectKana(v('遊ぶ', 'あそぶ', 'v5b'), {
      'non-past-polite': 'あそびます',
      negative: 'あそばない',
      past: 'あそんだ',
      te: 'あそんで',
      causative: 'あそばせる',
    })
  })

  it('読む (v5m)', () => {
    expectKana(v('読む', 'よむ', 'v5m'), {
      'non-past-polite': 'よみます',
      negative: 'よまない',
      past: 'よんだ',
      te: 'よんで',
      passive: 'よまれる',
      tai: 'よみたい',
    })
  })

  it('帰る (v5r)', () => {
    expectKana(v('帰る', 'かえる', 'v5r'), {
      'non-past-polite': 'かえります',
      negative: 'かえらない',
      past: 'かえった',
      te: 'かえって',
      potential: 'かえれる',
      volitional: 'かえろう',
      imperative: 'かえれ',
    })
  })

  it('買う (v5u) — う row takes わ', () => {
    expectKana(v('買う', 'かう', 'v5u'), {
      'non-past-polite': 'かいます',
      negative: 'かわない',
      'past-negative': 'かわなかった',
      past: 'かった',
      te: 'かって',
      potential: 'かえる',
      passive: 'かわれる',
      volitional: 'かおう',
    })
  })
})

describe('godan (special)', () => {
  it('行く (v5k-s) — irregular te/ta', () => {
    const iku = v('行く', 'いく', 'v5k-s')
    expectKana(iku, {
      negative: 'いかない',
      'non-past-polite': 'いきます',
      past: 'いった',
      te: 'いって',
      'conditional-tara': 'いったら',
      potential: 'いける',
      volitional: 'いこう',
    })
    expectKanji(iku, { te: '行って', past: '行った' })
  })

  it('問う (v5u-s) — irregular te/ta', () => {
    expectKana(v('問う', 'とう', 'v5u-s'), {
      negative: 'とわない',
      past: 'とうた',
      te: 'とうて',
      'conditional-tara': 'とうたら',
      'non-past-polite': 'といます',
    })
  })

  it('ある (v5r-i) — ない negatives, missing forms', () => {
    const aru = v('ある', 'ある', 'v5r-i')
    expectKana(aru, {
      'non-past': 'ある',
      'non-past-polite': 'あります',
      negative: 'ない',
      'negative-polite': 'ありません',
      past: 'あった',
      'past-negative': 'なかった',
      'past-negative-polite': 'ありませんでした',
      te: 'あって',
      'te-negative': 'なくて',
      stem: 'あり',
      volitional: 'あろう',
      'conditional-ba': 'あれば',
      'conditional-tara': 'あったら',
    })
    for (const form of [
      'potential',
      'passive',
      'causative',
      'causative-passive',
      'imperative',
      'prohibitive',
    ] as const) {
      expect(conjugate(aru, form), `ある → ${form}`).toBeNull()
    }
  })

  it('くださる (v5aru) — い stem, missing forms', () => {
    const kudasaru = v('下さる', 'くださる', 'v5aru')
    expectKana(kudasaru, {
      'non-past': 'くださる',
      'non-past-polite': 'くださいます',
      negative: 'くださらない',
      'negative-polite': 'くださいません',
      past: 'くださった',
      'past-polite': 'くださいました',
      te: 'くださって',
      stem: 'ください',
      imperative: 'ください',
      'conditional-ba': 'くだされば',
    })
    for (const form of [
      'potential',
      'passive',
      'causative',
      'causative-passive',
      'volitional',
      'volitional-polite',
      'prohibitive',
      'tai',
    ] as const) {
      expect(conjugate(kudasaru, form), `くださる → ${form}`).toBeNull()
    }
  })
})

describe('ichidan', () => {
  it('食べる (v1) — all forms', () => {
    const taberu = v('食べる', 'たべる', 'v1')
    expectKana(taberu, {
      'non-past': 'たべる',
      'non-past-polite': 'たべます',
      negative: 'たべない',
      'negative-polite': 'たべません',
      past: 'たべた',
      'past-polite': 'たべました',
      'past-negative': 'たべなかった',
      'past-negative-polite': 'たべませんでした',
      te: 'たべて',
      'te-negative': 'たべなくて',
      stem: 'たべ',
      potential: 'たべられる',
      passive: 'たべられる',
      causative: 'たべさせる',
      'causative-passive': 'たべさせられる',
      volitional: 'たべよう',
      'volitional-polite': 'たべましょう',
      imperative: 'たべろ',
      prohibitive: 'たべるな',
      'conditional-ba': 'たべれば',
      'conditional-tara': 'たべたら',
      tai: 'たべたい',
    })
    expectKanji(taberu, {
      negative: '食べない',
      'past-negative': '食べなかった',
      potential: '食べられる',
    })
  })

  it('くれる (v1-s) — imperative くれ', () => {
    const kureru = v('くれる', 'くれる', 'v1-s')
    expectKana(kureru, {
      imperative: 'くれ',
      negative: 'くれない',
      te: 'くれて',
      past: 'くれた',
    })
  })
})

describe('irregular', () => {
  it('する (vs) — all forms', () => {
    const suru = v('する', 'する', 'vs')
    expectKana(suru, {
      'non-past': 'する',
      'non-past-polite': 'します',
      negative: 'しない',
      'negative-polite': 'しません',
      past: 'した',
      'past-polite': 'しました',
      'past-negative': 'しなかった',
      'past-negative-polite': 'しませんでした',
      te: 'して',
      'te-negative': 'しなくて',
      stem: 'し',
      potential: 'できる',
      passive: 'される',
      causative: 'させる',
      'causative-passive': 'させられる',
      volitional: 'しよう',
      'volitional-polite': 'しましょう',
      imperative: 'しろ',
      prohibitive: 'するな',
      'conditional-ba': 'すれば',
      'conditional-tara': 'したら',
      tai: 'したい',
    })
  })

  it('勉強する (vs compound)', () => {
    const benkyou = v('勉強する', 'べんきょうする', 'vs')
    expectKana(benkyou, {
      'non-past-polite': 'べんきょうします',
      negative: 'べんきょうしない',
      potential: 'べんきょうできる',
      te: 'べんきょうして',
      volitional: 'べんきょうしよう',
    })
    expectKanji(benkyou, {
      potential: '勉強できる',
      'non-past-polite': '勉強します',
    })
  })

  it('来る (vk) — kanji and kana diverge', () => {
    const kuru = v('来る', 'くる', 'vk')
    expectKana(kuru, {
      'non-past': 'くる',
      'non-past-polite': 'きます',
      negative: 'こない',
      'negative-polite': 'きません',
      past: 'きた',
      'past-polite': 'きました',
      'past-negative': 'こなかった',
      'past-negative-polite': 'きませんでした',
      te: 'きて',
      'te-negative': 'こなくて',
      stem: 'き',
      potential: 'こられる',
      passive: 'こられる',
      causative: 'こさせる',
      'causative-passive': 'こさせられる',
      volitional: 'こよう',
      'volitional-polite': 'きましょう',
      imperative: 'こい',
      prohibitive: 'くるな',
      'conditional-ba': 'くれば',
      'conditional-tara': 'きたら',
      tai: 'きたい',
    })
    expectKanji(kuru, {
      negative: '来ない',
      'non-past-polite': '来ます',
      te: '来て',
      imperative: '来い',
      potential: '来られる',
    })
  })

  it('持ってくる (vk compound written in kana)', () => {
    const mottekuru = v('持ってくる', 'もってくる', 'vk')
    expectKana(mottekuru, { negative: 'もってこない', te: 'もってきて' })
    expectKanji(mottekuru, { negative: '持ってこない', te: '持ってきて' })
  })
})

describe('conjugateAll', () => {
  it('returns every form for a regular verb', () => {
    const all = conjugateAll(v('食べる', 'たべる', 'v1'))
    expect(Object.keys(all)).toHaveLength(CONJUGATION_FORMS.length)
    for (const form of CONJUGATION_FORMS) {
      expect(all[form], form).not.toBeNull()
    }
  })

  it('marks missing forms as null for ある', () => {
    const all = conjugateAll(v('ある', 'ある', 'v5r-i'))
    expect(all.potential).toBeNull()
    expect(all['non-past']).toEqual({ kanji: 'ある', kana: 'ある' })
  })
})
