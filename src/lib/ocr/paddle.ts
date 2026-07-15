import type {
  InitializationSummary,
  OcrResult,
} from '@paddleocr/paddleocr-js'
import { PADDLE_ASSET_VERSION } from './assets'

interface TransportSuccess {
  kind: 'worker-transport-response'
  status: 'success'
  requestId: number
  payload: unknown
}

interface TransportFailure {
  kind: 'worker-transport-response'
  status: 'error'
  requestId: number
  error?: { name?: string; message?: string; stack?: string }
}

type TransportResponse = TransportSuccess | TransportFailure

interface PendingRequest {
  resolve: (payload: unknown) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

export interface PaddleWorkerClientOptions {
  baseUrl?: string
  backend?: 'auto' | 'wasm'
  createWorker?: () => Worker
  requestTimeoutMs?: number
}

function prefixPath(path: string, baseUrl: string): string {
  const base = baseUrl === '/' ? '' : `/${baseUrl.replace(/^\/+|\/+$/gu, '')}`
  return `${base}${path}`
}

function createResolvedOptions(baseUrl: string, backend: 'auto' | 'wasm'): Record<string, unknown> {
  const root = `/ocr/paddle/${PADDLE_ASSET_VERSION}`
  return {
    pipelineConfig: {
      pipelineName: 'OCR',
      raw: {},
      warnings: [],
      unsupportedFeatures: [],
      modelSelection: {
        textDetectionModelName: 'PP-OCRv5_mobile_det',
        textRecognitionModelName: 'PP-OCRv5_mobile_rec',
      },
      assets: {
        det: { url: prefixPath(`${root}/models/PP-OCRv5_mobile_det.tar`, baseUrl) },
        rec: { url: prefixPath(`${root}/models/PP-OCRv5_mobile_rec.tar`, baseUrl) },
      },
      runtimeDefaults: {
        text_det_limit_side_len: 960,
        text_det_limit_type: 'max',
        text_det_max_side_limit: 2000,
        text_det_thresh: 0.3,
        text_det_box_thresh: 0.6,
        text_det_unclip_ratio: 2,
        text_rec_score_thresh: 0,
      },
      pipelineBatchSize: 1,
      textDetectionBatchSize: 1,
      textRecognitionBatchSize: 6,
    },
    ortOptions: {
      backend,
      wasmPaths: prefixPath(`${root}/runtime/`, baseUrl),
      numThreads: 1,
      simd: true,
      proxy: false,
      disableWasmProxy: true,
    },
  }
}

function isTransportResponse(value: unknown): value is TransportResponse {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'kind' in value &&
      value.kind === 'worker-transport-response' &&
      'requestId' in value &&
      typeof value.requestId === 'number',
  )
}

/** Small pinned adapter around PaddleOCR.js's documented worker message boundary. */
export class PaddleWorkerClient {
  private readonly baseUrl: string
  private readonly createWorker: () => Worker
  private readonly backend: 'auto' | 'wasm'
  private readonly requestTimeoutMs: number
  private worker: Worker | null = null
  private pending = new Map<number, PendingRequest>()
  private nextRequestId = 1
  private initPromise: Promise<InitializationSummary> | null = null
  private summary: InitializationSummary | null = null
  private disposed = false

  constructor(options: PaddleWorkerClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? import.meta.env.BASE_URL
    this.backend = options.backend ?? 'auto'
    this.requestTimeoutMs = options.requestTimeoutMs ?? 30_000
    this.createWorker =
      options.createWorker ??
      (() =>
        new Worker(
          prefixPath(`/ocr/paddle/${PADDLE_ASSET_VERSION}/worker.js`, this.baseUrl),
          { type: 'module', name: 'Paddle OCR' },
        ))
  }

  private getWorker(): Worker {
    if (this.disposed) throw new Error('Paddle OCR worker has been disposed')
    if (this.worker) return this.worker
    const worker = this.createWorker()
    worker.onmessage = (event: MessageEvent<unknown>) => {
      if (!isTransportResponse(event.data)) return
      const request = this.pending.get(event.data.requestId)
      if (!request) return
      this.pending.delete(event.data.requestId)
      clearTimeout(request.timeout)
      if (event.data.status === 'success') {
        request.resolve(event.data.payload)
      } else {
        const error = new Error(event.data.error?.message ?? 'Paddle OCR worker failed')
        error.name = event.data.error?.name ?? 'Error'
        if (event.data.error?.stack) error.stack = event.data.error.stack
        request.reject(error)
      }
    }
    worker.onerror = (event: ErrorEvent) => {
      const error = new Error(event.message || 'Paddle OCR worker failed')
      this.failWorker(error)
    }
    this.worker = worker
    return worker
  }

  private request(type: string, payload: unknown, transfer: Transferable[] = []): Promise<unknown> {
    const worker = this.getWorker()
    const requestId = this.nextRequestId++
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!this.pending.has(requestId)) return
        this.failWorker(new Error(`Paddle OCR ${type} timed out`))
      }, this.requestTimeoutMs)
      this.pending.set(requestId, { resolve, reject, timeout })
      worker.postMessage(
        { kind: 'worker-transport-request', type, payload, requestId },
        transfer,
      )
    })
  }

  private failWorker(error: Error): void {
    for (const request of this.pending.values()) {
      clearTimeout(request.timeout)
      request.reject(error)
    }
    this.pending.clear()
    this.worker?.terminate()
    this.worker = null
    this.initPromise = null
    this.summary = null
  }

  initialize(): Promise<InitializationSummary> {
    if (this.disposed) return Promise.reject(new Error('Paddle OCR worker has been disposed'))
    if (this.summary) return Promise.resolve(this.summary)
    if (!this.initPromise) {
      this.initPromise = this.request('init', {
        options: createResolvedOptions(this.baseUrl, this.backend),
      })
        .then((payload) => {
          const response = payload as { summary?: InitializationSummary }
          if (!response.summary) throw new Error('Paddle OCR returned an invalid initialization result')
          this.summary = response.summary
          return response.summary
        })
        .catch((error) => {
          this.initPromise = null
          throw error
        })
    }
    return this.initPromise
  }

  predict(imageBitmap: ImageBitmap): Promise<OcrResult> {
    const run = () =>
      this.request(
        'predict',
        { sources: [{ kind: 'imageBitmap', imageBitmap }], params: {} },
        [imageBitmap],
      ).then((payload) => {
        if (!Array.isArray(payload) || !payload[0]) {
          throw new Error('Paddle OCR returned an invalid recognition result')
        }
        return payload[0] as OcrResult
      })
    return this.summary ? run() : this.initialize().then(run)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    const error = new Error('Paddle OCR worker has been disposed')
    this.failWorker(error)
  }
}
