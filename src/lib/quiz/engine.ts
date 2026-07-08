import {
  classGroup,
  conjugate,
  type ConjugatedForm,
  type ConjugationForm,
} from '@/lib/conjugation'
import type { VerbEntry } from '@/lib/data/types'
import type { QuizConfig, QuizMode } from './config'
import { buildChoices, shuffle } from './distractors'

export interface Question {
  verb: VerbEntry
  form: ConjugationForm
  mode: QuizMode
  answer: ConjugatedForm
  /** what the prompt displays — the dictionary form, or (with the
   *  randomShown setting) a conjugated form of the verb */
  shown: ConjugatedForm
  /** the form `shown` is in; 'non-past' = plain dictionary form */
  shownForm: ConjugationForm
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

  const dictionaryForm = (verb: VerbEntry): ConjugatedForm =>
    conjugate(verb, 'non-past') ?? { kanji: verb.kanji, kana: verb.kana }

  /**
   * With randomShown: pick a form (from the quizzed set + dictionary form)
   * whose surface differs from the answer — showing the answer, or asking
   * for the form already on screen, would give the question away.
   */
  const pickShown = (
    verb: VerbEntry,
    form: ConjugationForm,
    answer: ConjugatedForm,
  ): { shown: ConjugatedForm; shownForm: ConjugationForm } => {
    const dict = dictionaryForm(verb)
    if (config.randomShown) {
      const candidates: ConjugationForm[] = ['non-past', ...config.forms.filter((f) => f !== form)]
      for (const f of shuffle(candidates)) {
        const c = f === 'non-past' ? dict : conjugate(verb, f)
        if (c && c.kana !== answer.kana) return { shown: c, shownForm: f }
      }
    }
    return { shown: dict, shownForm: 'non-past' }
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
    const { shown, shownForm } = pickShown(verb, form, answer)
    // never ask for the form already on screen — the answer would be
    // staring at the user (with randomShown, pickShown avoids this and the
    // check only rejects combos where no distinct surface exists at all)
    if (answer.kana === shown.kana && answer.kanji === shown.kanji) {
      used.add(key)
      continue
    }
    used.add(key)
    const mode = config.modes[Math.floor(Math.random() * config.modes.length)]
    questions.push({
      verb,
      form,
      mode,
      answer,
      shown,
      shownForm,
      choices: mode === 'choice' ? buildChoices(verb, form, answer, shown.kana) : undefined,
    })
  }
  return questions
}
