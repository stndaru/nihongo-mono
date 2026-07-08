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
 * Font-size settings, all four-step with 'default' as the smallest — the
 * sizes only go up from the original design.
 * - 'global': the whole UI is rem-based, so this scales everything by
 *   bumping the root font-size.
 * - 'ja': Japanese text ([lang="ja"]) relative to the global size.
 * - 'furigana': ruby readings relative to their base text.
 * CSS steps live in styles/index.css; attributes are set pre-paint in
 * index.html so a reload never flashes the default size.
 */
export type FontSize = 'default' | 'large' | 'xlarge' | 'xxlarge'
export type FontSizeKind = 'global' | 'ja' | 'furigana'

export const FONT_SIZES: { value: FontSize; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'large', label: 'Large' },
  { value: 'xlarge', label: 'Extra Large' },
  { value: 'xxlarge', label: 'Largest' },
]

const SIZE_KEYS: Record<FontSizeKind, string> = {
  global: 'nihongo-mono:font-size',
  ja: 'nihongo-mono:font-ja-size',
  furigana: 'nihongo-mono:font-furigana-size',
}
const SIZE_ATTRS: Record<FontSizeKind, 'fontSize' | 'fontJaSize' | 'fontFuriganaSize'> = {
  global: 'fontSize',
  ja: 'fontJaSize',
  furigana: 'fontFuriganaSize',
}

export function getFontSizePref(kind: FontSizeKind): FontSize {
  const v = localStorage.getItem(SIZE_KEYS[kind])
  return v === 'large' || v === 'xlarge' || v === 'xxlarge' ? v : 'default'
}

export function setFontSizePref(kind: FontSizeKind, size: FontSize): void {
  localStorage.setItem(SIZE_KEYS[kind], size)
  // default = no attribute, like the font-family prefs
  if (size === 'default') delete document.documentElement.dataset[SIZE_ATTRS[kind]]
  else document.documentElement.dataset[SIZE_ATTRS[kind]] = size
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
