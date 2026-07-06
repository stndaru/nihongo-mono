import { FORM_LABELS, getRule, type ConjugationForm, type VerbClass } from '@/lib/conjugation'

export function RuleCheatsheet({
  form,
  verbClass,
  showUsage = true,
}: {
  form: ConjugationForm
  verbClass: VerbClass
  /** set false where the surrounding UI already explains the form */
  showUsage?: boolean
}) {
  const rule = getRule(form, verbClass)
  const meta = FORM_LABELS[form]
  return (
    <div className="rounded-md bg-muted/60 p-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-medium">{rule.title}</span>
        <span lang="ja" className="text-primary">
          {rule.pattern}
        </span>
      </div>
      {showUsage && (
        <p className="mt-3 leading-relaxed">
          <span className="font-medium">{meta.hint}</span>
          <span className="text-muted-foreground"> — {meta.usage}</span>
        </p>
      )}
      <div className="mt-4 border-t border-border/60 pt-3">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          How to form it
        </p>
        <p className="mt-1.5 leading-relaxed text-muted-foreground">{rule.explanation}</p>
        {rule.exceptions && (
          <p className="mt-2.5 leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Watch out: </span>
            {rule.exceptions}
          </p>
        )}
      </div>
    </div>
  )
}
