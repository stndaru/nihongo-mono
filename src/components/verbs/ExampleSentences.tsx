import { Link } from '@tanstack/react-router'
import { ScanText } from 'lucide-react'
import { parseFurigana } from '@/lib/data/furigana'
import type { ExampleSentence } from '@/lib/data/types'
import { cn } from '@/lib/utils'
import { Furigana } from './Furigana'

/**
 * Small icon link that opens the sentence in the parser (new tab, so the
 * page being read stays put) for a word-by-word dissection.
 */
export function ParseSentenceLink({ ja, className }: { ja: string; className?: string }) {
  return (
    <Link
      to="/parser"
      search={{ q: ja }}
      target="_blank"
      rel="noopener"
      title="Break down this sentence in the Sentence Parser (new tab)"
      aria-label="Break down this sentence in the Sentence Parser"
      className={cn(
        'ml-2 inline-flex size-6 shrink-0 items-center justify-center rounded-md align-middle text-muted-foreground transition-colors duration-100 hover:bg-primary/10 hover:text-primary',
        className,
      )}
    >
      <ScanText className="size-3.5" />
    </Link>
  )
}

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
    return (
      <Furigana segments={parseFurigana(example.f)} className={cn('whitespace-normal', className)} />
    )
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
            <ParseSentenceLink ja={ex.ja} />
          </p>
          <p className="mt-1 text-[0.95rem] leading-relaxed text-muted-foreground">{ex.en}</p>
        </li>
      ))}
    </ul>
  )
}
