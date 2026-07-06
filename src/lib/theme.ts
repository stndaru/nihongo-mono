export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'nihongo-mono:theme'

export function getTheme(): Theme {
  const t = localStorage.getItem(STORAGE_KEY)
  return t === 'light' || t === 'dark' ? t : 'system'
}

export function applyTheme(theme: Theme): void {
  const dark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme)
  applyTheme(theme)
}

/** Keep the UI in sync when the OS theme changes while in 'system' mode. */
export function watchSystemTheme(): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => {
    if (getTheme() === 'system') applyTheme('system')
  }
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
