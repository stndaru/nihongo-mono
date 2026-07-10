/**
 * tesseract-wasm ships full typings (dist/index.d.ts, `types` field) but
 * its package.json "exports" map has no "types" condition, so bundler-mode
 * resolution can't see them. Minimal declaration of the surface this app
 * uses — keep in sync with node_modules/tesseract-wasm/dist/ocr-client.d.ts.
 */
declare module 'tesseract-wasm' {
  export type ProgressListener = (progress: number) => void

  export interface OCRClientInit {
    /** creates the worker; default = `new Worker(url)` */
    createWorker?: (url: string) => Worker
    /** wasm binary override; default loads relative to the worker script */
    wasmBinary?: Uint8Array | ArrayBuffer
    /** location of the worker script */
    workerURL?: string
  }

  export class OCRClient {
    constructor(init?: OCRClientInit)
    destroy(): Promise<void>
    loadModel(model: string | ArrayBuffer): Promise<void>
    loadImage(image: ImageBitmap | ImageData): Promise<void>
    clearImage(): Promise<void>
    getText(onProgress?: ProgressListener): Promise<string>
  }
}
