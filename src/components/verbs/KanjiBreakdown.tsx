import { useEffect, useState } from 'react'
import { loadKanji } from '@/lib/data/loader'
import type { KanjiEntry } from '@/lib/data/types'
import { LevelBadge } from './VerbBadges'

export function KanjiBreakdown({ chars }: { chars: string[] }) {
  const [kanji, setKanji] = useState<Record<string, KanjiEntry> | null>(null)
  useEffect(() => {
    let alive = true
    loadKanji().then((k) => {
      if (alive) setKanji(k)
    })
    return () => {
      alive = false
    }
  }, [])

  if (chars.length === 0) return null
  if (!kanji) {
    return <div className="py-4 text-sm text-muted-foreground">Loading kanji…</div>
  }

  const entries = chars.map((c) => kanji[c]).filter(Boolean)
  if (entries.length === 0) return null

  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {entries.map((entry) => (
        <div key={entry.char} className="flex gap-3 rounded-md border p-3">
          {/* becomes a Link to /kanji/$char once kanji pages exist */}
          <span lang="ja" className="text-4xl leading-none">
            {entry.char}
          </span>
          <div className="min-w-0 text-sm">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium">{entry.meanings.slice(0, 3).join(', ')}</span>
              {entry.jlpt && <LevelBadge level={entry.jlpt} />}
            </div>
            <dl lang="ja" className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {entry.on.length > 0 && (
                <div>
                  <dt className="inline">音: </dt>
                  <dd className="inline">{entry.on.slice(0, 4).join('、')}</dd>
                </div>
              )}
              {entry.kun.length > 0 && (
                <div>
                  <dt className="inline">訓: </dt>
                  <dd className="inline">{entry.kun.slice(0, 4).join('、')}</dd>
                </div>
              )}
            </dl>
            <div className="mt-1 text-xs text-muted-foreground">
              {entry.strokes} strokes
              {entry.freq ? ` · freq #${entry.freq}` : ''}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
