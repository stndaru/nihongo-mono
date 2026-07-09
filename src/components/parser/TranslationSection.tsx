import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translateSentence, type Translation } from '@/lib/data/translate'

export type TranslationState =
  | { status: 'loading' }
  | ({ status: 'done' } & Translation)
  | { status: 'error' }

/**
 * Fires the translation fetch as soon as a sentence is committed (?q=) —
 * independent of the dictionary/tokenizer loads, so it never blocks or is
 * blocked by the breakdown. Repeats resolve from the module cache before
 * paint, so the skeleton doesn't flash on re-parses. `attempt` exists for
 * retries after an outage: the sentence alone can't re-fire the effect when
 * the user re-commits identical text, so error paths bump the counter.
 */
export function useTranslation(
  sentence: string | undefined,
  attempt = 0,
): TranslationState | null {
  const [state, setState] = useState<TranslationState | null>(null)
  useEffect(() => {
    if (!sentence) {
      setState(null)
      return
    }
    let alive = true
    setState({ status: 'loading' })
    translateSentence(sentence)
      .then((t) => {
        if (alive) setState({ status: 'done', ...t })
      })
      .catch(() => {
        if (alive) setState({ status: 'error' })
      })
    return () => {
      alive = false
    }
  }, [sentence, attempt])
  return state
}

const PROVIDER_LABELS = { google: 'Google Translate', mymemory: 'MyMemory' } as const

export function TranslationSection({
  sentence,
  state,
  onRetry,
}: {
  sentence: string
  state: TranslationState | null
  /** re-fires the fetch after an outage (bumps the hook's attempt counter) */
  onRetry?: () => void
}) {
  if (!state) return null
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">Translation</h2>
      {state.status === 'loading' && (
        <div className="space-y-2.5 rounded-lg border p-4">
          <div className="h-4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        </div>
      )}
      {state.status === 'done' && (
        <>
          <p className="rounded-lg border p-4 text-base/relaxed">{state.text}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Machine translation via {PROVIDER_LABELS[state.provider]} — may be imperfect.
          </p>
        </>
      )}
      {state.status === 'error' && (
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">
            Translation unavailable — the translation services couldn&apos;t be reached.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                Try Again
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <a
                href={`https://translate.google.com/?sl=ja&tl=en&text=${encodeURIComponent(sentence)}&op=translate`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open in Google Translate <ExternalLink className="size-3.5" />
              </a>
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
