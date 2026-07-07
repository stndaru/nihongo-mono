/** Inflection of い- and な-adjectives (past, negative, te, adverbial…). */

export type AdjectiveForm =
  | 'non-past'
  | 'non-past-polite'
  | 'negative'
  | 'negative-polite'
  | 'past'
  | 'past-polite'
  | 'past-negative'
  | 'past-negative-polite'
  | 'te'
  | 'adverbial'
  | 'conditional-ba'
  | 'attributive'

export const ADJECTIVE_FORMS: readonly AdjectiveForm[] = [
  'non-past',
  'non-past-polite',
  'negative',
  'negative-polite',
  'past',
  'past-polite',
  'past-negative',
  'past-negative-polite',
  'te',
  'adverbial',
  'conditional-ba',
  'attributive',
] as const

export interface AdjectiveFormLabel {
  label: string
  hint: string
}

export const ADJECTIVE_FORM_LABELS: Record<AdjectiveForm, AdjectiveFormLabel> = {
  'non-past': { label: 'Non-past', hint: 'is …' },
  'non-past-polite': { label: 'Non-past polite', hint: 'is … (polite)' },
  negative: { label: 'Negative', hint: 'is not …' },
  'negative-polite': { label: 'Negative polite', hint: 'is not … (polite)' },
  past: { label: 'Past', hint: 'was …' },
  'past-polite': { label: 'Past polite', hint: 'was … (polite)' },
  'past-negative': { label: 'Past negative', hint: 'was not …' },
  'past-negative-polite': { label: 'Past negative polite', hint: 'was not … (polite)' },
  te: { label: 'Te form', hint: '… and…' },
  adverbial: { label: 'Adverbial', hint: '…ly' },
  'conditional-ba': { label: 'Conditional', hint: 'if …' },
  attributive: { label: 'Before a noun', hint: '… + noun' },
}

interface AdjectiveSurfaces {
  kanji: string
  kana: string
}

/**
 * い-adjectives whose final いい inflects as よ (いい, かっこいい, 気持ちいい).
 * かわいい is regular (かわいくない) — its いい is part of 可愛い, not 良い.
 */
function isYoiIrregular(kana: string): boolean {
  return kana.endsWith('いい') && !kana.endsWith('かわいい')
}

/** Suffix appended to the i-adjective stem (word minus final い). */
const I_ADJ_SUFFIXES: Record<AdjectiveForm, string | null> = {
  'non-past': 'い',
  'non-past-polite': 'いです',
  negative: 'くない',
  'negative-polite': 'くないです',
  past: 'かった',
  'past-polite': 'かったです',
  'past-negative': 'くなかった',
  'past-negative-polite': 'くなかったです',
  te: 'くて',
  adverbial: 'く',
  'conditional-ba': 'ければ',
  attributive: null, // same as non-past — hidden to avoid a duplicate row
}

/** Suffix appended to the na-adjective stem (the word itself). */
const NA_ADJ_SUFFIXES: Record<AdjectiveForm, string> = {
  'non-past': 'だ',
  'non-past-polite': 'です',
  negative: 'じゃない',
  'negative-polite': 'じゃないです',
  past: 'だった',
  'past-polite': 'でした',
  'past-negative': 'じゃなかった',
  'past-negative-polite': 'じゃなかったです',
  te: 'で',
  adverbial: 'に',
  'conditional-ba': 'なら',
  attributive: 'な',
}

/**
 * Inflects an adjective; kanji and kana surfaces are transformed in parallel.
 * Returns null for forms that don't exist (attributive of i-adjectives, or
 * any form when the word isn't actually inflectable).
 */
export function inflectAdjective(
  word: AdjectiveSurfaces,
  type: 'adj-i' | 'adj-na',
  form: AdjectiveForm,
): AdjectiveSurfaces | null {
  if (type === 'adj-na') {
    const suffix = NA_ADJ_SUFFIXES[form]
    return { kanji: word.kanji + suffix, kana: word.kana + suffix }
  }

  if (!word.kana.endsWith('い')) return null
  const suffix = I_ADJ_SUFFIXES[form]
  if (suffix === null) return null

  // いい inflects on its classical form よい: いい → よくない
  if (isYoiIrregular(word.kana) && form !== 'non-past' && form !== 'non-past-polite') {
    const kanaStem = word.kana.slice(0, -2) + 'よ'
    // kanji surface: replace a trailing いい the same way; 良い-spelled forms keep 良
    const kanjiStem = word.kanji.endsWith('いい')
      ? word.kanji.slice(0, -2) + 'よ'
      : word.kanji.slice(0, -1)
    return { kanji: kanjiStem + suffix, kana: kanaStem + suffix }
  }

  return {
    kanji: word.kanji.slice(0, -1) + suffix,
    kana: word.kana.slice(0, -1) + suffix,
  }
}

export function inflectAll(
  word: AdjectiveSurfaces,
  type: 'adj-i' | 'adj-na',
): Record<AdjectiveForm, AdjectiveSurfaces | null> {
  const out = {} as Record<AdjectiveForm, AdjectiveSurfaces | null>
  for (const form of ADJECTIVE_FORMS) out[form] = inflectAdjective(word, type, form)
  return out
}
