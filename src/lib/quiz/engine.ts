import {
  classGroup,
  conjugate,
  type ConjugatedForm,
  type ConjugationForm,
} from '@/lib/conjugation'
import type { VerbEntry } from '@/lib/data/types'
import type { QuizConfig, QuizMode } from './config'
import { buildChoices } from './distractors'

export interface Question {
  verb: VerbEntry
  form: ConjugationForm
  mode: QuizMode
  answer: ConjugatedForm
  /** present iff mode === 'choice'; includes the answer, pre-shuffled */
  choices?: ConjugatedForm[]
}

/**
 * Builds a quiz session. Verbs the user has seen less often are drawn more
 * frequently (weight 1/(1+seen)); pass `seenCount` from the progress store.
 */
export function generateSession(
  config: QuizConfig,
  verbs: VerbEntry[],
  seenCount: (verbId: string) => number = () => 0,
): Question[] {
  const pool = verbs.filter((v) => config.groups.includes(classGroup(v.class)))
  if (pool.length === 0) return []

  const weights = pool.map((v) => 1 / (1 + seenCount(v.id)))
  const totalWeight = weights.reduce((a, b) => a + b, 0)

  const pickVerb = (): VerbEntry => {
    let r = Math.random() * totalWeight
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i]
      if (r <= 0) return pool[i]
    }
    return pool[pool.length - 1]
  }

  const questions: Question[] = []
  const used = new Set<string>()
  const maxAttempts = config.length * 20
  for (let attempt = 0; questions.length < config.length && attempt < maxAttempts; attempt++) {
    const verb = pickVerb()
    const form = config.forms[Math.floor(Math.random() * config.forms.length)]
    const key = `${verb.id}|${form}`
    // allow repeats only once every combination is exhausted
    if (used.has(key) && used.size < pool.length * config.forms.length) continue
    const answer = conjugate(verb, form)
    if (!answer) continue // form doesn't exist for this verb (e.g. ある potential)
    used.add(key)
    const mode = config.modes[Math.floor(Math.random() * config.modes.length)]
    questions.push({
      verb,
      form,
      mode,
      answer,
      choices: mode === 'choice' ? buildChoices(verb, form, answer) : undefined,
    })
  }
  return questions
}
