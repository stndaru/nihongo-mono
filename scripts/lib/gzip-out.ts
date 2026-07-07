import { writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

/**
 * Bulk data under public/data ships pre-gzipped (.json.gz) and is inflated
 * client-side with DecompressionStream. This guarantees the ~4:1 transfer
 * saving even on hosts that don't compress large JSON on the fly, and keeps
 * ~100 MB of generated bulk out of the repository.
 */
export function writeJsonGz(path: string, data: unknown): void {
  writeFileSync(path, gzipSync(JSON.stringify(data), { level: 9 }))
}
