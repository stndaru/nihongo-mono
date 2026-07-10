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

/** Percent-based crop rectangle (react-image-crop's PercentCrop shape). */
export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Cut the crop rectangle (percentages of the displayed, EXIF-oriented
 * image) out of the original blob at full resolution. A near-full
 * selection returns the source untouched — no pointless re-encode.
 */
export async function cropToBlob(source: Blob, crop: CropRect): Promise<Blob> {
  if (crop.width >= 99.5 && crop.height >= 99.5 && crop.x <= 0.5 && crop.y <= 0.5) {
    return source
  }
  const image = await decode(source)
  try {
    const srcW = 'naturalWidth' in image ? image.naturalWidth : image.width
    const srcH = 'naturalHeight' in image ? image.naturalHeight : image.height
    const sx = Math.max(0, Math.round((crop.x / 100) * srcW))
    const sy = Math.max(0, Math.round((crop.y / 100) * srcH))
    const sw = Math.max(1, Math.min(srcW - sx, Math.round((crop.width / 100) * srcW)))
    const sh = Math.max(1, Math.min(srcH - sy, Math.round((crop.height / 100) * srcH)))
    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = sh
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d unavailable')
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh)
    // PNG keeps screenshot text crisp; photos re-encode as JPEG
    const type = source.type === 'image/png' ? 'image/png' : 'image/jpeg'
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('crop encode failed'))),
        type,
        0.92,
      )
    })
  } finally {
    if ('close' in image) image.close()
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
