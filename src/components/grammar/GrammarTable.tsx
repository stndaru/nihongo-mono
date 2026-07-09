import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { LevelBadge } from '@/components/verbs/VerbBadges'
import { rowClickGuard } from '@/lib/row-click'
import type { GrammarEntry } from '@/lib/data/types'

// kept small: every keystroke re-renders the visible rows
const PAGE = 100

export function GrammarTable({ entries }: { entries: GrammarEntry[] }) {
  const navigate = useNavigate()
  const [visible, setVisible] = useState(PAGE)
  // new result set → back to one page, so old Show More clicks don't linger
  useEffect(() => setVisible(PAGE), [entries])

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        No grammar points match — try widening the level filter or changing the search.
      </div>
    )
  }

  const shown = entries.slice(0, visible)
  return (
    <div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="sticky top-12 z-10 border-b bg-background text-left text-xs text-muted-foreground">
            <th className="py-1.5 pr-2 font-medium">Grammar</th>
            <th className="hidden py-1.5 pr-2 font-medium sm:table-cell">Romaji</th>
            <th className="py-1.5 pr-2 font-medium">Meaning</th>
            <th className="py-1.5 font-medium">Level</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((entry) => (
            <tr
              key={entry.slug}
              className="group cursor-pointer border-b border-border/60 hover:bg-muted/50"
              onClick={(e) => {
                if (rowClickGuard(e)) return
                navigate({ to: '/grammar/$slug', params: { slug: entry.slug } })
              }}
            >
              <td className="py-0 pr-2">
                <Link
                  to="/grammar/$slug"
                  params={{ slug: entry.slug }}
                  lang="ja"
                  className="flex items-center py-1.5 text-base leading-snug"
                >
                  {entry.title}
                </Link>
              </td>
              <td className="hidden py-1.5 pr-2 text-muted-foreground sm:table-cell">
                {entry.romaji}
              </td>
              <td className="max-w-0 truncate py-1.5 pr-2 text-muted-foreground" style={{ width: '45%' }}>
                {entry.meaning}
              </td>
              <td className="py-1.5">
                <LevelBadge level={entry.jlpt} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between py-3 text-xs text-muted-foreground">
        <span>
          {Math.min(visible, entries.length)} of {entries.length} grammar points
        </span>
        {entries.length > visible && (
          <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + PAGE)}>
            Show More
          </Button>
        )}
      </div>
    </div>
  )
}
