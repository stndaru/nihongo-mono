/**
 * The parser's "Scan Image" surface — lazy-loaded (with tesseract-wasm and
 * the whole OCR pipeline) only after the user opts in. Three ways in: paste
 * an image (button or Ctrl+V anywhere while open), upload a file, or a live
 * camera viewfinder (falling back to the native camera app, then to a
 * deliberate disabled state). The recognized text is cleaned for the active
 * tab and handed to the route, which auto-breaks-down when it fits the cap.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent as ReactDragEvent,
} from 'react'
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ChevronDown,
  ClipboardPaste,
  Crop as CropIcon,
  ImageUp,
  ScanText,
  TextCursorInput,
} from 'lucide-react'
import { ReactCrop, type PercentCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CopyButton } from '@/components/ui/copy-button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MAX_EN_SENTENCE_LEN, MAX_SENTENCE_LEN } from '@/lib/data/parse-sentence'
import { loadOcr, ocrReady } from '@/lib/ocr/engine'
import { cleanOcrEnglish, cleanOcrJapanese, type OcrOutcome } from '@/lib/ocr/postprocess'
import { cropToBlob, toImageData } from '@/lib/ocr/preprocess'
import type { OcrLang } from '@/lib/ocr/types'
import { cn } from '@/lib/utils'

type OcrStatus =
  | { phase: 'idle' }
  | { phase: 'engine' } // wasm+worker init — no byte progress (the worker fetches its own wasm)
  | { phase: 'model'; done: number; total: number }
  | { phase: 'recognizing'; previewUrl: string; progress: number }
  | { phase: 'done'; chars: number } // success — shown in the drop zone, then auto-resets
  | { phase: 'empty'; previewUrl: string }
  | { phase: 'over-limit'; previewUrl: string; length: number }
  | { phase: 'error'; kind: 'decode' | 'engine' | 'recognize' }

/**
 * How "photo from device" opens: a live in-app viewfinder when getUserMedia
 * exists, the native camera app via a capture input on touch devices
 * without it, else a deliberate disabled state (insecure context, no API).
 */
const CAMERA: 'live' | 'capture' | 'none' =
  typeof navigator !== 'undefined' &&
  typeof navigator.mediaDevices?.getUserMedia === 'function'
    ? 'live'
    : typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
      ? 'capture'
      : 'none'

/** clipboard.read() is Chromium/Safari — Firefox pastes via Ctrl+V only */
const CAN_READ_CLIPBOARD =
  typeof navigator !== 'undefined' && typeof navigator.clipboard?.read === 'function'

/**
 * A denied camera permission is remembered for the session: re-requesting
 * would hit a browser-suppressed prompt, so reopening shows the denied
 * state (with its escape hatches) instantly instead of hanging.
 */
let cameraDeniedThisSession = false

/** sticky "crop before scanning" preference — '0' skips the crop dialog */
const CROP_KEY = 'nihongo-mono:parser-ocr-crop'

const MB = (bytes: number) => (bytes / 1048576).toFixed(1)

