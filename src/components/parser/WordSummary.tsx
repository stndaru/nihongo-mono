import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Furigana } from '@/components/verbs/Furigana'
import { LevelBadge } from '@/components/verbs/VerbBadges'
import { PosBadge } from '@/components/vocab/PosBadge'
import { findKanjiChars } from '@/lib/data/loader'
import type { ParsedWord } from '@/lib/data/parse-sentence'
import type { KanjiEntry, VocabEntry } from '@/lib/data/types'

/**
 * Clicking a parsed word opens this summary instead of navigating away —
 * the breakdown stays put. The full detail page opens in a new tab.
 */
export function WordSummaryDialog({
  word,
  onClose,
}: {
  word: ParsedWord | null
  onClose: () => void
}) {
  // a merged compound's Parts swap the dialog to a component word; internal
  // state (not a callback) so the three parents (parser + both quiz
  // feedbacks) stay untouched — reset whenever a new word opens
  const [shown, setShown] = useState<ParsedWord | null>(null)
  useEffect(() => setShown(null), [word])
  const active = shown ?? word
  const entry = active?.entry ?? null
  const [kanji, setKanji] = useState<KanjiEntry[] | null>(null)
  useEffect(() => {
    if (!entry) return
    if (entry.kanjiChars.length === 0) {
      setKanji([])
      return
    }
    let alive = true
    setKanji(null)
    findKanjiChars(entry.kanjiChars).then((map) => {
      if (alive) {
        setKanji(entry.kanjiChars.map((c) => map[c]).filter((k): k is KanjiEntry => Boolean(k)))
      }
    })
    return () => {
      alive = false
    }
  }, [entry])

  const formLabel =
    active?.formLabel === 'Conjugated' ? 'Conjugated form' : (active?.formLabel ?? null)

  return (
    <Dialog
      open={word !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-w-md">
        {active && entry && (
          <>
            <DialogHeader>
              {shown && word && (
                <button
                  type="button"
                  onClick={() => setShown(null)}
                  className="flex items-center gap-1 self-start text-xs text-muted-foreground transition-colors duration-100 hover:text-foreground"
                >
                  <ArrowLeft className="size-3.5" /> Back to{' '}
                  <span lang="ja">{word.entry.kanji}</span>
                </button>
              )}
              <DialogTitle className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-left">
                <Furigana segments={entry.furigana} className="text-3xl leading-tight" />
                {entry.kana !== entry.kanji && (
                  <span lang="ja" className="text-base font-normal text-muted-foreground">
                    {entry.kana}
                  </span>
                )}
                {entry.romaji && (
                  <span className="text-xs font-normal text-muted-foreground">
                    {entry.romaji}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-1.5">
                {formLabel && (
                  <Badge variant="outline" className="px-1.5 font-normal text-primary">
                    {formLabel}
                  </Badge>
                )}
                {active.isVerb ? (
                  <Badge variant="outline" className="px-1.5 font-normal text-muted-foreground">
                    Verb
                  </Badge>
                ) : (
                  <PosBadge pos={(entry as VocabEntry).pos} />
                )}
                <LevelBadge level={entry.jlpt} />
              </div>

              {formLabel && (
                <p className="text-muted-foreground">
                  {/* "Here", not "in this sentence" — the popup also serves
                      quiz-feedback option rows */}
                  Here it appears as{' '}
                  <span lang="ja" className="text-foreground">
                    {active.surface}
                  </span>{' '}
                  — the {formLabel.toLowerCase()} of the dictionary form{' '}
                  <span lang="ja" className="text-foreground">
                    {entry.kanji}
                  </span>
                  .
                </p>
              )}

              <div>
                <h3 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Meaning
                </h3>
                <ul className="list-disc space-y-0.5 pl-4">
                  {entry.gloss.slice(0, 5).map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </div>

              {/* components of a pattern-merged compound (参加 + 者) — each
                  linked part swaps this dialog to its own entry */}
              {active.parts && active.parts.length > 0 && (
                <div>
                  <h3 className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Parts
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {active.parts.map((part, i) =>
                      part.word ? (
                        <button
                          key={`${i}:${part.surface}`}
                          type="button"
                          onClick={() => setShown(part.word!)}
                          className="flex items-baseline gap-2 rounded-md border px-2 py-1.5 text-left transition-colors duration-100 hover:border-primary/50 hover:bg-primary/5"
                        >
                          <span lang="ja" className="text-base leading-none">
                            {part.surface}
                          </span>
                          {part.reading && part.reading !== part.surface && (
                            <span lang="ja" className="text-xs text-muted-foreground">
                              {part.reading}
                            </span>
                          )}
                          <span className="max-w-36 truncate text-xs text-muted-foreground">
                            {part.word.entry.gloss[0]}
                          </span>
                        </button>
                      ) : (
                        <span
                          key={`${i}:${part.surface}`}
                          className="flex items-baseline gap-2 rounded-md border border-dashed px-2 py-1.5"
                        >
                          <span lang="ja" className="text-base leading-none">
                            {part.surface}
                          </span>
                          {part.reading && part.reading !== part.surface && (
                            <span lang="ja" className="text-xs text-muted-foreground">
                              {part.reading}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            not in the dictionary
                          </span>
                        </span>
                      ),
                    )}
                  </div>
                </div>
              )}

              {kanji && kanji.length > 0 && (
                <div>
                  <h3 className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Kanji Used
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {kanji.map((k) => (
                      <Link
                        key={k.char}
                        to="/kanji/$char"
                        params={{ char: k.char }}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors duration-100 hover:border-primary/50 hover:bg-primary/5"
                      >
                        <span lang="ja" className="text-xl leading-none">
                          {k.char}
                        </span>
                        <span className="max-w-36 truncate text-xs text-muted-foreground">
                          {k.meanings.slice(0, 2).join(', ')}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button asChild>
                {active.isVerb ? (
                  <Link
                    to="/verbs/$verbId"
                    params={{ verbId: entry.id }}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Detail Page <ExternalLink className="size-3.5" />
                  </Link>
                ) : (
                  <Link
                    to="/vocab/$wordId"
                    params={{ wordId: entry.id }}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Detail Page <ExternalLink className="size-3.5" />
                  </Link>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
