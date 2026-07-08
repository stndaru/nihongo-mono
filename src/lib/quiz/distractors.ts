import {
  CONJUGATION_FORMS,
  conjugate,
  type ConjugatedForm,
  type ConjugationForm,
} from '@/lib/conjugation'
import type { VerbEntry } from '@/lib/data/types'

export function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Multiple-choice options: the correct answer plus 3 other conjugations of
 * the same verb, deduped by surface so no two options read identically.
 * The form shown in the prompt (dictionary form, or a conjugated form with
 * the randomShown setting) is excluded — an option identical to the word
 * on screen is a free elimination.
 */
export function buildChoices(
  verb: VerbEntry,
  form: ConjugationForm,
  answer: ConjugatedForm,
  shownKana: string = verb.kana,
): ConjugatedForm[] {
  const seen = new Set([answer.kana, verb.kana, shownKana])
  const pool: ConjugatedForm[] = []
  for (const other of shuffle([...CONJUGATION_FORMS])) {
    if (other === form) continue
    const c = conjugate(verb, other)
    if (!c || seen.has(c.kana)) continue
    seen.add(c.kana)
    pool.push(c)
    if (pool.length === 3) break
  }
  return shuffle([answer, ...pool])
}
