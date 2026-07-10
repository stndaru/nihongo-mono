import type { ConjugationForm, GodanClass } from './types'

export interface GodanEndings {
  /** dictionary-form final kana */
  dict: string
  a: string
  i: string
  e: string
  o: string
  /** past-tense ending (euphonic change included) */
  ta: string
  /** te-form ending (euphonic change included) */
  te: string
}

export const GODAN_ENDINGS: Record<GodanClass, GodanEndings> = {
  v5u: { dict: 'う', a: 'わ', i: 'い', e: 'え', o: 'お', ta: 'った', te: 'って' },
  'v5u-s': { dict: 'う', a: 'わ', i: 'い', e: 'え', o: 'お', ta: 'うた', te: 'うて' },
  v5k: { dict: 'く', a: 'か', i: 'き', e: 'け', o: 'こ', ta: 'いた', te: 'いて' },
  'v5k-s': { dict: 'く', a: 'か', i: 'き', e: 'け', o: 'こ', ta: 'った', te: 'って' },
  v5g: { dict: 'ぐ', a: 'が', i: 'ぎ', e: 'げ', o: 'ご', ta: 'いだ', te: 'いで' },
  v5s: { dict: 'す', a: 'さ', i: 'し', e: 'せ', o: 'そ', ta: 'した', te: 'して' },
  v5t: { dict: 'つ', a: 'た', i: 'ち', e: 'て', o: 'と', ta: 'った', te: 'って' },
  v5n: { dict: 'ぬ', a: 'な', i: 'に', e: 'ね', o: 'の', ta: 'んだ', te: 'んで' },
  v5b: { dict: 'ぶ', a: 'ば', i: 'び', e: 'べ', o: 'ぼ', ta: 'んだ', te: 'んで' },
  v5m: { dict: 'む', a: 'ま', i: 'み', e: 'め', o: 'も', ta: 'んだ', te: 'んで' },
  v5r: { dict: 'る', a: 'ら', i: 'り', e: 'れ', o: 'ろ', ta: 'った', te: 'って' },
  'v5r-i': { dict: 'る', a: 'ら', i: 'り', e: 'れ', o: 'ろ', ta: 'った', te: 'って' },
  // Honorifics: the masu stem is い (くださる → くださいます), not り.
  v5aru: { dict: 'る', a: 'ら', i: 'い', e: 'れ', o: 'ろ', ta: 'った', te: 'って' },
}

/** Forms that simply don't exist (or are misleading to teach) for ある. */
const ARU_MISSING: ReadonlySet<ConjugationForm> = new Set([
  'potential',
  'passive',
  'causative',
  'causative-passive',
  'imperative',
  'prohibitive',
  // stative ある takes なくて only — "without existing" isn't a thing
  'te-negative-naide',
])

/** ある's plain negatives replace the whole verb with ない. */
const ARU_NEGATIVES: Partial<Record<ConjugationForm, string>> = {
  negative: 'ない',
  'past-negative': 'なかった',
  'te-negative': 'なくて',
}

/** Honorific godan verbs (くださる etc.) lack most derived forms. */
const V5ARU_MISSING: ReadonlySet<ConjugationForm> = new Set([
  'potential',
  'passive',
  'causative',
  'causative-passive',
  'volitional',
  'volitional-polite',
  'prohibitive',
  'tai',
])

/**
 * The suffix that replaces the final kana of the dictionary form,
 * or null when the form doesn't exist for this class.
 *
 * ある's whole-word negative replacements are NOT handled here — see
 * conjugate.ts, which must replace more than the final kana.
 */
export function godanSuffix(cls: GodanClass, form: ConjugationForm): string | null {
  if (cls === 'v5r-i' && ARU_MISSING.has(form)) return null
  if (cls === 'v5aru' && V5ARU_MISSING.has(form)) return null
  // v5aru imperative is the bare い-stem: ください, なさい
  if (cls === 'v5aru' && form === 'imperative') return GODAN_ENDINGS[cls].i

  const e = GODAN_ENDINGS[cls]
  switch (form) {
    case 'non-past':
      return e.dict
    case 'non-past-polite':
      return e.i + 'ます'
    case 'negative':
      return e.a + 'ない'
    case 'negative-polite':
      return e.i + 'ません'
    case 'past':
      return e.ta
    case 'past-polite':
      return e.i + 'ました'
    case 'past-negative':
      return e.a + 'なかった'
    case 'past-negative-polite':
      return e.i + 'ませんでした'
    case 'te':
      return e.te
    case 'te-negative':
      return e.a + 'なくて'
    case 'te-negative-naide':
      return e.a + 'ないで'
    case 'stem':
      return e.i
    case 'potential':
      return e.e + 'る'
    case 'passive':
      return e.a + 'れる'
    case 'causative':
      return e.a + 'せる'
    case 'causative-passive':
      return e.a + 'せられる'
    case 'volitional':
      return e.o + 'う'
    case 'volitional-polite':
      return e.i + 'ましょう'
    case 'imperative':
      return e.e
    case 'prohibitive':
      return e.dict + 'な'
    case 'conditional-ba':
      return e.e + 'ば'
    case 'conditional-tara':
      return e.ta + 'ら'
    case 'tai':
      return e.i + 'たい'
  }
}

export function aruNegative(form: ConjugationForm): string | undefined {
  return ARU_NEGATIVES[form]
}