export default function OcrPanel({
  dir,
  visible,
  onText,
  onUseRaw,
  onClose,
}: {
  dir: 'ja' | 'en'
  /**
   * The panel stays mounted after its first open (a view toggle must not
   * drop the scanned image or an in-flight recognition) — false while the
   * text view is showing: ignore pastes, keep the camera closed.
   */
  visible: boolean
  /** receives cleaned text; returns what the route did with it */
  onText: (clean: string) => OcrOutcome
  /** "Use as Input": the RAW text goes to the textarea for hand-editing */
  onUseRaw: (raw: string) => void
  onClose: () => void
}) {
  const lang: OcrLang = dir === 'en' ? 'eng' : 'jpn'
  const maxLen = dir === 'en' ? MAX_EN_SENTENCE_LEN : MAX_SENTENCE_LEN
  const langLabel = dir === 'en' ? 'English' : 'Japanese'

  const [status, setStatus] = useState<OcrStatus>({ phase: 'idle' })
  const [scanning, setScanning] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [pasteHint, setPasteHint] = useState<string | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  // the single image slot: each scan overwrites it (blob + image + the raw
  // OCR output before filtering), reviewable via the accordion below — the
  // blob stays so the stored scan can be re-cropped
  const [lastScan, setLastScan] = useState<{ blob: Blob; url: string; raw: string } | null>(
    null,
  )
  const [reviewOpen, setReviewOpen] = useState(false)
  // every acquired image stops here first: the crop dialog lets the user
  // cut away distractions before the OCR sees it (owner requirement).
  // `rescan` marks a re-crop of the stored scan — it overwrites the slot.
  const [pending, setPending] = useState<{ blob: Blob; url: string; rescan: boolean } | null>(
    null,
  )
  // sticky preference: skip the crop dialog entirely when unchecked
  const [cropFirst, setCropFirst] = useState(() => localStorage.getItem(CROP_KEY) !== '0')
  const toggleCropFirst = () =>
    setCropFirst((v) => {
      localStorage.setItem(CROP_KEY, v ? '0' : '1')
      return !v
    })

  const runRef = useRef(0)
  const busyRef = useRef(false)
  const previewUrlRef = useRef<string | null>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const captureRef = useRef<HTMLInputElement>(null)

  const dropPreview = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = null
  }

  // eager warm-up on mount and tab switch (mirrors Smart Parsing's
  // enableSmart): the engine + this tab's model download right away so the
  // first scan doesn't stack waits
  useEffect(() => {
    let live = true
    if (!ocrReady()) setStatus({ phase: 'engine' })
    loadOcr(lang, (done, total) => {
      if (live && !busyRef.current) setStatus({ phase: 'model', done, total })
    })
      .then(() => {
        if (!live) return
        setStatus((s) => (s.phase === 'engine' || s.phase === 'model' ? { phase: 'idle' } : s))
      })
      .catch(() => {
        if (live) setStatus({ phase: 'error', kind: 'engine' })
      })
    return () => {
      live = false
    }
  }, [lang])

  // stale-result guard + object-URL cleanup when the panel unmounts
  useEffect(
    () => () => {
      runRef.current += 1
      dropPreview()
    },
    [],
  )

  const scan = useCallback(
    async (source: Blob) => {
      if (busyRef.current) return
      busyRef.current = true
      setScanning(true)
      const run = ++runRef.current
      const alive = () => runRef.current === run
      dropPreview() // one image at a time — the new scan overwrites the slot
      setLastScan(null)
      const previewUrl = URL.createObjectURL(source)
      previewUrlRef.current = previewUrl
      try {
        const client = await loadOcr(lang, (done, total) => {
          if (alive()) setStatus({ phase: 'model', done, total })
        })
        let image: ImageData
        try {
          image = await toImageData(source)
        } catch {
          if (alive()) setStatus({ phase: 'error', kind: 'decode' })
          return
        }
        if (!alive()) return
        setStatus({ phase: 'recognizing', previewUrl, progress: 0 })
        await client.loadImage(image)
        const raw = await client.getText((progress) => {
          if (alive()) {
            setStatus((s) => (s.phase === 'recognizing' ? { ...s, progress } : s))
          }
        })
        if (!alive()) return // panel unmounted mid-recognition — drop the result
        setLastScan({ blob: source, url: previewUrl, raw })
        const clean = dir === 'en' ? cleanOcrEnglish(raw) : cleanOcrJapanese(raw)
        const outcome = onText(clean)
        setStatus(
          outcome === 'commit'
            ? { phase: 'done', chars: clean.length }
            : outcome === 'empty'
              ? { phase: 'empty', previewUrl }
              : { phase: 'over-limit', previewUrl, length: clean.length },
        )
      } catch {
        if (alive()) {
          setStatus({ phase: 'error', kind: ocrReady() ? 'recognize' : 'engine' })
        }
      } finally {
        busyRef.current = false
        if (alive()) setScanning(false)
      }
    },
    [dir, lang, onText],
  )

  /**
   * Every input path funnels here. With crop-first on (or an explicit
   * re-crop of the stored scan) the image parks in `pending` and the crop
   * dialog opens; with it off the scan starts straight away. One image at
   * a time — a newer acquisition replaces the parked one; its object URL
   * is revoked by the effect below.
   */
  const beginCrop = useCallback(
    (blob: Blob, opts?: { rescan?: boolean }) => {
      if (busyRef.current) return
      const rescan = opts?.rescan ?? false
      if (!rescan && !cropFirst) {
        void scan(blob)
        return
      }
      setPending({ blob, url: URL.createObjectURL(blob), rescan })
    },
    [cropFirst, scan],
  )

  // revoke each parked image's URL when it's replaced or on unmount
  useEffect(() => {
    const url = pending?.url
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [pending])

  const confirmCrop = async (crop: PercentCrop) => {
    if (!pending) return
    const source = pending.blob
    setPending(null)
    let cropped: Blob
    try {
      cropped = await cropToBlob(source, crop)
    } catch {
      setStatus({ phase: 'error', kind: 'decode' })
      return
    }
    void scan(cropped)
  }

  // Ctrl+V works anywhere on the page while the scan view is showing — the
  // one paste path every browser supports. Not while hidden: pasting into
  // the textarea must never secretly start a scan.
  useEffect(() => {
    if (!visible) return
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith('image/'),
      )
      const file = item?.getAsFile()
      if (!file) return
      e.preventDefault()
      beginCrop(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [beginCrop, visible])

  // flipping to the text view closes the viewfinder (its stream must not
  // keep the camera light on behind a hidden panel)
  useEffect(() => {
    if (!visible) setCameraOpen(false)
  }, [visible])

  // the transient "press Ctrl+V instead" hint after a denied clipboard read
  useEffect(() => {
    if (!pasteHint) return
    const timer = setTimeout(() => setPasteHint(null), 5000)
    return () => clearTimeout(timer)
  }, [pasteHint])

  // the success state lives in the drop zone for a beat, then it's ready
  // for the next image
  useEffect(() => {
    if (status.phase !== 'done') return
    const timer = setTimeout(() => {
      setStatus((s) => (s.phase === 'done' ? { phase: 'idle' } : s))
    }, 2500)
    return () => clearTimeout(timer)
  }, [status.phase])

  const pasteFromClipboard = async () => {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'))
        if (type) {
          beginCrop(await item.getType(type))
          return
        }
      }
      setPasteHint('No image on the clipboard — copy one first.')
    } catch {
      setPasteHint('Clipboard access was denied — press Ctrl+V instead.')
    }
  }

  const onFilePicked = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // re-picking the same file must re-fire
    if (file) beginCrop(file)
  }

  const onDrop = (e: ReactDragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'))
    if (file) beginCrop(file)
  }

  const openCamera = () => {
    if (CAMERA === 'live') setCameraOpen(true)
    else if (CAMERA === 'capture') captureRef.current?.click()
  }

  const preview = 'previewUrl' in status ? status.previewUrl : null

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className="space-y-3 rounded-lg border p-3"
    >
      {/* on narrow screens the action pair becomes two equal columns under
          Back to Text — free-wrapping left ragged holes at 390 px */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          title="back to typing (the scanned image is kept)"
          className="text-muted-foreground"
        >
          <ArrowLeft /> Back to Text
        </Button>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={pasteFromClipboard}
            disabled={scanning || !CAN_READ_CLIPBOARD}
            title={
              CAN_READ_CLIPBOARD
                ? 'read an image from the clipboard'
                : "this browser doesn't allow reading images from a script — press Ctrl+V instead"
            }
          >
            <ClipboardPaste /> Paste Image
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={openCamera}
            disabled={scanning || CAMERA === 'none'}
            title={
              CAMERA !== 'none'
                ? 'take a photo of the text'
                : typeof window !== 'undefined' && !window.isSecureContext
                  ? 'the camera needs a secure (https) connection'
                  : 'no camera access available in this browser'
            }
          >
            <Camera /> Open Camera
          </Button>
        </div>
      </div>

      {/* the drop zone is the primary affordance — big target, click to
          browse, highlighted while a drag hovers anywhere over the panel;
          it doubles as the success surface when a scan lands */}
      <button
        type="button"
        onClick={() => uploadRef.current?.click()}
        disabled={scanning}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-9 text-center transition-colors duration-100',
          status.phase === 'done'
            ? 'border-success/50 bg-success/5'
            : dragOver
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-muted-foreground/50 hover:bg-muted/30',
          scanning && 'opacity-50',
        )}
      >
        {status.phase === 'done' ? (
          <span className="flex flex-col items-center gap-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-150 motion-safe:ease-snap">
            <CheckCircle2 className="size-8 text-success" />
            <span className="text-sm font-medium">
              Scanned — {status.chars} characters added
            </span>
            <span className="text-xs text-muted-foreground">
              breaking the sentence down below
            </span>
          </span>
        ) : (
          <>
            <ImageUp
              className={cn(
                'size-8 transition-colors duration-100',
                dragOver ? 'text-primary' : 'text-muted-foreground/60',
              )}
            />
            <span className="text-sm font-medium">
              {dragOver ? 'Drop to scan' : 'Drop an image here'}
            </span>
            <span className="text-xs text-pretty text-muted-foreground">
              click to browse · Ctrl+V pastes · {langLabel} text only
            </span>
          </>
        )}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <p className="text-xs text-pretty text-muted-foreground">
          Best on clear printed text. Furigana can confuse detection — verify
          in Review last scan.
        </p>
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
          <Checkbox checked={cropFirst} onCheckedChange={toggleCropFirst} />
          Crop before scanning
        </label>
      </div>

      {pasteHint && <p className="text-xs text-muted-foreground">{pasteHint}</p>}

      {status.phase === 'engine' && (
        <StatusRow>
          <IndeterminateBar />
          Preparing the recognizer… (one-time, cached afterwards)
        </StatusRow>
      )}
      {status.phase === 'model' && (
        <StatusRow>
          {status.total > 0 ? <ProgressBar value={status.done / status.total} /> : <IndeterminateBar />}
          Downloading the {langLabel} model…
          {status.total > 0 && ` ${MB(status.done)}/${MB(status.total)} MB`} (one-time, cached
          afterwards)
        </StatusRow>
      )}
      {status.phase === 'recognizing' && (
        <StatusRow thumb={preview}>
          <ProgressBar value={status.progress / 100} />
          Reading text… {status.progress}%
        </StatusRow>
      )}
      {status.phase === 'empty' && (
        <StatusRow thumb={preview}>No {langLabel} text was found in the image.</StatusRow>
      )}
      {status.phase === 'over-limit' && (
        <StatusRow thumb={preview}>
          <span className="text-destructive">
            Found {status.length} characters — over the {maxLen} limit. Go
            Back to Text to trim it, then Break Down.
          </span>
        </StatusRow>
      )}
      {status.phase === 'error' && (
        <p className="text-xs text-destructive">
          {status.kind === 'engine' &&
            'The recognizer couldn’t be downloaded — check your connection and try again.'}
          {status.kind === 'decode' &&
            'This image format couldn’t be read — try a JPEG or PNG (iPhone HEIC photos may need converting).'}
          {status.kind === 'recognize' && 'Text recognition failed — try another image.'}
        </p>
      )}

      {lastScan && (
        <div className="border-t pt-2">
          <button
            type="button"
            onClick={() => setReviewOpen((o) => !o)}
            aria-expanded={reviewOpen}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors duration-100 hover:text-foreground"
          >
            <ChevronDown
              className={cn('size-3.5 transition-transform duration-100', reviewOpen && 'rotate-180')}
            />
            Review last scan
          </button>
          {reviewOpen && (
            <div className="mt-2 space-y-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-100">
              <img
                src={lastScan.url}
                alt="The scanned image"
                className="max-h-56 w-auto max-w-full rounded-md border object-contain"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                disabled={scanning}
                onClick={() => beginCrop(lastScan.blob, { rescan: true })}
                title="crop this image further and scan it again"
              >
                <CropIcon className="size-3.5" /> Crop &amp; Rescan
              </Button>
              <div>
                <div className="flex flex-wrap items-center gap-1">
                  <p className="text-xs text-muted-foreground">
                    Raw detected text (before filtering):
                  </p>
                  {lastScan.raw.trim() !== '' && (
                    <>
                      <CopyButton text={lastScan.raw} label="Copy the raw detected text" />
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-auto h-6 px-2 text-xs"
                        onClick={() => onUseRaw(lastScan.raw)}
                        title="put this raw text into the input box for editing"
                      >
                        <TextCursorInput className="size-3.5" /> Use as Input
                      </Button>
                    </>
                  )}
                </div>
                {lastScan.raw.trim() ? (
                  <p
                    lang={dir === 'en' ? 'en' : 'ja'}
                    className="mt-2 max-h-40 overflow-y-auto rounded-md border bg-muted/30 p-2 text-sm break-words whitespace-pre-wrap"
                  >
                    {lastScan.raw}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">(nothing was detected)</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFilePicked}
      />
      {CAMERA === 'capture' && (
        <input
          ref={captureRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onFilePicked}
        />
      )}

      {CAMERA === 'live' && (
        <OcrCameraDialog
          open={cameraOpen}
          onClose={() => setCameraOpen(false)}
          onCapture={beginCrop}
          onUploadInstead={() => {
            setCameraOpen(false)
            uploadRef.current?.click()
          }}
        />
      )}

      <OcrCropDialog
        pending={pending}
        onCancel={() => setPending(null)}
        onConfirm={confirmCrop}
        onDecodeError={() => {
          setPending(null)
          setStatus({ phase: 'error', kind: 'decode' })
        }}
      />
    </div>
  )
}

function StatusRow({ thumb, children }: { thumb?: string | null; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {thumb && (
        <img
          src={thumb}
          alt=""
          className="size-12 shrink-0 rounded-md border object-cover motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-100"
        />
      )}
      <div className="min-w-0 space-y-1">{children}</div>
    </div>
  )
}

/** GPU-only progress: the fill animates transform, never width. */
function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1 w-48 max-w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full origin-left rounded-full bg-primary transition-transform duration-100 ease-snap"
        style={{ transform: `scaleX(${Math.min(1, Math.max(0, value))})` }}
      />
    </div>
  )
}

function IndeterminateBar() {
  return <div className="h-1 w-48 max-w-full animate-pulse rounded-full bg-muted-foreground/30" />
}

const FULL_CROP: PercentCrop = { unit: '%', x: 0, y: 0, width: 100, height: 100 }

/**
 * The interstitial between acquiring an image and scanning it: crop away
 * distractions first. The selection defaults to the whole image, so
 * "just scan it" is a single click; a near-full selection skips the
 * re-encode entirely (see cropToBlob).
 */
function OcrCropDialog({
  pending,
  onCancel,
  onConfirm,
  onDecodeError,
}: {
  pending: { blob: Blob; url: string; rescan: boolean } | null
  onCancel: () => void
  onConfirm: (crop: PercentCrop) => void
  onDecodeError: () => void
}) {
  const [crop, setCrop] = useState<PercentCrop>(FULL_CROP)
  // fresh image → fresh full-frame selection
  useEffect(() => {
    setCrop(FULL_CROP)
  }, [pending?.url])

  return (
    <Dialog open={pending !== null} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CropIcon className="size-4 text-primary" /> Crop Before Scanning
          </DialogTitle>
          <DialogDescription>
            Drag the corners to keep just the text — cropping away clutter
            improves recognition.
          </DialogDescription>
        </DialogHeader>
        {pending && (
          <div className="flex justify-center">
            <ReactCrop
              crop={crop}
              onChange={(_, percent) => setCrop(percent)}
              keepSelection
            >
              <img
                src={pending.url}
                alt="The image about to be scanned"
                className="max-h-[55vh] w-auto max-w-full rounded-md"
                onError={onDecodeError}
              />
            </ReactCrop>
          </div>
        )}
        {pending?.rescan && (
          <p className="text-xs text-muted-foreground">
            Replaces the stored scan — the uncropped original won&apos;t be
            kept.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(crop)}>
            <ScanText /> Scan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type CameraPhase = 'starting' | 'streaming' | 'denied' | 'no-device' | 'failed'

function OcrCameraDialog({
  open,
  onClose,
  onCapture,
  onUploadInstead,
}: {
  open: boolean
  onClose: () => void
  onCapture: (blob: Blob) => void
  onUploadInstead: () => void
}) {
  const [phase, setPhase] = useState<CameraPhase>('starting')
  const [attempt, setAttempt] = useState(0)
  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!open) return
    if (cameraDeniedThisSession) {
      setPhase('denied')
      return
    }
    let live = true
    setPhase('starting')
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (!live) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        setPhase('streaming')
      })
      .catch((err: unknown) => {
        if (!live) return
        const name = err instanceof DOMException ? err.name : ''
        if (name === 'NotAllowedError') {
          cameraDeniedThisSession = true
          setPhase('denied')
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          setPhase('no-device')
        } else {
          setPhase('failed')
        }
      })
    return () => {
      live = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [open, attempt])

  useEffect(() => {
    if (phase === 'streaming' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [phase])

  const capture = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (blob) {
          onClose()
          onCapture(blob)
        }
      },
      'image/jpeg',
      0.92,
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Take a Photo</DialogTitle>
          <DialogDescription>
            Fill the frame with the text, then capture. The photo is scanned on
            this device and never uploaded.
          </DialogDescription>
        </DialogHeader>

        {phase === 'starting' && (
          <p className="text-sm text-muted-foreground">Waiting for camera permission…</p>
        )}
        {phase === 'streaming' && (
          // playsInline is mandatory on iOS — without it the stream
          // fullscreens. NO fixed aspect / object-cover: the preview must
          // show the sensor's full frame — exactly what Capture grabs — or a
          // portrait phone photo would be cropped to a misleading 16:9 strip
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="max-h-[60vh] w-full rounded-md border bg-black object-contain"
          />
        )}
        {phase === 'denied' && (
          <p className="text-sm text-destructive">
            Camera permission was denied — allow it in your browser&apos;s site
            settings, or upload a photo instead.
          </p>
        )}
        {phase === 'no-device' && (
          <p className="text-sm text-muted-foreground">
            No camera was found on this device.
          </p>
        )}
        {phase === 'failed' && (
          <p className="text-sm text-destructive">The camera couldn&apos;t be started.</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {phase === 'streaming' && <Button onClick={capture}>Capture</Button>}
          {(phase === 'denied' || phase === 'no-device') && (
            <Button onClick={onUploadInstead}>Upload Instead</Button>
          )}
          {phase === 'failed' && (
            <Button onClick={() => setAttempt((a) => a + 1)}>Try Again</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
