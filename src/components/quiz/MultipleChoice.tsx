import { useEffect } from 'react'
import { Furigana } from '@/components/verbs/Furigana'
import type { ConjugatedForm } from '@/lib/conjugation'
import { pairFurigana } from '@/lib/data/furigana'

export function MultipleChoice({
  choices,
  onSelect,
}: {
  choices: ConjugatedForm[]
  onSelect: (choice: ConjugatedForm) => void
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
          key={choice.kana}
          type="button"
          onClick={() => onSelect(choice)}
          className="flex items-center gap-3 rounded-md border p-3 text-left transition-colors duration-100 hover:border-primary/50 hover:bg-primary/5"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded border text-xs text-muted-foreground">
            {i + 1}
          </span>
          <Furigana segments={pairFurigana(choice.kanji, choice.kana)} className="text-lg" />
        </button>
      ))}
    </div>
  )
}
