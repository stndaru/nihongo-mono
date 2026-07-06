import type { ConjugationForm } from './types'

/** Suffix appended after dropping the final る of an ichidan verb. */
const ICHIDAN_SUFFIXES: Record<ConjugationForm, string> = {
  'non-past': 'る',
  'non-past-polite': 'ます',
  negative: 'ない',
  'negative-polite': 'ません',
  past: 'た',
  'past-polite': 'ました',
  'past-negative': 'なかった',
  'past-negative-polite': 'ませんでした',
  te: 'て',
  'te-negative': 'なくて',
  stem: '',
  potential: 'られる',
  passive: 'られる',
  causative: 'させる',
  'causative-passive': 'させられる',
  volitional: 'よう',
  'volitional-polite': 'ましょう',
  imperative: 'ろ',
  prohibitive: 'るな',
  'conditional-ba': 'れば',
  'conditional-tara': 'たら',
  tai: 'たい',
}

export function ichidanSuffix(
  cls: 'v1' | 'v1-s',
  form: ConjugationForm,
): string {
  // くれる's imperative is the bare stem: くれ
  if (cls === 'v1-s' && form === 'imperative') return ''
  return ICHIDAN_SUFFIXES[form]
}
