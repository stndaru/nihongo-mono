import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { WordSummaryDialog } from '@/components/parser/WordSummary'
import { FeedbackAccordion } from '@/components/quiz/FeedbackAccordion'
import { Button } from '@/components/ui/button'
import { JaText } from '@/components/ui/ja-text'
import { Furigana } from '@/components/verbs/Furigana'
import { RuleCheatsheet } from '@/components/verbs/RuleCheatsheet'
import { CONJUGATION_FORMS, conjugate, FORM_LABELS } from '@/lib/conjugation'
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
    <div className="quiz-enter space-y-3">
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
            <span className="font-semibold">
              {given ? <JaText text={given} /> : '(nothing)'}
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
        {(question.form === 'te-negative' || question.form === 'te-negative-naide') && (
          <p className="mt-3 border-t border-border/60 pt-2 text-sm text-muted-foreground">
            <span lang="ja" className="font-medium text-foreground">
              {FORM_LABELS[question.form].ja}
            </span>{' '}
            — {TE_NEGATIVE_DESC[question.form]}
          </p>
        )}
      </div>

      {(question.form === 'te-negative' || question.form === 'te-negative-naide') && (
        <SimilarTeNegative verb={question.verb} asked={question.form} />
      )}

      {question.choices && question.choices.length > 1 && (
        <FeedbackAccordion title="The Other Options">
          <OtherConjugationOptions question={question} given={given} onShowWord={setSummary} />
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

const TE_NEGATIVE_DESC = {
  'te-negative':
    '"not doing so" — links the negative clause as a cause or contrast (〜なくて、…).',
  'te-negative-naide':
    '"without doing so" — the skipped action accompanies the main verb (〜ないで…); also negative requests (〜ないでください).',
} as const

/**
 * The two negative te connectors are the quiz's most confusable pair, so
 * every negative-te answer explains the asked type in the answer card and
 * shows the sibling — with this verb's own surface — in its own headed box
 * BELOW the card: sitting next to the answer, it read as a second answer
 * (owner report). ある never has a sibling (ないで is null for it).
 */
function SimilarTeNegative({
  verb,
  asked,
}: {
  verb: Question['verb']
  asked: 'te-negative' | 'te-negative-naide'
}) {
  const sibling = asked === 'te-negative' ? 'te-negative-naide' : 'te-negative'
  const c = conjugate(verb, sibling)
  if (!c) return null
  return (
    <div className="rounded-md border border-dashed p-3 text-sm">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Similar form — don&apos;t confuse
      </p>
      <p className="mt-1.5 text-muted-foreground">
        <span lang="ja" className="font-medium text-foreground">
          {c.kanji}
        </span>{' '}
        ({FORM_LABELS[sibling].label}) — {TE_NEGATIVE_DESC[sibling]}
      </p>
    </div>
  )
}

/**
 * What the unchosen options actually were: each distractor is another
 * conjugation of the same verb, so name its form(s) by re-deriving them
 * (a few in-memory conjugate calls — renders only while the accordion is
 * open, no stored data or network involved). Each row opens the word
 * summary popup carrying that option's surface + form.
 */
function OtherConjugationOptions({
  question,
  given,
  onShowWord,
}: {
  question: Question
  given: string
  onShowWord: (word: ParsedWord) => void
}) {
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
            <button
              type="button"
              title="Word summary"
              className="ml-auto cursor-pointer text-xs text-primary underline-offset-2 hover:underline"
              onClick={() =>
                onShowWord({
                  entry: question.verb,
                  isVerb: true,
                  surface: c.kanji,
                  formLabel: labels.length > 0 ? labels.join(' / ') : 'Conjugated',
                })
              }
            >
              Details
            </button>
          </li>
        )
      })}
    </ul>
  )
}
