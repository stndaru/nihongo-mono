# PP-OCRv3 Mobile OCR Feasibility and Benchmark Plan

Date: 2026-07-19

Status: accepted no-go decision; retain Tesseract

## Executive conclusion

Replacing the browser Tesseract implementation with PP-OCRv3 is technically
feasible, but the two assumptions motivating a direct replacement are not
supported:

- **It is not lighter by cold-download size.** The current Japanese Tesseract
  path is about 3.45 MB before normal HTTP compression. The official
  PP-OCRv3 multilingual detector plus Japanese recognizer archives total
  12.27 MiB before adding ONNX Runtime Web, OpenCV-based post-processing, or an
  optional orientation classifier. A straightforward PaddleOCR.js worker plus
  its WASM runtime adds roughly another 6.7 MB gzip before model weights.
- **It is not proven more accurate for this app.** Paddle's published
  PP-OCRv3 figures use Paddle's own datasets and native/server inference. They
  neither compare against Tesseract nor measure this app's end-to-end Japanese
  screenshots, furigana, mixed Japanese/English, photographs, or browser
  runtime.
- **There is no officially supported single PP-OCRv3 Japanese-and-English
  recognizer.** Paddle publishes separate `japan` and `en` recognizers. The
  Japanese dictionary contains Latin characters, so it can emit English, but
  Paddle publishes no English accuracy for that use.
- **PP-OCRv3 is no longer the current generation.** PP-OCRv6 was released in
  June 2026. Its small tier has a unified Japanese-and-English model and much
  better official language-specific evidence, but its official detector and
  recognizer ONNX files are about 31 MB before runtime. Its tiny tier does not
  support Japanese.

The safe decision is therefore **do not remove Tesseract yet**. Build a
disposable, lazy-loaded browser spike, benchmark it against the existing
engine on a versioned app-specific corpus, and remove Tesseract only if the
replacement clears explicit accuracy, byte, latency, memory, and browser
compatibility gates.

## Current application baseline

The current implementation in `src/lib/ocr/` has several useful properties
that a replacement must preserve:

- OCR is opt-in and lazy-loaded.
- The worker and WASM are self-hosted.
- One worker is reused, while Japanese and English trained-data buffers are
  fetched and cached separately.
- Images are EXIF-aware, downscaled to at most 2,000 px, and can be cropped or
  rotated before recognition.
- Model downloads expose byte progress.
- The worker is destroyed when the OCR route unmounts.
- The static offline manifest includes all built application assets, so larger
  OCR assets also enlarge a full offline installation.

Measured from the checked-out dependency and generated assets:

| Current asset | Bytes |
| --- | ---: |
| Tesseract core WASM | 1,839,004 |
| OCR worker JavaScript | 93,353 |
| Japanese trained data, gzip | 1,521,392 |
| English trained data, gzip | 1,961,173 |
| Japanese active-path total | 3,453,749 |
| English active-path total | 3,893,530 |

This is the relevant baseline for “lighter,” not model parameters alone.

## What PP-OCRv3 requires

PP-OCR is an end-to-end pipeline, not a drop-in recognizer:

1. A detector finds text regions.
2. Geometry post-processing creates and orders line boxes.
3. Regions are cropped and rectified.
4. An optional classifier corrects 0/180-degree orientation.
5. A recognizer decodes each cropped line using a language dictionary.

The detector cannot be omitted for the app's multi-line screenshots and
photos. Omitting the orientation classifier may be reasonable if the current
manual rotate flow remains, but that is a benchmarkable product constraint,
not a free equivalence.

