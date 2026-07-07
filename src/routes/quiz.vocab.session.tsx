import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { toHiragana } from 'wanakana'
import { KanaInput } from '@/components/quiz/KanaInput'
import {
  QuizDisplayToggles,
  quizDisplayAttrs,
  useQuizDisplay,
} from '@/components/quiz/QuizDisplayToggles'
import { QuizLeaveGuard } from '@/components/quiz/QuizLeaveGuard'
import { VocabAnswerFeedback } from '@/components/quiz/VocabAnswerFeedback'
import {
  VocabSessionSummary,
  type VocabQuestionResult,
} from '@/components/quiz/VocabSessionSummary'
import { Badge } from '@/components/ui/badge'
import { Furigana } from '@/components/verbs/Furigana'
import { PosBadge } from '@/components/vocab/PosBadge'
import { loadVerbLevels, loadVocabLevels } from '@/lib/data/loader'
import type { VocabEntry } from '@/lib/data/types'
import { useProgress } from '@/lib/progress/context'
import {
  answerGloss,
  generateVocabSession,
  verbQuizWords,
  type VocabQuestion,
} from '@/lib/quiz/vocab-engine'
import { parseVocabConfig, sanitizeVocabSearch } from '@/lib/quiz/vocab-config'

export const Route = createFileRoute('/quiz/vocab/session')({
  validateSearch: sanitizeVocabSearch,
  component: VocabQuizSessionPage,
})

type State =
  | { phase: 'loading' }
  | {
      phase: 'question' | 'feedback' | 'done'
      questions: VocabQuestion[]
      index: number
      results: VocabQuestionResult[]
    }

type Action =
  | { type: 'init'; questions: VocabQuestion[] }
  | { type: 'answer'; given: string; correct: boolean }
  | { type: 'next' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'init':
      return { phase: 'question', questions: action.questions, index: 0, results: [] }
    case 'answer': {
      if (state.phase !== 'question') return state
      const result: VocabQuestionResult = {
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

function checkTyped(question: VocabQuestion, raw: string): boolean {
  const typed = toHiragana(raw.trim())
  return typed === toHiragana(question.word.kana) || raw.trim() === question.word.kanji
}

const PROMPTS = {
  reading: 'Type the reading',
  recall: 'Type the Japanese word',
  meaning: 'Pick the meaning',
} as const

function VocabQuizSessionPage() {
  const search = Route.useSearch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const config = useMemo(() => parseVocabConfig(search), [JSON.stringify(search)])
  const [words, setWords] = useState<{ vocab: VocabEntry[]; verbs: VocabEntry[] } | null>(null)
  const [state, dispatch] = useReducer(reducer, { phase: 'loading' })
  const { progress, recordSession } = useProgress()
  const [display, setDisplay] = useQuizDisplay()

  const progressRef = useRef(progress)
  progressRef.current = progress
  const seenCount = useCallback(
    (wordId: string) => progressRef.current.verbs[wordId]?.seen ?? 0,
    [],
  )

  useEffect(() => {
    let alive = true
    Promise.all([
      loadVocabLevels(config.levels),
      config.verbs ? loadVerbLevels(config.levels) : Promise.resolve([]),
    ]).then(([vocab, verbs]) => {
      if (!alive) return
      const loaded = { vocab, verbs: verbQuizWords(verbs) }
      setWords(loaded)
      dispatch({
        type: 'init',
        questions: generateVocabSession(config, loaded.vocab, loaded.verbs, seenCount),
      })
    })
    return () => {
      alive = false
    }
  }, [config, seenCount])

  const retry = useCallback(() => {
    if (words)
      dispatch({
        type: 'init',
        questions: generateVocabSession(config, words.vocab, words.verbs, seenCount),
      })
  }, [words, config, seenCount])

  const onNext = useCallback(() => dispatch({ type: 'next' }), [])

  // commit results exactly once per finished session
  const recordedFor = useRef<VocabQuestion[] | null>(null)
  useEffect(() => {
    if (state.phase !== 'done' || recordedFor.current === state.questions) return
    recordedFor.current = state.questions
    recordSession({
      answers: state.results.map((r) => ({
        verbId: r.question.word.id,
        correct: r.correct,
        // dictionary-form verbs mixed into the vocab quiz keep their verb id
        kind: r.question.verb ? ('verb' as const) : ('vocab' as const),
      })),
      forms: [],
      kind: 'vocab',
    })
  }, [state, recordSession])

  if (state.phase === 'loading') {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
  }

  if (state.questions.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">
          No words match this quiz setup — try different levels or word types.
        </p>
        <Link
          to="/quiz/vocab"
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
        <VocabSessionSummary results={state.results} onRetry={retry} />
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
        <div className="mt-2 flex items-center justify-between">
          {/* navigating away triggers the leave confirmation */}
          <Link
            to="/quiz/vocab"
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors duration-100 hover:text-foreground"
            title="Exit this quiz"
          >
            <LogOut className="size-3.5 rotate-180" /> Exit
          </Link>
          <QuizDisplayToggles display={display} onChange={setDisplay} />
        </div>
      </div>

      {/* the question */}
      <div className="rounded-lg border p-5 text-center">
        {question.kind === 'recall' ? (
          <div className="text-2xl leading-snug">{answerGloss(question.word)}</div>
        ) : question.kind === 'reading' ? (
          // plain text — furigana would give the answer away
          <div lang="ja" className="text-4xl leading-tight">
            {question.word.kanji}
          </div>
        ) : (
          <Furigana segments={question.word.furigana} className="text-4xl leading-tight" />
        )}
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span className="quiz-info">
            {question.verb ? (
              <Badge variant="outline" className="px-1.5 font-normal text-muted-foreground">
                Verb
              </Badge>
            ) : (
              <PosBadge pos={question.word.pos} />
            )}
          </span>
          {PROMPTS[question.kind]}
        </div>
      </div>

      {state.phase === 'question' ? (
        question.kind === 'meaning' ? (
          <MeaningChoices
            key={state.index}
            choices={question.choices!}
            answer={answerGloss(question.word)}
            onSelect={(choice) =>
              dispatch({ type: 'answer', given: choice, correct: choice === answerGloss(question.word) })
            }
          />
        ) : (
          <KanaInput
            key={state.index}
            onSubmit={(raw) =>
              dispatch({ type: 'answer', given: raw, correct: checkTyped(question, raw) })
            }
          />
        )
      ) : (
        <VocabAnswerFeedback
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

function MeaningChoices({
  choices,
  onSelect,
}: {
  choices: string[]
  answer: string
  onSelect: (choice: string) => void
}) {
  // number keys 1–4 select an option
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key)
      if (n >= 1 && n <= choices.length) onSelect(choices[n - 1])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [choices, onSelect])

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {choices.map((choice, i) => (
        <button
          key={choice}
          type="button"
          onClick={() => onSelect(choice)}
          className="flex items-center gap-3 rounded-md border p-3 text-left transition-colors duration-100 hover:border-primary/50 hover:bg-primary/5"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded border text-xs text-muted-foreground">
            {i + 1}
          </span>
          <span className="text-base">{choice}</span>
        </button>
      ))}
    </div>
  )
}
