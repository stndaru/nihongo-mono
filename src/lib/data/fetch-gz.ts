/**
 * Fetches the pre-gzipped bulk data under public/data (see
 * scripts/lib/gzip-out.ts). Files ship as .json.gz so the ~4:1 compression
 * is guaranteed regardless of host configuration; if a host/CDN already
 * inflated the body (Content-Encoding), the magic-byte check falls through
 * to plain parsing.
 */
export async function fetchJsonGz<T>(path: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${path}`)
  if (!res.ok) throw new Error(`GET data/${path} → ${res.status}`)
  const buf = new Uint8Array(await res.arrayBuffer())
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    const inflated = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))
    return new Response(inflated).json() as Promise<T>
  }
  return JSON.parse(new TextDecoder().decode(buf)) as T
}

/**
 * Same host-tolerance for binary payloads (the kuromoji dictionary):
 * inflates when the body is still gzip, passes through when the server
 * already decoded it via Content-Encoding.
 */
export async function fetchBufferGz(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`)
  const buf = new Uint8Array(await res.arrayBuffer())
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    const inflated = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))
    return new Response(inflated).arrayBuffer()
  }
  return buf.buffer as ArrayBuffer
}
