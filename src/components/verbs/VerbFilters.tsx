import { Chip, ChipGroup } from '@/components/ui/chip'
import type { ClassGroup } from '@/lib/conjugation'
import type { WordLevel } from '@/lib/data/types'

/**
 * All chip groups are multi-select; empty = no constraint (everything
 * shows). Clicking a group's label toggles select/deselect-all — the
 * site-wide filter convention.
 */
export interface VerbListFilters {
  levels: WordLevel[]
  groups: ClassGroup[]
  endings: ('ru' | 'other')[]
  trans: ('vt' | 'vi')[]
  common?: boolean
}

const ALL_GROUPS: ClassGroup[] = ['godan', 'ichidan', 'suru', 'kuru']
const ALL_ENDINGS = ['ru', 'other'] as const
const ALL_TRANS = ['vt', 'vi'] as const

function toggleItem<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

function toggleAll<T>(list: T[], all: readonly T[]): T[] {
  return all.every((x) => list.includes(x)) ? [] : [...all]
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
    if (levels.length === 0) return // never allow zero levels chip-by-chip
    onChange({ ...filters, levels })
  }
  // label click: select/deselect all JLPT levels; Beyond (a heavyweight
  // opt-in download) keeps whatever state it has
  const toggleAllLevels = () => {
    const jlptAll: WordLevel[] = [5, 4, 3, 2, 1]
    const allOn = jlptAll.every((l) => filters.levels.includes(l))
    const beyond: WordLevel[] = filters.levels.includes(0) ? [0] : []
    onChange({ ...filters, levels: allOn ? beyond : [...jlptAll, ...beyond] })
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <ChipGroup
        label="Level"
        onLabelClick={toggleAllLevels}
        labelTitle="select/deselect all JLPT levels"
      >
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
      <ChipGroup
        label="Type"
        onLabelClick={() => onChange({ ...filters, groups: toggleAll(filters.groups, ALL_GROUPS) })}
        labelTitle="select/deselect all types"
      >
        {ALL_GROUPS.map((group) => (
          <Chip
            key={group}
            active={filters.groups.includes(group)}
            onClick={() => onChange({ ...filters, groups: toggleItem(filters.groups, group) })}
          >
            {{ godan: 'Godan', ichidan: 'Ichidan', suru: 'する', kuru: '来る' }[group]}
          </Chip>
        ))}
      </ChipGroup>
      <ChipGroup
        label="Ends"
        onLabelClick={() =>
          onChange({ ...filters, endings: toggleAll(filters.endings, ALL_ENDINGS) })
        }
        labelTitle="select/deselect all endings"
      >
        <Chip
          active={filters.endings.includes('ru')}
          onClick={() => onChange({ ...filters, endings: toggleItem(filters.endings, 'ru') })}
        >
          〜る
        </Chip>
        <Chip
          active={filters.endings.includes('other')}
          onClick={() => onChange({ ...filters, endings: toggleItem(filters.endings, 'other') })}
        >
          Other
        </Chip>
      </ChipGroup>
      <ChipGroup
        label="Trans."
        onLabelClick={() => onChange({ ...filters, trans: toggleAll(filters.trans, ALL_TRANS) })}
        labelTitle="select/deselect both transitivities"
      >
        <Chip
          active={filters.trans.includes('vt')}
          onClick={() => onChange({ ...filters, trans: toggleItem(filters.trans, 'vt') })}
          title="transitive"
        >
          VT
        </Chip>
        <Chip
          active={filters.trans.includes('vi')}
          onClick={() => onChange({ ...filters, trans: toggleItem(filters.trans, 'vi') })}
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
