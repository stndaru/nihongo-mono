/** Versioned, compressed Paddle assets copied by scripts/copy-paddleocr.ts. */
export const PADDLE_ASSET_VERSION = 'v0.4.2'

export interface PaddleAssetEntry {
  source: string
  target: string
  bytes: number
  inflatedBytes: number
  sha256: string
  contentType: string
}

export interface PaddleAssetManifest {
  version: string
  totalBytes: number
  files: PaddleAssetEntry[]
}

export interface PaddleAssetDownloadPlan {
  files: PaddleAssetEntry[]
  cachedBytes: number
  downloadBytes: number
}

export interface EnsurePaddleAssetsOptions {
  baseUrl?: string
  signal?: AbortSignal
  onProgress?: (doneBytes: number, totalBytes: number) => void
}

interface SharedEnsureProgress {
  done: number
  total: number
}

interface SharedEnsure<T> {
  promise: Promise<T>
  listeners: Set<(done: number, total: number) => void>
  progress: SharedEnsureProgress | null
}

/**
 * Coalesce callers onto one transfer while keeping each caller's progress
 * listener and cancellation lifecycle independent. Aborting a waiter does not
 * discard a download another tab/panel still needs.
 */
export function createSharedAssetEnsurer<T>(
  start: (onProgress: (done: number, total: number) => void) => Promise<T>,
) {
  let active: SharedEnsure<T> | null = null
  return (options: Pick<EnsurePaddleAssetsOptions, 'signal' | 'onProgress'> = {}): Promise<T> => {
    if (!active) {
      const shared: SharedEnsure<T> = {
        promise: Promise.resolve(undefined as T),
        listeners: new Set(),
        progress: null,
      }
      active = shared
      shared.promise = Promise.resolve()
        .then(() =>
          start((done, total) => {
            shared.progress = { done, total }
            for (const listener of shared.listeners) listener(done, total)
          }),
        )
        .finally(() => {
          if (active === shared) active = null
        })
    }

    const shared = active
    const listener = options.onProgress
    if (listener) {
      shared.listeners.add(listener)
      if (shared.progress) listener(shared.progress.done, shared.progress.total)
    }
    if (options.signal?.aborted) {
      if (listener) shared.listeners.delete(listener)
      const error = new Error('Paddle OCR asset wait was cancelled')
      error.name = 'AbortError'
      return Promise.reject(error)
    }

    return new Promise<T>((resolve, reject) => {
      const cleanup = () => {
        if (listener) shared.listeners.delete(listener)
        options.signal?.removeEventListener('abort', onAbort)
      }
      const onAbort = () => {
        cleanup()
        const error = new Error('Paddle OCR asset wait was cancelled')
        error.name = 'AbortError'
        reject(error)
      }
      options.signal?.addEventListener('abort', onAbort, { once: true })
      shared.promise.then(
        (value) => {
          cleanup()
          resolve(value)
        },
        (error: unknown) => {
          cleanup()
          reject(error)
        },
      )
    })
  }
}

/** Must match public/sw.js. Versioning makes model upgrades atomic. */
export const PADDLE_CACHE = `nihongo-mono-ocr-paddle-${PADDLE_ASSET_VERSION}`
let lastNetworkBytes = 0

/** Local diagnostics for the benchmark harness; no data leaves the browser. */
export function lastPaddleNetworkBytes(): number {
  return lastNetworkBytes
}

const ASSET_ROOT = `/ocr/paddle/${PADDLE_ASSET_VERSION}/`

function isAssetEntry(value: unknown): value is PaddleAssetEntry {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<PaddleAssetEntry>
  return (
    typeof item.source === 'string' &&
    item.source.startsWith(`${ASSET_ROOT}download/`) &&
    item.source.endsWith('.pack') &&
    typeof item.target === 'string' &&
    item.target.startsWith(ASSET_ROOT) &&
    !item.target.includes('/download/') &&
    typeof item.bytes === 'number' &&
    item.bytes > 0 &&
    typeof item.inflatedBytes === 'number' &&
    item.inflatedBytes > 0 &&
    typeof item.sha256 === 'string' &&
    /^[a-f0-9]{64}$/u.test(item.sha256) &&
    typeof item.contentType === 'string' &&
    item.contentType.length > 0
  )
}

/** Validate the generated manifest before trusting URLs or progress totals. */
export function parsePaddleAssetManifest(text: string): PaddleAssetManifest {
  const data = JSON.parse(text) as Partial<PaddleAssetManifest> | null
  if (
    !data ||
    typeof data !== 'object' ||
    data.version !== PADDLE_ASSET_VERSION ||
    typeof data.totalBytes !== 'number' ||
    !Array.isArray(data.files) ||
    data.files.length === 0 ||
    !data.files.every(isAssetEntry) ||
    data.files.reduce((sum, file) => sum + file.bytes, 0) !== data.totalBytes
  ) {
    throw new Error('Paddle OCR asset manifest is malformed')
  }
  return data as PaddleAssetManifest
}

function prefixAssetPath(path: string, baseUrl: string): string {
  const base = baseUrl === '/' ? '' : `/${baseUrl.replace(/^\/+|\/+$/gu, '')}`
  return `${base}${path}`
}

/** Pure planning seam used by the UI and tested independently of Cache Storage. */
export function paddleAssetDownloadPlan(
  manifest: PaddleAssetManifest,
  cachedTargets: ReadonlySet<string>,
  baseUrl = '/',
): PaddleAssetDownloadPlan {
  const files = manifest.files.map((file) => ({
    ...file,
    source: prefixAssetPath(file.source, baseUrl),
    target: prefixAssetPath(file.target, baseUrl),
  }))
  const missing = files.filter((file) => !cachedTargets.has(file.target))
  const downloadBytes = missing.reduce((sum, file) => sum + file.bytes, 0)
  return {
    files: missing,
    cachedBytes: manifest.totalBytes - downloadBytes,
    downloadBytes,
  }
}

