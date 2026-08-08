/**
 * Lazy, app-owned worker wrapper around tesseract-wasm's low-level engine.
 * The low-level surface is required so each image can select a page layout
 * mode after loadImage (Tesseract resets it there). The same dependency and
 * WASM files power both horizontal and vertical recognition.
 */
import { fetchModel } from './fetch-model'
import { registerOcrDestroy } from './handle'
import { selfClearingCache } from './self-clearing'
import type { OcrClient, OcrModel, OcrRecognitionOptions, OcrRecognitionResult } from './types'
import type { OcrWorkerRequest, OcrWorkerResponse } from './worker-protocol'

type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never
type OcrWorkerRequestPayload = WithoutId<OcrWorkerRequest>

interface PendingRequest {
  resolve: (result: OcrRecognitionResult | undefined) => void
  reject: (error: Error) => void
  onProgress?: (progress: number) => void
}

class WorkerOcrClient implements OcrClient {
  private readonly worker = new Worker(new URL('./ocr.worker.ts', import.meta.url), {
    type: 'module',
  })
  private readonly pending = new Map<number, PendingRequest>()
  private nextId = 1
  private dead = false

  constructor() {
    this.worker.addEventListener('message', this.onMessage)
    this.worker.addEventListener('error', this.onWorkerError)
  }

  private readonly onMessage = (event: MessageEvent<OcrWorkerResponse>) => {
    const response = event.data
    const pending = this.pending.get(response.id)
    if (!pending) return
    if (response.type === 'progress') {
      pending.onProgress?.(response.progress)
      return
    }
    this.pending.delete(response.id)
    if (response.type === 'error') pending.reject(new Error(response.message))
    else pending.resolve(response.result)
  }

  private readonly onWorkerError = (event: ErrorEvent) => {
    const error = new Error(event.message || 'OCR worker failed')
    for (const request of this.pending.values()) request.reject(error)
    this.pending.clear()
  }

  private request(
    request: OcrWorkerRequestPayload,
    transfer: Transferable[] = [],
    onProgress?: (progress: number) => void,
  ): Promise<OcrRecognitionResult | undefined> {
    if (this.dead) return Promise.reject(new Error('OCR worker has been destroyed'))
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress })
      this.worker.postMessage({ ...request, id } as OcrWorkerRequest, transfer)
    })
  }

  async loadModel(model: ArrayBuffer): Promise<void> {
    await this.request({ type: 'load-model', model }, [model])
  }

  async recognize(
    image: ImageData,
    options: OcrRecognitionOptions,
    onProgress?: (progress: number) => void,
  ): Promise<OcrRecognitionResult> {
    const result = await this.request({ type: 'recognize', image, options }, [], onProgress)
    if (!result) throw new Error('OCR worker returned no recognition result')
    return result
  }

  async destroy(): Promise<void> {
    if (this.dead) return
    try {
      await this.request({ type: 'destroy' })
    } finally {
      this.dead = true
      this.worker.removeEventListener('message', this.onMessage)
      this.worker.removeEventListener('error', this.onWorkerError)
      this.worker.terminate()
      for (const request of this.pending.values()) {
        request.reject(new Error('OCR worker was destroyed'))
      }
      this.pending.clear()
    }
  }
}

let clientPromise: Promise<WorkerOcrClient> | null = null
let ready = false
let loadedModel: OcrModel | null = null
let modelQueue: Promise<void> = Promise.resolve()
const modelBuffers = new Map<OcrModel, () => Promise<ArrayBuffer>>()

function getClient(): Promise<WorkerOcrClient> {
  if (!clientPromise) {
    clientPromise = Promise.resolve(new WorkerOcrClient())
    registerOcrDestroy(destroyOcr)
  }
  return clientPromise
}

function getModelBuffer(
  model: OcrModel,
  onProgress?: (done: number, total: number) => void,
): Promise<ArrayBuffer> {
  let cached = modelBuffers.get(model)
  if (!cached) {
    cached = selfClearingCache(() => fetchModel(model, onProgress))
    modelBuffers.set(model, cached)
  }
  return cached()
}

export function ocrReady(model?: OcrModel): boolean {
  return ready && (model === undefined || loadedModel === model)
}

export async function loadOcr(
  model: OcrModel,
  onModelProgress?: (done: number, total: number) => void,
): Promise<OcrClient> {
  const client = await getClient()
  if (loadedModel !== model) {
    const load = modelQueue.then(async () => {
      // A rapid direction/tab toggle can queue the same target twice. Recheck
      // after earlier swaps finish so only the final necessary model is loaded.
      if (loadedModel === model) return
      const buffer = await getModelBuffer(model, onModelProgress)
      // Keep the cached source buffer intact for instant JA/EN/direction swaps.
      await client.loadModel(buffer.slice(0))
      loadedModel = model
      ready = true
    })
    modelQueue = load.catch(() => {})
    await load
  }
  return client
}

export function destroyOcr(): void {
  const doomed = clientPromise
  clientPromise = null
  ready = false
  loadedModel = null
  modelQueue = Promise.resolve()
  void doomed?.then((client) => client.destroy()).catch(() => {})
}
