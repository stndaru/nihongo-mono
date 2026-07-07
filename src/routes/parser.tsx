import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ScanText, TriangleAlert } from 'lucide-react'
import { Tooltip as TooltipPrimitive } from 'radix-ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Furigana } from '@/components/verbs/Furigana'
import { LevelBadge } from '@/components/verbs/VerbBadges'
import { PosBadge } from '@/components/vocab/PosBadge'
import { loadVerbLevels, loadVocabLevels } from '@/lib/data/loader'
import {
  buildParserDicts,
  parseSentence,
  stripNonJapanese,
  uniqueWords,
  type ParsedSegment,
  type ParsedWord,
  type ParserDicts,
} from '@/lib/data/parse-sentence'
import type { VocabEntry } from '@/lib/data/types'

const MAX_LEN = 100

interface ParserSearch {
  /** pre-filled sentence (the palette's "Break Down as Sentence" hand-off) */
  q?: string
}

export const Route = createFileRoute('/parser')({
  validateSearch: (search: Record<string, unknown>): ParserSearch => {
    const q =
      typeof search.q === 'string' ? stripNonJapanese(search.q).slice(0, MAX_LEN) : ''
    return q ? { q } : {}
  },
  component: ParserPage,
})

function wordLink(word: ParsedWord) {
  return word.isVerb
    ? ({ to: '/verbs/$verbId', params: { verbId: word.entry.id } } as const)
    : ({ to: '/vocab/$wordId', params: { wordId: word.entry.id } } as const)
}

