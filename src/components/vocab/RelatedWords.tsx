import { Link } from '@tanstack/react-router'
import { Furigana } from '@/components/verbs/Furigana'
import type { VocabEntry } from '@/lib/data/types'

export function RelatedWords({ title, words }: { title: string; words: VocabEntry[] }) {
  if (words.length === 0) return null
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {words.map((word) => (
          <Link
            key={word.id}
            to="/vocab/$wordId"
            params={{ wordId: word.id }}
            className="flex items-baseline gap-3 rounded-md border p-3 transition-colors duration-100 hover:border-primary/50 hover:bg-primary/5"
          >
            <Furigana segments={word.furigana} className="text-xl" />
            <span className="truncate text-sm text-muted-foreground">
              {word.gloss.join('; ')}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
