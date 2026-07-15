# Paddle OCR browser pack notices

This optional, self-hosted OCR pack is downloaded only after the user enables
image scanning. Images and recognized text remain in the browser.

## Runtime

- `@paddleocr/paddleocr-js` 0.4.2 — Apache License 2.0
  ([source](https://github.com/PaddlePaddle/PaddleOCR/tree/main/paddleocr-js))
- PaddleOCR / PP-OCRv5 — Apache License 2.0
  ([source](https://github.com/PaddlePaddle/PaddleOCR))
- `onnxruntime-web` 1.24.3 — MIT License
  ([source](https://github.com/microsoft/onnxruntime))
- OpenCV.js (`@techstark/opencv-js`) — Apache License 2.0
- `js-yaml` 4.3.0 — MIT License
- `clipper-lib` 6.4.2 — Boost Software License 1.0

The full corresponding license texts are deployed beside this notice under
`/ocr/paddle/licenses/` (`Apache-2.0.txt`, `MIT.txt`, and `BSL-1.0.txt`).

## Models

The committed gzip archives are deterministic copies of PaddlePaddle's official
PP-OCRv5 mobile ONNX inference archives:

- Detection: `PP-OCRv5_mobile_det_onnx_infer.tar`
  - Source: `https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv5_mobile_det_onnx_infer.tar`
  - Distributed gzip SHA-256: `635dcb3ad4ee25aa77fbc9d58eb3b0269327c64b0db7ab6b600755d08e6276b0`
- Recognition: `PP-OCRv5_mobile_rec_onnx_infer.tar`
  - Source: `https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv5_mobile_rec_onnx_infer.tar`
  - Distributed gzip SHA-256: `92b138ed6adfb65f6eefa80d176ebd7802ae3f0783fce2af7225ad939b82405d`

See `docs/research/paddleocr-browser-feasibility.md` for the selection rationale,
browser constraints, and measured payload accounting.
