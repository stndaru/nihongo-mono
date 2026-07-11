import { todayLocal } from './streak'
import type { ProgressData } from './store'

export function progressFileName(): string {
  return `nihongo-mono-progress-${todayLocal()}.json`
}

export function downloadProgress(data: ProgressData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = progressFileName()
  a.click()
  URL.revokeObjectURL(url)
}

export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read the file.'))
    reader.readAsText(file)
  })
}
