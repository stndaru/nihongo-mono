import { ensurePaddleAssets } from './assets'
import { loadOcr } from './engine'
import { registerOcrDestroy } from './handle'
import { PaddleWorkerClient } from './paddle'
import { toImageData } from './preprocess'
import { assessPaddleResult, normalizePaddleResult, type OcrEngineName } from './result'
import type { OcrLang } from './types'

export type OcrProgress =
  | { phase: 'assets'; done: number; total: number }
  | { phase: 'initializing' }
  | { phase: 'recognizing'; engine: OcrEngineName; progress?: number }

export interface PaddleRunResult {
  raw: string
  confidence: number | null
  writingMode: 'horizontal' | 'vertical'
  lines: number
  provider?: string
  elapsedMs?: number
}

export interface OcrRecognitionResult extends PaddleRunResult {
  engine: OcrEngineName
  needsReview: boolean
  fallbackReason?: 'error' | 'empty'
}

export interface OcrRunners {
  paddle: (source: Blob, onProgress?: (progress: OcrProgress) => void) => Promise<PaddleRunResult>
  tesseract: (
    source: Blob,
    lang: OcrLang,
    onProgress?: (progress: OcrProgress) => void,
  ) => Promise<string>
}

let paddleClient: PaddleWorkerClient | null = null
let paddleInitialized = false
let paddleBackend: 'auto' | 'wasm' = 'auto'

export function paddleOcrReady(): boolean {
  return paddleInitialized
}

export function ocrDevOverride(search: string): OcrEngineName | null {
  const value = new URLSearchParams(search).get('ocrEngine')
  return value === 'paddle' || value === 'tesseract' ? value : null
}

function getPaddleClient(): PaddleWorkerClient {
  if (!paddleClient) {
    paddleClient = new PaddleWorkerClient({ backend: paddleBackend })
    registerOcrDestroy(destroyPaddleOcr)
  }
  return paddleClient
}

export async function preparePaddleOcr(
  onProgress?: (progress: OcrProgress) => void,
): Promise<void> {
  await ensurePaddleAssets({
    onProgress: (done, total) => onProgress?.({ phase: 'assets', done, total }),
  })
  onProgress?.({ phase: 'initializing' })
  try {
    await getPaddleClient().initialize()
  } catch (error) {
    if (paddleBackend === 'wasm') throw error
    // A failed WebGPU session can poison ORT's in-worker WASM fallback.
    // Restart in a clean worker and initialize WASM directly.
    paddleClient?.dispose()
    paddleClient = null
    paddleBackend = 'wasm'
    await getPaddleClient().initialize()
  }
  paddleInitialized = true
}

async function runPaddle(
  source: Blob,
  onProgress?: (progress: OcrProgress) => void,
): Promise<PaddleRunResult> {
  await preparePaddleOcr(onProgress)
  const client = getPaddleClient()
  onProgress?.({ phase: 'recognizing', engine: 'paddle' })
  const image = await toImageData(source)
  if (typeof createImageBitmap !== 'function') {
    throw new Error('Paddle OCR requires ImageBitmap support')
  }
  const bitmap = await createImageBitmap(image)
  const result = await client.predict(bitmap)
  const normalized = normalizePaddleResult(result.items)
  return {
    ...normalized,
    provider: result.runtime.recProvider,
    elapsedMs: result.metrics.totalMs,
  }
}

async function runTesseract(
  source: Blob,
  lang: OcrLang,
  onProgress?: (progress: OcrProgress) => void,
): Promise<string> {
  const client = await loadOcr(lang, (done, total) => {
    onProgress?.({ phase: 'assets', done, total })
  })
  const image = await toImageData(source)
  onProgress?.({ phase: 'recognizing', engine: 'tesseract', progress: 0 })
  await client.loadImage(image)
  return client.getText((progress) => {
    onProgress?.({ phase: 'recognizing', engine: 'tesseract', progress })
  })
}

const browserRunners: OcrRunners = { paddle: runPaddle, tesseract: runTesseract }

/** Primary Paddle policy with automatic Tesseract fallback for errors and empty results. */
export async function recognizeWithFallback(
  source: Blob,
  lang: OcrLang,
  runners: OcrRunners = browserRunners,
  onProgress?: (progress: OcrProgress) => void,
): Promise<OcrRecognitionResult> {
  let paddle: PaddleRunResult
  try {
    paddle = await runners.paddle(source, onProgress)
  } catch {
    const raw = await runners.tesseract(source, lang, onProgress)
    return {
      engine: 'tesseract',
      raw,
      confidence: null,
      writingMode: 'horizontal',
      lines: raw.trim() ? raw.trim().split(/\r?\n/u).length : 0,
      needsReview: false,
      fallbackReason: 'error',
    }
  }

  const assessment = assessPaddleResult(paddle)
  if (assessment === 'auto-fallback') {
    const raw = await runners.tesseract(source, lang, onProgress)
    return {
      engine: 'tesseract',
      raw,
      confidence: null,
      writingMode: 'horizontal',
      lines: raw.trim() ? raw.trim().split(/\r?\n/u).length : 0,
      needsReview: false,
      fallbackReason: 'empty',
    }
  }
  return { engine: 'paddle', ...paddle, needsReview: assessment === 'review' }
}

/** Explicit retry shown only in the review state. */
export async function recognizeWithTesseract(
  source: Blob,
  lang: OcrLang,
  onProgress?: (progress: OcrProgress) => void,
): Promise<OcrRecognitionResult> {
  const raw = await browserRunners.tesseract(source, lang, onProgress)
  return {
    engine: 'tesseract',
    raw,
    confidence: null,
    writingMode: 'horizontal',
    lines: raw.trim() ? raw.trim().split(/\r?\n/u).length : 0,
    needsReview: false,
  }
}

export function destroyPaddleOcr(): void {
  paddleClient?.dispose()
  paddleClient = null
  paddleInitialized = false
  paddleBackend = 'auto'
}
