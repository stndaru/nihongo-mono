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
const LIGHT_BACKGROUND_THRESHOLD = 240
const DARK_INK_THRESHOLD = 200
const MINIMUM_CENTER_LIGHT_SHARE = 0.55
const MINIMUM_INK_COMPONENT_AREA = 30
const MAXIMUM_INK_COMPONENT_AREA = 100_000
const CONTENT_PADDING = 8

const compositedLuminance = (data: Uint8ClampedArray, offset: number) => {
  const luminance =
    (data[offset] * 299 + data[offset + 1] * 587 + data[offset + 2] * 114) / 1000
  const alpha = data[offset + 3] / 255
  return 255 - alpha * (255 - luminance)
}

/**
 * Remove generous white/near-white margins around a cropped text block.
 * Tesseract's block segmentation can discard a small two-column region when
 * whitespace dominates the crop. We only trim light-centered regions, so
 * photos and dark balloons keep their pixels unchanged. Dark components that
 * touch the crop edge (speech-bubble outlines) and tiny components (screentone
 * dots or dust) do not define the text bounds. Padding leaves Tesseract
 * breathing room around the detected ink.
 */
export function trimLightMargins(source: ImageData): ImageData {
  const { data, width, height } = source
  if (width < 3 || height < 3) return source

  const centerLeft = Math.floor(width * 0.2)
  const centerRight = Math.ceil(width * 0.8)
  const centerTop = Math.floor(height * 0.2)
  const centerBottom = Math.ceil(height * 0.8)
  let centerPixels = 0
  let lightCenterPixels = 0
  for (let y = centerTop; y < centerBottom; y += 1) {
    for (let x = centerLeft; x < centerRight; x += 1) {
      centerPixels += 1
      if (compositedLuminance(data, (y * width + x) * 4) >= LIGHT_BACKGROUND_THRESHOLD) {
        lightCenterPixels += 1
      }
    }
  }
  if (lightCenterPixels / centerPixels < MINIMUM_CENTER_LIGHT_SHARE) return source

  const rowInk = new Uint32Array(height)
  const columnInk = new Uint32Array(width)
  const dark = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (compositedLuminance(data, (y * width + x) * 4) <= DARK_INK_THRESHOLD) {
        dark[y * width + x] = 1
      }
    }
  }

  const visited = new Uint8Array(dark.length)
  const neighbours = [-width - 1, -width, -width + 1, -1, 1, width - 1, width, width + 1]
  for (let start = 0; start < dark.length; start += 1) {
    if (dark[start] === 0 || visited[start] === 1) continue
    const component = [start]
    visited[start] = 1
    let touchesEdge = false
    for (let cursor = 0; cursor < component.length; cursor += 1) {
      if (component.length > MAXIMUM_INK_COMPONENT_AREA) return source
      const index = component[cursor]
      const x = index % width
      const y = Math.floor(index / width)
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) touchesEdge = true
      for (const delta of neighbours) {
        const next = index + delta
        if (next < 0 || next >= dark.length || dark[next] === 0 || visited[next] === 1) continue
        const nextX = next % width
        if (Math.abs(nextX - x) > 1) continue
        visited[next] = 1
        component.push(next)
      }
    }
    if (touchesEdge || component.length < MINIMUM_INK_COMPONENT_AREA) continue
    for (const index of component) {
      const x = index % width
      const y = Math.floor(index / width)
      rowInk[y] += 1
      columnInk[x] += 1
    }
  }

  const minimumRowInk = Math.max(2, Math.ceil(width * 0.015))
  const minimumColumnInk = Math.max(2, Math.ceil(height * 0.005))
  const firstRow = rowInk.findIndex((count) => count >= minimumRowInk)
  const firstColumn = columnInk.findIndex((count) => count >= minimumColumnInk)
  if (firstRow < 0 || firstColumn < 0) return source

  let lastRow = height - 1
  while (lastRow > firstRow && rowInk[lastRow] < minimumRowInk) lastRow -= 1
  let lastColumn = width - 1
  while (lastColumn > firstColumn && columnInk[lastColumn] < minimumColumnInk) lastColumn -= 1

  const top = Math.max(0, firstRow - CONTENT_PADDING)
  const bottom = Math.min(height, lastRow + CONTENT_PADDING + 1)
  const left = Math.max(0, firstColumn - CONTENT_PADDING)
  const right = Math.min(width, lastColumn + CONTENT_PADDING + 1)
  const outputWidth = right - left
  const outputHeight = bottom - top
  if (outputWidth >= width - 2 && outputHeight >= height - 2) return source

  const output = new Uint8ClampedArray(outputWidth * outputHeight * 4)
  for (let y = 0; y < outputHeight; y += 1) {
    const sourceOffset = ((top + y) * width + left) * 4
    const targetOffset = y * outputWidth * 4
    output.set(data.subarray(sourceOffset, sourceOffset + outputWidth * 4), targetOffset)
  }
  if (typeof ImageData === 'function') {
    return new ImageData(output, outputWidth, outputHeight)
  }
  return { data: output, width: outputWidth, height: outputHeight, colorSpace: source.colorSpace } as ImageData
}

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
  image: CanvasImageSource,
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

/** Rotate already-downscaled OCR pixels without another decode/re-encode pass. */
export function rotateImageData(source: ImageData, turns: QuarterTurns): ImageData {
  if (turns === 0) return source
  const input = document.createElement('canvas')
  input.width = source.width
  input.height = source.height
  const inputContext = input.getContext('2d')
  if (!inputContext) throw new Error('canvas 2d unavailable')
  inputContext.putImageData(source, 0, 0)

  const output = drawRotated(input, source.width, source.height, turns)
  const outputContext = output.getContext('2d', { willReadFrequently: true })
  if (!outputContext) throw new Error('canvas 2d unavailable')
  return outputContext.getImageData(0, 0, output.width, output.height)
}
