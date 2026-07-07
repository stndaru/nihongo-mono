import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { WordSense } from '@/lib/data/types'
import { cn } from '@/lib/utils'
import { ExampleJa, ParseSentenceLink } from './ExampleSentences'

/**
 * Numbered dictionary senses; a row expands to show the full gloss list and
 * that sense's own example sentences.
 */
export function MeaningsAccordion({ senses }: { senses: WordSense[] }) {
  const [open, setOpen] = useState<number | null>(null)
  if (senses.length === 0) return null

  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">Meanings</h2>
      <div className="divide-y divide-border/60 rounded-lg border">
        {senses.map((sense, i) => {
          const isOpen = open === i
          const expandable = sense.examples.length > 0 || sense.gloss.length > 1
          return (
            <div key={i}>
              <button
                type="button"
                onClick={() => expandable && setOpen(isOpen ? null : i)}
                className={cn(
                  'flex w-full items-baseline gap-3 p-3 text-left text-sm',
                  expandable && 'transition-colors duration-100 hover:bg-muted/50',
                )}
                aria-expanded={isOpen}
              >
                <span className="shrink-0 text-xs text-muted-foreground">{i + 1}.</span>
                <span className="min-w-0 flex-1 font-medium">
                  {isOpen ? sense.gloss.join('; ') : sense.gloss[0]}
                  {!isOpen && sense.gloss.length > 1 && (
                    <span className="font-normal text-muted-foreground">
                      {' '}
                      +{sense.gloss.length - 1} more
                    </span>
                  )}
                </span>
                {expandable && (
                  <ChevronDown
                    className={cn(
                      'size-4 shrink-0 self-center text-muted-foreground transition-transform duration-150',
                      isOpen && 'rotate-180',
                    )}
                  />
                )}
              </button>
              {isOpen && sense.examples.length > 0 && (
                // top padding keeps the first line's ruby clear of the header
                <div className="space-y-3 px-3 pt-2 pb-3 pl-9">
                  {sense.examples.map((ex, j) => (
                    <div key={j} className="text-sm">
                      <p className="text-lg leading-loose">
                        <ExampleJa example={ex} />
                        <ParseSentenceLink ja={ex.ja} />
                      </p>
                      <p className="mt-0.5 leading-relaxed text-muted-foreground">{ex.en}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
