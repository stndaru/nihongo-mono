export type OcrCorpusCategory =
  | 'horizontal-ja'
  | 'vertical-ja'
  | 'handwriting-ja'
  | 'english'
  | 'adverse'

export interface OcrSampleResult {
  id: string
  category: OcrCorpusCategory
  expected: string
  paddle: { text: string; usable: boolean; confidence: number | null }
  tesseract: { text: string; usable: boolean }
  /** Human label: accepting this result without review is safe. */
  safeToAutoParse: boolean
}

export interface OcrDeviceResult {
  tier: 'desktop' | 'mid-phone' | 'low-phone'
  browser: 'chrome' | 'edge' | 'firefox' | 'safari'
  release: 'current' | 'previous-1' | 'previous-2'
  scanMs: number[]
  initMs: number
  maxLongTaskMs: number
  incrementalMemoryBytes: number
  retainedMemoryBytesAfterClose: number
  firstDownloadBytes: number
  repeatDownloadBytes: number
  fallbackCrashed: boolean
}

export interface OcrBenchmarkReport {
  samples: OcrSampleResult[]
  devices: OcrDeviceResult[]
}

export interface OcrGateResult {
  name: string
  passed: boolean
  actual: number | string
  requirement: string
}

function normalized(text: string): string {
  return text.normalize('NFKC').replace(/\s+/gu, '')
}

function editDistance(left: string, right: string): number {
  const a = Array.from(left)
  const b = Array.from(right)
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row]
    for (let column = 1; column <= b.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1),
      )
    }
    previous = current
  }
  return previous[b.length]
}

export function characterErrorRate(expected: string, actual: string): number {
  const reference = normalized(expected)
  if (!reference) return normalized(actual) ? 1 : 0
  return editDistance(reference, normalized(actual)) / Array.from(reference).length
}

function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : Infinity
}

function p95(values: number[]): number {
  if (!values.length) return Infinity
  const sorted = values.toSorted((a, b) => a - b)
  return sorted[Math.ceil(sorted.length * 0.95) - 1]
}