/** One matched word inside the sentence: highlight + tooltip + link. */
function WordSpan({ word }: { word: ParsedWord }) {
  const link = wordLink(word)
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <Link
          {...link}
          className="rounded-sm underline decoration-primary/50 decoration-dotted underline-offset-4 transition-colors duration-100 hover:bg-primary/15 focus-visible:bg-primary/15"
        >
          {word.surface}
        </Link>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          className="z-50 max-w-72 rounded-md border bg-background p-3 text-sm shadow-md duration-100 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0"
        >
          <div className="flex items-baseline gap-2" lang="ja">
            <span className="font-medium">{word.entry.kanji}</span>
            {word.entry.kana !== word.entry.kanji && (
              <span className="text-xs text-muted-foreground">{word.entry.kana}</span>
            )}
          </div>
          {word.formLabel && (
            <p className="mt-1 text-xs text-primary">
              {word.formLabel} of{' '}
              <span lang="ja">{word.entry.kanji}</span>
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {word.entry.gloss.slice(0, 2).join('; ')}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5">
            {word.isVerb ? (
              <Badge variant="outline" className="px-1.5 font-normal text-muted-foreground">
                Verb
              </Badge>
            ) : (
              <PosBadge pos={(word.entry as VocabEntry).pos} />
            )}
            <LevelBadge level={word.entry.jlpt} />
          </div>
          <TooltipPrimitive.Arrow className="fill-border" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

function ParserPage() {
  const { q } = Route.useSearch()
  const navigate = Route.useNavigate()

  const [dicts, setDicts] = useState<ParserDicts | null>(null)
  useEffect(() => {
    let alive = true
    Promise.all([loadVerbLevels([5, 4, 3, 2, 1]), loadVocabLevels([5, 4, 3, 2, 1])]).then(
      ([verbs, vocab]) => {
        if (alive) setDicts(buildParserDicts(verbs, vocab))
      },
    )
    return () => {
      alive = false
    }
  }, [])

  const [text, setText] = useState(q ?? '')
  const [blocked, setBlocked] = useState(false)
  const [result, setResult] = useState<ParsedSegment[] | null>(null)

  const onInput = (raw: string) => {
    const clean = stripNonJapanese(raw).slice(0, MAX_LEN)
    setBlocked(clean.length !== raw.length)
    setText(clean)
  }

  // the sentence lives in ?q= so the breakdown survives navigating to a
  // word's detail page and coming back (and palette hand-offs auto-run)
  const breakDown = () => {
    const trimmed = text.trim()
    if (trimmed) navigate({ search: { q: trimmed }, replace: true })
  }
  useEffect(() => {
    if (q && dicts) {
      setText(q)
      setResult(parseSentence(q, dicts))
    }
  }, [q, dicts])

  const words = useMemo(() => (result ? uniqueWords(result) : []), [result])

  return (
    <TooltipPrimitive.Provider delayDuration={150}>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Sentence Parser</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste a Japanese sentence and break it down into the words it&apos;s
            built from — verbs (conjugated ones included), nouns, adjectives,
            adverbs, and more. Hover a highlighted word for a quick summary;
            click it for the full detail page.
          </p>
        </div>

        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
            <TriangleAlert className="size-4 shrink-0" /> Before you rely on it
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-muted-foreground">
            <li>
              This is heuristic dictionary matching, not a full grammar analyzer —
              incoherent sentences, typos, or unusual spellings will produce an
              inaccurate breakdown. Long compounds can also split differently
              than a native reader would.
            </li>
            <li>
              Japanese input only: <span lang="ja">かな</span> and{' '}
              <span lang="ja">漢字</span>. Romaji is not accepted — type{' '}
              <span lang="ja">たべた</span>, not &quot;tabeta&quot;.
            </li>
            <li>
              Only JLPT-listed words are recognized; rare words and most proper
              names stay unhighlighted.
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => onInput(e.target.value)}
            lang="ja"
            rows={2}
            placeholder="旅行の楽しみは、何といってもやはり、その土地の名物料理を食べることだろう。"
            className="w-full resize-none rounded-md border bg-transparent px-3 py-2 text-lg outline-none placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {blocked && (
                <span className="text-destructive">
                  Non-Japanese characters were removed — kana and kanji only.{' '}
                </span>
              )}
              {text.length}/{MAX_LEN}
            </p>
            <Button onClick={breakDown} disabled={!dicts || !text.trim()}>
              {dicts ? 'Break Down' : 'Loading dictionary…'}
            </Button>
          </div>
        </div>

        {result && (
          <>
            <section>
              <h2 className="mb-2 text-lg font-semibold">Breakdown</h2>
              <p className="mb-3 text-xs text-muted-foreground">
                Dotted words are recognized — hover for a summary, click to open.
              </p>
              <p lang="ja" className="rounded-lg border p-4 text-2xl/relaxed">
                {result.map((seg, i) =>
                  seg.word ? (
                    <WordSpan key={i} word={seg.word} />
                  ) : (
                    <span key={i} className="text-muted-foreground">
                      {seg.text}
                    </span>
                  ),
                )}
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold">
                Words Found{words.length > 0 ? ` (${words.length})` : ''}
              </h2>
              {words.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing recognized — the sentence may use words outside the JLPT
                  lists, or an unusual spelling.
                </p>
              ) : (
                <div className="grid gap-1.5">
                  {words.map((word) => (
                    <Link
                      key={`${word.entry.id}:${word.surface}`}
                      {...wordLink(word)}
                      className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 rounded-md border p-2.5 transition-colors duration-100 hover:border-primary/50 hover:bg-primary/5"
                    >
                      <Furigana segments={word.entry.furigana} className="shrink-0 text-base" />
                      {word.formLabel && (
                        <span lang="ja" className="text-sm text-muted-foreground">
                          {word.surface}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                        {word.entry.gloss.join('; ')}
                      </span>
                      {word.formLabel && (
                        <Badge variant="outline" className="px-1.5 font-normal text-primary">
                          {word.formLabel}
                        </Badge>
                      )}
                      {word.isVerb ? (
                        <Badge
                          variant="outline"
                          className="px-1.5 font-normal text-muted-foreground"
                        >
                          Verb
                        </Badge>
                      ) : (
                        <PosBadge pos={(word.entry as VocabEntry).pos} />
                      )}
                      <LevelBadge level={word.entry.jlpt} />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {!result && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ScanText className="size-3.5" />
            Tip: the Ctrl/Cmd+K search offers &quot;Break Down as Sentence&quot; when a
            Japanese query matches no word.
          </p>
        )}
      </div>
    </TooltipPrimitive.Provider>
  )
}
