export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'nihongo-mono:theme'

export function getTheme(): Theme {
  const t = localStorage.getItem(STORAGE_KEY)
  // default follows the OS — 'light'/'dark' are explicit user picks
  return t === 'dark' || t === 'light' ? t : 'system'
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
  // default is sans — a stored 'serif' is an explicit user pick
  return localStorage.getItem(FONT_KEYS[kind]) === 'serif' ? 'serif' : 'sans'
}

export function setFontPref(kind: FontKind, choice: FontChoice): void {
  localStorage.setItem(FONT_KEYS[kind], choice)
  const el = document.documentElement
  if (choice === 'serif') el.dataset[FONT_ATTRS[kind]] = 'serif'
  else delete el.dataset[FONT_ATTRS[kind]]
}

/**
 * Overall font scale. Everything in the UI is rem-based, so scaling the
 * root font-size scales the whole app. 'default' (100%) is the smallest —
 * the sizes only go up from the original design.
 */
export type FontSize = 'default' | 'large' | 'xlarge' | 'xxlarge'

export const FONT_SIZES: { value: FontSize; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'large', label: 'Large' },
  { value: 'xlarge', label: 'Extra Large' },
  { value: 'xxlarge', label: 'Largest' },
]

const FONT_SIZE_KEY = 'nihongo-mono:font-size'

export function getFontSizePref(): FontSize {
  const v = localStorage.getItem(FONT_SIZE_KEY)
  return v === 'large' || v === 'xlarge' || v === 'xxlarge' ? v : 'default'
}

export function setFontSizePref(size: FontSize): void {
  localStorage.setItem(FONT_SIZE_KEY, size)
  // default = no attribute, like the font-family prefs
  if (size === 'default') delete document.documentElement.dataset.fontSize
  else document.documentElement.dataset.fontSize = size
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
