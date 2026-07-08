import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { WordSummaryDialog } from '@/components/parser/WordSummary'
import { Button } from '@/components/ui/button'
import { Furigana } from '@/components/verbs/Furigana'
import { RuleCheatsheet } from '@/components/verbs/RuleCheatsheet'
import { FORM_LABELS } from '@/lib/conjugation'
import { enter } from '@/lib/animate'
import { pairFurigana } from '@/lib/data/furigana'
import type { ParsedWord } from '@/lib/data/parse-sentence'
import type { Question } from '@/lib/quiz/engine'
import { cn } from '@/lib/utils'

export function AnswerFeedback({
  question,
  given,
  correct,
  isLast,
  onNext,
}: {
  question: Question
  given: string
  correct: boolean
  isLast: boolean
  onNext: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => enter(ref.current), [])

  // summary popup (same one the sentence parser uses) — the session stays put
  const [summary, setSummary] = useState<ParsedWord | null>(null)

  // Enter advances — ignore the first ~200ms so the Enter that submitted
  // the answer can't skip the feedback, and don't advance under the popup.
  const summaryOpen = summary !== null
  useEffect(() => {
    const mountedAt = performance.now()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !summaryOpen && performance.now() - mountedAt > 200) onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onNext, summaryOpen])

  return (
    <div ref={ref} className="space-y-3">
      <div
        className={cn(
          'flex items-center gap-2 rounded-md p-3 text-sm font-medium',
          correct
            ? 'bg-success/10 text-success'
            : 'bg-destructive/10 text-destructive',
        )}
      >
        {correct ? <Check className="size-4" /> : <X className="size-4" />}
        {correct ? 'Correct!' : (
          <span>
            Not quite — you answered{' '}
            <span lang="ja" className="font-semibold">
              {given || '(nothing)'}
            </span>
          </span>
        )}
      </div>

      <div className="rounded-md border p-3">
        <div className="text-xs text-muted-foreground">
          {FORM_LABELS[question.form].label} of{' '}
          <button
            type="button"
            lang="ja"
            className="cursor-pointer text-primary underline-offset-2 hover:underline"
            title="Word summary"
            onClick={() =>
              setSummary({
                entry: question.verb,
                isVerb: true,
                surface: question.verb.kanji,
                formLabel: null,
              })
            }
          >
            {question.verb.kanji}
          </button>
          {question.shownForm !== 'non-past' && (
            <>
              {' '}
              · shown as{' '}
              <span lang="ja" className="text-foreground">
                {question.shown.kanji}
              </span>{' '}
              ({FORM_LABELS[question.shownForm].label})
            </>
          )}
        </div>
        <Furigana
          segments={pairFurigana(question.answer.kanji, question.answer.kana)}
          className="mt-2 block text-3xl leading-normal"
        />
        <div className="quiz-info mt-1 text-sm text-muted-foreground">
          {question.verb.gloss.join('; ')}
        </div>
      </div>

      <RuleCheatsheet form={question.form} verbClass={question.verb.class} />

      <Button onClick={onNext} size="lg" className="w-full">
        {isLast ? 'Finish' : 'Next'} <span className="ml-1 text-xs opacity-70">(Enter)</span>
      </Button>

      <WordSummaryDialog word={summary} onClose={() => setSummary(null)} />
    </div>
  )
}
