# PaddleOCR browser migration feasibility

Research date: 2026-07-15
Scope: replace the sentence parser's browser-side `tesseract-wasm` OCR while preserving Japanese and English scanning, privacy, static hosting, broad modern-browser support, responsiveness, offline use, and low network transfer.

## Decision summary

**Recommendation: do not replace Tesseract outright yet. Build a time-boxed PaddleOCR.js spike behind the existing OCR boundary and keep Tesseract until an app-specific benchmark passes.**

PaddleOCR now has an official browser SDK, so the migration is technically feasible. It is also a credible accuracy candidate: PP-OCRv5 officially supports Japanese and English, detects text regions before recognizing them, and Paddle reports substantially better Japanese/vertical results than its own prior generation. However, there is no official PaddleOCR.js-versus-Tesseract benchmark for this app's inputs, and the Japanese-capable Paddle browser payload is not light relative to the current implementation.

With the implemented self-hosted pack, a PP-OCRv5 worker cold start is **28,063,664 bytes (26.8 MiB)**, versus approximately **2.27 MB** for the prior Japanese Tesseract worker/model path. The Paddle path is therefore roughly **12× the prior compressed first-use transfer**, even though both remain fully lazy and add zero OCR bytes to a user who never opts in.

The small PP-OCRv6-tiny downloads do not safely solve this. Paddle's current PP-OCRv6 documentation says tiny excludes Japanese, while a table on the same page reports a Japanese score for tiny. The JavaScript SDK maps `lang: "japan", ocrVersion: "PP-OCRv6"` to **small**, not tiny. Until Paddle clarifies the contradiction and the app validates it, tiny cannot be treated as a capability-preserving Japanese configuration.

## Current app contract (verified in this repository)

This app does **not** use Tesseract.js. It uses the smaller [`tesseract-wasm`](../../package.json) wrapper around Tesseract:

- OCR code is lazy-loaded only after explicit opt-in ([parser route](../../src/routes/parser.tsx), [OCR engine](../../src/lib/ocr/engine.ts)).
- Recognition runs in a Web Worker; the route destroys the worker on unmount while retaining already-fetched model buffers.
- Japanese and English have separate committed, pre-gzipped `tessdata_fast` models, fetched with byte progress and swapped into one warm client ([model loader](../../src/lib/ocr/fetch-model.ts)).
- Images never leave the browser. Paste, file, camera, crop, manual quarter-turn rotation, EXIF correction, and a 2,000 px longest-side cap happen before recognition ([panel](../../src/components/parser/OcrPanel.tsx), [preprocessing](../../src/lib/ocr/preprocess.ts)).
- The raw scan remains reviewable; cleaned text is handed to the existing Japanese/English parser. Japanese cleanup removes whitespace and Latin page noise; English cleanup collapses layout whitespace ([postprocessing](../../src/lib/ocr/postprocess.ts)).
- Engine/model files are same-origin and included in the opt-in offline manifest. The production CSP already permits same-origin workers and WebAssembly compilation ([CSP generator](../../scripts/gen-csp.ts), [offline manifest](../../scripts/gen-offline-manifest.ts)).

Measured repository assets:

| Current first-use path | Raw bytes | Gzip bytes (level 9, measurement) |
|---|---:|---:|
| SIMD Tesseract WASM | 1,839,004 | 730,312 |
| Worker JavaScript | 93,353 | 23,610 |
| Japanese trained data (already `.gz`) | 1,521,392 | 1,516,252 |
| **Japanese total** | **3,453,749** | **2,270,174** |
| English trained data (already `.gz`) | 1,961,173 | 1,957,844 |
| **English total** | **3,893,530** | **2,711,766** |

Only one of the SIMD/fallback WASM binaries is fetched at runtime. The full opt-in offline pack includes both binaries and both language models, so its disk cost is higher than a normal first scan.

## What “PaddleOCR in a browser” means now

### Current official route: PaddleOCR.js, not legacy Paddle.js

