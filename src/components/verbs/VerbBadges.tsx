import { Badge } from '@/components/ui/badge'
import { classGroup, type VerbClass } from '@/lib/conjugation'
import type { JlptLevel, VerbEntry } from '@/lib/data/types'
import { cn } from '@/lib/utils'

const LEVEL_STYLES: Record<JlptLevel, string> = {
  5: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  4: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  3: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  2: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  1: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
}

export function LevelBadge({ level, className }: { level: JlptLevel; className?: string }) {
  return (
    <Badge variant="secondary" className={cn('px-1.5 font-medium', LEVEL_STYLES[level], className)}>
      N{level}
    </Badge>
  )
}

const GROUP_LABELS: Record<ReturnType<typeof classGroup>, string> = {
  godan: 'Godan',
  ichidan: 'Ichidan',
  suru: 'する',
  kuru: '来る',
}

export function ClassBadge({ cls, className }: { cls: VerbClass; className?: string }) {
  return (
    <Badge variant="outline" className={cn('px-1.5 font-normal text-muted-foreground', className)}>
      {GROUP_LABELS[classGroup(cls)]}
    </Badge>
  )
}

export function TransBadge({
  trans,
  className,
}: {
  trans: VerbEntry['transitivity']
  className?: string
}) {
  if (!trans) return null
  return (
    <Badge
      variant="outline"
      className={cn('px-1.5 font-normal text-muted-foreground', className)}
      title={
        trans === 'both'
          ? 'transitive & intransitive'
          : trans === 'vt'
            ? 'transitive'
            : 'intransitive'
      }
    >
      {trans === 'both' ? 'vt·vi' : trans}
    </Badge>
  )
}
