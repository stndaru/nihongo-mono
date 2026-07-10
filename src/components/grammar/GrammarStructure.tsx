import { Fragment } from 'react'
import { JaText } from '@/components/ui/ja-text'

/**
 * ＋ splits a line into tokens only at （…）/［…］ depth 0, so an optional
 * tail like "（＋そうだ／らしい）" or an annotation like "［number ＋
 * counter］" stays inside its chip instead of losing its closing bracket
 * to the next one.
 */
function splitTokens(line: string): string[] {
  const tokens: string[] = []
  let depth = 0
  let current = ''
  for (const ch of line) {
    if (ch === '（' || ch === '［') depth++
    else if ((ch === '）' || ch === '］') && depth > 0) depth--
    if (ch === '＋' && depth === 0) {
      tokens.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  tokens.push(current)
  return tokens.map((t) => t.trim()).filter((t) => t !== '')
}

/**
 * One token of a formation line: "Verb［ない form］" renders the ［…］
 * annotation smaller and muted next to the part name. A token without
 * brackets is just text — there is no parse-failure mode. JaText scopes
 * lang="ja" to the Japanese runs only, so Latin part names ("Verb") keep
 * the UI font instead of the larger Japanese-font glyphs.
 */
function StructureToken({ token }: { token: string }) {
  // split keeps the bracket contents at odd indexes: "Verb［ない form］" →
  // ["Verb", "ない form", ""]
  const pieces = token.split(/［([^］]*)］/)
  return (
    <span className="inline-flex items-baseline gap-1 rounded-md border bg-background px-2 py-1">
      {pieces.map((piece, i) =>
        piece === '' ? null : i % 2 === 1 ? (
          <span key={i} className="text-xs text-muted-foreground">
            <JaText text={piece} />
          </span>
        ) : (
          <JaText key={i} text={piece} />
        ),
      )}
    </span>
  )
}

/**
 * Renders formation lines like "Verb［ない form］＋ で ＋ Verb-B" as chip
 * sequences — the data convention is plain strings (types.ts GrammarEntry),
 * so worst case a line renders as a single chip.
 */
export function GrammarStructure({ structure }: { structure: string[] }) {
  if (structure.length === 0) return null
  return (
    <div className="space-y-2">
      {structure.map((line, i) => (
        <div
          key={i}
          className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border bg-muted/30 p-3 text-sm"
        >
          {splitTokens(line).map((token, j) => (
            <Fragment key={j}>
              {j > 0 && <span className="text-muted-foreground select-none">＋</span>}
              <StructureToken token={token} />
            </Fragment>
          ))}
        </div>
      ))}
    </div>
  )
}
