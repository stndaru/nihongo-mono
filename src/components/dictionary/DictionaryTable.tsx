import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Furigana } from '@/components/verbs/Furigana'
import { ClassBadge, LevelBadge, TransBadge } from '@/components/verbs/VerbBadges'
import { PosBadge } from '@/components/vocab/PosBadge'
import { rowClickGuard } from '@/lib/row-click'
import type { VerbEntry, VocabEntry } from '@/lib/data/types'

/** One combined-dictionary row; verbs and vocab keep their own detail routes. */
export interface DictRow {
  word: VerbEntry | VocabEntry
  isVerb: boolean
}

// kept small: every keystroke re-renders the visible rows (ruby is expensive),
// and the combined dataset is the largest table in the app (~9.6k JLPT rows)
const PAGE = 100

export function DictionaryTable({ rows }: { rows: DictRow[] }) {
  const navigate = useNavigate()
  const [visible, setVisible] = useState(PAGE)
  // new result set → back to one page, so old Show More clicks don't linger
  useEffect(() => setVisible(PAGE), [rows])

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        No words match — try widening the filters or changing the search.
      </div>
    )
  }

  const shown = rows.slice(0, visible)
  return (
    <div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="sticky top-12 z-10 border-b bg-background text-left text-xs text-muted-foreground">
            <th className="py-1.5 pr-2 font-medium">Word</th>
            <th className="hidden py-1.5 pr-2 font-medium sm:table-cell">Reading</th>
            <th className="py-1.5 pr-2 font-medium">Meaning</th>
            <th className="hidden py-1.5 pr-2 font-medium md:table-cell">Type</th>
            <th className="py-1.5 pr-2 font-medium">Level</th>
            <th className="py-1.5 font-medium" title="common word">
              <span className="sr-only">Common</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map(({ word, isVerb }) => (
            <tr
              key={`${isVerb ? 'v' : 'w'}${word.id}`}
              className="group cursor-pointer border-b border-border/60 hover:bg-muted/50"
              onClick={(e) => {
                if (rowClickGuard(e)) return
                if (isVerb) navigate({ to: '/verbs/$verbId', params: { verbId: word.id } })
                else navigate({ to: '/vocab/$wordId', params: { wordId: word.id } })
              }}
            >
              <td className="py-0 pr-2">
                {isVerb ? (
                  <Link
                    to="/verbs/$verbId"
                    params={{ verbId: word.id }}
                    className="flex items-center py-1.5 text-base leading-snug"
                  >
                    <Furigana segments={word.furigana} />
                  </Link>
                ) : (
                  <Link
                    to="/vocab/$wordId"
                    params={{ wordId: word.id }}
                    className="flex items-center py-1.5 text-base leading-snug"
                  >
                    <Furigana segments={word.furigana} />
                  </Link>
                )}
              </td>
              <td lang="ja" className="hidden py-1.5 pr-2 text-muted-foreground sm:table-cell">
                {word.kana}
              </td>
              <td className="max-w-0 truncate py-1.5 pr-2 text-muted-foreground" style={{ width: '40%' }}>
                {word.gloss.join('; ')}
              </td>
              <td className="hidden whitespace-nowrap py-1.5 pr-2 md:table-cell">
                {isVerb ? (
                  <span className="flex items-center gap-1">
                    <Badge variant="outline" className="px-1.5 font-normal text-muted-foreground">
                      Verb
                    </Badge>
                    <ClassBadge cls={(word as VerbEntry).class} />
                    <TransBadge trans={(word as VerbEntry).transitivity} />
                  </span>
                ) : (
                  <PosBadge pos={(word as VocabEntry).pos} />
                )}
              </td>
              <td className="py-1.5 pr-2">
                <LevelBadge level={word.jlpt} />
              </td>
              <td className="w-4 py-1.5">
                {word.common && (
                  <span className="block size-1.5 rounded-full bg-primary/60" title="common word" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between py-3 text-xs text-muted-foreground">
        <span>
          {Math.min(visible, rows.length)} of {rows.length.toLocaleString()} words
        </span>
        {rows.length > visible && (
          <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + PAGE)}>
            Show More
          </Button>
        )}
      </div>
    </div>
  )
}
