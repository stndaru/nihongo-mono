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
                        <td className="w-36 py-2 pr-3 font-medium sm:w-48">
                          {FORM_LABELS[form].label}
                        </td>
                        {/* fixed-width kanji column keeps the kana column aligned
                            so the eye scans straight down each script */}
                        <td lang="ja" className="w-[11em] py-2 pr-4 text-base">
                          {c.kanji}
                        </td>
                        <td lang="ja" className="py-2 pr-2 text-base text-muted-foreground">
                          {c.kanji !== c.kana ? c.kana : ''}
                        </td>
                        <td className="w-8 py-2 text-right">
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
                          <td colSpan={4} className="py-2">
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
