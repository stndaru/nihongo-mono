import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Furigana } from '@/components/verbs/Furigana'
import { LevelBadge } from '@/components/verbs/VerbBadges'
import type { VocabEntry } from '@/lib/data/types'
import { PosBadge } from './PosBadge'

const PAGE = 500

export function VocabTable({ words }: { words: VocabEntry[] }) {
  const [visible, setVisible] = useState(PAGE)

  if (words.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        No words match — try widening the level filter or changing the search.
      </div>
    )
  }

  const shown = words.slice(0, visible)
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
          {shown.map((word) => (
            <tr key={word.id} className="group border-b border-border/60 hover:bg-muted/50">
              <td className="py-0 pr-2">
                <Link
                  to="/vocab/$wordId"
                  params={{ wordId: word.id }}
                  className="flex items-center py-1.5 text-base leading-snug"
                >
                  <Furigana segments={word.furigana} />
                </Link>
              </td>
              <td lang="ja" className="hidden py-1.5 pr-2 text-muted-foreground sm:table-cell">
                {word.kana}
              </td>
              <td className="max-w-0 truncate py-1.5 pr-2 text-muted-foreground" style={{ width: '45%' }}>
                {word.gloss.join('; ')}
              </td>
              <td className="hidden whitespace-nowrap py-1.5 pr-2 md:table-cell">
                <PosBadge pos={word.pos} />
              </td>
              <td className="py-1.5 pr-2">
                <LevelBadge level={word.jlpt} />
              </td>
              <td className="w-4 py-1.5">
                {word.common && (
                  <span
                    className="block size-1.5 rounded-full bg-primary/60"
                    title="common word"
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between py-3 text-xs text-muted-foreground">
        <span>
          {Math.min(visible, words.length)} of {words.length} words
        </span>
        {words.length > visible && (
          <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + PAGE)}>
            Show More
          </Button>
        )}
      </div>
    </div>
  )
}
