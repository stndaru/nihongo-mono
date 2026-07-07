import { CONJUGATION_FORMS, type ConjugationForm } from '@/lib/conjugation'
import type { FormStat, ProgressData, VerbStat } from './store'

export function accuracyOf(stat: { seen: number; correct: number }): number {
  return stat.seen > 0 ? stat.correct / stat.seen : 0
}

/**
 * Coarse per-word buckets so the UI can say "work on these". Thresholds are
 * deliberately simple and explainable:
 * - new: fewer than 2 encounters — not enough data to judge
 * - weak: wrong at least 40% of the time
 * - solid: 3+ encounters, ≥90% accurate, and the last 2+ answers were correct
 * - learning: everything in between
 */
export type WordStatus = 'new' | 'weak' | 'learning' | 'solid'

export function wordStatus(stat: VerbStat): WordStatus {
  if (stat.seen < 2) return 'new'
  const acc = accuracyOf(stat)
  if (acc < 0.6) return 'weak'
  if (stat.seen >= 3 && acc >= 0.9 && (stat.run ?? 0) >= 2) return 'solid'
  return 'learning'
}

export interface FormBreakdownRow extends FormStat {
  form: ConjugationForm
  accuracy: number
}

/** Practiced conjugation forms, weakest first (never-quizzed forms omitted). */
export function formBreakdown(progress: ProgressData): FormBreakdownRow[] {
  const rows: FormBreakdownRow[] = []
  for (const form of CONJUGATION_FORMS) {
    const stat = progress.forms[form]
    if (!stat || stat.seen === 0) continue
    rows.push({ form, ...stat, accuracy: accuracyOf(stat) })
  }
  return rows.sort((a, b) => a.accuracy - b.accuracy || b.seen - a.seen)
}
