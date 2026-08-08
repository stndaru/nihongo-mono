/** Recognition model, matching the committed tessdata_fast filenames. */
export type OcrModel = 'jpn' | 'jpn_vert' | 'eng'

export type OcrDirection = 'horizontal' | 'vertical'
export type OcrLayout = 'block' | 'auto'

export interface OcrRect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface OcrTextItem {
  rect: OcrRect
  flags: number
  confidence: number
  text: string
}

export interface OcrRecognitionResult {
  raw: string
  lines: OcrTextItem[]
}

export interface OcrRecognitionOptions {
  /** Tesseract PSM 3 = automatic, 5 = vertical block, 6 = uniform block. */
  pageSegmentationMode: 3 | 5 | 6
}

export interface OcrClient {
  recognize(
    image: ImageData,
    options: OcrRecognitionOptions,
    onProgress?: (progress: number) => void,
  ): Promise<OcrRecognitionResult>
  destroy(): Promise<void>
}
