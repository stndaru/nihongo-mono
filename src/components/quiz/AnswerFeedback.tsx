import { useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Furigana } from '@/components/verbs/Furigana'
import { RuleCheatsheet } from '@/components/verbs/RuleCheatsheet'
import { FORM_LABELS } from '@/lib/conjugation'
import { enter } from '@/lib/animate'
import { pairFurigana } from '@/lib/data/furigana'
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

  // Enter advances — ignore the first ~200ms so the Enter that submitted
  // the answer can't skip the feedback.
  useEffect(() => {
    const mountedAt = performance.now()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && performance.now() - mountedAt > 200) onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onNext])

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
          <Link
            to="/verbs/$verbId"
            params={{ verbId: question.verb.id }}
            target="_blank"
            rel="noopener"
            lang="ja"
            className="text-primary underline-offset-2 hover:underline"
            title="Open verb detail in a new tab"
          >
            {question.verb.kanji}
          </Link>
        </div>
        <Furigana
          segments={pairFurigana(question.answer.kanji, question.answer.kana)}
          className="mt-2 block text-3xl leading-normal"
        />
        <div className="mt-1 text-sm text-muted-foreground">
          {question.verb.gloss.join('; ')}
        </div>
      </div>

      <RuleCheatsheet form={question.form} verbClass={question.verb.class} />

      <Button onClick={onNext} size="lg" className="w-full sm:w-auto">
        {isLast ? 'Finish' : 'Next'} <span className="ml-1 text-xs opacity-70">(Enter)</span>
      </Button>
    </div>
  )
}
