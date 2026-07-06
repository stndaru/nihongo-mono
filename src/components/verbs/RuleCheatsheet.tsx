import { getRule, type ConjugationForm, type VerbClass } from '@/lib/conjugation'

export function RuleCheatsheet({
  form,
  verbClass,
}: {
  form: ConjugationForm
  verbClass: VerbClass
}) {
  const rule = getRule(form, verbClass)
  return (
    <div className="rounded-md bg-muted/60 p-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-medium">{rule.title}</span>
        <span lang="ja" className="text-primary">
          {rule.pattern}
        </span>
      </div>
      <p className="mt-1.5 leading-relaxed text-muted-foreground">{rule.explanation}</p>
      {rule.exceptions && (
        <p className="mt-1.5 leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Watch out: </span>
          {rule.exceptions}
        </p>
      )}
    </div>
  )
}
