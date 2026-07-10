import { Fragment } from 'react'

// Kana + CJK symbols/punctuation (U+3000-30FF: 々〜「」（） included), CJK
// ext-A, CJK unified, CJK compatibility, and the full-/half-width forms
// block U+FF00-FFEF (／＋｜ etc.).
const JA_RUN = /([　-ヿ㐀-䶿一-鿿豈-﫿＀-￯]+)/

/**
 * Mixed Japanese/Latin text: wraps only the Japanese runs in lang="ja"
 * spans. Putting lang="ja" on the whole string makes its Latin part render
 * in the Japanese font (whose Latin glyphs are visibly larger) and follow
 * the Japanese font-size setting — "Verb ／ い-adjective" bloated the word
 * "Verb". Safe inside an existing lang="ja" scope (nested scopes reset to
 * 1em in index.css).
 */
export function JaText({ text }: { text: string }) {
  const parts = text.split(JA_RUN)
  if (parts.length === 1) return <>{text}</>
  return (
    <>
      {parts.map((part, i) =>
        part === '' ? null : i % 2 === 1 ? (
          <span key={i} lang="ja">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
}
