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

/** Clockwise 90° steps applied before cropping/scanning. */
export type QuarterTurns = 0 | 1 | 2 | 3

/** Draw `image` rotated by quarter turns into a canvas of w×h (pre-turn). */
function drawRotated(
  image: ImageBitmap | HTMLImageElement,
  w: number,
  h: number,
  turns: QuarterTurns,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const swap = turns % 2 === 1
  canvas.width = swap ? h : w
  canvas.height = swap ? w : h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d unavailable')
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((turns * Math.PI) / 2)
  ctx.drawImage(image, -w / 2, -h / 2, w, h)
  return canvas
}

function encode(canvas: HTMLCanvasElement, sourceType: string): Promise<Blob> {
  // PNG keeps screenshot text crisp; photos re-encode as JPEG
  const type = sourceType === 'image/png' ? 'image/png' : 'image/jpeg'
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('image encode failed'))),
      type,
      0.92,
    )
  })
}

/**
 * The crop dialog's rotate preview: the source rotated by quarter turns,
 * downscaled to the OCR ceiling (MAX_SIDE) so a 12 MP photo doesn't
 * re-encode at full size on every click. Preview-only — the final scan
 * bakes rotation from the original via cropToBlob.
 */
export async function rotateToBlob(source: Blob, turns: QuarterTurns): Promise<Blob> {
  const image = await decode(source)
  try {
    const srcW = 'naturalWidth' in image ? image.naturalWidth : image.width
    const srcH = 'naturalHeight' in image ? image.naturalHeight : image.height
    if (!srcW || !srcH) throw new Error('image decoded to zero size')
    const scale = Math.min(1, MAX_SIDE / Math.max(srcW, srcH))
    const canvas = drawRotated(
      image,
      Math.max(1, Math.round(srcW * scale)),
      Math.max(1, Math.round(srcH * scale)),
      turns,
    )
    return await encode(canvas, source.type)
  } finally {
    if ('close' in image) image.close()
  }
}

/**
 * Rotate the original blob by quarter turns, then cut the crop rectangle
 * (percentages of the ROTATED, EXIF-oriented image — matching what the
 * dialog displayed) out at full resolution. A near-full selection with no
 * rotation returns the source untouched — no pointless re-encode.
 */
export async function cropToBlob(
  source: Blob,
  crop: CropRect,
  turns: QuarterTurns = 0,
): Promise<Blob> {
  if (
    turns === 0 &&
    crop.width >= 99.5 &&
    crop.height >= 99.5 &&
    crop.x <= 0.5 &&
    crop.y <= 0.5
  ) {
    return source
  }
  const image = await decode(source)
  try {
    const srcW = 'naturalWidth' in image ? image.naturalWidth : image.width
    const srcH = 'naturalHeight' in image ? image.naturalHeight : image.height
    const rotated = drawRotated(image, srcW, srcH, turns)
    const w = rotated.width
    const h = rotated.height
    const sx = Math.max(0, Math.round((crop.x / 100) * w))
    const sy = Math.max(0, Math.round((crop.y / 100) * h))
    const sw = Math.max(1, Math.min(w - sx, Math.round((crop.width / 100) * w)))
    const sh = Math.max(1, Math.min(h - sy, Math.round((crop.height / 100) * h)))
    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = sh
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d unavailable')
    ctx.drawImage(rotated, sx, sy, sw, sh, 0, 0, sw, sh)
    return await encode(canvas, source.type)
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
