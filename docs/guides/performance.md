# Performance guide

Barcode work is usually limited by pixels, thresholding and detector retries,
not by the number of characters in a short payload. The fastest reliable
pipeline is the one that gives the decoder enough module detail and no more
image than it needs.

## Start with the smallest useful frame

For a camera or photo input, reduce the long edge before every decode pass when
the source contains substantially more detail than the physical barcode:

```js
import { decode } from '@sythos/js_barcode_universal';

function decodeResized(source, workCanvas) {
  const workContext = workCanvas.getContext('2d', { willReadFrequently: true });
  if (!workContext) throw new Error('A 2D canvas context is required');

  const maxLongEdge = 800;
  const ratio = Math.min(1, maxLongEdge / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * ratio));
  const height = Math.max(1, Math.round(source.height * ratio));

  workCanvas.width = width;
  workCanvas.height = height;
  workContext.drawImage(source, 0, 0, width, height);
  const frame = workContext.getImageData(0, 0, width, height);
  return decode(frame, { profile: 'camera', formats: ['qr'] });
}
```

The `800` value is a practical starting point copied from the browser example,
not an SDK requirement. Raise it when the symbol's modules become too small;
lower it when the symbol is large and the device is struggling. A crop around a
known region of interest is usually better than shrinking the whole 4K frame.

The SDK accepts up to 16,384 pixels per side and 16,777,216 pixels in total.
That total is still a high ceiling, roughly twice a normal 4K image, but it is
there to bound allocations and should not be treated as a camera target.

## Keep the browser loop bounded

Create one working canvas and one context. Do not create a new canvas for every
`requestAnimationFrame`, and do not launch a second synchronous decode while
the first one is still running. For a worker, use a busy flag or a queue with a
small fixed limit. After a validated hit, stop the stream if the UX is a
single-scan flow.

```js
let busy = false;

function scheduleFrame() {
  requestAnimationFrame(() => {
    if (busy) return scheduleFrame();
    busy = true;
    try {
      const frame = context.getImageData(0, 0, canvas.width, canvas.height);
      const hits = decode(frame, {
        formats: ['qr', 'datamatrix'],
        profile: 'camera',
      });
      if (hits[0]) showResultAsText(hits[0]);
    } finally {
      busy = false;
      scheduleFrame();
    }
  });
}
```

The `showResultAsText()` placeholder should use DOM text nodes or
`textContent`, not `innerHTML`. Keep application actions outside this loop until
the payload has passed the application's own validation.

## Reduce detector work deliberately

- Pass `formats` when the expected symbology is known. An unrestricted scan
  checks more format families in the same raster.
- Keep the default `binarizer: 'auto'` for mixed inputs. Use `global` for clean,
  generated images when profiling proves that it is enough; use `hybrid` for
  uneven illumination.
- `tryHarder: true` also retries inverted input. Set it to `false` only when the
  capture contract guarantees the polarity and orientation you need.
- `profile: 'camera'` adds eight-angle normalization only after the native pass
  finds no validated result. It is valuable for handheld capture, but not a
  free speed setting.
- A result at a non-zero camera `rotation` is already the output of that
  orientation retry. Do not rotate and decode the same frame again in the UI
  unless you have a separate, measured reason.

An empty result is cheap to reason about and normal for a frame. Do not keep
retrying the same pixels indefinitely after an input or allocation error; fix
the frame size or report the boundary failure.

## Use workers for sustained image work

Moving `getImageData()` and `decode()` into a module worker keeps the main thread
available for controls and video presentation. Transfer a buffer when the UI no
longer needs the frame; copy it when the UI must keep using it. The complete
[Web Workers guide](web-workers.md) includes a transfer-list example.

For camera loops, the useful sequence is:

```text
capture → resize/crop → transfer one frame → decode → return a result → repeat
```

Never let “capture” outrun “decode” without a bound. Dropping stale frames is
usually better than decoding a backlog that is already showing the past.

## Rendering and output backends

Encoding remains CPU work. WebGL2 and WebGPU can accelerate drawing a matrix to
a canvas, especially for large symbols or many outputs, but they do not make
Reed–Solomon, mask scoring or bit placement a GPU operation. Measure before
adding a GPU path to a small one-off QR.

Use the simplest renderer that meets the output need:

| Need | Good choice |
| --- | --- |
| DOM-independent pixels for a reader or worker | `toImageData()` |
| A browser canvas with universal fallback | `toCanvas()` |
| Synchronous vector output | `toSVG()` |
| PNG bytes or a download | `toPNG()` |
| Optional GPU drawing | `renderToCanvasAuto()` or `renderToCanvasAutoAsync()` |

`toImageData()` and `toPNG()` allocate full output buffers. Reuse matrices and
avoid regenerating a symbol when only the display surface changed. A matrix has
no quiet zone; render options add the margin and, for a 1D symbol, stretch the
single encoded row to `barHeight`.

## Render limits are part of performance

All renderers validate matrix dimensions and output dimensions before allocating
large buffers. `scale`, `margin` and `barHeight` must be safe integers within
their bounds, and the final image cannot exceed 16,384 pixels on a side or
16,777,216 pixels in total. Invalid, fractional or oversized values raise an
error; do not rely on silent coercion to protect an application-facing slider.

Choose values from the physical output rather than from the largest possible
number:

```js
const matrix = encode('PERF-1D', { format: 'code128' });
const image = toImageData(matrix, {
  scale: 2,
  margin: 10,
  barHeight: 80,
});
```

For a high-volume service, validate user-provided render options before calling
the renderer and return a normal input error instead of repeatedly constructing
and discarding oversized output attempts.

## Measure the whole pipeline

Time the capture resize, `getImageData()`, decode and presentation separately.
The detector is not always the bottleneck. A practical browser measurement is:

```js
const start = performance.now();
context.drawImage(video, 0, 0, width, height);
const afterDraw = performance.now();
const frame = context.getImageData(0, 0, width, height);
const afterRead = performance.now();
const hits = decode(frame, { formats: ['pdf417'], profile: 'camera' });
const afterDecode = performance.now();

console.table({
  drawMs: afterDraw - start,
  readPixelsMs: afterRead - afterDraw,
  decodeMs: afterDecode - afterRead,
  found: hits.length,
});
```

Measure on the devices and formats that matter. QR, a dense PDF417 and a 1D
scanline do not exercise identical detector paths, and a GPU backend that helps
large rendering may add no value to a single small symbol.

For camera prerequisites, orientation metadata and safe empty-result handling,
see [Camera reading](camera-reading.md). For input allocation and binarizer
details, see [Image pipeline](image-pipeline.md).
