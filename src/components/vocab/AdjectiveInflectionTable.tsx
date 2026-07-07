import { Ban, Sparkles } from 'lucide-react'
import {
  ADJECTIVE_FORM_LABELS,
  ADJECTIVE_FORMS,
  inflectAll,
  type AdjectiveForm,
} from '@/lib/conjugation/adjective'
import type { VocabEntry } from '@/lib/data/types'

const POLITE: ReadonlySet<AdjectiveForm> = new Set([
  'non-past-polite',
  'negative-polite',
  'past-polite',
  'past-negative-polite',
])
const NEGATIVE: ReadonlySet<AdjectiveForm> = new Set([
  'negative',
  'negative-polite',
  'past-negative',
  'past-negative-polite',
])

export function AdjectiveInflectionTable({ word }: { word: VocabEntry }) {
  if (word.pos !== 'adj-i' && word.pos !== 'adj-na') return null
  const all = inflectAll(word, word.pos)

  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">Inflections</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        {word.pos === 'adj-i'
          ? 'い-adjectives inflect on their own — no copula needed.'
          : 'な-adjectives inflect with the copula (だ・です).'}
      </p>
      <table className="w-full border-collapse text-sm">
        <tbody>
          {ADJECTIVE_FORMS.map((form) => {
            const c = all[form]
            if (!c) return null
            const hasKana = c.kanji !== c.kana
            return (
              <tr key={form} className="border-b border-border/60">
                <td className="w-32 py-2 pr-3 font-medium sm:w-48">
                  <span className="inline-flex items-center gap-1.5">
                    {ADJECTIVE_FORM_LABELS[form].label}
                    {POLITE.has(form) && (
                      <Sparkles className="size-3 shrink-0 text-muted-foreground/70" aria-label="polite" />
                    )}
                    {NEGATIVE.has(form) && (
                      <Ban className="size-3 shrink-0 text-muted-foreground/70" aria-label="negative" />
                    )}
                  </span>
                  <div className="text-xs font-normal text-muted-foreground">
                    {ADJECTIVE_FORM_LABELS[form].hint}
                  </div>
                </td>
                <td lang="ja" className="py-2 pr-4 text-base sm:w-[11em]">
                  <div>{c.kanji}</div>
                  {hasKana && (
                    <div className="text-xs text-muted-foreground sm:hidden">{c.kana}</div>
                  )}
                </td>
                <td
                  lang="ja"
                  className="hidden py-2 pr-2 text-base text-muted-foreground sm:table-cell"
                >
                  {hasKana ? c.kana : ''}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
