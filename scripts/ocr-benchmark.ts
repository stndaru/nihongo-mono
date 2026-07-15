import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { evaluateOcrBenchmark, type OcrBenchmarkReport } from './ocr-benchmark-lib'

const reportPath = resolve(process.argv[2] ?? 'benchmarks/ocr/results.json')
if (!existsSync(reportPath)) {
  console.error(`OCR benchmark report is missing: ${reportPath}`)
  console.error('Run the local browser corpus harness on all three device profiles before release.')
  process.exit(1)
}

const report = JSON.parse(readFileSync(reportPath, 'utf8')) as OcrBenchmarkReport
const result = evaluateOcrBenchmark(report)
for (const gate of result.gates) {
  console.log(`${gate.passed ? 'PASS' : 'FAIL'} ${gate.name}: ${gate.actual} (${gate.requirement})`)
}
if (!result.passed) process.exit(1)
