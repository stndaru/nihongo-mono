import { OFFLINE_CACHE } from '@/lib/offline/offline'
import {
  ensurePaddleAssets,
  PADDLE_ASSET_VERSION,
  PADDLE_CACHE,
} from './assets'

const META_KEY = 'nihongo-mono:ocr-offline:v0.4.2'
export const OCR_OFFLINE_MANIFEST_URL = '/ocr/offline-manifest.json'
const COMPLETE_MARKER = `/ocr/offline-complete-${PADDLE_ASSET_VERSION}.json`

export interface OcrOfflineManifest {
  version: string
  paddleBytes: number
  totalBytes: number
  files: [string, number][]
}

export interface OcrOfflineMeta {
  version: string
  bytes: number
  files: number
  completedAt: string
  persisted: boolean
}

export function parseOcrCompletionMarker(text: string): string[] {
  const data = JSON.parse(text) as { version?: unknown; paths?: unknown } | null
  if (
    !data ||
    data.version !== PADDLE_ASSET_VERSION ||
    !Array.isArray(data.paths) ||
    data.paths.length === 0 ||
    !data.paths.every((path) => typeof path === 'string' && path.startsWith('/ocr/'))
  ) {
    throw new Error('OCR offline completion marker is malformed')
  }
  return data.paths
}

export function parseOcrOfflineManifest(text: string): OcrOfflineManifest {
  const data = JSON.parse(text) as Partial<OcrOfflineManifest> | null
  if (
    !data ||
    typeof data !== 'object' ||
    data.version !== PADDLE_ASSET_VERSION ||
    typeof data.paddleBytes !== 'number' ||
    data.paddleBytes <= 0 ||
    typeof data.totalBytes !== 'number' ||
    !Array.isArray(data.files) ||
    data.files.length === 0 ||
    !data.files.every(
      (file) =>
        Array.isArray(file) &&
        typeof file[0] === 'string' &&
        file[0].startsWith('/ocr/') &&
        !file[0].startsWith('/ocr/paddle/') &&
        typeof file[1] === 'number' &&
        file[1] > 0,
    ) ||
    data.paddleBytes + data.files.reduce((sum, [, bytes]) => sum + bytes, 0) !== data.totalBytes
  ) {
    throw new Error('OCR offline manifest is malformed')
  }
  return data as OcrOfflineManifest
}

export function ocrOfflineDownloadPlan(
  manifest: OcrOfflineManifest,
  cached: ReadonlySet<string>,
) {
  const files = manifest.files.filter(([path]) => !cached.has(path))
  const downloadBytes = files.reduce((sum, [, bytes]) => sum + bytes, 0)
  return {
    files,
    cachedBytes: manifest.totalBytes - manifest.paddleBytes - downloadBytes,
    downloadBytes,
  }
}

export async function fetchOcrOfflineManifest(): Promise<OcrOfflineManifest> {
  const response = await fetch(OCR_OFFLINE_MANIFEST_URL, { cache: 'no-store' })
  if (!response.ok) throw new Error(`OCR offline manifest failed (${response.status})`)
  return parseOcrOfflineManifest(await response.text())
}

export function loadOcrOfflineMeta(): OcrOfflineMeta | null {
  try {
    const value = JSON.parse(localStorage.getItem(META_KEY) ?? 'null') as Partial<OcrOfflineMeta> | null
    return value &&
      value.version === PADDLE_ASSET_VERSION &&
      typeof value.bytes === 'number' &&
      typeof value.files === 'number' &&
      typeof value.completedAt === 'string'
      ? (value as OcrOfflineMeta)
      : null
  } catch {
    return null
  }
}

export async function ocrOfflineCacheIntact(): Promise<boolean> {
  try {
    if (!(await caches.has(PADDLE_CACHE))) return false
    const cache = await caches.open(PADDLE_CACHE)
    const marker = await cache.match(COMPLETE_MARKER, { ignoreVary: true })
    if (!marker) return false
    const paths = parseOcrCompletionMarker(await marker.text())
    for (const path of paths) {
      if (!(await cache.match(path, { ignoreVary: true }))) return false
    }
    return true
  } catch {
    return false
  }
}

async function readFile(
  response: Response,
  expectedBytes: number,
  onChunk: (bytes: number) => void,
): Promise<ArrayBuffer> {
  const reader = response.body?.getReader()
  if (!reader) {
    const data = await response.arrayBuffer()
    onChunk(data.byteLength)
    if (data.byteLength !== expectedBytes) throw new Error('OCR offline file size mismatch')
    return data
  }
  const output = new Uint8Array(expectedBytes)
  let offset = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (offset + value.byteLength > output.byteLength) {
      throw new Error('OCR offline file size mismatch')
    }
    output.set(value, offset)
    offset += value.byteLength
    onChunk(value.byteLength)
  }
  if (offset !== expectedBytes) throw new Error('OCR offline file size mismatch')
  return output.buffer
}

export async function enableOcrOffline(
  manifest: OcrOfflineManifest,
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<OcrOfflineMeta> {
  let paddleDone = 0
  const paddleManifest = await ensurePaddleAssets({
    signal,
    onProgress: (done, total) => {
      paddleDone = done
      onProgress(done, manifest.totalBytes)
      if (total !== manifest.paddleBytes) throw new Error('OCR offline Paddle size mismatch')
    },
  })
  const cache = await caches.open(PADDLE_CACHE)
  const cached = new Set<string>()
  for (const [path] of manifest.files) {
    if (await cache.match(path, { ignoreVary: true })) cached.add(path)
  }
  const plan = ocrOfflineDownloadPlan(manifest, cached)
  let done = paddleDone + plan.cachedBytes
  onProgress(done, manifest.totalBytes)
  for (const [path, bytes] of plan.files) {
    const response = await fetch(path, { cache: 'no-store', signal })
    if (!response.ok) throw new Error(`${path} failed (${response.status})`)
    const contentType = response.headers.get('Content-Type') ?? 'application/octet-stream'
    const data = await readFile(response, bytes, (chunk) => {
      done += chunk
      onProgress(done, manifest.totalBytes)
    })
    await cache.put(path, new Response(data, { headers: { 'Content-Type': contentType } }))
  }
  const requiredPaths = [
    ...paddleManifest.files.map((file) => file.target),
    ...manifest.files.map(([path]) => path),
  ]
  await cache.put(
    COMPLETE_MARKER,
    new Response(JSON.stringify({ version: PADDLE_ASSET_VERSION, paths: requiredPaths }), {
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  let persisted = false
  try {
    persisted = (await navigator.storage?.persist?.()) === true
  } catch {
    // The pack is still usable; it is simply eligible for storage-pressure eviction.
  }
  const meta: OcrOfflineMeta = {
    version: manifest.version,
    bytes: manifest.totalBytes,
    files: requiredPaths.length,
    completedAt: new Date().toISOString(),
    persisted,
  }
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  } catch {
    // Bookkeeping only.
  }
  return meta
}

export async function removeOcrOffline(): Promise<void> {
  await caches.delete(PADDLE_CACHE)
  try {
    localStorage.removeItem(META_KEY)
  } catch {
    // Nothing else to clear.
  }
  if (!(await caches.has(OFFLINE_CACHE))) {
    const registrations = await navigator.serviceWorker.getRegistrations().catch(() => [])
    await Promise.all(registrations.map((registration) => registration.unregister()))
  }
}