**Verified fact.** PaddleOCR 3.5 released the official browser SDK in April 2026. The package is `@paddleocr/paddleocr-js`; version 0.4.2 is published from the PaddleOCR repository and depends on ONNX Runtime Web and OpenCV.js. It runs detection and recognition on the client and offers a dedicated worker mode. ([PaddleOCR 3.5 release](https://github.com/PaddlePaddle/PaddleOCR/releases/tag/v3.5.0), [browser documentation](https://www.paddleocr.ai/latest/en/version3.x/inference_deployment/cross_platform/browser.html), [SDK manifest](https://github.com/PaddlePaddle/PaddleOCR/blob/main/paddleocr-js/packages/core/package.json))

**Verified fact.** The older `PaddlePaddle/Paddle.js` repository advertised WebGL, WebGPU, WASM, and an OCR package, but its latest listed GitHub release is from September 2021. It is not the current PaddleOCR browser deployment documented by PaddleOCR 3.5. ([legacy repository and browser coverage](https://github.com/PaddlePaddle/Paddle.js), [legacy releases](https://github.com/PaddlePaddle/Paddle.js/releases))

**Conclusion.** A new implementation should evaluate official PaddleOCR.js. Basing a refactor on the legacy Paddle.js OCR package would create a second, older deployment path with weaker evidence for current Japanese models.

### Japanese, English, and text layout

**Verified fact.** PP-OCRv5's general recognition model supports Simplified Chinese, Pinyin, Traditional Chinese, English, and Japanese in one model. Paddle's internal table reports PP-OCRv5-mobile scores of 0.727 for Japanese detection and 0.7577 for Japanese recognition; it also reports 0.8089 for vertical-text recognition. These are Paddle-internal evaluation sets, not this app's acceptance results. ([PP-OCRv5 description and tables](https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/algorithm/PP-OCRv5/PP-OCRv5.md))

**Verified fact.** PaddleOCR.js accepts `lang: "japan"` and maps Japanese, English, Simplified Chinese, and Traditional Chinese PP-OCRv5 requests to the same PP-OCRv5 mobile detector/recognizer. A JA/EN tab switch therefore need not fetch a second model. ([SDK language/model resolver](https://github.com/PaddlePaddle/PaddleOCR/blob/main/paddleocr-js/packages/core/src/pipelines/ocr/shared.ts))

**Verified fact.** PaddleOCR.js returns recognized lines with polygons, text, and confidence, plus detection/recognition timings. It can accept `Blob`, `ImageBitmap`, `ImageData`, canvas, image elements, or OpenCV matrices. ([prediction API](https://www.paddleocr.ai/latest/en/version3.x/inference_deployment/cross_platform/browser.html#prediction))

**Verified limitation.** The browser SDK currently ignores and warns about `DocPreprocessor` and `TextLineOrientation`. It does not provide the full Python pipeline's page-orientation classifier, unwarping, text-line orientation stage, PP-Structure layout analysis, tables, formulas, or PDF/document hierarchy. ([SDK configuration implementation](https://github.com/PaddlePaddle/PaddleOCR/blob/main/paddleocr-js/packages/core/src/pipelines/ocr/config.ts), [native general OCR pipeline](https://www.paddleocr.ai/latest/en/version3.x/pipeline_usage/OCR.html))

**Inference for this app.** The current crop, EXIF correction, 90-degree rotate control, image-size cap, raw-result review, and language cleaners should remain outside the engine adapter. Paddle's detector may improve cluttered/multi-line images and return useful confidence/polygons, but the line order and joining policy must be tested on horizontal and vertical Japanese. Paddle's published scores do not establish that small furigana will be read correctly; the existing furigana failure corpus must remain an explicit acceptance category.

### Browser and device coverage

**Verified fact.** PaddleOCR.js exposes `webgpu`, `wasm`, and `auto`. `auto` attempts WebGPU and then WASM; it does not select WebGL or WebNN. ([runtime implementation](https://github.com/PaddlePaddle/PaddleOCR/blob/main/paddleocr-js/packages/core/src/runtime/ort.ts))

**Verified fact.** ONNX Runtime's compatibility table lists its WASM CPU provider for current Chrome/Edge desktop and Android, Chromium on iOS, Safari desktop/iOS, and Firefox desktop. Its WebGPU support is much narrower (principally Chromium), while WebGL is in maintenance mode and is not selected by PaddleOCR.js. ([ORT Web compatibility table](https://onnxruntime.ai/docs/get-started/with-javascript/web.html), [ORT WebGPU guidance](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html))

**Verified fact.** PaddleOCR.js worker mode moves OpenCV, model loading, detection, and recognition into a module worker. Its host application must support emitted module workers and configure runtime asset paths. ([worker documentation](https://github.com/PaddlePaddle/PaddleOCR/blob/main/paddleocr-js/packages/core/README.md#worker-mode), [SDK architecture](https://github.com/PaddlePaddle/PaddleOCR/blob/main/paddleocr-js/docs/architecture.md))

**Verified fact.** ONNX Runtime uses multiple WASM threads only when WebAssembly threading is available and the page is cross-origin isolated. Otherwise it falls back to one thread. Its proxy-worker mode has CSP limitations, but PaddleOCR.js worker mode disables that nested proxy and uses its own worker. ([ORT environment flags](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html))

**Conclusion.** “Runs in a modern browser” is supportable through the WASM fallback. “Fast on every device running a modern browser” is not. Low-memory phones, iOS Safari, Firefox, and browsers without cross-origin isolation will use a large CPU/WASM path and need real latency and memory tests. A deterministic broad-support baseline would be `worker: true`, same-origin assets, and WASM; `auto`/WebGPU can be an evidence-based enhancement after it is shown to work for both detector and recognizer.

## Network, caching, offline, and static hosting

### Measured published assets

The following are measurements made on 2026-07-15 against exact assets referenced by the official 0.4.2 source. They are measurements, not vendor promises. Model URLs come from the [SDK model registry](https://github.com/PaddlePaddle/PaddleOCR/blob/main/paddleocr-js/packages/core/src/resources/model-asset.ts); the SDK package version and dependencies come from its [manifest](https://github.com/PaddlePaddle/PaddleOCR/blob/main/paddleocr-js/packages/core/package.json).

| PaddleOCR.js PP-OCRv5 worker path | Raw bytes | Gzip bytes (level 9, measurement) |
|---|---:|---:|
| PP-OCRv5 mobile detector tar | 4,843,520 | 4,541,602 |
| PP-OCRv5 mobile recognizer tar | 16,701,440 | 14,147,785 |
| Published worker bundle (OpenCV/ORT orchestration included) | 11,341,486 | 3,588,876 |
| ORT `ort-wasm-simd-threaded.jsep.wasm` referenced by that worker | 25,014,754 | 5,769,708 |
| ORT JSEP loader module | 46,595 | 15,693 |
| **Implemented first-use total** | **57,947,795** | **28,063,664** |

The official model server returned the tars without `Content-Encoding`, so using the default cross-origin URLs costs the full 21,544,960 model bytes before runtime. The SDK requires the fetched body to parse as an uncompressed ustar archive and does not accept a `.tar.gz` payload; normal HTTP `Content-Encoding: gzip` is still possible because the browser transparently decodes it before JavaScript receives the tar. ([archive requirements](https://www.paddleocr.ai/latest/en/version3.x/inference_deployment/cross_platform/browser.html#custom-model-archive-format-and-validation))

The npm package also contains ONNX Runtime's smaller non-JSEP WASM, but the published Paddle worker bundle references the larger JSEP file because it supports WebGPU. Counting the 11.2 MB non-JSEP file for this package's worker cold path would understate the shipped runtime.

### PP-OCRv6 size shortcut is not established for Japanese

Measured built-in ONNX tar totals are 31,211,520 raw bytes for PP-OCRv6-small and 6,318,080 for PP-OCRv6-tiny. The tiny pair looks attractive, but Paddle's PP-OCRv6 introduction says medium/small support 50 languages including Japanese while “tiny supports 49, excluding Japanese.” The same document nevertheless publishes Japanese detector/recognizer numbers for tiny, so the official page is internally inconsistent. ([PP-OCRv6 introduction](https://www.paddleocr.ai/latest/en/version3.x/algorithm/PP-OCRv6/PP-OCRv6.html))

The SDK resolves `lang: "japan", ocrVersion: "PP-OCRv6"` to PP-OCRv6-small; tiny can only be selected by explicit model names. Therefore PP-OCRv6-tiny is an experiment, not a capability-preserving recommendation. PP-OCRv6-small has a larger model transfer than v5 and still needs a browser benchmark.

### Integration consequences

**Verified fact.** PaddleOCR.js fetches each whole model tar into an `ArrayBuffer`, then extracts ONNX/config entries in memory. It reports downloaded byte counts after initialization, but its high-level worker API does not expose this app's current streamed byte-progress contract or a persistent model cache. ([model loader](https://github.com/PaddlePaddle/PaddleOCR/blob/main/paddleocr-js/packages/core/src/resources/model-asset.ts), [worker-backed API](https://github.com/PaddlePaddle/PaddleOCR/blob/main/paddleocr-js/packages/core/src/pipelines/ocr/worker-backed.ts))

**Inference for this app.** Preserve zero initial-load impact by retaining the existing opt-in and lazy `OcrPanel` chunk. Self-host version-pinned model tars and ORT WASM under `/ocr/`; otherwise the current CSP blocks the model/CDN requests, the offline manifest cannot include them, a third-party outage breaks OCR, and model versions can drift. Set `wasmPaths` explicitly so worker/main paths use the same version. The implemented build keeps these files out of the base offline manifest and offers a separate 33.7 MiB compressed OCR pack containing Paddle plus the Tesseract fallback.

Same-origin module-worker output should fit the current `script-src 'self'` fallback for workers, and the existing `'wasm-unsafe-eval'` is already present. Enabling threaded WASM/cross-origin isolation is a separate product decision: COOP/COEP must be tested with Google sign-in, translation fallbacks, fonts/images, and every host before it can be used. Single-thread worker WASM avoids making cross-origin isolation a prerequisite, at a likely latency cost.

## Accuracy and performance: what is known and what is not

### Supported by primary sources

- Paddle's internal PP-OCRv5 results show a large improvement over PP-OCRv4 on Japanese detection, Japanese recognition, and vertical text. ([PP-OCRv5 tables](https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/algorithm/PP-OCRv5/PP-OCRv5.md))
- Paddle's native benchmark says PP-OCRv5-mobile is slower than PP-OCRv4-mobile because the larger recognition dictionary takes longer. The published native CPU/GPU timings are not browser timings. ([PP-OCRv5 inference reference](https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/algorithm/PP-OCRv5/PP-OCRv5.md#四推理性能参考数据))
- ONNX Runtime notes that WASM supports all ONNX operators while GPU providers support subsets, and that runtime/model size can be reduced with a custom minimal ORT build plus ORT-format models. PaddleOCR.js 0.4.2 does not ship such an OCR-specific minimal runtime. ([ORT Web overview](https://onnxruntime.ai/docs/tutorials/web/), [ORT Web build/minimal-build guidance](https://onnxruntime.ai/docs/build/web.html))

### Missing evidence (must not be presented as fact)

- No official head-to-head Japanese PaddleOCR.js versus this app's `tesseract-wasm` implementation.
- No official browser benchmark for low-end Android, iPhone Safari, Firefox, or this app's 2,000 px input ceiling.
- No app-specific character accuracy for clean screenshots, camera photos, blur/glare, mixed Japanese/English, vertical Japanese, ruby/furigana, or handwritten text.
- No measured browser peak heap/GPU memory, initialization time, warm-scan latency, long tasks, or thermal/battery behavior for this integration.
- No proof that WebGPU is faster for both Paddle detector and recognizer on representative devices; `auto` is a fallback policy, not a performance guarantee.

Consequently, “Paddle is more reliable than Tesseract” is a hypothesis for this product, not yet a verified conclusion.

## Capability-preserving spike and acceptance gates

Use the existing `src/lib/ocr/` seam rather than rewriting the UI first. The spike should preserve the panel's input/output and lifecycle behavior while swapping only the engine adapter:

1. Start with official `@paddleocr/paddleocr-js`, PP-OCRv5-mobile, `worker: true`, same-origin versioned assets, and an explicit backend policy. Join returned line items into the existing raw-text review and keep confidence/polygons available for diagnostics.
2. Keep crop, EXIF orientation, manual quarter-turn rotation, downscaling, raw review, text cleaners, over-limit handling, opt-in, retry, and worker disposal unchanged.
3. Keep Tesseract available as a fallback during the experiment. A Paddle initialization/model/CSP failure must not remove image scanning.
4. Build a checked-in, license-safe OCR acceptance corpus owned by this project. Include clean UI screenshots, textbook/book camera shots, skew, blur/glare, clutter, horizontal and vertical Japanese, furigana, mixed JA/EN, English pages, empty images, and large phone photos. Do not tune only to a few anecdotes.
5. Compare exact-output character error rate, empty/failure rate, and useful-text rate. Paddle must beat Tesseract on the app's important Japanese groups and must not materially regress English.
6. Measure cold encoded transfer by URL, warm repeat transfer, initialization time, first and second scan latency, peak JS/WASM/GPU memory, event timing, and long tasks at 4× CPU throttle. Test low/mid Android Chrome, iPhone Safari, Firefox, Chromium desktop with/without WebGPU, and reduced-memory conditions.
7. Reject the migration if it breaks the current definition of “light.” If a ~27 MB optimized opt-in download is acceptable only for a high-accuracy mode, present that trade-off explicitly rather than silently replacing the ~2.3 MB path.

### Suggested go/no-go criteria

- **Accuracy:** demonstrable improvement on the project corpus, especially Japanese camera shots/furigana/vertical groups; no material English regression.
- **Capabilities:** paste/upload/camera/crop/rotate/review/retry/offline/privacy all pass unchanged; graceful Tesseract fallback remains until Paddle is proven.
- **Responsiveness:** zero page errors/console errors, no OCR inference on the main thread, and no user-visible input jank.
- **Compatibility:** successful WASM scan on the supported Safari/Firefox/Chromium device matrix; WebGPU failure always falls back cleanly.
- **Network:** zero OCR bytes before opt-in; exact cold bytes disclosed; repeat scans and reloads use HTTP/service-worker cache; all runtime/model URLs are same-origin and version-pinned.
- **Static/offline:** production CSP and every static host serve the worker/WASM/model MIME and compression correctly; offline download includes all required OCR files and works with the network disabled.

## Pros and cons for this application

| Pros | Cons / risks |
|---|---|
| Official browser SDK now exists and is actively shipping. | Very new SDK (April 2026); API/package maturity is materially lower than Tesseract's current integration. |
| Japanese + English in one PP-OCRv5 recognition model; no language-model swap. | The implemented V5 browser cold transfer is 26.8 MiB, about 12× current Japanese first use. |
| Detection-first pipeline provides line polygons and confidences and is plausibly better for clutter/scene text. | Accuracy superiority over this app's Tesseract path is unproven without a shared corpus. |
| Dedicated worker keeps inference away from the UI thread. | Runtime/model initialization and peak memory are much larger; low-end-device behavior is unknown. |
| WASM CPU fallback covers the broad modern-browser set; optional WebGPU can accelerate some Chromium devices. | WebGPU is not universal; threaded WASM needs cross-origin isolation; fallback devices may be slow. |
| Fully on-device/private after same-origin assets are loaded; compatible with static hosting and service-worker caching. | SDK does not provide the current streamed progress/persistent cache behavior; host integration must own it. |
| Current crop/rotate/review UI can be retained around a new adapter. | Browser SDK ignores document orientation/unwarping/text-line orientation and does not expose the full PaddleOCR/PaddleX layout stack. |

## Final verdict

PaddleOCR.js is a feasible **accuracy experiment**, not currently a drop-in win on all stated constraints. It can preserve privacy, static hosting, offline operation, UI responsiveness, and broad browser execution if it is worker-backed, self-hosted, lazy, and retains the app's existing preprocessing. It cannot preserve the current lightweight network profile: the Japanese-capable official path is an order of magnitude larger.

Proceed only as a dual-engine benchmark spike. Make the permanent migration after evidence shows that Paddle's real Japanese accuracy gain is worth the measured cold bytes, latency, and memory on the target device matrix. If low network usage is a hard constraint comparable to the current ~2.3 MB compressed Japanese path, keep Tesseract as the default today.
