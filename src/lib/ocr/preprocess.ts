/**
 * Image decode + downscale for OCR. Phone photos come in at 4000 px+;
 * Tesseract's LSTM gains nothing above ~2000 px on the longest side and
 * recognition time scales with pixel area, so large images are resized
 * down before they reach the worker. EXIF orientation is applied at
 * decode so portrait photos aren't scanned sideways.
 *
 * Throws on undecodable input (HEIC outside Safari, corrupt files) — the
 * caller maps that to its decode-error state.
 */
const MAX_SIDE = 2000

async function decode(source: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(source, { imageOrientation: 'from-image' })
  }
  // old-Safari fallback: <img> decode (browsers apply EXIF here by default)
  const url = URL.createObjectURL(source)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function toImageData(source: Blob): Promise<ImageData> {
  const image = await decode(source)
  try {
    const srcW = 'naturalWidth' in image ? image.naturalWidth : image.width
    const srcH = 'naturalHeight' in image ? image.naturalHeight : image.height
    if (!srcW || !srcH) throw new Error('image decoded to zero size')
    const scale = Math.min(1, MAX_SIDE / Math.max(srcW, srcH))
    const w = Math.max(1, Math.round(srcW * scale))
    const h = Math.max(1, Math.round(srcH * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('canvas 2d unavailable')
    ctx.drawImage(image, 0, 0, w, h)
    return ctx.getImageData(0, 0, w, h)
  } finally {
    if ('close' in image) image.close() // free the decoded pixels immediately
  }
}
