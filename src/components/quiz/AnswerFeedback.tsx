import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { WordSummaryDialog } from '@/components/parser/WordSummary'
import { FeedbackAccordion } from '@/components/quiz/FeedbackAccordion'
import { Button } from '@/components/ui/button'
import { Furigana } from '@/components/verbs/Furigana'
import { RuleCheatsheet } from '@/components/verbs/RuleCheatsheet'
import { CONJUGATION_FORMS, conjugate, FORM_LABELS } from '@/lib/conjugation'
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

      {question.choices && question.choices.length > 1 && (
        <FeedbackAccordion title="The Other Options">
          <OtherConjugationOptions question={question} given={given} />
        </FeedbackAccordion>
      )}

      <RuleCheatsheet form={question.form} verbClass={question.verb.class} />

      <Button onClick={onNext} size="lg" className="w-full">
        {isLast ? 'Finish' : 'Next'} <span className="ml-1 text-xs opacity-70">(Enter)</span>
      </Button>

      <WordSummaryDialog word={summary} onClose={() => setSummary(null)} />
    </div>
  )
}

/**
 * What the unchosen options actually were: each distractor is another
 * conjugation of the same verb, so name its form(s) by re-deriving them
 * (a few in-memory conjugate calls — renders only while the accordion is
 * open, no stored data or network involved).
 */
function OtherConjugationOptions({ question, given }: { question: Question; given: string }) {
  const others = (question.choices ?? []).filter((c) => c.kana !== question.answer.kana)
  return (
    <ul className="space-y-1.5 text-sm">
      {others.map((c) => {
        const labels = CONJUGATION_FORMS.filter(
          (f) => conjugate(question.verb, f)?.kana === c.kana,
        ).map((f) => FORM_LABELS[f].label)
        const picked = given === c.kana || given === c.kanji
        return (
          <li key={c.kana} className="flex flex-wrap items-baseline gap-x-2 border-b border-border/60 py-1 last:border-b-0">
            <Furigana segments={pairFurigana(c.kanji, c.kana)} className="text-lg" />
            <span className="text-muted-foreground">
              {labels.length > 0 ? labels.join(' / ') : 'another form'} of{' '}
              <span lang="ja">{question.verb.kanji}</span>
            </span>
            {picked && <span className="text-xs text-destructive">your answer</span>}
          </li>
        )
      })}
    </ul>
  )
}
