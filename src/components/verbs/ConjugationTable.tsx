import { Fragment, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  conjugateAll,
  FORM_GROUPS,
  FORM_LABELS,
  type ConjugationForm,
} from '@/lib/conjugation'
import type { VerbEntry } from '@/lib/data/types'
import { cn } from '@/lib/utils'
import { RuleCheatsheet } from './RuleCheatsheet'

export function ConjugationTable({ verb }: { verb: VerbEntry }) {
  const all = conjugateAll(verb)
  const [open, setOpen] = useState<ConjugationForm | null>(null)

  return (
    <div className="space-y-4">
      {FORM_GROUPS.map((group) => {
        const rows = group.forms.filter((form) => all[form] !== null)
        if (rows.length === 0) return null
        return (
          <section key={group.label}>
            <h3 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {group.label}
            </h3>
            <table className="w-full border-collapse text-sm">
              <tbody>
                {rows.map((form) => {
                  const c = all[form]!
                  const isOpen = open === form
                  return (
                    <Fragment key={form}>
                      <tr
                        className="cursor-pointer border-b border-border/60 hover:bg-muted/50"
                        onClick={() => setOpen(isOpen ? null : form)}
                      >
                        <td className="w-40 py-1.5 pr-2 sm:w-52">
                          <div className="font-medium">{FORM_LABELS[form].label}</div>
                          <div className="text-xs text-muted-foreground">
                            {FORM_LABELS[form].hint}
                          </div>
                        </td>
                        <td lang="ja" className="py-1.5 pr-2 text-base">
                          {c.kanji}
                          {c.kanji !== c.kana && (
                            <span className="ml-2 text-sm text-muted-foreground">{c.kana}</span>
                          )}
                        </td>
                        <td className="w-8 py-1.5 text-right">
                          <ChevronDown
                            className={cn(
                              'ml-auto size-4 text-muted-foreground transition-transform duration-150',
                              isOpen && 'rotate-180',
                            )}
                          />
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-border/60">
                          <td colSpan={3} className="py-2">
                            <RuleCheatsheet form={form} verbClass={verb.class} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </section>
        )
      })}
    </div>
  )
}