export function evaluateOcrBenchmark(report: OcrBenchmarkReport) {
  const byCategory = (category: OcrCorpusCategory) =>
    report.samples.filter((sample) => sample.category === category)
  const paddleCer = (category: OcrCorpusCategory) =>
    mean(byCategory(category).map((sample) => characterErrorRate(sample.expected, sample.paddle.text)))
  const tesseractCer = (category: OcrCorpusCategory) =>
    mean(byCategory(category).map((sample) => characterErrorRate(sample.expected, sample.tesseract.text)))
  const usable = (category: OcrCorpusCategory) =>
    mean(byCategory(category).map((sample) => (sample.paddle.usable ? 1 : 0)))

  const horizontalPaddle = paddleCer('horizontal-ja')
  const horizontalTesseract = tesseractCer('horizontal-ja')
  const horizontalImprovement =
    horizontalTesseract > 0 ? 1 - horizontalPaddle / horizontalTesseract : 0
  const device = (tier: OcrDeviceResult['tier']) =>
    report.devices.find((item) => item.tier === tier)
  const devicesPresent = ['desktop', 'mid-phone', 'low-phone'].every((tier) =>
    report.devices.some((item) => item.tier === tier),
  )
  const browsers = ['chrome', 'edge', 'firefox', 'safari'] as const
  const releases = ['current', 'previous-1', 'previous-2'] as const
  const browserMatrixPresent = browsers.every((browser) =>
    releases.every((release) =>
      report.devices.some((item) => item.browser === browser && item.release === release),
    ),
  )
  const scanLimits: Record<OcrDeviceResult['tier'], number> = {
    desktop: 2500,
    'mid-phone': 5000,
    'low-phone': 10000,
  }
  const gates: OcrGateResult[] = []
  const add = (name: string, passed: boolean, actual: number | string, requirement: string) => {
    gates.push({ name, passed, actual, requirement })
  }

  const minimums: Record<OcrCorpusCategory, number> = {
    'horizontal-ja': 20,
    'vertical-ja': 15,
    'handwriting-ja': 15,
    english: 10,
    adverse: 10,
  }
  for (const [category, minimum] of Object.entries(minimums) as [OcrCorpusCategory, number][]) {
    const count = byCategory(category).length
    add(`corpus-${category}`, count >= minimum, count, `at least ${minimum} labeled samples`)
  }
  add('horizontal-ja-cer', horizontalPaddle <= 0.05, horizontalPaddle, 'CER <= 5%')
  add(
    'horizontal-ja-improvement',
    horizontalImprovement >= 0.2,
    horizontalImprovement,
    'at least 20% lower CER than Tesseract',
  )
  add('vertical-ja-cer', paddleCer('vertical-ja') <= 0.15, paddleCer('vertical-ja'), 'CER <= 15%')
  add('vertical-ja-usable', usable('vertical-ja') >= 0.9, usable('vertical-ja'), '>= 90% human-rated usable')
  add('handwriting-ja-cer', paddleCer('handwriting-ja') <= 0.25, paddleCer('handwriting-ja'), 'CER <= 25%')
  add('handwriting-ja-usable', usable('handwriting-ja') >= 0.8, usable('handwriting-ja'), '>= 80% human-rated usable')
  const englishRegression = paddleCer('english') - tesseractCer('english')
  add('english-regression', englishRegression <= 0.02, englishRegression, '<= 2 percentage-point CER regression')
  const silentEmpty = report.samples.filter(
    (sample) => normalized(sample.expected) && !normalized(sample.paddle.text),
  ).length
  add('no-silent-empty', silentEmpty === 0, silentEmpty, 'zero non-empty references returned empty')
  const falsePositiveEmpty = report.samples.filter(
    (sample) => !normalized(sample.expected) && normalized(sample.paddle.text),
  ).length
  add('empty-stays-empty', falsePositiveEmpty === 0, falsePositiveEmpty, 'zero false positives on empty references')

  const labeledConfidence = report.samples.filter(
    (sample) => typeof sample.paddle.confidence === 'number',
  )
  const accepted = labeledConfidence.filter((sample) => (sample.paddle.confidence ?? 0) >= 0.72)
  const safeAccepted = accepted.filter((sample) => sample.safeToAutoParse)
  const safeTotal = labeledConfidence.filter((sample) => sample.safeToAutoParse).length
  const precision = accepted.length ? safeAccepted.length / accepted.length : 0
  const recall = safeTotal ? safeAccepted.length / safeTotal : 0
  add(
    'confidence-coverage',
    labeledConfidence.length === report.samples.length,
    labeledConfidence.length,
    'every sample has Paddle confidence and a human auto-parse label',
  )
  add('confidence-precision', precision >= 0.95, precision, '0.72 threshold precision >= 95%')
  add('confidence-recall', recall >= 0.8, recall, '0.72 threshold recall >= 80%')

  add('device-profiles', devicesPresent, report.devices.length, 'desktop, mid-phone, and low-phone profiles')
  add(
    'browser-matrix',
    browserMatrixPresent,
    report.devices.length,
    'Chrome, Edge, Firefox, and Safari current plus previous two releases',
  )
  for (const tier of ['desktop', 'mid-phone', 'low-phone'] as const) {
    const result = device(tier)
    const latency = result ? p95(result.scanMs) : Infinity
    add(`${tier}-latency`, latency <= scanLimits[tier], latency, `p95 <= ${scanLimits[tier]} ms`)
  }
  const mid = device('mid-phone')
  add('mid-phone-init', Boolean(mid && mid.initMs <= 8000), mid?.initMs ?? Infinity, '<= 8000 ms after download')
  const maxLongTask = report.devices.length
    ? Math.max(...report.devices.map((item) => item.maxLongTaskMs))
    : Infinity
  add('main-thread-long-task', maxLongTask <= 200, maxLongTask, 'no task > 200 ms at 4x CPU throttle')
  const maxMemory = report.devices.length
    ? Math.max(...report.devices.map((item) => item.incrementalMemoryBytes))
    : Infinity
  add('incremental-memory', maxMemory < 250 * 1024 * 1024, maxMemory, '< 250 MiB and released after close')
  const retainedMemory = report.devices.length
    ? Math.max(...report.devices.map((item) => item.retainedMemoryBytesAfterClose))
    : Infinity
  add('memory-release', retainedMemory <= 25 * 1024 * 1024, retainedMemory, '<= 25 MiB retained after closing OCR')
  const firstBytes = report.devices.length
    ? Math.max(...report.devices.map((item) => item.firstDownloadBytes))
    : Infinity
  add('first-download', firstBytes <= 30 * 1024 * 1024, firstBytes, '<= 30 MiB')
  const repeatBytes = report.devices.length
    ? Math.max(...report.devices.map((item) => item.repeatDownloadBytes))
    : Infinity
  add('repeat-network', repeatBytes === 0, repeatBytes, 'zero OCR library/model bytes')
  const fallbackCrashes = report.devices.filter((item) => item.fallbackCrashed).length
  add('webgpu-fallback', fallbackCrashes === 0, fallbackCrashes, 'zero crashes when WebGPU falls back to WASM')

  return { passed: gates.every((gate) => gate.passed), gates }
}
