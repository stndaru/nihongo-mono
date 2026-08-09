/// <reference lib="webworker" />

import type { OCREngine } from 'tesseract-wasm'
import type { OcrWorkerRequest, OcrWorkerResponse } from './worker-protocol'

const scope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope
let enginePromise: Promise<OCREngine> | null = null

interface TesseractModule {
  createOCREngine(options?: { wasmBinary?: ArrayBuffer }): Promise<OCREngine>
  supportsFastBuild(): boolean
}

const engineBase = `${import.meta.env.BASE_URL}ocr/engine/`
let modulePromise: Promise<TesseractModule> | null = null

function getModule(): Promise<TesseractModule> {
  if (!modulePromise) {
    // lib.js is copied from the pinned dependency into public alongside the
    // WASM. Loading it at runtime prevents Vite from also emitting the
    // package's unused high-level worker and default WASM asset URLs.
    modulePromise = import(/* @vite-ignore */ `${engineBase}lib.js`) as Promise<TesseractModule>
    modulePromise.catch(() => {
      modulePromise = null
    })
  }
  return modulePromise
}

function getEngine(): Promise<OCREngine> {
  if (!enginePromise) {
    enginePromise = getModule().then(async ({ createOCREngine, supportsFastBuild }) => {
      const filename = supportsFastBuild()
        ? 'tesseract-core.wasm'
        : 'tesseract-core-fallback.wasm'
      const wasmBinary = await fetch(`${engineBase}${filename}`).then((response) => {
        if (!response.ok) throw new Error(`GET ${filename} returned ${response.status}`)
        return response.arrayBuffer()
      })
      return createOCREngine({ wasmBinary })
    })
    enginePromise.catch(() => {
      enginePromise = null
    })
  }
  return enginePromise
}

function send(message: OcrWorkerResponse): void {
  scope.postMessage(message)
}

async function handle(request: OcrWorkerRequest): Promise<void> {
  const engine = await getEngine()
  if (request.type === 'load-model') {
    engine.loadModel(request.model)
    send({ id: request.id, type: 'result' })
    return
  }
  if (request.type === 'destroy') {
    engine.destroy()
    enginePromise = null
    modulePromise = null
    send({ id: request.id, type: 'result' })
    scope.close()
    return
  }

  engine.loadImage(request.image)
  try {
    // Tesseract resets this setting when a new image is loaded, so this must
    // remain after loadImage rather than being treated as model configuration.
    engine.setVariable(
      'tessedit_pageseg_mode',
      String(request.options.pageSegmentationMode),
    )
    const progress = (value: number) =>
      send({ id: request.id, type: 'progress', progress: value })
    const lines = engine.getTextBoxes('line', progress)
    const words = request.options.includeWordBoxes ? engine.getTextBoxes('word') : []
    const raw = engine.getText()
    send({ id: request.id, type: 'result', result: { raw, lines, words } })
  } finally {
    engine.clearImage()
  }
}

// Engine operations are synchronous once the WASM is initialized. The promise
// chain also serializes model swaps with recognition requests from fast UI taps.
let queue = Promise.resolve()
scope.addEventListener('message', (event: MessageEvent<OcrWorkerRequest>) => {
  queue = queue
    .then(() => handle(event.data))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      send({ id: event.data.id, type: 'error', message })
    })
})
