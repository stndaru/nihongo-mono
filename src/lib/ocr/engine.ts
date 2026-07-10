/**
 * Lifecycle wrapper around the tesseract-wasm OCRClient — a Web Worker
 * running the Tesseract engine. Everything here (including tesseract-wasm
 * itself) loads only inside the parser's lazy OCR chunk; the engine wasm
 * and worker script are copied to public/ocr/engine/ by
 * scripts/copy-tesseract.ts, and the worker resolves its wasm relative to
 * its own URL (SIMD/fallback build auto-detected).
 *
 * One client is reused across scans and JA↔EN tab switches; loadModel()
 * swaps the recognition model in place. Model bytes are cached per
 * language so switching back is instant, and every cache self-clears on
 * failure (decision 60). destroyOcr is registered with handle.ts so the
 * route can free the worker's wasm heap on unmount without importing this
 * chunk.
 */
import type { OCRClient } from 'tesseract-wasm'
import { fetchModel } from './fetch-model'
import { registerOcrDestroy } from './handle'
import { selfClearingCache } from './self-clearing'
import type { OcrLang } from './types'

let clientPromise: Promise<OCRClient> | null = null
let ready = false
let loadedLang: OcrLang | null = null
let modelLoad: Promise<void> | null = null
const modelBuffers = new Map<OcrLang, () => Promise<ArrayBuffer>>()

function getClient(): Promise<OCRClient> {
  if (!clientPromise) {
    clientPromise = import('tesseract-wasm').then(({ OCRClient }) => {
      const client = new OCRClient({
        workerURL: `${import.meta.env.BASE_URL}ocr/engine/tesseract-worker.js`,
      })
      registerOcrDestroy(destroyOcr)
      return client
    })
    clientPromise.catch(() => {
      clientPromise = null // a failed load may be retried
    })
  }
  return clientPromise
}

function getModelBuffer(
  lang: OcrLang,
  onProgress?: (done: number, total: number) => void,
): Promise<ArrayBuffer> {
  let cached = modelBuffers.get(lang)
  if (!cached) {
    // progress belongs to the first (real) fetch; cache hits are instant
    cached = selfClearingCache(() => fetchModel(lang, onProgress))
    modelBuffers.set(lang, cached)
  }
  return cached()
}

/** True once the engine is up with some model loaded (skip the notices). */
export function ocrReady(): boolean {
  return ready
}

/**
 * Engine + recognition model for `lang`, ready to scan. Reports model
 * download progress in bytes; the engine/worker init has no byte progress
 * (the worker fetches its own wasm).
 */
export async function loadOcr(
  lang: OcrLang,
  onModelProgress?: (done: number, total: number) => void,
): Promise<OCRClient> {
  const client = await getClient()
  if (loadedLang !== lang) {
    loadedLang = lang
    const load = getModelBuffer(lang, onModelProgress).then((buf) => client.loadModel(buf))
    modelLoad = load
    load.catch(() => {
      // a failed swap must not leave this lang marked as loaded
      if (loadedLang === lang) {
        loadedLang = null
        modelLoad = null
      }
    })
  }
  await modelLoad
  ready = true
  return client
}

/** Shut the worker down and drop its wasm heap. Model bytes stay cached. */
export function destroyOcr(): void {
  const doomed = clientPromise
  clientPromise = null
  ready = false
  loadedLang = null
  modelLoad = null
  void doomed?.then((client) => client.destroy()).catch(() => {})
}
