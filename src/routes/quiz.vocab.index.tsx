import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Chip, ChipGroup } from '@/components/ui/chip'
import { QuizTabs } from '@/components/quiz/QuizTabs'
import { toggleAll, ToggleAllHeading } from '@/components/quiz/ToggleAllHeading'
import { POS_LABELS } from '@/components/vocab/PosBadge'
import type { JlptLevel, VocabPos } from '@/lib/data/types'
import { QUIZ_LENGTHS } from '@/lib/quiz/config'
import {
  ALL_POS,
  ALL_VOCAB_MODES,
  loadLastVocabConfig,
  saveLastVocabConfig,
  serializeVocabConfig,
  type VocabQuizConfig,
  type VocabQuizMode,
} from '@/lib/quiz/vocab-config'

export const Route = createFileRoute('/quiz/vocab/')({
  component: VocabQuizSetupPage,
})

function toggleItem<T>(list: T[], item: T, min = 1): T[] {
  const next = list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
  return next.length >= min ? next : list
}

function VocabQuizSetupPage() {
  const navigate = useNavigate()
  const [config, setConfig] = useState<VocabQuizConfig>(() => loadLastVocabConfig())

  const start = () => {
    saveLastVocabConfig(config)
    navigate({ to: '/quiz/vocab/session', search: serializeVocabConfig(config) })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <QuizTabs active="/quiz/vocab" />
      <div>
        <h1 className="text-2xl font-semibold">Vocabulary quiz</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Type the reading of a word, pick its meaning, or pick the word for an
          English meaning — depending on the answer mode drawn for each question.
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
          onClick={() => setConfig({ ...config, pos: toggleAll(config.pos, ALL_POS) })}
        >
          Word type
        </ToggleAllHeading>
        <ChipGroup label="">
          {ALL_POS.map((pos: VocabPos) => (
            <Chip
              key={pos}
              active={config.pos.includes(pos)}
              onClick={() => setConfig({ ...config, pos: toggleItem(config.pos, pos) })}
            >
              {POS_LABELS[pos]}
            </Chip>
          ))}
        </ChipGroup>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Verbs</h2>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={config.verbs}
            onCheckedChange={() => setConfig({ ...config, verbs: !config.verbs })}
          />
          Include verbs in dictionary form (食べる, 飲む…) as questions
        </label>
      </section>

      <section className="space-y-2">
        <ToggleAllHeading
          onClick={() =>
            setConfig({ ...config, modes: toggleAll(config.modes, ALL_VOCAB_MODES) })
          }
        >
          Answer mode
        </ToggleAllHeading>
        <div className="flex flex-col gap-y-2 text-sm">
          {(
            [
              ['input', 'Type the reading (romaji auto-converts to kana)'],
              ['choice', 'Shown the Japanese word — pick the English meaning'],
              ['choice-ja', 'Shown the English meaning — pick the Japanese word'],
            ] as [VocabQuizMode, string][]
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
        {config.modes.length > 1 && (
          <p className="text-xs text-muted-foreground">
            Multiple selected — the mode is picked at random per question.
          </p>
        )}
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
          config.pos.length === 0 ||
          config.levels.length === 0 ||
          config.modes.length === 0
        }
      >
        Start Quiz
      </Button>
    </div>
  )
}
