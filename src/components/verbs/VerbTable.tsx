import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { rowClickGuard } from '@/lib/row-click'
import type { VerbEntry } from '@/lib/data/types'
import { Furigana } from './Furigana'
import { ClassBadge, LevelBadge, TransBadge } from './VerbBadges'

// kept small: every keystroke re-renders the visible rows (ruby is expensive)
const PAGE = 100

export function VerbTable({ verbs }: { verbs: VerbEntry[] }) {
  const navigate = useNavigate()
  const [visible, setVisible] = useState(PAGE)
  // new result set → back to one page, so old Show More clicks don't linger
  useEffect(() => setVisible(PAGE), [verbs])

  if (verbs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        No verbs match — try widening the level filter or changing the search.
      </div>
    )
  }

  const shown = verbs.slice(0, visible)
  return (
    <div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="sticky top-12 z-10 border-b bg-background text-left text-xs text-muted-foreground">
            <th className="py-1.5 pr-2 font-medium">Verb</th>
            <th className="hidden py-1.5 pr-2 font-medium sm:table-cell">Reading</th>
            <th className="py-1.5 pr-2 font-medium">Meaning</th>
            <th className="hidden py-1.5 pr-2 font-medium md:table-cell">Type</th>
            <th className="py-1.5 pr-2 font-medium">Level</th>
            <th className="py-1.5 font-medium" title="common verb">
              <span className="sr-only">Common</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((verb) => (
            <tr
              key={verb.id}
              className="group cursor-pointer border-b border-border/60 hover:bg-muted/50"
              onClick={(e) => {
                if (rowClickGuard(e)) return
                navigate({ to: '/verbs/$verbId', params: { verbId: verb.id } })
              }}
            >
              <td className="py-0 pr-2">
                <Link
                  to="/verbs/$verbId"
                  params={{ verbId: verb.id }}
                  className="flex items-center py-1.5 text-base leading-snug"
                >
                  <Furigana segments={verb.furigana} />
                </Link>
              </td>
              <td lang="ja" className="hidden py-1.5 pr-2 text-muted-foreground sm:table-cell">
                {verb.kana}
              </td>
              <td className="max-w-0 truncate py-1.5 pr-2 text-muted-foreground" style={{ width: '45%' }}>
                {verb.gloss.join('; ')}
              </td>
              <td className="hidden whitespace-nowrap py-1.5 pr-2 md:table-cell">
                <ClassBadge cls={verb.class} />
                <TransBadge trans={verb.transitivity} className="ml-1" />
              </td>
              <td className="py-1.5 pr-2">
                <LevelBadge level={verb.jlpt} />
              </td>
              <td className="w-4 py-1.5">
                {verb.common && (
                  <span
                    className="block size-1.5 rounded-full bg-primary/60"
                    title="common verb"
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between py-3 text-xs text-muted-foreground">
        <span>
          {Math.min(visible, verbs.length)} of {verbs.length} verbs
        </span>
        {verbs.length > visible && (
          <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + PAGE)}>
            Show More
          </Button>
        )}
      </div>
    </div>
  )
}
