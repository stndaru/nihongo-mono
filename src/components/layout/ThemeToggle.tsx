import { useEffect, useState } from 'react'
import { Moon, Sun, SunMoon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getTheme, setTheme, watchSystemTheme, type Theme } from '@/lib/theme'

const ORDER: Theme[] = ['system', 'light', 'dark']

const ICONS = {
  system: SunMoon,
  light: Sun,
  dark: Moon,
} as const

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(() => getTheme())

  useEffect(() => watchSystemTheme(), [])

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]
    setTheme(next)
    setThemeState(next)
  }

  const Icon = ICONS[theme]
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycle}
      title={`Theme: ${theme}`}
      aria-label={`Theme: ${theme}. Click to change.`}
    >
      <Icon className="size-4" />
    </Button>
  )
}
