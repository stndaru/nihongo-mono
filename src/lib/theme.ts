export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'nihongo-mono:theme'

export function getTheme(): Theme {
  const t = localStorage.getItem(STORAGE_KEY)
  // default is light — 'system' is opt-in via settings
  return t === 'dark' || t === 'system' ? t : 'light'
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

export type FontChoice = 'serif' | 'sans'
export type FontKind = 'text' | 'ja'

const FONT_KEYS: Record<FontKind, string> = {
  text: 'nihongo-mono:font-text',
  ja: 'nihongo-mono:font-ja',
}
const FONT_ATTRS: Record<FontKind, 'fontText' | 'fontJa'> = {
  text: 'fontText',
  ja: 'fontJa',
}

export function getFontPref(kind: FontKind): FontChoice {
  return localStorage.getItem(FONT_KEYS[kind]) === 'sans' ? 'sans' : 'serif'
}

export function setFontPref(kind: FontKind, choice: FontChoice): void {
  localStorage.setItem(FONT_KEYS[kind], choice)
  const el = document.documentElement
  if (choice === 'sans') el.dataset[FONT_ATTRS[kind]] = 'sans'
  else delete el.dataset[FONT_ATTRS[kind]]
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
