# OCR engine and model notices

The sentence parser's opt-in **Scan Image** feature runs entirely in the
browser using the following third-party components, served from this
directory:

## tesseract-wasm (`engine/`)

WebAssembly build of the Tesseract OCR engine.
<https://github.com/robertknight/tesseract-wasm>

Copyright (c) 2022, Robert Knight and tesseract-wasm contributors.
Licensed under the **BSD 2-Clause License** (see the LICENSE.md shipped in
the `tesseract-wasm` npm package for the full text).

The engine embeds:

- **Tesseract OCR** — <https://github.com/tesseract-ocr/tesseract>,
  Copyright Google Inc. and contributors, licensed under the
  **Apache License 2.0** (<https://www.apache.org/licenses/LICENSE-2.0>).
- **Leptonica** — <http://leptonica.org>, licensed under the
  BSD 2-Clause-style Leptonica License.

## Recognition models (`models/`)

`jpn.traineddata.gz` and `eng.traineddata.gz` are the Japanese and English
fast integer LSTM models from the Tesseract project's **tessdata_fast**
repository — <https://github.com/tesseract-ocr/tessdata_fast> — licensed
under the **Apache License 2.0**
(<https://www.apache.org/licenses/LICENSE-2.0>). They are redistributed
here unmodified apart from gzip compression.
