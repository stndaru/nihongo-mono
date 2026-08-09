import type { OcrRecognitionOptions, OcrRecognitionResult } from './types'

export type OcrWorkerRequest =
  | { id: number; type: 'load-model'; model: ArrayBuffer }
  | { id: number; type: 'recognize'; image: ImageData; options: OcrRecognitionOptions }
  | { id: number; type: 'destroy' }

export type OcrWorkerResponse =
  | { id: number; type: 'progress'; progress: number }
  | { id: number; type: 'result'; result?: OcrRecognitionResult }
  | { id: number; type: 'error'; message: string }
