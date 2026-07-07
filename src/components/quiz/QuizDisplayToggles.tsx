import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Chip } from '@/components/ui/chip'

/**
 * Mid-quiz display preferences, shared by both quiz types and persisted:
 * - ruby: furigana on the question and the answer explanation
 * - info: word-type badges and English glosses in question/feedback
 * They work via data attributes on the session wrapper (see index.css), so
 * toggling never re-renders or reshuffles the running session.
 */
export interface QuizDisplay {
  ruby: boolean
  info: boolean
}

const KEY = 'nihongo-mono:quiz-display'

function load(): QuizDisplay {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '')
    return { ruby: raw.ruby !== false, info: raw.info !== false }
  } catch {
    return { ruby: true, info: true }
  }
}

export function useQuizDisplay(): [QuizDisplay, (patch: Partial<QuizDisplay>) => void] {
  const [display, setDisplay] = useState<QuizDisplay>(load)
  const update = (patch: Partial<QuizDisplay>) => {
    setDisplay((prev) => {
      const next = { ...prev, ...patch }
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }
  return [display, update]
}

/** Data attributes for the session wrapper element. */
export function quizDisplayAttrs(display: QuizDisplay) {
  return {
    'data-quiz': '',
    'data-quiz-ruby': display.ruby ? undefined : 'hide',
    'data-quiz-info': display.info ? undefined : 'hide',
  }
}

export function QuizDisplayToggles({
  display,
  onChange,
}: {
  display: QuizDisplay
  onChange: (patch: Partial<QuizDisplay>) => void
}) {
  const Icon = ({ shown }: { shown: boolean }) =>
    shown ? <Eye className="size-3" /> : <EyeOff className="size-3" />
  return (
    <div className="flex items-center gap-1.5">
      <Chip
        active={display.ruby}
        onClick={() => onChange({ ruby: !display.ruby })}
        title={display.ruby ? 'Hide furigana' : 'Show furigana'}
      >
        <span className="flex items-center gap-1">
          <Icon shown={display.ruby} /> Furigana
        </span>
      </Chip>
      <Chip
        active={display.info}
        onClick={() => onChange({ info: !display.info })}
        title={
          display.info
            ? 'Hide word types and English glosses'
            : 'Show word types and English glosses'
        }
      >
        <span className="flex items-center gap-1">
          <Icon shown={display.info} /> Word Info
        </span>
      </Chip>
    </div>
  )
}
