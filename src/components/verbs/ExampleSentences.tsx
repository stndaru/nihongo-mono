import type { ExampleSentence } from '@/lib/data/types'

export function ExampleSentences({ examples }: { examples: ExampleSentence[] }) {
  if (examples.length === 0) return null
  return (
    <ul className="space-y-2.5">
      {examples.map((ex, i) => (
        <li key={i} className="rounded-md border p-3 text-sm">
          <p lang="ja" className="text-base leading-relaxed">
            {ex.ja}
          </p>
          <p className="mt-1 leading-relaxed text-muted-foreground">{ex.en}</p>
        </li>
      ))}
    </ul>
  )
}
