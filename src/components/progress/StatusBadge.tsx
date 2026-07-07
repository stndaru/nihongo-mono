import type { WordStatus } from '@/lib/progress/analytics'
import { cn } from '@/lib/utils'

export const STATUS_LABELS: Record<WordStatus, string> = {
  weak: 'Weak',
  learning: 'Learning',
  solid: 'Solid',
  new: 'New',
}

const STATUS_STYLES: Record<WordStatus, string> = {
  weak: 'bg-destructive/10 text-destructive',
  learning: 'bg-primary/10 text-primary',
  solid: 'bg-success/10 text-success',
  new: 'bg-muted text-muted-foreground',
}

export function StatusBadge({ status }: { status: WordStatus }) {
  return (
    <span
      className={cn(
        'inline-block rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap',
        STATUS_STYLES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
