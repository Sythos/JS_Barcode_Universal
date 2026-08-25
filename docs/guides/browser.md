# Browser guide

The browser integration is intentionally small: the SDK does not own a DOM,
an image codec or a camera widget. It accepts ordinary JavaScript values and
lets the page decide whether the result belongs in an `<img>`, a `<canvas>`, a
download or a worker. That keeps the same decoder usable in a browser, a
worker and Node.js.

## Choose a browser entry point

There are three useful loading styles. The first two correspond to the
package's public `./bundle/iife` and `./bundle` exports; the last uses the
focused subpath exports from `package.json`.

| Situation | Entry point |
| --- | --- |
| A classic page or a local `file://` example | the `bundle/sythos-barcode.js` IIFE asset, exposing `window.SythosBarcode` |
| A module page or a browser bundler | the package root, or the `bundle/sythos-barcode.esm.js` ESM asset |
| A small feature-specific bundle | a public package subpath such as `@sythos/js_barcode_universal/qr` or `.../render/svg` |

The [installation guide](../installation.md) shows the package, CDN and
source layouts. The checked-in [create example](https://github.com/Sythos/JS_Barcode_Universal/blob/main/examples/create.html) is
the quickest way to see the IIFE bundle in a plain HTML file.

The package is ESM-first and has no runtime dependencies. A browser does not
need Node.js, a native addon, WebAssembly or a barcode service to encode or
decode. The repository's browser syntax floor is iOS Safari 15; optional
features such as `OffscreenCanvas`, WebGL2 and WebGPU are detected at runtime.

## A complete module-page example

This page generates a QR symbol, draws it with the ordinary 2D canvas path,
reads the pixels back and displays the verified text. It works as a module page
served by a local development server or from a site that permits the ESM bundle
to load. The generation part does not need a camera or a secure context.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Barcode browser round trip</title>
</head>
<body>
  <canvas id="barcode" aria-label="Generated QR code"></canvas>
  <output id="status" role="status"></output>

  <script type="module">
    import {
      decode,
      encode,
      renderToCanvasAuto,
    } from 'https://unpkg.com/@sythos/js_barcode_universal/bundle/sythos-barcode.esm.js';

    const canvas = document.querySelector('#barcode');
    const status = document.querySelector('#status');
    const matrix = encode('https://www.sythos.net/', { format: 'qr', ecc: 'M' });
    const draw = renderToCanvasAuto(matrix, canvas, {
      scale: 8,
      margin: 4,
      backend: '2d',
    });

    if (draw.backend === 'none') {
      status.textContent = 'The browser could not provide a 2D canvas context.';
    } else {
      const context = canvas.getContext('2d', { willReadFrequently: true });
      const frame = context.getImageData(0, 0, canvas.width, canvas.height);
      const hits = decode(frame, { formats: ['qr'] });
      status.textContent = hits[0]
        ? `${draw.backend}: ${hits[0].text}`
        : 'The rendered pixels did not contain a validated QR code.';
    }
  </script>
</body>
</html>
```

For an application that has already installed the npm package, replace the
URL import with a normal package import and let the application's bundler
resolve it:

```js
import { decode, encode, renderToCanvasAuto } from '@sythos/js_barcode_universal';
```

TypeScript uses the same package specifiers. The package maps them to the
compiled JavaScript runtime and its matching declarations; do not import the
implementation files under `src/ts/` directly:

```ts
import {
  decode,
  encode,
  toImageData,
  type DecodeResult,
} from '@sythos/js_barcode_universal';

const matrix = encode('BROWSER-TS', { format: 'qr' });
const image = toImageData(matrix, { scale: 6, margin: 4 });
const results: DecodeResult[] = decode(image, { formats: ['qr'] });

console.log(results[0]?.text ?? 'No validated QR Code found');
```

Pin a specific package release in production rather than letting an unpinned
CDN URL change the bytes under a deployed page. The browser example is a
teaching surface, not a replacement for your application's content-security
policy or dependency review.

## IIFE pages and the local examples

The IIFE bundle exposes one global, `SythosBarcode`. It is useful when a page is
not using a module loader:

```html
<img id="barcode" alt="Generated Code 128 symbol">
<script src="bundle/sythos-barcode.js"></script>
<script>
  const matrix = SythosBarcode.encode('BROWSER-IIFE', { format: 'code128' });
  const svg = SythosBarcode.toSVGDataURI(matrix, {
    scale: 3,
    margin: 8,
    barHeight: 72,
  });
  document.querySelector('#barcode').src = svg;
</script>
```

The relative path above assumes the HTML file sits at the repository root. In
the checked-in examples the bundle is one directory above the `examples/`
folder, so their path is `../bundle/sythos-barcode.js`.

Opening an IIFE generation example from `file://` is fine. Camera capture is a
separate browser capability and normally requires HTTPS or `localhost`; see
the [camera guide](camera-reading.md) for the permission and frame loop.

## Canvas and image boundaries

The SDK does not require a canvas for decoding. A canvas is simply a convenient
browser adapter:

```js
const context = canvas.getContext('2d', { willReadFrequently: true });
const image = context.getImageData(0, 0, canvas.width, canvas.height);
const results = decode(image, {
  formats: ['qr', 'datamatrix'],
  binarizer: 'auto',
});
```

The image object is RGBA, row-major and four byte values per pixel. The
[image pipeline guide](image-pipeline.md) documents the exact contract and
resource limits. If an image came from another origin, drawing it into a
canvas without the correct CORS headers can taint that canvas; that is a
browser security error before the SDK gets involved. Use a same-origin asset,
an allowed CORS response or an application-side image adapter.

For a repeated read loop, create the working canvas and its 2D context once,
reuse them, and keep the decoded payload as text. The canonical
[read example](https://github.com/Sythos/JS_Barcode_Universal/blob/main/examples/read.html) renders payloads with DOM text nodes
instead of treating scanned content as HTML.

## Optional rendering backends

`toCanvas()` is the universal 2D fallback. `renderToCanvasAuto()` tries WebGL2
and then 2D and returns `{ backend: 'webgl2' | '2d' | 'none' }`. The asynchronous
`renderToCanvasAutoAsync()` may also probe WebGPU. The probes matter because a
canvas can be committed to only one kind of context; do not ask for a WebGPU
context, fail, and then expect the same canvas to become a 2D canvas.

GPU rendering accelerates drawing a matrix into a canvas. It does not move the
barcode encoder to the GPU, and it is not a promise that decoding a camera
frame becomes GPU-accelerated. Feature-detect the result and retain a 2D path.

```js
import {
  encode,
  isWebGPUAvailable,
  renderToCanvasAutoAsync,
} from '@sythos/js_barcode_universal';

const canvas = document.querySelector('#barcode');
const matrix = encode('GPU-OPTIONAL', { format: 'qr' });
const hasWebGPU = await isWebGPUAvailable();
const result = await renderToCanvasAutoAsync(matrix, canvas, {
  backend: hasWebGPU ? 'auto' : '2d',
  scale: 6,
});
console.log(result.backend); // webgpu, webgl2, 2d or none
```

All renderers apply the same allocation checks. `scale`, `margin` and
`barHeight` must be safe integer values, and the final image must stay within
16,384 pixels per side and 16,777,216 pixels in total. That total is still a
high ceiling—roughly twice the pixel count of a normal 4K image—but it is a
ceiling, not a recommendation for every frame.

## Browser-specific failure handling

- A missing or rejected camera permission is a page/platform condition, not a
  decoder success. Explain it to the user and keep file input available.
- `decode()` returning `[]` is a normal “no validated symbol in this frame”
  result. Do not display a partial payload as a successful scan.
- A malformed image object or an oversized allocation can throw a library
  error. Catch it at the untrusted browser input boundary.
- Never insert decoded text or error messages with `innerHTML`; use
  `textContent` or DOM node construction.

For the full camera lifecycle, including iOS `playsinline`, see
[Camera reading](camera-reading.md). For a non-DOM execution path, see
[Web Workers](web-workers.md).
