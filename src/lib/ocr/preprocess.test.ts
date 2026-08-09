import { describe, expect, it } from 'vitest'
import { normalizeDarkText, trimLightMargins } from './preprocess'

const image = (width: number, height: number, fill: number): ImageData => {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset] = fill
    data[offset + 1] = fill
    data[offset + 2] = fill
    data[offset + 3] = 255
  }
  return { data, width, height, colorSpace: 'srgb' } as ImageData
}

const fillRect = (
  target: ImageData,
  left: number,
  top: number,
  right: number,
  bottom: number,
  value: number,
) => {
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const offset = (y * target.width + x) * 4
      target.data[offset] = value
      target.data[offset + 1] = value
      target.data[offset + 2] = value
    }
  }
}

const strokeRect = (
  target: ImageData,
  left: number,
  top: number,
  right: number,
  bottom: number,
  value: number,
) => {
  fillRect(target, left, top, right, top + 2, value)
  fillRect(target, left, bottom - 2, right, bottom, value)
  fillRect(target, left, top, left + 2, bottom, value)
  fillRect(target, right - 2, top, right, bottom, value)
}

describe('trimLightMargins', () => {
  it('removes oversized light margins while retaining padding around dark text', () => {
    const source = image(100, 200, 255)
    strokeRect(source, 30, 50, 70, 150, 0)

    const trimmed = trimLightMargins(source)

    expect([trimmed.width, trimmed.height]).toEqual([56, 116])
    expect(trimmed.data[(8 * trimmed.width + 8) * 4]).toBe(0)
  })

  it('does not trim images whose center is not predominantly light', () => {
    const source = image(100, 200, 120)
    strokeRect(source, 30, 50, 70, 150, 0)

    expect(trimLightMargins(source)).toBe(source)
  })

  it('ignores a speech-bubble outline connected to the crop edge', () => {
    const source = image(100, 200, 255)
    fillRect(source, 0, 0, 100, 2, 0)
    fillRect(source, 0, 198, 100, 200, 0)
    fillRect(source, 0, 0, 2, 200, 0)
    fillRect(source, 98, 0, 100, 200, 0)
    fillRect(source, 5, 10, 10, 15, 0)
    strokeRect(source, 30, 50, 70, 150, 0)

    const trimmed = trimLightMargins(source)

    expect([trimmed.width, trimmed.height]).toEqual([56, 116])
  })

  it('ignores isolated dark noise in an otherwise blank crop', () => {
    const source = image(100, 200, 255)
    fillRect(source, 50, 100, 51, 101, 0)

    expect(trimLightMargins(source)).toBe(source)
  })
})

describe('normalizeDarkText', () => {
  it('turns minority light lettering on a dark background into dark ink on white', () => {
    const source = image(20, 10, 36)
    fillRect(source, 4, 2, 6, 8, 245)
    fillRect(source, 10, 2, 12, 8, 150)

    const normalized = normalizeDarkText(source)

    expect(normalized).not.toBe(source)
    expect(normalized.data[0]).toBe(255)
    expect(normalized.data[(2 * normalized.width + 4) * 4]).toBe(0)
    expect(normalized.data[(2 * normalized.width + 10) * 4]).toBe(0)
  })

  it('leaves conventional dark text on a light background unchanged', () => {
    const source = image(20, 10, 250)
    fillRect(source, 4, 2, 6, 8, 20)

    expect(normalizeDarkText(source)).toBe(source)
  })
})
