# OCR fixtures

These small PNGs are original test assets rendered for this repository; they
contain no third-party page or dialogue.

- `ocr-horizontal-japanese.png` — one horizontal line, ground truth
  `今日は良い天気です`.
- `ocr-vertical-japanese.png` — two upright vertical columns. Natural Japanese
  order is the right column `今日は良い天気`, then the left column
  `漫画を読みます`; parser ground truth is `今日は良い天気漫画を読みます`.

Use them for production-preview OCR regression checks. The supplied manga page
used while developing decision 75 is copyrighted, local-only, and must never be
copied into this directory.
