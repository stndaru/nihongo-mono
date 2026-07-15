import { describe, expect, it, vi } from 'vitest'
import { PaddleWorkerClient } from './paddle'

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  messages: Array<{ message: Record<string, unknown>; transfer: Transferable[] }> = []
  terminated = false

  postMessage(message: Record<string, unknown>, transfer: Transferable[] = []) {
    this.messages.push({ message, transfer })
  }

  respond(index: number, payload: unknown) {
    const requestId = this.messages[index].message.requestId
    this.onmessage?.({
      data: { kind: 'worker-transport-response', status: 'success', requestId, payload },
    } as MessageEvent)
  }

  terminate() {
    this.terminated = true
  }
}

describe('PaddleWorkerClient', () => {
  it('initializes the pinned mobile models with same-origin WebGPU/WASM assets', async () => {
    const worker = new FakeWorker()
    const client = new PaddleWorkerClient({
      baseUrl: '/app/',
      createWorker: () => worker as unknown as Worker,
    })

    const initialization = client.initialize()
    const request = worker.messages[0].message
    const options = (request.payload as { options: Record<string, any> }).options

    expect(request).toMatchObject({ kind: 'worker-transport-request', type: 'init', requestId: 1 })
    expect(options.pipelineConfig.modelSelection).toEqual({
      textDetectionModelName: 'PP-OCRv5_mobile_det',
      textRecognitionModelName: 'PP-OCRv5_mobile_rec',
    })
    expect(options.pipelineConfig.assets).toEqual({
      det: { url: '/app/ocr/paddle/v0.4.2/models/PP-OCRv5_mobile_det.tar' },
      rec: { url: '/app/ocr/paddle/v0.4.2/models/PP-OCRv5_mobile_rec.tar' },
    })
    expect(options.ortOptions).toMatchObject({
      backend: 'auto',
      wasmPaths: '/app/ocr/paddle/v0.4.2/runtime/',
      numThreads: 1,
      disableWasmProxy: true,
    })

    worker.respond(0, { summary: { backend: 'auto', detProvider: 'wasm', recProvider: 'wasm' } })
    await initialization
  })

  it('transfers the image and returns the first OCR result', async () => {
    const worker = new FakeWorker()
    const client = new PaddleWorkerClient({ createWorker: () => worker as unknown as Worker })
    const initialization = client.initialize()
    worker.respond(0, { summary: { backend: 'auto' } })
    await initialization

    const bitmap = { width: 100, height: 200 } as ImageBitmap
    const prediction = client.predict(bitmap)
    expect(worker.messages[1].message).toMatchObject({
      kind: 'worker-transport-request',
      type: 'predict',
      payload: { sources: [{ kind: 'imageBitmap', imageBitmap: bitmap }], params: {} },
    })
    expect(worker.messages[1].transfer).toEqual([bitmap])

    const result = {
      image: { width: 100, height: 200 },
      items: [{ poly: [[0, 0]], text: '日本語', score: 0.9 }],
      metrics: { totalMs: 100 },
      runtime: { requestedBackend: 'auto', detProvider: 'wasm', recProvider: 'wasm' },
    }
    worker.respond(1, [result])
    await expect(prediction).resolves.toEqual(result)
  })

  it('can force a clean WASM worker after an automatic backend failure', async () => {
    const worker = new FakeWorker()
    const client = new PaddleWorkerClient({
      backend: 'wasm',
      createWorker: () => worker as unknown as Worker,
    })

    const initialization = client.initialize()

    const options = (worker.messages[0].message.payload as { options: Record<string, any> }).options
    expect(options.ortOptions.backend).toBe('wasm')
    client.dispose()
    await expect(initialization).rejects.toThrow('disposed')
  })

  it('rejects pending work and terminates the worker on disposal', async () => {
    const worker = new FakeWorker()
    const client = new PaddleWorkerClient({ createWorker: () => worker as unknown as Worker })
    const pending = client.initialize()

    client.dispose()

    await expect(pending).rejects.toThrow('disposed')
    expect(worker.terminated).toBe(true)
  })

  it('times out a stalled worker so the caller can fall back', async () => {
    vi.useFakeTimers()
    const worker = new FakeWorker()
    const client = new PaddleWorkerClient({
      createWorker: () => worker as unknown as Worker,
      requestTimeoutMs: 100,
    })
    const pending = client.initialize()
    const rejection = expect(pending).rejects.toThrow('init timed out')

    await vi.advanceTimersByTimeAsync(100)

    await rejection
    expect(worker.terminated).toBe(true)
    vi.useRealTimers()
  })
})
