import { describe, expect, it } from 'vitest'
import { evaluateOcrBenchmark, type OcrBenchmarkReport, type OcrSampleResult } from './ocr-benchmark-lib'

function samples(category: OcrSampleResult['category'], count: number): OcrSampleResult[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${category}-${index}`,
    category,
    expected: category === 'adverse' && index === 0 ? '' : '日本語',
    paddle: {
      text: category === 'adverse' && index === 0 ? '' : '日本語',
      usable: true,
      confidence: 0.96,
    },
    tesseract: {
      text: category === 'adverse' && index === 0 ? '' : '日本語語',
      usable: true,
    },
    safeToAutoParse: true,
  }))
}

function passingReport(): OcrBenchmarkReport {
  return {
    samples: [
      ...samples('horizontal-ja', 20),
      ...samples('vertical-ja', 15),
      ...samples('handwriting-ja', 15),
      ...samples('english', 10).map((sample) => ({
        ...sample,
        expected: 'English',
        paddle: { text: 'English', usable: true, confidence: 0.96 },
        tesseract: { text: 'English', usable: true },
      })),
      ...samples('adverse', 10),
    ],
    devices: (['chrome', 'edge', 'firefox', 'safari'] as const).flatMap((browser) =>
      (['current', 'previous-1', 'previous-2'] as const).map((release, index) => ({
        tier: (index === 0 ? 'desktop' : index === 1 ? 'mid-phone' : 'low-phone') as
          | 'desktop'
          | 'mid-phone'
          | 'low-phone',
        browser,
        release,
        scanMs: [index === 0 ? 1200 : index === 1 ? 4000 : 9000],
        initMs: index === 0 ? 3000 : 7000,
        maxLongTaskMs: index === 0 ? 80 : index === 1 ? 120 : 180,
        incrementalMemoryBytes:
          index === 0 ? 100_000_000 : index === 1 ? 150_000_000 : 200_000_000,
        retainedMemoryBytesAfterClose: 10_000_000,
        firstDownloadBytes: 28_063_664,
        repeatDownloadBytes: 0,
        fallbackCrashed: false,
      })),
    ),
  }
}

describe('evaluateOcrBenchmark', () => {
  it('passes the agreed accuracy, corpus, network, and device gates', () => {
    const result = evaluateOcrBenchmark(passingReport())
    expect(result.passed).toBe(true)
    expect(result.gates.every((gate) => gate.passed)).toBe(true)
  })

  it('blocks release on a vertical Japanese usability regression', () => {
    const report = passingReport()
    for (const sample of report.samples.filter((item) => item.category === 'vertical-ja').slice(0, 2)) {
      sample.paddle.usable = false
    }
    const result = evaluateOcrBenchmark(report)
    expect(result.gates.find((gate) => gate.name === 'vertical-ja-usable')).toMatchObject({ passed: false })
    expect(result.passed).toBe(false)
  })

  it('blocks silent empty output and repeat network traffic', () => {
    const report = passingReport()
    report.samples[0].paddle.text = ''
    report.devices[0].repeatDownloadBytes = 1
    const result = evaluateOcrBenchmark(report)
    expect(result.gates.find((gate) => gate.name === 'no-silent-empty')).toMatchObject({ passed: false })
    expect(result.gates.find((gate) => gate.name === 'repeat-network')).toMatchObject({ passed: false })
  })

  it('blocks an incomplete browser matrix and an unsafe confidence threshold', () => {
    const report = passingReport()
    report.devices = report.devices.filter((device) => device.browser !== 'safari')
    for (const sample of report.samples.slice(0, 5)) sample.safeToAutoParse = false
    const result = evaluateOcrBenchmark(report)
    expect(result.gates.find((gate) => gate.name === 'browser-matrix')).toMatchObject({ passed: false })
    expect(result.gates.find((gate) => gate.name === 'confidence-precision')).toMatchObject({ passed: false })
  })
})
