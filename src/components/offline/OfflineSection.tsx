/**
 * Settings → "Offline access" (decision 72): the one surface for the
 * opt-in whole-app download. States: unsupported / not downloaded /
 * downloading (byte progress + cancel) / available (button disabled —
 * owner requirement) / update available / cleared-by-browser. The size
 * and the caveats are stated up front — nothing downloads until the
 * click.
 */
import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, HardDriveDownload, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  cacheIntact,
  enableOffline,
  fetchManifest,
  formatMB,
  loadOfflineMeta,
  offlineSupported,
  removeOffline,
  type OfflineManifest,
  type OfflineMeta,
} from '@/lib/offline/offline'

type Check =
  | { phase: 'checking' }
  | { phase: 'ready'; manifest: OfflineManifest }
  | { phase: 'unreachable' } // manifest fetch failed — probably offline

export function OfflineSection() {
  const supported = offlineSupported()
  const [meta, setMeta] = useState<OfflineMeta | null>(() => loadOfflineMeta())
  const [intact, setIntact] = useState<boolean | null>(null)
  const [check, setCheck] = useState<Check>({ phase: 'checking' })
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!supported) return
    let live = true
    void cacheIntact().then((v) => live && setIntact(v))
    fetchManifest()
      .then((manifest) => live && setCheck({ phase: 'ready', manifest }))
      .catch(() => live && setCheck({ phase: 'unreachable' }))
    return () => {
      live = false
    }
  }, [supported])

  if (!supported) {
    return (
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Offline access</h2>
        <p className="text-xs text-pretty text-muted-foreground">
          This browser can&apos;t store the app for offline use (it needs
          service-worker support and a secure https connection).
        </p>
      </section>
    )
  }

  const manifest = check.phase === 'ready' ? check.manifest : null
  const downloading = progress !== null
  // "available" = a completed download whose cache the browser still holds
  const available = meta !== null && intact === true
  const cleared = meta !== null && intact === false
  const stale = available && manifest !== null && manifest.version !== meta.version
  const current = available && manifest !== null && manifest.version === meta.version

  const start = async () => {
    if (!manifest || downloading) return
    setNote(null)
    const controller = new AbortController()
    abortRef.current = controller
    setProgress({ done: 0, total: manifest.totalBytes })
    try {
      const result = await enableOffline(
        manifest,
        (done) => setProgress({ done, total: manifest.totalBytes }),
        controller.signal,
      )
      setMeta(result)
      setIntact(true)
      setNote({
        kind: 'ok',
        text: result.persisted
          ? 'Ready — the whole app now works without a connection.'
          : 'Ready — the whole app now works without a connection. (The browser declined persistent storage, so it may still clear the copy if disk space runs very low.)',
      })
    } catch (err) {
      setMeta(loadOfflineMeta())
      setIntact(await cacheIntact())
      setNote(
        controller.signal.aborted
          ? { kind: 'ok', text: 'Download cancelled.' }
          : {
              kind: 'error',
              text:
                'The download didn’t finish — check your connection and try again. ' +
                (err instanceof Error ? err.message : ''),
            },
      )
    } finally {
      abortRef.current = null
      setProgress(null)
    }
  }

  const remove = async () => {
    setNote(null)
    await removeOffline()
    setMeta(null)
    setIntact(false)
    setNote({ kind: 'ok', text: 'Offline data removed.' })
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">Offline access</h2>
      <p className="text-xs text-pretty text-muted-foreground">
        Download the entire app — every page, the full dictionary
        (including the Beyond tier and proper names), quizzes, grammar,
        stroke order, Smart Parsing, and image scanning — into this
        browser. Everything then keeps working with no connection, even
        after closing the browser.
      </p>
      <ul className="list-disc space-y-1 pl-4 text-xs text-pretty text-muted-foreground">
        <li>
          One-time download of{' '}
          <span className="font-medium text-foreground">
            {manifest ? `about ${formatMB(manifest.totalBytes)}` : 'about 72 MB'}
          </span>
          , stored by this browser on this device until you remove it or
          clear the site&apos;s data. Private/incognito windows don&apos;t
          keep it.
        </li>
        <li>
          Google Drive sync and sentence translation still need a
          connection — quiz progress made offline is saved in this browser
          and syncs when you&apos;re back online.
        </li>
        <li>
          When the app updates, this page will offer to refresh the copy;
          until then the downloaded version keeps working.
        </li>
      </ul>

      {cleared && (
        <p className="text-xs text-destructive">
          The browser has cleared the offline data (usually to free disk
          space) — download it again to restore offline access.
        </p>
      )}
      {check.phase === 'unreachable' && (
        <p className="text-xs text-muted-foreground">
          {available
            ? 'You appear to be offline — the downloaded copy is in use.'
            : 'Couldn’t reach the server to check the download — try again when online.'}
        </p>
      )}

      {downloading && progress && (
        <div className="space-y-1">
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full origin-left rounded-full bg-primary transition-transform duration-100 ease-snap"
              style={{
                transform: `scaleX(${Math.min(1, progress.done / Math.max(1, progress.total))})`,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Downloading… {formatMB(progress.done)} of {formatMB(progress.total)}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {downloading ? (
          <Button variant="outline" onClick={() => abortRef.current?.abort()}>
            Cancel Download
          </Button>
        ) : current ? (
          // owner requirement: already available → the button is disabled
          <Button variant="outline" disabled>
            <CheckCircle2 className="text-success" /> Available Offline
          </Button>
        ) : (
          <Button variant="outline" disabled={manifest === null} onClick={start}>
            <HardDriveDownload />
            {stale
              ? 'Update Offline Copy'
              : cleared
                ? 'Download Again'
                : 'Download for Offline Use'}
          </Button>
        )}
        {available && !downloading && (
          <Button variant="ghost" onClick={remove}>
            Remove Offline Data
          </Button>
        )}
      </div>

      {current && meta && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <WifiOff className="size-3.5" />
          {formatMB(meta.bytes)} ({meta.files.toLocaleString()} files) downloaded{' '}
          {new Date(meta.completedAt).toLocaleDateString()}
          {meta.persisted ? ' — protected from automatic cleanup' : ''}
        </p>
      )}
      {stale && (
        <p className="text-xs text-muted-foreground">
          The app has been updated since this copy was downloaded — refresh
          it to get the latest version offline.
        </p>
      )}

      {note && (
        <p className={note.kind === 'ok' ? 'text-xs text-success' : 'text-xs text-destructive'}>
          {note.text}
        </p>
      )}
    </section>
  )
}
