import type { OcrDirection, OcrLayout, OcrRecognitionOptions } from './types'
import type { QuarterTurns } from './preprocess'

const SINGLE_VERTICAL_COLUMN_RATIO = 4
const NARROW_VERTICAL_MARGIN_TRIM_RATIO = 2.5

export interface OcrScanPlan {
  turns: QuarterTurns
  pageSegmentationMode: OcrRecognitionOptions['pageSegmentationMode']
}

/** Only narrow vertical blocks benefit from removing speech-bubble whitespace. */
export function shouldTrimLightMargins(
  direction: OcrDirection,
  layout: OcrLayout,
  width: number,
  height: number,
): boolean {
  return (
    direction === 'vertical' &&
    layout === 'block' &&
    height / Math.max(1, width) >= NARROW_VERTICAL_MARGIN_TRIM_RATIO
  )
}

/**
 * Match Tesseract's page mode to the geometry it actually receives.
 * `jpn_vert` handles isolated tall columns best while they are upright with
 * PSM 5. Wider balloons can contain several right-to-left columns, whose
 * ordering is more reliable after the established counter-clockwise rotation.
 */
export function getOcrScanPlan(
  direction: OcrDirection,
  layout: OcrLayout,
  width: number,
  height: number,
): OcrScanPlan {
  if (direction === 'horizontal') {
    return { turns: 0, pageSegmentationMode: layout === 'auto' ? 3 : 6 }
  }
  if (layout === 'auto') return { turns: 3, pageSegmentationMode: 3 }
  if (height / Math.max(1, width) >= SINGLE_VERTICAL_COLUMN_RATIO) {
    return { turns: 0, pageSegmentationMode: 5 }
  }
  return { turns: 3, pageSegmentationMode: 6 }
}
