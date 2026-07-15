# OCR release corpus and device report

`bun run ocr:benchmark [results.json]` is the mandatory local release gate for
the PaddleOCR branch. The command intentionally fails when no report is present.
Do not commit private user images or device telemetry.

The final license-safe corpus must contain at least:

- 20 horizontal Japanese images (including furigana and camera photos)
- 15 vertical Japanese images
- 15 genuine handwritten Japanese images
- 10 English images
- 10 adverse or empty images (blur, glare, skew, clutter, and true empty input)

Each sample records an expected transcription, both engines' raw text, Paddle
confidence, a human `usable` verdict, and whether accepting the result without
review is safe. Device results must cover desktop, mid-range phone, and low-end
phone tiers plus Chrome, Edge, Firefox, and Safari at current, previous-one,
and previous-two releases. Record scan samples, post-download initialization,
the longest main-thread task at 4× throttle, incremental and retained memory,
first/repeat OCR transfer, and whether forced WebGPU fallback crashed.

Minimal JSON shape:

```json
{
  "samples": [
    {
      "id": "horizontal-ja-001",
      "category": "horizontal-ja",
      "expected": "日本語",
      "paddle": { "text": "日本語", "usable": true, "confidence": 0.96 },
      "tesseract": { "text": "日本言吾", "usable": false },
      "safeToAutoParse": true
    }
  ],
  "devices": [
    {
      "tier": "desktop",
      "browser": "chrome",
      "release": "current",
      "scanMs": [1200, 1100],
      "initMs": 3000,
      "maxLongTaskMs": 80,
      "incrementalMemoryBytes": 120000000,
      "retainedMemoryBytesAfterClose": 10000000,
      "firstDownloadBytes": 28063664,
      "repeatDownloadBytes": 0,
      "fallbackCrashed": false
    }
  ]
}
```

Record image provenance, license, capture device, orientation, and any
transform alongside the local corpus. “Genuine handwritten” cannot be replaced
by a handwriting font or generated synthetic image. The exact thresholds and
minimum counts are executable in `scripts/ocr-benchmark-lib.ts` and documented
in decision 74.
