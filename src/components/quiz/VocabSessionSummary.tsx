import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { answerGloss, type VocabQuestion } from '@/lib/quiz/vocab-engine'

export interface VocabQuestionResult {
  question: VocabQuestion
  given: string
  correct: boolean
}

const KIND_LABELS = {
  reading: 'Reading',
  recall: 'Recall',
  meaning: 'Meaning',
  word: 'Word Match',
} as const

export function VocabSessionSummary({
  results,
  onRetry,
}: {
  results: VocabQuestionResult[]
  onRetry: () => void
}) {
  const correct = results.filter((r) => r.correct).length
  const pct = results.length > 0 ? Math.round((correct / results.length) * 100) : 0
  const missed = results.filter((r) => !r.correct)

  return (
    <div className="quiz-enter space-y-6">
      <div className="rounded-lg border p-4 text-center">
        <div className="text-4xl font-semibold">{pct}%</div>
        <div className="mt-1 text-sm text-muted-foreground">
          {correct} of {results.length} correct
        </div>
      </div>

      {missed.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium">Worth reviewing</h2>
          <ul className="space-y-1 text-sm">
            {missed.map((r, i) => (
              <li
                key={i}
                className="flex flex-wrap items-baseline gap-x-3 border-b border-border/60 py-1"
              >
                {r.question.verb ? (
                  <Link
                    to="/verbs/$verbId"
                    params={{ verbId: r.question.word.id }}
                    lang="ja"
                    className="text-base text-primary underline-offset-2 hover:underline"
                  >
                    {r.question.word.kanji}
                  </Link>
                ) : (
                  <Link
                    to="/vocab/$wordId"
                    params={{ wordId: r.question.word.id }}
                    lang="ja"
                    className="text-base text-primary underline-offset-2 hover:underline"
                  >
                    {r.question.word.kanji}
                  </Link>
                )}
                <span lang="ja" className="text-muted-foreground">
                  {r.question.word.kana}
                </span>
                <span className="text-muted-foreground">
                  {KIND_LABELS[r.question.kind]} → {answerGloss(r.question.word)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={onRetry}>Same Settings Again</Button>
        <Button variant="outline" asChild>
          <Link to="/quiz/vocab">Change Settings</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/progress">View Progress</Link>
        </Button>
      </div>
    </div>
  )
}
