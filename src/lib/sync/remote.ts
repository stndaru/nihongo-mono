import { parseImported, type ProgressData } from '@/lib/progress/store'

/**
 * A legitimate progress file is a few KB; anything near this is not ours.
 * Checked BEFORE JSON.parse so a tampered Drive file can't memory-bomb the
 * tab (the remote blob is untrusted input — see decision 70).
 */
export const MAX_REMOTE_BYTES = 1_000_000

export class RemoteInvalidError extends Error {}

/**
 * The only door remote data comes through: size cap, then the same
 * validation + migration the file-import feature uses (parseImported).
 */
export function validateRemote(text: string): ProgressData {
  if (text.length > MAX_REMOTE_BYTES) {
    throw new RemoteInvalidError('Drive copy is too large to be a progress file.')
  }
  try {
    return parseImported(text)
  } catch (e) {
    throw new RemoteInvalidError(e instanceof Error ? e.message : 'Drive copy is unreadable.')
  }
}
