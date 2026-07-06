import { Fragment, useState } from 'react'
import { Ban, ChevronDown, Sparkles } from 'lucide-react'
import { Chip } from '@/components/ui/chip'
import {
  conjugateAll,
  FORM_GROUPS,
  FORM_LABELS,
  NEGATIVE_FORMS,
  POLITE_FORMS,
  type ConjugationForm,
} from '@/lib/conjugation'
import type { VerbEntry } from '@/lib/data/types'
import { cn } from '@/lib/utils'
import { RuleCheatsheet } from './RuleCheatsheet'

export function ConjugationTable({ verb }: { verb: VerbEntry }) {
  const all = conjugateAll(verb)
  const [open, setOpen] = useState<ConjugationForm | null>(null)
  const [showPolite, setShowPolite] = useState(true)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Chip active={showPolite} onClick={() => setShowPolite((v) => !v)}>
          <Sparkles className="mr-1 inline size-3" />
          Polite forms
        </Chip>
        <span className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Sparkles className="size-3" /> polite
          </span>
          <span className="flex items-center gap-1">
            <Ban className="size-3" /> negative
          </span>
        </span>
      </div>

      {FORM_GROUPS.map((group) => {
        const rows = group.forms.filter(
          (form) => all[form] !== null && (showPolite || !POLITE_FORMS.has(form)),
        )
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
                  const hasKana = c.kanji !== c.kana
                  return (
                    <Fragment key={form}>
                      <tr
                        className="cursor-pointer border-b border-border/60 hover:bg-muted/50"
                        onClick={() => setOpen(isOpen ? null : form)}
                      >
                        <td className="w-32 py-2 pr-3 font-medium sm:w-48">
                          <span className="inline-flex items-center gap-1.5">
                            {FORM_LABELS[form].label}
                            {POLITE_FORMS.has(form) && (
                              <Sparkles className="size-3 shrink-0 text-muted-foreground/70" aria-label="polite" />
                            )}
                            {NEGATIVE_FORMS.has(form) && (
                              <Ban className="size-3 shrink-0 text-muted-foreground/70" aria-label="negative" />
                            )}
                          </span>
                        </td>
                        {/* fixed-width kanji column keeps the kana column aligned
                            so the eye scans straight down each script; on mobile
                            the kana stacks under the kanji instead */}
                        <td lang="ja" className="py-2 pr-4 text-base sm:w-[11em]">
                          <div>{c.kanji}</div>
                          {hasKana && (
                            <div className="text-xs text-muted-foreground sm:hidden">
                              {c.kana}
                            </div>
                          )}
                        </td>
                        <td
                          lang="ja"
                          className="hidden py-2 pr-2 text-base text-muted-foreground sm:table-cell"
                        >
                          {hasKana ? c.kana : ''}
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
