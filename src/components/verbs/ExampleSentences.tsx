import type { ExampleSentence } from '@/lib/data/types'
import { cn } from '@/lib/utils'
import { Furigana } from './Furigana'

/** The Japanese line of an example, with ruby when the build produced it. */
export function ExampleJa({
  example,
  className,
}: {
  example: ExampleSentence
  className?: string
}) {
  if (example.f) {
    // sentences must wrap, unlike single-word furigana
    return <Furigana segments={example.f} className={cn('whitespace-normal', className)} />
  }
  return (
    <span lang="ja" className={className}>
      {example.ja}
    </span>
  )
}

export function ExampleSentences({ examples }: { examples: ExampleSentence[] }) {
  if (examples.length === 0) return null
  return (
    <ul className="space-y-2.5">
      {examples.map((ex, i) => (
        <li key={i} className="rounded-md border p-3 pt-4 text-sm">
          <p className="text-xl leading-loose">
            <ExampleJa example={ex} />
          </p>
          <p className="mt-1 text-[0.95rem] leading-relaxed text-muted-foreground">{ex.en}</p>
        </li>
      ))}
    </ul>
  )
}
