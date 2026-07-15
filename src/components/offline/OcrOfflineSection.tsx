import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, HardDriveDownload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatMB, offlineSupported } from '@/lib/offline/offline'
import {
  enableOcrOffline,
  fetchOcrOfflineManifest,
  loadOcrOfflineMeta,
  ocrOfflineCacheIntact,
  removeOcrOffline,
  type OcrOfflineManifest,
  type OcrOfflineMeta,
} from '@/lib/ocr/offline'

export function OcrOfflineSection() {
  const supported = offlineSupported()
  const [manifest, setManifest] = useState<OcrOfflineManifest | null>(null)
  const [meta, setMeta] = useState<OcrOfflineMeta | null>(() => loadOcrOfflineMeta())
  const [intact, setIntact] = useState<boolean | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [note, setNote] = useState<{ error: boolean; text: string } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!supported) return
    let live = true
    void ocrOfflineCacheIntact().then((value) => live && setIntact(value))
    void fetchOcrOfflineManifest()
      .then((value) => live && setManifest(value))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [supported])

  if (!supported) return null
  const available = meta !== null && intact === true

  const download = async () => {
    if (!manifest || progress) return
    const controller = new AbortController()
    abortRef.current = controller
    setNote(null)
    setProgress({ done: 0, total: manifest.totalBytes })
    try {
      const result = await enableOcrOffline(
        manifest,
        (done, total) => setProgress({ done, total }),
        controller.signal,
      )
      setMeta(result)
      setIntact(true)
      setNote({
        error: false,
        text: 'OCR assets are cached. Download Offline Access above too for a cold offline restart.',
      })
    } catch (error) {
      setNote({
        error: !controller.signal.aborted,
        text: controller.signal.aborted
          ? 'Download cancelled.'
          : `The OCR pack did not finish — check your connection and try again. ${error instanceof Error ? error.message : ''}`,
      })
    } finally {
      abortRef.current = null
      setProgress(null)
    }
  }

  const remove = async () => {
    await removeOcrOffline()
    setMeta(null)
    setIntact(false)
    setNote({ error: false, text: 'Offline OCR data removed.' })
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">Image Scanning Offline Pack</h2>
      <p className="text-xs text-pretty text-muted-foreground">
        Keep PaddleOCR and both Tesseract fallback languages on this device.
        This keeps the OCR assets available without making the normal app download larger.
        Download Offline Access above as well if the app must open after a restart with no connection.
      </p>
      <p className="text-xs text-muted-foreground">
        One-time download:{' '}
        <span className="font-medium text-foreground">
          {manifest ? `about ${formatMB(manifest.totalBytes)}` : 'about 34 MB'}
        </span>
        . Files already cached by a scan are reused.
      </p>

      {progress && (
        <div className="space-y-1">
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full origin-left rounded-full bg-primary transition-transform duration-100 ease-snap"
              style={{ transform: `scaleX(${progress.done / Math.max(1, progress.total)})` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Downloading… {formatMB(progress.done)} of {formatMB(progress.total)}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {progress ? (
          <Button variant="outline" onClick={() => abortRef.current?.abort()}>
            Cancel Download
          </Button>
        ) : available ? (
          <>
            <Button variant="outline" disabled>
              <CheckCircle2 className="text-success" /> Available Offline
            </Button>
            <Button variant="ghost" onClick={() => void remove()}>
              Remove OCR Data
            </Button>
          </>
        ) : (
          <Button variant="outline" disabled={!manifest} onClick={() => void download()}>
            <HardDriveDownload /> Download OCR Pack
          </Button>
        )}
      </div>

      {note && (
        <p className={note.error ? 'text-xs text-destructive' : 'text-xs text-success'}>
          {note.text}
        </p>
      )}
    </section>
  )
}
