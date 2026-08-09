import { describe, expect, it } from 'vitest'
import { getOcrScanPlan, shouldTrimLightMargins } from './scan-plan'

describe('getOcrScanPlan', () => {
  it('keeps a tall isolated vertical column upright with vertical-block segmentation', () => {
    expect(getOcrScanPlan('vertical', 'block', 59, 335)).toEqual({
      turns: 0,
      pageSegmentationMode: 5,
    })
  })

  it('keeps the established rotated block path for a multi-column crop', () => {
    expect(getOcrScanPlan('vertical', 'block', 230, 505)).toEqual({
      turns: 3,
      pageSegmentationMode: 6,
    })
  })

  it('keeps automatic vertical analysis on the rotated input', () => {
    expect(getOcrScanPlan('vertical', 'auto', 59, 335)).toEqual({
      turns: 3,
      pageSegmentationMode: 3,
    })
  })

  it('does not rotate horizontal scans', () => {
    expect(getOcrScanPlan('horizontal', 'block', 1200, 300)).toEqual({
      turns: 0,
      pageSegmentationMode: 6,
    })
  })
})

describe('shouldTrimLightMargins', () => {
  it('trims a tall narrow speech-bubble crop', () => {
    expect(shouldTrimLightMargins('vertical', 'block', 145, 390)).toBe(true)
  })

  it('preserves a wider multi-column narration crop', () => {
    expect(shouldTrimLightMargins('vertical', 'block', 234, 510)).toBe(false)
  })

  it('does not alter automatic or horizontal scans', () => {
    expect(shouldTrimLightMargins('vertical', 'auto', 145, 390)).toBe(false)
    expect(shouldTrimLightMargins('horizontal', 'block', 145, 390)).toBe(false)
  })
})
