import { Link } from '@tanstack/react-router'
import { SyncStatusInline } from '@/components/sync/SyncStatusInline'
import { Button } from '@/components/ui/button'
import { FORM_LABELS, type ConjugationForm } from '@/lib/conjugation'
import type { Question } from '@/lib/quiz/engine'

export interface QuestionResult {
  question: Question
  given: string
  correct: boolean
}

export function SessionSummary({
  results,
  onRetry,
}: {
  results: QuestionResult[]
  onRetry: () => void
}) {
  const correct = results.filter((r) => r.correct).length
  const pct = results.length > 0 ? Math.round((correct / results.length) * 100) : 0

  const byForm = new Map<ConjugationForm, { correct: number; total: number }>()
  for (const r of results) {
    const s = byForm.get(r.question.form) ?? { correct: 0, total: 0 }
    s.total += 1
    if (r.correct) s.correct += 1
    byForm.set(r.question.form, s)
  }
  const missed = results.filter((r) => !r.correct)

  return (
    <div className="quiz-enter space-y-6">
      <div className="rounded-lg border p-4 text-center">
        <div className="text-4xl font-semibold">{pct}%</div>
        <div className="mt-1 text-sm text-muted-foreground">
          {correct} of {results.length} correct
        </div>
        {/* the auto-sync fires right when this screen appears — show it */}
        <SyncStatusInline className="mt-2 justify-center" />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium">By conjugation</h2>
        <ul className="space-y-1 text-sm">
          {[...byForm.entries()].map(([form, s]) => (
            <li key={form} className="flex items-center justify-between border-b border-border/60 py-1">
              <span>{FORM_LABELS[form].label}</span>
              <span className="text-muted-foreground">
                {s.correct}/{s.total}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {missed.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium">Worth reviewing</h2>
          <ul className="space-y-1 text-sm">
            {missed.map((r, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-3 border-b border-border/60 py-1">
                <Link
                  to="/verbs/$verbId"
                  params={{ verbId: r.question.verb.id }}
                  lang="ja"
                  className="text-base text-primary underline-offset-2 hover:underline"
                >
                  {r.question.verb.kanji}
                </Link>
                <span className="text-muted-foreground">
                  {FORM_LABELS[r.question.form].label} →{' '}
                  <span lang="ja">{r.question.answer.kanji}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={onRetry}>Same Settings Again</Button>
        <Button variant="outline" asChild>
          <Link to="/quiz">Change Settings</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/progress">View Progress</Link>
        </Button>
      </div>
    </div>
  )
}
