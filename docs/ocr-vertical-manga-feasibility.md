# Vertical Japanese and Manga OCR Feasibility

Date: 2026-08-09

Status: implemented for one user-cropped region; whole-page manga OCR remains out of scope

Implementation outcome: the app-owned low-level worker was required as
anticipated, but this wrapper's reliable `jpn_vert` path rotates an upright crop
counter-clockwise and recognizes the resulting rows with PSM 6. PSM 5 on the
upright crop produced poor text in the paired fixtures. Final production-preview
verification returned exact parser text for the original clean two-column
fixture and the supplied tightly cropped narration box; this small result does
not establish general manga accuracy.

## Executive conclusion

There are two materially different features hiding behind “vertical manga
OCR”:

1. **OCR one user-cropped vertical balloon or narration box.** This is
   feasible without replacing Tesseract. The lowest-risk experiment is an
   explicit Vertical mode that lazy-loads Tesseract's official `jpn_vert`
   model and keeps the existing crop-first workflow.
2. **OCR a whole manga page in one action.** The current implementation is
   not sufficient. A full page needs manga-aware text-region detection,
   per-region recognition, and Japanese manga reading-order logic. Changing
   only the recognition model or page-segmentation mode does not provide
   those pieces.

The provided example is favorable for a cropped-region MVP: most dialogue is
large, clean, dark print inside pale balloons or boxes. It is unfavorable for
one-shot page OCR: it contains multiple disconnected regions, vertical
columns, panel structure, screentone, artwork, and stylized sound effects.
Tesseract's page-level reading order and treatment of decorative text are
therefore at least as important as character recognition. This assessment is
based on the image's layout; the image was not added to the repository and no
copyrighted dialogue is reproduced here.

**Recommendation:** benchmark the incremental `jpn_vert` crop flow first.
Only add page-segmentation plumbing if the benchmark shows segmentation—not
recognition—is the limiting factor. Treat automatic whole-page manga OCR as a
separate product and architecture decision.

## What the current application actually does

The current path in [`src/lib/ocr/`](../src/lib/ocr/) has good foundations:
OCR is opt-in and lazy, the engine and models are self-hosted, recognition
runs in a worker, images are EXIF-corrected and capped at 2,000 px, and every
image can be cropped and rotated before recognition. The production Japanese
model is `tessdata_fast/jpn`; OCR then returns one string, and Japanese
post-processing removes all whitespace before handing it to the parser.