Paddle's [official PP-OCR model list](https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version2.x/ppocr/model_list.en.md)
publishes separate Japanese and English PP-OCRv3 recognizers. The
[PaddleOCR 2.10 model mapping](https://github.com/PaddlePaddle/PaddleOCR/blob/release/2.10/paddleocr.py)
likewise maps `japan` and `en` to different recognizer archives and
dictionaries. Japanese uses the multilingual detector and
`japan_dict.txt`; English uses its own recognizer and `en_dict.txt`.

The Japanese recognizer configuration is a MobileNetV1Enhance/SVTR-LCNet
CTC recognizer with a `[3, 48, 320]` input shape and training
`max_text_length: 25`; see the
[official Japanese PP-OCRv3 configuration](https://github.com/PaddlePaddle/PaddleOCR/blob/main/configs/rec/PP-OCRv3/multi_language/japan_PP-OCRv3_mobile_rec.yml).
Long Japanese lines therefore need explicit coverage in the app benchmark.

### Official archive measurements

The following official artifacts were measured by HTTP response size on
2026-07-19:

| Artifact | Official URL | Bytes | MiB |
| --- | --- | ---: | ---: |
| Multilingual mobile detector | [PP-OCRv3 detector](https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv3_mobile_det_infer.tar) | 2,611,200 | 2.49 |
| Japanese mobile recognizer | [PP-OCRv3 Japanese recognizer](https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/japan_PP-OCRv3_mobile_rec_infer.tar) | 10,250,240 | 9.78 |
| English mobile recognizer | [PP-OCRv3 English recognizer](https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/en_PP-OCRv3_mobile_rec_infer.tar) | 18,186,240 | 17.34 |
| Optional 0/180 classifier | [PP-OCR classifier](https://paddleocr.bj.bcebos.com/dygraph_v2.0/ch/ch_ppocr_mobile_v2.0_cls_infer.tar) | 2,188,800 | 2.09 |

The minimum Japanese pipeline is consequently 12,861,440 bytes
(12.27 MiB) before the browser runtime. Keeping separate Japanese and English
recognizers takes the minimum detector-plus-recognizer model set to about
29.61 MiB before runtime.

The archives contain Paddle `pdiparams` plus inference JSON/YAML, not ONNX.
They cannot be handed directly to a browser ONNX session. Paddle's
[official Paddle2ONNX instructions](https://github.com/PaddlePaddle/PaddleOCR/blob/main/deploy/paddle2onnx/readme.md)
document conversion of PP-OCRv3 detection, recognition, and classification
models, so conversion is supported in principle. The converted graphs still
need to be validated against the exact browser execution provider.

### One Japanese-and-English v3 model?

The [official Japanese dictionary](https://github.com/PaddlePaddle/PaddleOCR/blob/main/ppocr/utils/dict/japan_dict.txt)
has 4,399 entries and includes ASCII uppercase, lowercase, and digits. That
means the Japanese recognizer can technically emit English characters.
It does **not** make it an officially supported bilingual model:

- the model list describes it as Japanese and numeric;
- Paddle publishes a separate English model using
  [the English dictionary](https://github.com/PaddlePaddle/PaddleOCR/blob/main/ppocr/utils/en_dict.txt);
- no official English accuracy is published for the Japanese recognizer.

Using only the Japanese recognizer for mixed Japanese/English would be a
custom optimization whose English quality must be measured, not an
established PP-OCRv3 configuration.

## Browser runtime feasibility

There are two realistic implementation routes:

1. Convert PP-OCRv3 assets to ONNX and build the detector, crop/rectify, and
   recognizer pipeline directly on
   [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/).
2. Convert and package them for the official PaddleOCR.js SDK.

The second route is the shorter spike. The
[official PaddleOCR.js browser guide](https://www.paddleocr.ai/latest/en/version3.x/inference_deployment/cross_platform/browser.html)
supports custom detector and recognizer archives, worker execution, WASM,
and WebGPU. Its custom archive contract requires an **uncompressed ustar**
archive containing `inference.onnx` and `inference.yml`; gzip model archives
are not accepted by the SDK itself. Normal HTTP `Content-Encoding` may still
compress the transfer, but the host configuration and measured wire bytes
must prove that rather than assume it.

PaddleOCR.js uses ONNX Runtime and OpenCV.js for model execution and geometry
work. Its [package manifest](https://github.com/PaddlePaddle/PaddleOCR/blob/main/paddleocr-js/packages/core/package.json)
declares `onnxruntime-web`, `@techstark/opencv-js`, `clipper-lib`, and
`js-yaml`. The
[recognizer implementation](https://github.com/PaddlePaddle/PaddleOCR/blob/main/paddleocr-js/packages/core/src/models/rec.ts)
reads the model's `RecResizeImg.image_shape` and embedded character dictionary
and performs CTC-style decoding, which is structurally compatible with the
PP-OCRv3 metadata. Current built-in examples default to later PP-OCR
generations, so PP-OCRv3 archive compatibility still needs an executable
proof.

### Runtime weight

Measured from the official npm packages on 2026-07-19:

| Runtime asset | Raw bytes | gzip | Brotli |
| --- | ---: | ---: | ---: |
| PaddleOCR.js worker bundle | 11,341,486 | 3,555,424 | 2,602,376 |
| ORT SIMD/threaded WASM | 12,361,745 | 3,157,954 | 2,015,771 |
| ORT WebGPU/JSEP WASM | 25,014,754 | 5,794,943 | 3,418,874 |

A straightforward worker-plus-WASM build therefore adds about 6.7 MB gzip
or 4.6 MB Brotli before model weights. Tree-shaking, a custom ORT build, and
conditional WebGPU loading may reduce this, but those are later
optimizations, not evidence that the initial replacement is lighter.

The [ORT Web deployment guide](https://onnxruntime.ai/docs/tutorials/web/deploy.html)
documents self-hosting the JavaScript, WASM, workers, and model assets, plus
optional custom builds. The [ORT browser support table](https://onnxruntime.ai/docs/get-started/with-javascript/web.html)
shows WASM as the broad compatibility baseline, while WebGPU support is
narrower. WebGPU can be a Chromium fast path but cannot be the only app path.

### Workers, SIMD, CSP, and isolation

The app already permits self-hosted workers and `'wasm-unsafe-eval'`. Keeping
all runtime and model files under the existing origin should avoid a new CSP
origin. A CDN would require explicit CSP changes and would weaken the
deterministic/offline behavior.

PaddleOCR.js can own the module worker and disables ONNX Runtime's proxy worker
inside it. ONNX Runtime's
[WASM environment options](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html)
state that multithreaded WASM additionally requires `crossOriginIsolated`.
This app currently does not send COOP/COEP headers, so the safe first spike is:

- dedicated PaddleOCR.js worker;
- one-thread WASM baseline;
- SIMD through feature detection;
- optional WebGPU fast path with WASM fallback.

Adding COOP/COEP solely for OCR could affect third-party integrations and
must be tested separately. It should not be assumed as part of the first
benchmark.

### Cold and offline cost

The app's generated offline manifest includes all built files. Even if OCR
remains opt-in at runtime, self-hosted PP-OCR assets increase a user's full
offline install. The benchmark must report both:

- cold deep-link/action transfer for a user who invokes OCR; and
- delta to the complete offline package.

Model switching also matters. A single Japanese recognizer may avoid the
17.34 MiB English artifact, but only if its mixed-language accuracy passes.

## Accuracy evidence

The official recognition module page reports, on Paddle's own datasets and
native PaddleInference:

| Model | Published average accuracy | Published CPU time | Storage |
| --- | ---: | ---: | ---: |
| `japan_PP-OCRv3_mobile_rec` | 45.69% | 8.48 / 4.07 ms | 8.8 M |
| `en_PP-OCRv3_mobile_rec` | 70.69% | 8.65 / 5.57 ms | 7.8 M |

Source: [PaddleOCR v3 text-recognition module documentation](https://www.paddleocr.ai/v3.0.2/en/version3.x/module_usage/text_recognition.html).

Those numbers must not be compared directly:

- Japanese and English use different self-built datasets.
- They measure cropped-line recognition, not end-to-end OCR.
- Detection misses and line ordering are excluded.
- The timings use an eight-thread Intel Xeon and native PaddleInference, not
  a phone browser running WASM or WebGPU.
- Tesseract is not included.

The [PP-OCRv3 paper](https://arxiv.org/abs/2206.03001) reports improvements
over PP-OCRv2 on its own Chinese system setup. The
[official PP-OCRv3 introduction](https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version2.x/ppocr/blog/PP-OCRv3_introduction.md)
also reports an English improvement over an earlier Paddle model. Neither
provides evidence that PP-OCRv3 is more accurate than Tesseract on this app's
Japanese content.

The only defensible current accuracy conclusion is **unproven**.

## Exploratory paired benchmark

An exploratory benchmark ran both engines over the same 18 local synthetic
fixtures: nine Japanese and nine English. Tesseract used the app's exact
`tesseract-wasm` path in Chromium. PP-OCRv3 used the official mobile detector
and separate Japanese and English recognizers through PaddleOCR 3.7 and
Paddle 3.3 on native CPU. Character error rate (CER) was computed as total
Levenshtein edits divided by total ground-truth characters.

| Fixture set | Engine | Edits / characters | CER | Exact |
| --- | --- | ---: | ---: | ---: |
| Japanese, all 9 | Tesseract | 26 / 185 | 14.054% | 6 / 9 |
| Japanese, all 9 | PP-OCRv3 | 45 / 185 | 24.324% | 2 / 9 |
| Japanese, excluding mixed-script fixture | Tesseract | 26 / 159 | 16.352% | 5 / 8 |
| Japanese, excluding mixed-script fixture | PP-OCRv3 | 35 / 159 | 22.013% | 2 / 8 |
| English, all 9 | Tesseract | 4 / 482 | 0.830% | 7 / 9 |
| English, all 9 | PP-OCRv3 | 16 / 482 | 3.320% | 0 / 9 |

On this small corpus, PP-OCRv3 was less accurate in both languages. It
frequently missed terminal punctuation. Tesseract was exact on the mixed
Japanese-and-English fixture, while PP-OCRv3 had 38.5% CER. Neither engine
handled the furigana fixture correctly: both recognized the reading together
with the base text, producing 105.9% CER for Tesseract and 117.6% for
PP-OCRv3.

This result is useful negative evidence, not a production benchmark. The
corpus is small and synthetic; although it includes simulated blur, JPEG
damage, low contrast, uneven light, and slight rotation, it does not cover
real phone cameras, genuine glare/perspective, representative devices, or a
held-out real-world distribution.
It also used different runtimes. Tesseract's observed browser times
(approximately 49–134 ms) and PP-OCRv3's native Paddle CPU times
(approximately 0.5–2.2 s) are **not comparable** and support no speed
conclusion. A browser ONNX spike remains necessary for performance, memory,
and transfer measurement.

There was also a current native-Windows integration caveat: PP-OCRv3 under
Paddle 3.3.1 failed through the oneDNN/PIR path because of an attribute error
and required `enable_mkldnn=False`. A browser ONNX deployment may not share
that failure, but it reinforces the need to test the exact proposed runtime
rather than infer compatibility from native Paddle.

## Current-generation challenge: PP-OCRv6

Choosing v3 because it is named “mobile” risks solving against an obsolete
premise. The
[official PP-OCRv6 documentation](https://www.paddleocr.ai/latest/en/version3.x/algorithm/PP-OCRv6/PP-OCRv6.html)
states that PP-OCRv6 small and medium use one unified recognition model for
Japanese, English, and many other languages. The tiny tier excludes Japanese.
The same page reports in-house Japanese and English results for the small
tier, including Japanese detector Hmean 82.3, Japanese recognition accuracy
88.2, and printed-English recognition accuracy 93.3.

This is better language-specific evidence than v3 offers, but still not an
app-specific Tesseract comparison or browser measurement. It is also not
lightweight on wire:

| Official PP-OCRv6-small ONNX asset | Size |
| --- | ---: |
| [Detector `inference.onnx`](https://huggingface.co/PaddlePaddle/PP-OCRv6_small_det_onnx/tree/main) | 9.88 MB |
| [Recognizer `inference.onnx`](https://huggingface.co/PaddlePaddle/PP-OCRv6_small_rec_onnx/tree/main) | 21.2 MB |
| Combined before runtime | about 31 MB |

PP-OCRv6-small belongs in an accuracy/currentness experiment, not as evidence
for a lighter download. No current official Paddle option found in this
research satisfies all three requirements simultaneously: unified Japanese
and English, supported browser deployment, and a smaller cold payload than
the existing Japanese Tesseract path.

## Licensing

The replacement stack is permissively licensed:

- [PaddleOCR and PaddleOCR.js: Apache-2.0](https://github.com/PaddlePaddle/PaddleOCR/blob/main/LICENSE)
- [ONNX Runtime: MIT](https://github.com/microsoft/onnxruntime/blob/main/LICENSE)
- [OpenCV 4.x: Apache-2.0](https://github.com/opencv/opencv/blob/4.x/LICENSE)

An implementation must retain the required license and notice material and
record the exact provenance of converted model files. Existing Tesseract and
tessdata license notices should be removed only when its package, copied
runtime, trained data, and fallback code are actually removed.

## Required paired benchmark

External benchmark tables cannot make the product decision. The benchmark
should run the existing Tesseract path, a PP-OCRv3 browser spike, and—if the
single-model requirement is real—PP-OCRv6-small against identical inputs.

### Versioned corpus

Use licensed or synthetic fixtures with reviewed ground truth, stratified by:

- clean rendered horizontal Japanese at several fonts and sizes;
- the existing furigana failure cases;
- mixed Japanese plus ASCII/English, numbers, punctuation, and spaces;
- pure English;
- lines longer than 25 characters;
- multi-line layouts and unusual line spacing;
- low-resolution photos, perspective, glare, blur, and uneven light;
- 90/180-degree rotation;
- vertical Japanese only if it is in product scope.

Do not tune the fixture corpus after inspecting only one engine's failures.
Keep a development subset and a held-out decision subset.

### Accuracy metrics

Report per stratum and overall:

- detector precision, recall, and Hmean at line-box level;
- normalized character error rate by script/language;
- exact-line and exact-image match rate;
- raw engine output and post-cleanup output separately;
- deletion/substitution/insertion counts;
- confidence calibration if confidence is exposed.

The current cleanup behavior may hide Latin output on the Japanese tab and
whitespace behavior will differ between engines, so normalization must be
declared before running the decision benchmark.

### Performance and network metrics

Measure in production builds on representative desktop Chromium, Android,
and iOS/Safari:

- cold initialization, first recognition, and warm recognition p50/p95;
- WASM baseline and WebGPU where available;
- peak JS/WASM memory and out-of-memory/crash rate;
- main-thread long tasks and interaction responsiveness;
- CDP `encodedDataLength` for initial OCR and each language/model switch;
- total built OCR asset size and complete offline-manifest delta;
- model cache hit behavior after reload.

Run with the repository's 4× CPU throttling convention in addition to real
devices. Paddle's server timings are not substitutes.

### Decision gates to agree before implementation

At minimum:

1. No material Japanese CER regression on the held-out core corpus.
2. A measured improvement on the furigana cases that motivate the change.
3. No material pure-English regression if one Japanese model is proposed.
4. Acceptable p95 first-scan and warm-scan latency on the slowest supported
   phone/browser.
5. No browser crashes or unacceptable peak-memory increase.
6. An explicit cold-byte and offline-package budget.
7. A rollback path until the replacement passes all gates.

## Questions that must be answered before foundation work

These are product constraints disguised as implementation details:

1. Does “lighter” mean model parameter count, first-use wire bytes, complete
   offline size, peak memory, or recognition latency? The candidates rank
   differently under each definition.
2. Is the requirement one recognizer that handles mixed Japanese and English,
   or merely both languages behind separate modes?
3. Is iOS/Safari a required target? If yes, WASM—not WebGPU—is the performance
   floor.
4. Are furigana, long lines, mixed scripts, photographs, rotation, and
   vertical Japanese acceptance requirements?
5. What byte and latency regressions are acceptable for an accuracy gain?
6. What measured win is large enough to justify deleting the proven fallback?

Until those answers and the paired benchmark exist, completely removing
Tesseract would be an irreversible foundation rewrite based on a currently
false size assumption and an unproven accuracy assumption.
