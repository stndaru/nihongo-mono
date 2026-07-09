/**
 * Sentence translation (ja→en and en→ja) for the parser — free, keyless,
 * tiny payloads.
 *
 * Provider chain: Google's unofficial gtx endpoint (Google-quality, CORS-open,
 * but undocumented and revocable) → MyMemory (official free API, daily cap,
 * weaker Japanese) → reject, and the UI falls back to an external Google
 * Translate link. Results are cached per direction+sentence for the session;
 * failures are never cached so a transient outage doesn't poison retries.
 */
export interface Translation {
  text: string
  provider: 'google' | 'mymemory'
}

const TIMEOUT_MS = 6000
/** keyed `${sl}-${tl}:${sentence}` — the two directions never collide */
const cache = new Map<string, Translation>()

/**
 * gtx returns nested arrays: data[0] is one [translated, source, ...] chunk
 * per sentence — concatenate them all, not just the first.
 */
export function parseGtxResponse(json: unknown): string {
  const chunks = (json as unknown[])?.[0]
  if (!Array.isArray(chunks)) throw new Error('unexpected gtx shape')
  return chunks
    .map((c) => (Array.isArray(c) && typeof c[0] === 'string' ? c[0] : ''))
    .join('')
}

/** MyMemory reports errors as HTTP 200 — responseStatus is the real signal. */
export function parseMyMemoryResponse(json: unknown): string {
  const r = json as { responseStatus?: number; responseData?: { translatedText?: unknown } }
  if (r?.responseStatus !== 200 || typeof r.responseData?.translatedText !== 'string') {
    throw new Error('mymemory error response')
  }
  return r.responseData.translatedText
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function fromGoogle(sentence: string, sl: string, tl: string): Promise<Translation> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(sentence)}`
  const text = parseGtxResponse(await fetchJson(url))
  if (!text.trim()) throw new Error('empty translation')
  return { text, provider: 'google' }
}

async function fromMyMemory(sentence: string, sl: string, tl: string): Promise<Translation> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(sentence)}&langpair=${sl}|${tl}`
  const text = parseMyMemoryResponse(await fetchJson(url))
  if (!text.trim()) throw new Error('empty translation')
  return { text, provider: 'mymemory' }
}

async function translate(sentence: string, sl: string, tl: string): Promise<Translation> {
  const key = `${sl}-${tl}:${sentence}`
  const hit = cache.get(key)
  if (hit) return hit
  const result = await fromGoogle(sentence, sl, tl).catch(() => fromMyMemory(sentence, sl, tl))
  cache.set(key, result)
  return result
}

/** ja → en: the JP→EN mode's Translation section. */
export function translateSentence(sentence: string): Promise<Translation> {
  return translate(sentence, 'ja', 'en')
}

/** en → ja: the EN→JP mode's input step — the result feeds the parser. */
export function translateToJapanese(sentence: string): Promise<Translation> {
  return translate(sentence, 'en', 'ja')
}