That last behavior is appropriate for a sentence screenshot, but it erases
line and region boundaries that would be useful for a whole manga page. The
upstream `OCRClient` does expose word/line text boxes, although this app's
minimal local declaration currently includes only `getText`. The official
[`OCRClient` source](https://github.com/robertknight/tesseract-wasm/blob/main/src/ocr-client.ts#L156-L234)
documents `getTextBoxes`, hOCR, and orientation in addition to plain text.
Boxes can preserve engine-detected regions, but they cannot recover regions
that page analysis missed or put them into manga reading order by themselves.

### The vertical Tesseract model exists

Tesseract officially publishes `jpn_vert.traineddata` in
[`tessdata_fast`](https://github.com/tesseract-ocr/tessdata_fast#example---jpn-and-japanese).
The repository says `jpn_vert` was trained on vertically rendered text, with
training images rotated so their long edge remains horizontal. It also says
the ordinary `jpn` configuration loads `jpn_vert` as a secondary language and
that this usually works in a normal Tesseract installation. The raw fast
models are approximately 2.36 MB for
[`jpn`](https://github.com/tesseract-ocr/tessdata_fast/blob/main/jpn.traineddata)
and 2.9 MB for
[`jpn_vert`](https://github.com/tesseract-ocr/tessdata_fast/blob/main/jpn_vert.traineddata)
before repository-side gzip/HTTP compression.

The automatic secondary-language behavior cannot be assumed to work in this
browser wrapper. `tesseract-wasm`'s
[`LoadModel`](https://github.com/robertknight/tesseract-wasm/blob/main/src/lib.cpp#L1191-L1224)
receives one model byte buffer and initializes it under a hard-coded language
name. It does not receive a tessdata directory containing a separately
addressable `jpn_vert` file. This is an inference from the wrapper source, not
a measured accuracy result; the robust experiment is to load `jpn_vert`
directly.

### Page segmentation is the important API gap

Tesseract defines:

- PSM 3: fully automatic page segmentation;
- PSM 5: one uniform block of vertically aligned text; and
- PSM 11: sparse text with no particular order.

These definitions come from Tesseract's official
[page-segmentation documentation](https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html#page-segmentation-method).
PSM 5 is a strong candidate for one tightly cropped balloon or narration box.
It is not a whole-page manga mode because the page is not one uniform text
block. PSM 3 or 11 might find more disconnected areas, but neither promises
manga panel/bubble order.

The checked-out `tesseract-wasm` 0.11.0 API has a non-obvious constraint:

- The worker-backed high-level
  [`OCRClient`](https://robertknight.github.io/tesseract-wasm/api/classes/OCRClient.html)
  does **not** expose `setVariable` or a PSM setter.
- The low-level synchronous
  [`OCREngine`](https://robertknight.github.io/tesseract-wasm/api/classes/OCREngine.html#setvariable)
  does expose `setVariable`.
- The native wrapper resets page segmentation to `PSM_AUTO` while loading
  each image in
  [`LoadImage`](https://github.com/robertknight/tesseract-wasm/blob/main/src/lib.cpp#L1265-L1282).
  Any custom call must therefore set `tessedit_pageseg_mode` **after**
  `loadImage` and before recognition.
- Tesseract itself confirms that
  [`SetVariable("tessedit_pageseg_mode", ...)`](https://github.com/tesseract-ocr/tesseract/blob/main/src/api/baseapi.cpp#L2928-L2948)
  changes the page-segmentation mode.

Therefore, changing a TypeScript declaration alone is not enough. Reliable
PSM 5 support requires either a small maintained fork/patch that proxies
`setVariable` through `OCRClient`, or an app-owned worker around the low-level
`OCREngine`. A wrapper swap to Tesseract.js is another option: its official
API supports
[`worker.setParameters`](https://github.com/naptha/tesseract.js/blob/master/docs/api.md#workersetparametersparams-jobid-promise),
including `tessedit_pageseg_mode`, and
[`recognize` rectangles](https://github.com/naptha/tesseract.js/blob/master/docs/api.md#workerrecognizeimage-options-output-jobid-promise).
It is still the same Tesseract engine, so the swap improves configuration
access rather than manga accuracy.

### Orientation and manual rotation

Automatic orientation is not a safe Japanese direction detector. The wrapper
documents its
[`getOrientation`](https://github.com/robertknight/tesseract-wasm/blob/main/src/lib.cpp#L1376-L1389)
method as a simplistic heuristic intended for non-uppercase Latin text and
likely to perform poorly on other scripts. An explicit Horizontal/Vertical
choice is more reliable and makes the download/behavior understandable.

The existing crop-and-rotate UI is still useful, but there are two different
rotations:

- correcting a photo that is physically sideways; and
- transforming an upright vertical Japanese line into the horizontal line
  shape seen by the recognizer.

Simply rotating upright vertical text and retaining the horizontal `jpn`
model also rotates every glyph, so it is not equivalent to using the vertical
model. A benchmark can test two constrained variants: upright crop +
`jpn_vert` under automatic/PSM 5 layout, and a deliberately rotated crop +
`jpn_vert` under a horizontal single-block layout. The rotation direction and
reading order must be pinned by fixtures, not guessed.

## Feasible options

| Option | Client-only/offline | Whole-page regions/order | Payload/complexity | Assessment |
| --- | --- | --- | --- | --- |
| `jpn_vert` with the current Tesseract worker | Yes | No; crop one region | One additional ~2.9 MB raw model, usually compressed in transit; small product change | **Best first experiment** |
| Custom low-level tesseract-wasm worker or small maintained fork | Yes | Still no | Adds PSM/variable plumbing and maintenance | Do only if the first experiment shows PSM 5 materially helps |
| Tesseract.js + `jpn_vert` | Yes | Still no | Easier parameter/rectangle API, heavier wrapper; same recognizer | Configuration convenience, not an accuracy upgrade |
| PaddleOCR.js / PP-OCR | Yes | Detection exists; manga order still custom | Detector + recognizer + ONNX/OpenCV runtime | Technically plausible but much heavier; benchmark against existing no-go gates |
| manga-ocr + a manga detector, run as a local companion | Offline, but not inside this SPA | Yes with a detector such as mokuro's stack | Python/PyTorch and hundreds of MB | Strong domain fit; good desktop preprocessing/import option |
| Google Cloud Vision or Azure Read | No | Returns located lines/words; manga order still needs validation | Backend/auth, upload, cost, CSP and fallback work | Optional accuracy experiment, not compatible with current privacy/offline promise |

### PaddleOCR in the browser

Paddle's official
[`PaddleOCR.js` browser SDK](https://www.paddleocr.ai/latest/en/version3.x/inference_deployment/cross_platform/browser.html)
runs detector and recognizer stages in a worker and supports WASM/WebGPU.
This makes it structurally closer to whole-page OCR than Tesseract's current
single-string path. It is not lightweight: the current official PP-OCRv6
small ONNX assets are about
[`9.88 MB` for detection](https://huggingface.co/PaddlePaddle/PP-OCRv6_small_det_onnx/tree/main)
plus
[`21.2 MB` for recognition](https://huggingface.co/PaddlePaddle/PP-OCRv6_small_rec_onnx/tree/main)
before JavaScript, ONNX Runtime, and geometry code. This reinforces the
existing conclusion in [`ocr-ppocrv3-feasibility.md`](ocr-ppocrv3-feasibility.md):
Paddle belongs behind explicit accuracy, byte, latency, memory, and browser
compatibility gates. Detection boxes also do not settle manga panel and
speech order.

### Manga-specific local tools

[`manga-ocr`](https://github.com/kha-white/manga-ocr#readme) is the strongest
domain-specific recognizer found. Its owner explicitly lists vertical and
horizontal text, furigana, text over artwork, varied fonts, low-quality
images, and multi-line speech bubbles as training targets. The trade-off is
fundamental: the supported implementation is Python/PyTorch, the first run
downloads about 400 MB, and the official
[`manga-ocr-base` model repository](https://huggingface.co/kha-white/manga-ocr-base/tree/main)
is 444 MB. The project also warns that its language-aware decoder can invent
plausible text when no text is present.

[`mokuro`](https://github.com/kha-white/mokuro#readme) combines a comic text
detector with manga-ocr, processes manga offline ahead of reading, and emits
OCR text plus region metadata for a browser reader. That architecture is a
credible alternative for users who want whole-volume quality: run a local
desktop/CLI companion, then paste or import selected text into nihongo-mono.
It is not a plausible dependency for this lightweight static SPA without a
large converted-model and browser-runtime project.

### Cloud OCR

Google Cloud Vision supports Japanese and mixed-language OCR through
`TEXT_DETECTION`/`DOCUMENT_TEXT_DETECTION` and returns bounding boxes for
phrases and words ([language support](https://docs.cloud.google.com/vision/docs/languages),
[OCR response](https://docs.cloud.google.com/vision/docs/ocr)). Azure Read
supports printed and handwritten Japanese, mixed languages, and line/word
locations and confidence
([Azure OCR overview](https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/overview-ocr),
[language support](https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/language-support)).
Neither official source found promises manga-specific vertical accuracy or
correct manga reading order, so both still require the same licensed paired
benchmark.

These services conflict with the current architecture in several ways:

- the page image leaves the device and OCR no longer works offline;
- a shared billed credential cannot safely live in a static SPA—Google's
  [API-key guidance](https://docs.cloud.google.com/docs/authentication/api-keys-best-practices)
  explicitly says not to put keys in client code and to proxy requests
  through a server;
- a backend/token broker or user-supplied credentials introduce new setup,
  abuse, quota, and support concerns; and
- each endpoint must be added to `connect-src` in `scripts/gen-csp.ts`, and
  the repository requires a useful offline fallback for new external
  providers.

Provider data-handling terms differ and need user-facing consent. Google's
[Vision data-usage FAQ](https://docs.cloud.google.com/vision/docs/data-usage)
says synchronous image content is processed in memory, not persisted, and
not used to train models. Azure's
[OCR privacy documentation](https://learn.microsoft.com/en-us/legal/cognitive-services/computer-vision/ocr-data-privacy-security)
says Read input and results may be encrypted and temporarily stored, then
deleted within 24 hours. AWS Textract is not a candidate because its official
[limits](https://docs.aws.amazon.com/textract/latest/dg/limits-document.html)
explicitly say vertical text is unsupported.

## Proposed research spike, not an implementation commitment

The first spike should answer the smallest useful question: **Can a user crop
one vertical speech region and receive parser-ready Japanese with acceptable
accuracy?**

Test these variants on identical regions:

1. current `jpn` + current automatic segmentation (baseline);
2. explicit `jpn_vert` + automatic segmentation, requiring no wrapper fork;
3. explicit `jpn_vert` + PSM 5 set after `loadImage` in a disposable custom
   worker; and
4. only if justified, the two manual 90-degree transforms with their reading
   order declared.

Use a versioned, legally usable corpus instead of committing the provided
page. Include clean balloons, rectangular narration boxes, multiple vertical
columns, small print, furigana, punctuation, text over artwork/screentone,
stylized sound effects, blur/perspective/glare, and a few horizontal regions.
For whole-page experiments, separately measure region recall and correct
region order; character error rate alone will hide a failed product.

Record:

- normalized character error rate and exact-region rate;
- deletions caused by furigana or layout analysis;
- region detection recall and manga reading-order accuracy;
- raw text/boxes before the current whitespace cleaner and parser-ready text
  after it;
- cold model bytes, first/warm scan time, peak worker memory, and failures on
  desktop Chromium, Android Chromium, and iOS Safari; and
- whether a cropped-region result fits the parser's 120-character product
  limit without awkward recovery.

Do not begin automatic detector integration until the owner chooses between
these products:

- **crop one balloon, then parse it**; or
- **scan a whole page, select/reorder regions, then parse one or more**.

That choice dominates the UI, model/runtime budget, test corpus, and the
meaning of “success.”