async function readCompressedAsset(
  response: Response,
  expectedBytes: number,
  onChunk: (bytes: number) => void,
): Promise<ArrayBuffer> {
  if (!response.body) {
    const buffer = await response.arrayBuffer()
    onChunk(buffer.byteLength)
    return buffer
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    length += value.byteLength
    onChunk(value.byteLength)
  }
  if (length !== expectedBytes) throw new Error('Paddle OCR asset size did not match its manifest')
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes.buffer
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function inflateGzip(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot unpack the Paddle OCR assets')
  }
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).arrayBuffer()
}

async function ensureServiceWorkerControl(): Promise<void> {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    throw new Error('Paddle OCR requires a secure browser context')
  }
  const controllerBefore = navigator.serviceWorker.controller
  const registration = await navigator.serviceWorker.register('/sw.js')
  await registration.update().catch(() => undefined)
  await navigator.serviceWorker.ready
  const updatePending = Boolean(registration.installing || registration.waiting)
  if (navigator.serviceWorker.controller && !updatePending) return
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      navigator.serviceWorker.removeEventListener('controllerchange', onChange)
      reject(new Error('The OCR cache could not take control of this page'))
    }, 5000)
    const onChange = () => {
      window.clearTimeout(timeout)
      resolve()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onChange, { once: true })
    if (navigator.serviceWorker.controller && navigator.serviceWorker.controller !== controllerBefore) {
      window.clearTimeout(timeout)
      navigator.serviceWorker.removeEventListener('controllerchange', onChange)
      resolve()
    }
  })
}

/**
 * Download, verify and expand Paddle into a versioned Cache Storage pack.
 * Progress is exact compressed asset bytes; a fully cached repeat adds zero network bytes.
 */
async function ensurePaddleAssetsOnce(
  options: EnsurePaddleAssetsOptions = {},
): Promise<PaddleAssetManifest> {
  if (typeof caches === 'undefined' || typeof crypto?.subtle === 'undefined') {
    throw new Error('This browser cannot safely cache Paddle OCR')
  }
  await ensureServiceWorkerControl()
  const baseUrl = options.baseUrl ?? import.meta.env.BASE_URL
  const manifestPath = prefixAssetPath(`${ASSET_ROOT}manifest.json`, baseUrl)
  const cache = await caches.open(PADDLE_CACHE)
  const installedManifestPath = prefixAssetPath(`${ASSET_ROOT}installed-manifest-v2.json`, baseUrl)
  const installedManifest = await cache.match(installedManifestPath, { ignoreVary: true })
  let manifestText: string
  if (installedManifest) {
    manifestText = await installedManifest.text()
  } else {
    const manifestResponse = await fetch(manifestPath, {
      cache: 'no-store',
      signal: options.signal,
    })
    if (!manifestResponse.ok) {
      throw new Error(`Paddle OCR manifest failed (${manifestResponse.status})`)
    }
    manifestText = await manifestResponse.text()
  }
  const manifest = parsePaddleAssetManifest(manifestText)
  const targets = new Set<string>()
  for (const file of manifest.files) {
    const target = prefixAssetPath(file.target, baseUrl)
    if (await cache.match(target, { ignoreVary: true })) targets.add(target)
  }
  const plan = paddleAssetDownloadPlan(manifest, targets, baseUrl)
  lastNetworkBytes = plan.downloadBytes
  let doneBytes = plan.cachedBytes
  options.onProgress?.(doneBytes, manifest.totalBytes)

  for (const file of plan.files) {
    const response = await fetch(file.source, { cache: 'no-store', signal: options.signal })
    if (!response.ok) throw new Error(`${file.source} failed (${response.status})`)
    const compressed = await readCompressedAsset(response, file.bytes, (bytes) => {
      doneBytes += bytes
      options.onProgress?.(doneBytes, manifest.totalBytes)
    })
    if (compressed.byteLength !== file.bytes) {
      throw new Error('Paddle OCR asset size did not match its manifest')
    }
    const digest = toHex(await crypto.subtle.digest('SHA-256', compressed))
    if (digest !== file.sha256) throw new Error('Paddle OCR asset integrity check failed')
    const inflated = await inflateGzip(compressed)
    if (inflated.byteLength !== file.inflatedBytes) {
      throw new Error('Paddle OCR expanded asset size did not match its manifest')
    }
    await cache.put(
      file.target,
      new Response(inflated, {
        headers: { 'Content-Type': file.contentType, 'Cache-Control': 'public, max-age=31536000' },
      }),
    )
  }
  if (!installedManifest) {
    await cache.put(
      installedManifestPath,
      new Response(manifestText, { headers: { 'Content-Type': 'application/json' } }),
    )
  }
  return manifest
}

const sharedEnsurers = new Map<
  string,
  ReturnType<typeof createSharedAssetEnsurer<PaddleAssetManifest>>
>()

export function ensurePaddleAssets(
  options: EnsurePaddleAssetsOptions = {},
): Promise<PaddleAssetManifest> {
  const baseUrl = options.baseUrl ?? import.meta.env.BASE_URL
  let ensure = sharedEnsurers.get(baseUrl)
  if (!ensure) {
    ensure = createSharedAssetEnsurer((onProgress) =>
      ensurePaddleAssetsOnce({ baseUrl, onProgress }),
    )
    sharedEnsurers.set(baseUrl, ensure)
  }
  return ensure({ signal: options.signal, onProgress: options.onProgress })
}
