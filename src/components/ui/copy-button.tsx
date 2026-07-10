import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Icon-only copy-to-clipboard button with a transient ✓ confirmation —
 * the label lives in aria-label/title (state indication per decision 48:
 * the icon swap IS the feedback, no motion needed).
 */
export function CopyButton({
  text,
  label,
  className,
}: {
  text: string
  /** accessible name, e.g. "Copy the raw detected text" */
  label: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      title={label}
      className={className}
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => setCopied(true))
          .catch(() => {}) // clipboard write denied — the button just stays a copy icon
      }}
    >
      {copied ? <Check className="text-success" /> : <Copy />}
    </Button>
  )
}
