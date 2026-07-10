/**
 * Static bridge between the parser route and the lazily-loaded OCR engine.
 * The route must free the OCR worker's wasm heap on unmount, but importing
 * engine.ts there would pull the whole OCR chunk into the route bundle —
 * so engine.ts registers its destroy function here, and the route calls
 * destroyOcrIfLoaded(), a no-op unless the OCR chunk actually loaded.
 */
let destroyFn: (() => void) | null = null

export function registerOcrDestroy(fn: () => void): void {
  destroyFn = fn
}

export function destroyOcrIfLoaded(): void {
  destroyFn?.()
  destroyFn = null
}
