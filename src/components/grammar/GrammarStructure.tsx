import { Fragment } from 'react'

const JA_RE = /[぀-ヿ㐀-䶿一-鿿｟-ﾟ]/

/**
 * One token of a formation line: "Verb［ない form］" renders the ［…］
 * annotation smaller and muted next to the part name. A token without
 * brackets is just text — there is no parse-failure mode.
 */
function StructureToken({ token }: { token: string }) {
  // split keeps the bracket contents at odd indexes: "Verb［ない form］" →
  // ["Verb", "ない form", ""]
  const pieces = token.split(/［([^］]*)］/)
  return (
    <span
      lang={JA_RE.test(token) ? 'ja' : undefined}
      className="inline-flex items-baseline gap-1 rounded-md border bg-background px-2 py-1"
    >
      {pieces.map((piece, i) =>
        piece === '' ? null : i % 2 === 1 ? (
          <span key={i} className="text-xs text-muted-foreground">
            {piece}
          </span>
        ) : (
          <Fragment key={i}>{piece}</Fragment>
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
          {line.split('＋').map((token, j) => (
            <Fragment key={j}>
              {j > 0 && <span className="text-muted-foreground select-none">＋</span>}
              <StructureToken token={token.trim()} />
            </Fragment>
          ))}
        </div>
      ))}
    </div>
  )
}
