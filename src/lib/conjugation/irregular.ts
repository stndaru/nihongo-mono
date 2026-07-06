import type { ConjugatedForm, ConjugationForm } from './types'

/**
 * する, conjugated. Applies to bare する and to N+する compounds
 * (勉強する → 勉強 + table value). Kanji and kana surfaces are identical
 * because the する part is always written in kana.
 */
export const SURU_FORMS: Record<ConjugationForm, string> = {
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
}

/**
 * 来る, conjugated. The kanji surface keeps 来 while the reading of the
 * stem shifts between き・こ・く — the reason kanji and kana are tracked
 * separately throughout the engine.
 */
export const KURU_FORMS: Record<ConjugationForm, ConjugatedForm> = {
  'non-past': { kanji: '来る', kana: 'くる' },
  'non-past-polite': { kanji: '来ます', kana: 'きます' },
  negative: { kanji: '来ない', kana: 'こない' },
  'negative-polite': { kanji: '来ません', kana: 'きません' },
  past: { kanji: '来た', kana: 'きた' },
  'past-polite': { kanji: '来ました', kana: 'きました' },
  'past-negative': { kanji: '来なかった', kana: 'こなかった' },
  'past-negative-polite': { kanji: '来ませんでした', kana: 'きませんでした' },
  te: { kanji: '来て', kana: 'きて' },
  'te-negative': { kanji: '来なくて', kana: 'こなくて' },
  stem: { kanji: '来', kana: 'き' },
  potential: { kanji: '来られる', kana: 'こられる' },
  passive: { kanji: '来られる', kana: 'こられる' },
  causative: { kanji: '来させる', kana: 'こさせる' },
  'causative-passive': { kanji: '来させられる', kana: 'こさせられる' },
  volitional: { kanji: '来よう', kana: 'こよう' },
  'volitional-polite': { kanji: '来ましょう', kana: 'きましょう' },
  imperative: { kanji: '来い', kana: 'こい' },
  prohibitive: { kanji: '来るな', kana: 'くるな' },
  'conditional-ba': { kanji: '来れば', kana: 'くれば' },
  'conditional-tara': { kanji: '来たら', kana: 'きたら' },
  tai: { kanji: '来たい', kana: 'きたい' },
}
