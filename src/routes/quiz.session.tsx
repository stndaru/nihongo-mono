import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { toHiragana } from 'wanakana'
import { AnswerFeedback } from '@/components/quiz/AnswerFeedback'
import { KanaInput } from '@/components/quiz/KanaInput'
import { MultipleChoice } from '@/components/quiz/MultipleChoice'
import {
  QuizDisplayToggles,
  quizDisplayAttrs,
  useQuizDisplay,
} from '@/components/quiz/QuizDisplayToggles'
import { QuizLeaveGuard } from '@/components/quiz/QuizLeaveGuard'
import { SessionSummary, type QuestionResult } from '@/components/quiz/SessionSummary'
import { Furigana } from '@/components/verbs/Furigana'
import { FORM_LABELS, type ConjugatedForm } from '@/lib/conjugation'
import { loadVerbLevels } from '@/lib/data/loader'
import type { VerbEntry } from '@/lib/data/types'
import { useProgress } from '@/lib/progress/context'
import { parseConfig, sanitizeSearch } from '@/lib/quiz/config'
import { generateSession, type Question } from '@/lib/quiz/engine'

export const Route = createFileRoute('/quiz/session')({
  validateSearch: sanitizeSearch,
  component: QuizSessionPage,
})

type State =
  | { phase: 'loading' }
  | {
      phase: 'question' | 'feedback' | 'done'
      questions: Question[]
      index: number
      results: QuestionResult[]
    }

type Action =
  | { type: 'init'; questions: Question[] }
  | { type: 'answer'; given: string; correct: boolean }
  | { type: 'next' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'init':
      return { phase: 'question', questions: action.questions, index: 0, results: [] }
    case 'answer': {
      if (state.phase !== 'question') return state
      const result: QuestionResult = {
        question: state.questions[state.index],
        given: action.given,
        correct: action.correct,
      }
      return { ...state, phase: 'feedback', results: [...state.results, result] }
    }
    case 'next': {
      if (state.phase !== 'feedback') return state
      const nextIndex = state.index + 1
      return nextIndex >= state.questions.length
        ? { ...state, phase: 'done' }
        : { ...state, phase: 'question', index: nextIndex }
    }
  }
}

function checkTyped(question: Question, raw: string): boolean {
  const typed = toHiragana(raw.trim())
  return typed === toHiragana(question.answer.kana) || raw.trim() === question.answer.kanji
}

function QuizSessionPage() {
  const search = Route.useSearch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const config = useMemo(() => parseConfig(search), [JSON.stringify(search)])
  const [verbs, setVerbs] = useState<VerbEntry[] | null>(null)
  const [state, dispatch] = useReducer(reducer, { phase: 'loading' })
  const { progress, recordSession } = useProgress()
  const [display, setDisplay] = useQuizDisplay()

  // latest progress without re-generating the session when it changes
  const progressRef = useRef(progress)
  progressRef.current = progress
  const seenCount = useCallback(
    (verbId: string) => progressRef.current.verbs[verbId]?.seen ?? 0,
    [],
  )

  useEffect(() => {
    let alive = true
    loadVerbLevels(config.levels).then((list) => {
      if (!alive) return
      setVerbs(list)
      dispatch({ type: 'init', questions: generateSession(config, list, seenCount) })
    })
    return () => {
      alive = false
    }
  }, [config, seenCount])

  const retry = useCallback(() => {
    if (verbs) dispatch({ type: 'init', questions: generateSession(config, verbs, seenCount) })
  }, [verbs, config, seenCount])

  // commit results exactly once per finished session
  const recordedFor = useRef<Question[] | null>(null)
  useEffect(() => {
    if (state.phase !== 'done' || recordedFor.current === state.questions) return
    recordedFor.current = state.questions
    recordSession({
      answers: state.results.map((r) => ({
        verbId: r.question.verb.id,
        correct: r.correct,
      })),
      forms: state.results.map((r) => r.question.form),
    })
  }, [state, recordSession])

  const onNext = useCallback(() => dispatch({ type: 'next' }), [])

  if (state.phase === 'loading') {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
  }

  if (state.questions.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">
          No verbs match this quiz setup — try different levels or verb types.
        </p>
        <Link
          to="/quiz"
          className="mt-3 inline-block text-primary underline-offset-2 hover:underline"
        >
          Back to quiz setup
        </Link>
      </div>
    )
  }

  if (state.phase === 'done') {
    return (
      <div className="mx-auto max-w-xl">
        <SessionSummary results={state.results} onRetry={retry} />
      </div>
    )
  }

  const question = state.questions[state.index]
  const lastResult = state.results[state.results.length - 1]

  return (
    <div className="mx-auto max-w-xl space-y-5" {...quizDisplayAttrs(display)}>
      {/* leaving mid-session loses progress — confirm first */}
      <QuizLeaveGuard active />
      {/* progress */}
      <div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            Question {state.index + 1} / {state.questions.length}
          </span>
          <span>{state.results.filter((r) => r.correct).length} correct</span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-[width] duration-150"
            style={{ width: `${(state.index / state.questions.length) * 100}%` }}
          />
        </div>
        <div className="mt-2 flex justify-end">
          <QuizDisplayToggles display={display} onChange={setDisplay} />
        </div>
      </div>

      {/* the question */}
      <div className="rounded-lg border p-5 text-center">
        <Furigana segments={question.verb.furigana} className="text-4xl leading-tight" />
        <div className="mt-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {FORM_LABELS[question.form].label}
          </span>{' '}
          · {FORM_LABELS[question.form].hint}
        </div>
      </div>

      {state.phase === 'question' ? (
        question.mode === 'input' ? (
          <KanaInput
            key={state.index}
            onSubmit={(raw) =>
              dispatch({ type: 'answer', given: raw, correct: checkTyped(question, raw) })
            }
          />
        ) : (
          <MultipleChoice
            key={state.index}
            choices={question.choices!}
            onSelect={(choice: ConjugatedForm) =>
              dispatch({
                type: 'answer',
                given: choice.kanji,
                correct: choice.kana === question.answer.kana,
              })
            }
          />
        )
      ) : (
        <AnswerFeedback
          question={question}
          given={lastResult.given}
          correct={lastResult.correct}
          isLast={state.index + 1 >= state.questions.length}
          onNext={onNext}
        />
      )}
    </div>
  )
}
