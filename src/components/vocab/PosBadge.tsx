import { Badge } from '@/components/ui/badge'
import type { VocabPos } from '@/lib/data/types'
import { cn } from '@/lib/utils'

export const POS_LABELS: Record<VocabPos, string> = {
  noun: 'Noun',
  'adj-i': 'い-adj',
  'adj-na': 'な-adj',
  adverb: 'Adverb',
}

export function PosBadge({ pos, className }: { pos: VocabPos; className?: string }) {
  return (
    <Badge variant="outline" className={cn('px-1.5 font-normal text-muted-foreground', className)}>
      {POS_LABELS[pos]}
    </Badge>
  )
}
