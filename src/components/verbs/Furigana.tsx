import type { FuriganaSegment } from '@/lib/data/types'
import { cn } from '@/lib/utils'

export function Furigana({
  segments,
  className,
}: {
  segments: FuriganaSegment[]
  className?: string
}) {
  return (
    <span lang="ja" className={cn('whitespace-nowrap', className)}>
      {segments.map((s, i) =>
        s.r ? (
          <ruby key={i}>
            {s.t}
            <rt>{s.r}</rt>
          </ruby>
        ) : (
          <span key={i}>{s.t}</span>
        ),
      )}
    </span>
  )
}
