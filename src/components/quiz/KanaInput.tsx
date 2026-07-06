import { useEffect, useRef } from 'react'
import { bind, unbind, toKana } from 'wanakana'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * Uncontrolled text input with wanakana IME binding: latin typing converts
 * to kana live, native kana input passes through. Remount (key=) per question.
 */
export function KanaInput({ onSubmit }: { onSubmit: (raw: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    bind(el, { IMEMode: true })
    el.focus()
    return () => unbind(el)
  }, [])

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        const raw = ref.current?.value.trim() ?? ''
        if (!raw) return
        // finalize a trailing lone "n" → ん etc.
        onSubmit(toKana(raw))
      }}
    >
      <Input
        ref={ref}
        lang="ja"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder="答え…"
        className="h-11 text-lg"
      />
      <Button type="submit" size="lg" className="h-11">
        Answer
      </Button>
    </form>
  )
}
