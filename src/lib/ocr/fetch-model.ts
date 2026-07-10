/**
 * Streamed fetch for the committed OCR recognition models
 * (public/ocr/models/{jpn,eng}.traineddata.gz) with byte-level progress —
 * fetchBufferGz can't report progress, and a 1.5–2 MB model deserves a
 * bar. Same host tolerance as fetch-gz.ts: inflate when the body is still
 * gzip (magic bytes), pass through when the server already decoded it via
 * Content-Encoding.
 */
import type { OcrLang } from './types'

export async function fetchModel(
  lang: OcrLang,
  onProgress?: (done: number, total: number) => void,
): Promise<ArrayBuffer> {
  const url = `${import.meta.env.BASE_URL}ocr/models/${lang}.traineddata.gz`
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`GET ${url} → ${res.status}`)

  // content-length is the wire size; absent (or 0) → indeterminate progress.
  // When a host marks .gz files with Content-Encoding, the stream yields
  // INFLATED bytes while content-length stays compressed — clamp so the
  // bar never overruns 100%.
  const total = Number(res.headers.get('content-length') ?? 0)
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let done = 0
  for (;;) {
    const { value, done: finished } = await reader.read()
    if (finished) break
    chunks.push(value)
    done += value.byteLength
    onProgress?.(total > 0 ? Math.min(done, total) : done, total)
  }
  const buf = new Uint8Array(done)
  let offset = 0
  for (const chunk of chunks) {
    buf.set(chunk, offset)
    offset += chunk.byteLength
  }

  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    const inflated = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))
    return new Response(inflated).arrayBuffer()
  }
  return buf.buffer
}
