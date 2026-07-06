import { aruNegative, godanSuffix } from './godan'
import { ichidanSuffix } from './ichidan'
import { KURU_FORMS, SURU_FORMS } from './irregular'
import {
  CONJUGATION_FORMS,
  type ConjugatableVerb,
  type ConjugatedForm,
  type ConjugationForm,
  type GodanClass,
} from './types'

/**
 * Conjugate a verb into the given form. Kanji and kana surfaces are
 * transformed independently so mixed-script results stay correct
 * (来る → 来ない / こない).
 *
 * Returns null when the form doesn't exist for the verb
 * (e.g. the passive of ある).
 */
export function conjugate(
  verb: ConjugatableVerb,
  form: ConjugationForm,
): ConjugatedForm | null {
  switch (verb.class) {
    case 'vs': {
      const suffix = SURU_FORMS[form]
      return {
        kanji: stripSuffix(verb.kanji, 'する') + suffix,
        kana: stripSuffix(verb.kana, 'する') + suffix,
      }
    }
    case 'vk': {
      const f = KURU_FORMS[form]
      // Compound like 持ってくる may write the verb part in kana.
      const kanjiPart = verb.kanji.endsWith('来る') ? f.kanji : f.kana
      return {
        kanji: stripSuffix(stripSuffix(verb.kanji, '来る'), 'くる') + kanjiPart,
        kana: stripSuffix(verb.kana, 'くる') + f.kana,
      }
    }
    case 'v1':
    case 'v1-s': {
      const suffix = ichidanSuffix(verb.class, form)
      return {
        kanji: verb.kanji.slice(0, -1) + suffix,
        kana: verb.kana.slice(0, -1) + suffix,
      }
    }
    default: {
      // ある: plain negatives replace the whole verb, not just the ending.
      if (verb.class === 'v5r-i') {
        const neg = aruNegative(form)
        if (neg !== undefined) {
          return {
            kanji: verb.kanji.slice(0, -2) + neg,
            kana: verb.kana.slice(0, -2) + neg,
          }
        }
      }
      const suffix = godanSuffix(verb.class as GodanClass, form)
      if (suffix === null) return null
      return {
        kanji: verb.kanji.slice(0, -1) + suffix,
        kana: verb.kana.slice(0, -1) + suffix,
      }
    }
  }
}

export function conjugateAll(
  verb: ConjugatableVerb,
): Record<ConjugationForm, ConjugatedForm | null> {
  const out = {} as Record<ConjugationForm, ConjugatedForm | null>
  for (const form of CONJUGATION_FORMS) out[form] = conjugate(verb, form)
  return out
}

function stripSuffix(s: string, suffix: string): string {
  return s.endsWith(suffix) ? s.slice(0, -suffix.length) : s
}
