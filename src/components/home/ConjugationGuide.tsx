import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  CONJUGATION_FORMS,
  conjugate,
  FORM_LABELS,
  getRule,
  type ConjugationForm,
  type VerbClass,
} from '@/lib/conjugation'
import type { VerbEntry } from '@/lib/data/types'
import { cn } from '@/lib/utils'

/**
 * Per-form "how to build it" guide for the verb cheatsheet: one accordion
 * row per conjugation form, each explaining the rule for godan / ichidan /
 * する / 来る with a live example. Rules come from the same getRule() cards
 * the quiz and detail pages use; examples are conjugated at render time —
 * static content, no data fetches.
 */

/** conjugate() only reads kanji/kana/class — a minimal fixture is enough. */
const exampleVerb = (kanji: string, kana: string, cls: VerbClass) =>
  ({ kanji, kana, class: cls }) as VerbEntry

const GROUPS: { name: string; verbClass: VerbClass; verb: VerbEntry }[] = [
  { name: 'Godan', verbClass: 'v5k', verb: exampleVerb('書く', 'かく', 'v5k') },
  { name: 'Ichidan', verbClass: 'v1', verb: exampleVerb('食べる', 'たべる', 'v1') },
  { name: 'する', verbClass: 'vs', verb: exampleVerb('する', 'する', 'vs') },
  { name: '来る', verbClass: 'vk', verb: exampleVerb('来る', 'くる', 'vk') },
]

function FormRow({ form }: { form: ConjugationForm }) {
  const [open, setOpen] = useState(false)
  const label = FORM_LABELS[form]
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-baseline gap-2 p-3 text-left text-sm transition-colors duration-100 hover:bg-muted/50"
      >
        <span className="font-medium">{label.label}</span>
        <span lang="ja" className="text-xs text-muted-foreground">
          {label.ja}
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">· {label.hint}</span>
        <ChevronDown
          className={cn(
            'ml-auto size-4 shrink-0 self-center text-muted-foreground transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <div className="px-3 pb-3">
          <p className="mb-2.5 text-xs text-muted-foreground">{label.usage}</p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {GROUPS.map(({ name, verbClass, verb }) => {
              const rule = getRule(form, verbClass)
              const conjugated = conjugate(verb, form)
              // する/来る patterns are already concrete (来る → 来て) — an
              // example line would just repeat them
              const example =
                conjugated && !rule.pattern.includes(conjugated.kanji) ? conjugated : null
              return (
                <div key={name} className="rounded-md border p-3 text-sm">
                  <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {name}
                  </div>
                  <div lang="ja" className="mt-1.5 font-medium">
                    {rule.pattern}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {rule.explanation}
                  </p>
                  {rule.exceptions && (
                    <p className="mt-1.5 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
                      {rule.exceptions}
                    </p>
                  )}
                  {example && (
                    <div lang="ja" className="mt-2 border-t border-border/60 pt-2">
                      {verb.kanji} → {example.kanji}
                      {example.kana !== example.kanji && (
                        <span className="text-muted-foreground">（{example.kana}）</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function ConjugationGuide() {
  return (
    <div>
      <h2 className="text-lg font-semibold">How to Build Each Conjugation</h2>
      <p className="mt-1 mb-3 text-sm text-muted-foreground">
        Every form, one rule per verb type, with an example — expand the ones
        you need. The same rule cards appear in quiz feedback and on every
        verb&apos;s detail page.
      </p>
      <div className="divide-y divide-border/60 rounded-lg border">
        {CONJUGATION_FORMS.map((form) => (
          <FormRow key={form} form={form} />
        ))}
      </div>
    </div>
  )
}
