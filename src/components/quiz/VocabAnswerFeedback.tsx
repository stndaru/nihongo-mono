import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { WordSummaryDialog } from '@/components/parser/WordSummary'
import { FeedbackAccordion } from '@/components/quiz/FeedbackAccordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExampleJa, ParseSentenceLink } from '@/components/verbs/ExampleSentences'
import { Furigana } from '@/components/verbs/Furigana'
import { PosBadge } from '@/components/vocab/PosBadge'
import type { ParsedWord } from '@/lib/data/parse-sentence'
import { answerGloss, type VocabQuestion } from '@/lib/quiz/vocab-engine'
import { cn } from '@/lib/utils'

export function VocabAnswerFeedback({
  question,
  given,
  correct,
  isLast,
  onNext,
}: {
  question: VocabQuestion
  given: string
  correct: boolean
  isLast: boolean
  onNext: () => void
}) {
  // summary popup (same one the sentence parser uses) — the session stays put
  const [summary, setSummary] = useState<ParsedWord | null>(null)
  const summaryOpen = summary !== null

  // Enter advances — ignore the first ~200ms so the Enter that submitted
  // the answer can't skip the feedback, and don't advance under the popup.
  useEffect(() => {
    const mountedAt = performance.now()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !summaryOpen && performance.now() - mountedAt > 200) onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onNext, summaryOpen])

  const { word } = question
  return (
    <div className="quiz-enter space-y-3">
      <div
        className={cn(
          'flex items-center gap-2 rounded-md p-3 text-sm font-medium',
          correct ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
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
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="quiz-info">
            {question.verb ? (
              <Badge variant="outline" className="px-1.5 font-normal text-muted-foreground">
                Verb
              </Badge>
            ) : (
              <PosBadge pos={word.pos} />
            )}
          </span>
          <button
            type="button"
            className="cursor-pointer text-primary underline-offset-2 hover:underline"
            title="Word summary"
            onClick={() =>
              setSummary({
                entry: word,
                isVerb: !!question.verb,
                surface: word.kanji,
                formLabel: null,
              })
            }
          >
            Details
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-end gap-x-3">
          <Furigana segments={word.furigana} className="text-3xl leading-normal" />
          {word.kanji !== word.kana && (
            <span lang="ja" className="text-base text-muted-foreground">
              {word.kana}
            </span>
          )}
        </div>
        <div className="quiz-info mt-1 text-sm text-muted-foreground">
          {word.gloss.join('; ')}
        </div>
        {word.examples[0] && (
          <div className="mt-2 border-t border-border/60 pt-3 text-sm">
            <p className="text-lg leading-loose">
              <ExampleJa example={word.examples[0]} />
              {/* new tab, per the mid-quiz convention — the session must stay put */}
              <ParseSentenceLink ja={word.examples[0].ja} />
            </p>
            <p className="mt-0.5 text-muted-foreground">{word.examples[0].en}</p>
          </div>
        )}
      </div>

      {(question.kind === 'meaning' || question.kind === 'word') && (
        <FeedbackAccordion title="The Other Options">
          <OtherVocabOptions question={question} given={given} />
        </FeedbackAccordion>
      )}

      <Button onClick={onNext} size="lg" className="w-full">
        {isLast ? 'Finish' : 'Next'} <span className="ml-1 text-xs opacity-70">(Enter)</span>
      </Button>

      <WordSummaryDialog word={summary} onClose={() => setSummary(null)} />
    </div>
  )
}

/**
 * What the unchosen options actually were — each distractor's own word and
 * meaning, from data already in the session (no fetches).
 */
function OtherVocabOptions({ question, given }: { question: VocabQuestion; given: string }) {
  const rows =
    question.kind === 'meaning'
      ? (question.choices ?? [])
          .map((gloss, i) => ({ word: question.choiceWords?.[i], picked: given === gloss }))
          .filter((r): r is { word: NonNullable<typeof r.word>; picked: boolean } => !!r.word)
          .filter((r) => r.word.id !== question.word.id)
      : (question.wordChoices ?? [])
          .filter((w) => w.id !== question.word.id)
          .map((word) => ({ word, picked: given === word.kanji }))
  return (
    <ul className="space-y-1.5 text-sm">
      {rows.map(({ word, picked }) => (
        <li
          key={word.id}
          className="flex flex-wrap items-baseline gap-x-2 border-b border-border/60 py-1 last:border-b-0"
        >
          <span lang="ja" className="text-lg">
            {word.kanji}
          </span>
          {word.kanji !== word.kana && (
            <span lang="ja" className="text-xs text-muted-foreground">
              {word.kana}
            </span>
          )}
          <span className="text-muted-foreground">{answerGloss(word)}</span>
          {picked && <span className="text-xs text-destructive">your answer</span>}
        </li>
      ))}
    </ul>
  )
}
