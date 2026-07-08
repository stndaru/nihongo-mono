import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Chip, ChipGroup } from '@/components/ui/chip'
import { QuizTabs } from '@/components/quiz/QuizTabs'
import { toggleAll, ToggleAllHeading } from '@/components/quiz/ToggleAllHeading'
import {
  CONJUGATION_FORMS,
  FORM_GROUPS,
  FORM_LABELS,
  type ClassGroup,
  type ConjugationForm,
} from '@/lib/conjugation'
import {
  ALL_GROUPS,
  DEFAULT_FORMS,
  loadLastConfig,
  QUIZ_LENGTHS,
  saveLastConfig,
  serializeConfig,
  type QuizConfig,
  type QuizMode,
} from '@/lib/quiz/config'
import type { JlptLevel } from '@/lib/data/types'

export const Route = createFileRoute('/quiz/')({
  component: QuizSetupPage,
})

const GROUP_LABELS: Record<ClassGroup, string> = {
  godan: 'Godan',
  ichidan: 'Ichidan',
  suru: 'する',
  kuru: '来る',
}

function toggleItem<T>(list: T[], item: T, min = 1): T[] {
  const next = list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
  return next.length >= min ? next : list
}

function QuizSetupPage() {
  const navigate = useNavigate()
  const [config, setConfig] = useState<QuizConfig>(() => loadLastConfig())

  const start = () => {
    saveLastConfig(config)
    navigate({ to: '/quiz/session', search: serializeConfig(config) })
  }

  const setForms = (forms: ConjugationForm[]) => setConfig({ ...config, forms })

  return (
    <div className="max-w-2xl space-y-6">
      <QuizTabs active="/quiz" />
      <div>
        <h1 className="text-2xl font-semibold">Conjugation quiz</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A verb appears in dictionary form — type or pick the requested conjugation.
        </p>
      </div>

      <section className="space-y-2">
        <ToggleAllHeading
          onClick={() =>
            setConfig({ ...config, levels: toggleAll(config.levels, [5, 4, 3, 2, 1]) })
          }
        >
          JLPT level
        </ToggleAllHeading>
        <ChipGroup label="">
          {([5, 4, 3, 2, 1] as JlptLevel[]).map((level) => (
            <Chip
              key={level}
              active={config.levels.includes(level)}
              onClick={() => setConfig({ ...config, levels: toggleItem(config.levels, level) })}
            >
              N{level}
            </Chip>
          ))}
        </ChipGroup>
      </section>

      <section className="space-y-2">
        <ToggleAllHeading
          onClick={() => setConfig({ ...config, groups: toggleAll(config.groups, ALL_GROUPS) })}
        >
          Verb type
        </ToggleAllHeading>
        <ChipGroup label="">
          {ALL_GROUPS.map((group) => (
            <Chip
              key={group}
              active={config.groups.includes(group)}
              onClick={() => setConfig({ ...config, groups: toggleItem(config.groups, group) })}
            >
              {GROUP_LABELS[group]}
            </Chip>
          ))}
        </ChipGroup>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <ToggleAllHeading
            onClick={() => setForms(toggleAll(config.forms, CONJUGATION_FORMS))}
          >
            Conjugations
          </ToggleAllHeading>
          <div className="flex gap-1">
            <Chip
              active={config.forms.length === CONJUGATION_FORMS.length}
              onClick={() => setForms([...CONJUGATION_FORMS])}
            >
              Select All
            </Chip>
            <Chip
              active={
                config.forms.length === DEFAULT_FORMS.length &&
                DEFAULT_FORMS.every((f) => config.forms.includes(f))
              }
              onClick={() => setForms([...DEFAULT_FORMS])}
            >
              Basic Only
            </Chip>
          </div>
        </div>
        <div className="space-y-3">
          {FORM_GROUPS.map((group) => {
            const allSelected = group.forms.every((f) => config.forms.includes(f))
            return (
              <div key={group.label}>
                <button
                  type="button"
                  className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase transition-colors duration-100 hover:text-foreground"
                  onClick={() =>
                    setForms(
                      allSelected
                        ? config.forms.filter(
                            (f) => !(group.forms as readonly ConjugationForm[]).includes(f),
                          )
                        : [...new Set([...config.forms, ...group.forms])],
                    )
                  }
                  title={allSelected ? 'Deselect group' : 'Select group'}
                >
                  {group.label}
                </button>
                <div className="flex flex-wrap gap-1">
                  {group.forms.map((form) => (
                    <Chip
                      key={form}
                      active={config.forms.includes(form)}
                      title={FORM_LABELS[form].hint}
                      onClick={() => setForms(toggleItem(config.forms, form))}
                    >
                      {FORM_LABELS[form].label}
                    </Chip>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="space-y-2">
        <ToggleAllHeading
          onClick={() =>
            setConfig({
              ...config,
              modes: toggleAll(config.modes, ['input', 'choice'] as QuizMode[]),
            })
          }
        >
          Answer mode
        </ToggleAllHeading>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {(
            [
              ['input', 'Type the answer (romaji auto-converts to kana)'],
              ['choice', 'Multiple choice'],
            ] as [QuizMode, string][]
          ).map(([mode, label]) => (
            <label key={mode} className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={config.modes.includes(mode)}
                onCheckedChange={() =>
                  setConfig({ ...config, modes: toggleItem(config.modes, mode) })
                }
              />
              {label}
            </label>
          ))}
        </div>
        {config.modes.length === 2 && (
          <p className="text-xs text-muted-foreground">
            Both selected — the mode is picked at random per question.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Shown verb</h2>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <Checkbox
            className="mt-0.5"
            checked={config.randomShown}
            onCheckedChange={() =>
              setConfig({ ...config, randomShown: !config.randomShown })
            }
          />
          <span>
            Randomize the shown form — the verb may appear conjugated (
            <span lang="ja">食べた</span>) instead of in dictionary form (
            <span lang="ja">食べる</span>), drawn from your selected conjugations
          </span>
        </label>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Questions</h2>
        <ChipGroup label="">
          {QUIZ_LENGTHS.map((n) => (
            <Chip
              key={n}
              active={config.length === n}
              onClick={() => setConfig({ ...config, length: n })}
            >
              {n}
            </Chip>
          ))}
        </ChipGroup>
      </section>

      <Button
        size="lg"
        onClick={start}
        disabled={
          config.forms.length === 0 ||
          config.levels.length === 0 ||
          config.groups.length === 0 ||
          config.modes.length === 0
        }
      >
        Start Quiz
      </Button>
    </div>
  )
}
