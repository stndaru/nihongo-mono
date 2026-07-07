import { Chip, ChipGroup } from '@/components/ui/chip'
import type { ClassGroup } from '@/lib/conjugation'
import type { WordLevel } from '@/lib/data/types'

export interface VerbListFilters {
  levels: WordLevel[]
  group?: ClassGroup
  ending?: 'ru' | 'other'
  trans?: 'vt' | 'vi'
  common?: boolean
}

export function VerbFilters({
  filters,
  onChange,
}: {
  filters: VerbListFilters
  onChange: (next: VerbListFilters) => void
}) {
  const toggleLevel = (level: WordLevel) => {
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
        <Chip
          active={filters.levels.includes(0)}
          onClick={() => toggleLevel(0)}
          title="every other JMdict verb, beyond the JLPT lists"
        >
          Beyond
        </Chip>
      </ChipGroup>
      <ChipGroup label="Type">
        <Chip active={filters.group === 'godan'} onClick={() => toggle('group', 'godan')}>
          Godan
        </Chip>
        <Chip active={filters.group === 'ichidan'} onClick={() => toggle('group', 'ichidan')}>
          Ichidan
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
          Other
        </Chip>
      </ChipGroup>
      <ChipGroup label="Trans.">
        <Chip
          active={filters.trans === 'vt'}
          onClick={() => toggle('trans', 'vt')}
          title="transitive"
        >
          VT
        </Chip>
        <Chip
          active={filters.trans === 'vi'}
          onClick={() => toggle('trans', 'vi')}
          title="intransitive"
        >
          VI
        </Chip>
      </ChipGroup>
      <Chip
        active={filters.common === true}
        onClick={() => onChange({ ...filters, common: filters.common ? undefined : true })}
      >
        Common Only
      </Chip>
    </div>
  )
}
