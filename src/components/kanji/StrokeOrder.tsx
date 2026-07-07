import { useEffect, useState } from 'react'
import { findStrokes } from '@/lib/data/loader'
import { cn } from '@/lib/utils'

/**
 * Stroke-order frame strip rendered from KanjiVG path data: frame N draws
 * strokes 1…N with the newest stroke highlighted and a dot at its start
 * point. No SVG files ship to the client — just the path strings (one
 * ~11 KB shard per kanji, see loader.ts) — and no stroke-number text is
 * needed since the sequence itself is the numbering.
 *
 * Renders nothing while loading and nothing at all when KanjiVG has no
 * data for the character (rare kanji).
 */
export function StrokeOrder({
  char,
  frameClass,
  heading,
}: {
  char: string
  frameClass?: string
  /** wraps the strip in a section with this title (kanji detail page) */
  heading?: string
}) {
  const [paths, setPaths] = useState<string[] | undefined>(undefined)
  useEffect(() => {
    let alive = true
    setPaths(undefined)
    findStrokes(char).then((p) => {
      if (alive) setPaths(p)
    })
    return () => {
      alive = false
    }
  }, [char])

  if (!paths || paths.length === 0) return null

  const strip = (
    <div className="flex flex-wrap gap-1" role="img" aria-label={`stroke order of ${char}`}>
      {paths.map((_, frame) => (
        <svg
          key={frame}
          viewBox="0 0 109 109"
          className={cn('size-11 shrink-0 rounded border border-border/60', frameClass)}
        >
          {paths.slice(0, frame + 1).map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={i === frame ? 'stroke-primary' : 'stroke-muted-foreground/45'}
            />
          ))}
          <StartDot d={paths[frame]} />
        </svg>
      ))}
    </div>
  )

  if (!heading) return strip
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">{heading}</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        {paths.length} strokes, one frame per stroke — the highlighted stroke is drawn
        next, starting at the dot. Data from KanjiVG.
      </p>
      {strip}
    </section>
  )
}

/** Marks where the highlighted stroke begins (its path's M x,y). */
function StartDot({ d }: { d: string }) {
  const m = /^[Mm]\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/.exec(d)
  if (!m) return null
  return <circle cx={Number(m[1])} cy={Number(m[2])} r={4} className="fill-primary/80" />
}
