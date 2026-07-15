/**
 * Static bridge between the parser route and the lazily-loaded OCR engine.
 * The route must free the OCR worker's wasm heap on unmount, but importing
 * engine.ts there would pull the whole OCR chunk into the route bundle —
 * so engine.ts registers its destroy function here, and the route calls
 * destroyOcrIfLoaded(), a no-op unless the OCR chunk actually loaded.
 */
const destroyFns = new Set<() => void>()

export function registerOcrDestroy(fn: () => void): void {
  destroyFns.add(fn)
}

export function destroyOcrIfLoaded(): void {
  for (const destroy of destroyFns) destroy()
  destroyFns.clear()
}
