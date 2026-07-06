import type { ClassGroup } from '@/lib/conjugation'
import type { JlptLevel } from '@/lib/data/types'
import { cn } from '@/lib/utils'

export interface VerbListFilters {
  levels: JlptLevel[]
  group?: ClassGroup
  ending?: 'ru' | 'other'
  trans?: 'vt' | 'vi'
  common?: boolean
}

function Chip({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-7 rounded-md border px-2 text-xs transition-colors duration-100',
        active
          ? 'border-primary/50 bg-primary/10 font-medium text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function ChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1">
      <span className="mr-0.5 text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

export function VerbFilters({
  filters,
  onChange,
}: {
  filters: VerbListFilters
  onChange: (next: VerbListFilters) => void
}) {
  const toggleLevel = (level: JlptLevel) => {
    const has = filters.levels.includes(level)
    const levels = has
      ? filters.levels.filter((l) => l !== level)
      : [...filters.levels, level].sort((a, b) => b - a)
    if (levels.length === 0) return // never allow zero levels
    onChange({ ...filters, levels })
  }
  const toggle = <K extends 'group' | 'ending' | 'trans'>(
    key: K,
    value: NonNullable<VerbListFilters[K]>,
  ) => {
    onChange({ ...filters, [key]: filters[key] === value ? undefined : value })
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <ChipGroup label="Level">
        {([5, 4, 3, 2, 1] as const).map((level) => (
          <Chip
            key={level}
            active={filters.levels.includes(level)}
            onClick={() => toggleLevel(level)}
          >
            N{level}
          </Chip>
        ))}
      </ChipGroup>
      <ChipGroup label="Type">
        <Chip active={filters.group === 'godan'} onClick={() => toggle('group', 'godan')}>
          godan
        </Chip>
        <Chip active={filters.group === 'ichidan'} onClick={() => toggle('group', 'ichidan')}>
          ichidan
        </Chip>
        <Chip active={filters.group === 'suru'} onClick={() => toggle('group', 'suru')}>
          する
        </Chip>
        <Chip active={filters.group === 'kuru'} onClick={() => toggle('group', 'kuru')}>
          来る
        </Chip>
      </ChipGroup>
      <ChipGroup label="Ends">
        <Chip active={filters.ending === 'ru'} onClick={() => toggle('ending', 'ru')}>
          〜る
        </Chip>
        <Chip active={filters.ending === 'other'} onClick={() => toggle('ending', 'other')}>
          other
        </Chip>
      </ChipGroup>
      <ChipGroup label="Trans.">
        <Chip
          active={filters.trans === 'vt'}
          onClick={() => toggle('trans', 'vt')}
          title="transitive"
        >
          vt
        </Chip>
        <Chip
          active={filters.trans === 'vi'}
          onClick={() => toggle('trans', 'vi')}
          title="intransitive"
        >
          vi
        </Chip>
      </ChipGroup>
      <Chip
        active={filters.common === true}
        onClick={() => onChange({ ...filters, common: filters.common ? undefined : true })}
      >
        common only
      </Chip>
    </div>
  )
}
