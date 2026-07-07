import { startTransition, useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

/**
 * Shared search debounce. 150 ms sat below normal typing cadence
 * (~150–250 ms between keystrokes), so searches kept firing MID-typing and
 * each heavy table render stuttered the input. 250 ms waits typing out
 * without feeling laggy. Used by SearchBox and the command palette.
 */
export const SEARCH_DEBOUNCE_MS = 250

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (q: string) => void
  placeholder?: string
}) {
  const [text, setText] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // external reset (e.g. back navigation restoring URL state)
  useEffect(() => setText(value), [value])
  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={text}
        placeholder={placeholder ?? 'Search kanji, kana, romaji, or English…'}
        className="pl-8"
        onChange={(e) => {
          const next = e.target.value
          setText(next)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => {
            // non-urgent: lets further keystrokes interrupt the heavy
            // result re-render instead of stuttering behind it
            startTransition(() => onChange(next))
          }, SEARCH_DEBOUNCE_MS)
        }}
      />
    </div>
  )
}
