import { Link, useCanGoBack, useRouter, type LinkProps } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

const linkClass =
  '-ml-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors duration-100 hover:text-foreground'

/**
 * Detail-page back control. When this tab has in-app history it behaves
 * like the browser back button — returning to whatever page led here
 * (table with its filters, progress review, another detail page…).
 * Opened directly or in a new tab (e.g. detail links from a running quiz
 * are target="_blank"), there is nothing to go back to, so it links to
 * the section's list page instead.
 */
export function BackButton({ fallback, label }: { fallback: LinkProps['to']; label: string }) {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  if (canGoBack) {
    return (
      <button type="button" onClick={() => router.history.back()} className={linkClass}>
        <ArrowLeft className="size-3.5" /> Back
      </button>
    )
  }
  return (
    <Link to={fallback} className={linkClass}>
      <ArrowLeft className="size-3.5" /> Back to {label}
    </Link>
  )
}
