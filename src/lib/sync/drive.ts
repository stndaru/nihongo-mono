/**
 * Google Drive v3 REST over plain fetch — no gapi client library (it's
 * ~100 kB for four endpoints). Every function takes the fetch
 * implementation and token as arguments so the engine, unit tests, and
 * Playwright runs can inject fakes; nothing here reads globals.
 *
 * Scope is drive.file: the app only ever sees the folder and file it
 * created itself. Names are fixed constants and still escaped before
 * being interpolated into a `q` query — user input never reaches one.
 */
import { MAX_REMOTE_BYTES } from './remote'

export const FOLDER_NAME = 'Nihongo Mono'
export const FILE_NAME = 'progress.json'

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

export type DriveErrorKind =
  | 'auth'
  | 'rate-limit'
  | 'storage-quota'
  | 'not-found'
  | 'offline'
  | 'too-large'
  | 'unknown'

export class DriveError extends Error {
  kind: DriveErrorKind
  constructor(kind: DriveErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

/** Escape a value for a Drive `q` query (backslashes, then quotes). */
export function escapeQ(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/** Map a Drive HTTP failure to a SyncErrorKind-shaped classification. */
export function classifyDriveError(status: number, body: unknown): DriveErrorKind {
  if (status === 401) return 'auth'
  if (status === 429) return 'rate-limit'
  if (status === 404) return 'not-found'
  if (status === 403) {
    const reasons = collectReasons(body)
    if (reasons.includes('storageQuotaExceeded')) return 'storage-quota'
    if (
      reasons.includes('rateLimitExceeded') ||
      reasons.includes('userRateLimitExceeded') ||
      reasons.includes('dailyLimitExceeded')
    ) {
      return 'rate-limit'
    }
    // a revoked grant surfaces as 403 insufficientPermissions
    if (reasons.includes('insufficientPermissions') || reasons.includes('forbidden')) {
      return 'auth'
    }
  }
  return 'unknown'
}

function collectReasons(body: unknown): string[] {
  const err = (body as { error?: { errors?: { reason?: string }[]; status?: string } } | null)
    ?.error
  const reasons = (err?.errors ?? []).map((e) => e.reason ?? '')
  if (err?.status) reasons.push(err.status)
  return reasons
}

type Fetch = typeof fetch

async function driveCall(
  fetchImpl: Fetch,
  token: string,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  let res: Response
  try {
    res = await fetchImpl(url, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${token}` },
    })
  } catch {
    // fetch itself rejecting is a network problem, not an API answer
    throw new DriveError('offline', 'Network request to Google Drive failed.')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new DriveError(
      classifyDriveError(res.status, body),
      `Drive request failed (${res.status}).`,
    )
  }
  return res
}

export async function findFolder(fetchImpl: Fetch, token: string): Promise<string | null> {
  const q = `name='${escapeQ(FOLDER_NAME)}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`
  const res = await driveCall(
    fetchImpl,
    token,
    `${API}/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`,
  )
  const data = (await res.json()) as { files?: { id: string }[] }
  return data.files?.[0]?.id ?? null
}

export async function createFolder(fetchImpl: Fetch, token: string): Promise<string> {
  const res = await driveCall(fetchImpl, token, `${API}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['root'],
    }),
  })
  return ((await res.json()) as { id: string }).id
}

export interface RemoteFileInfo {
  id: string
  modifiedTime: string
}

export async function findFile(
  fetchImpl: Fetch,
  token: string,
  folderId: string,
): Promise<RemoteFileInfo | null> {
  const q = `name='${escapeQ(FILE_NAME)}' and '${escapeQ(folderId)}' in parents and trashed=false`
  const res = await driveCall(
    fetchImpl,
    token,
    `${API}/files?q=${encodeURIComponent(q)}&fields=files(id,modifiedTime)&pageSize=1`,
  )
  const data = (await res.json()) as { files?: RemoteFileInfo[] }
  return data.files?.[0] ?? null
}

/** Multipart create: metadata part names the file, media part is the JSON. */
export async function createFile(
  fetchImpl: Fetch,
  token: string,
  folderId: string,
  json: string,
): Promise<string> {
  const boundary = 'nihongo-mono-sync'
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: FILE_NAME, parents: [folderId], mimeType: 'application/json' }) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`
  const res = await driveCall(
    fetchImpl,
    token,
    `${UPLOAD}/files?uploadType=multipart&fields=id`,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    },
  )
  return ((await res.json()) as { id: string }).id
}

export async function updateFile(
  fetchImpl: Fetch,
  token: string,
  fileId: string,
  json: string,
): Promise<void> {
  await driveCall(
    fetchImpl,
    token,
    `${UPLOAD}/files/${encodeURIComponent(fileId)}?uploadType=media`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: json,
    },
  )
}

/** Download the file body, refusing anything over the remote size cap. */
export async function downloadFile(
  fetchImpl: Fetch,
  token: string,
  fileId: string,
): Promise<string> {
  const res = await driveCall(
    fetchImpl,
    token,
    `${API}/files/${encodeURIComponent(fileId)}?alt=media`,
  )
  const blob = await res.blob()
  if (blob.size > MAX_REMOTE_BYTES) {
    throw new DriveError('too-large', 'Drive copy is too large to be a progress file.')
  }
  return blob.text()
}
