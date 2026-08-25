# Rendering output

Encoders return a module grid. Renderers turn that grid into something a user
can display, download, print or pass back into the reader. Keeping rendering
separate means one encoded payload can serve an SVG preview, a PNG download
and a camera-test image without re-encoding the barcode.

## Shared render options

The public [`RenderOptions`](../../src/ts/render/options.d.ts) type is shared by
the SVG, PNG, image-data and canvas paths:

| Option | Default | Meaning |
| --- | --- | --- |
| `scale` | `8` | Pixels per barcode module. |
| `margin` | `4` | Light quiet-zone modules on every side. |
| `dark` | `'#000000'` | Colour of set modules. |
| `light` | `'#ffffff'` | Colour of clear modules; `'none'` or `'transparent'` can be used for transparency where supported. |
| `barHeight` | Derived | Total bar height in pixels for a one-dimensional symbol. |

`scale`, `margin` and `barHeight` affect memory and output dimensions. Keep
them bounded when values come from users, requests or remote configuration.
The renderer validates values, but an application should reject an output
budget that is too large before allocating it.

## SVG

`toSVG()` returns a complete SVG string. `toSVGDataURI()` returns a data URI
that can be assigned to an image source or download link:

```js
import {
  encode,
  toSVG,
  toSVGDataURI,
} from '@sythos/js_barcode_universal';

const matrix = encode('SVG output', { format: 'qr' });
const svg = toSVG(matrix, { scale: 8, margin: 4 });
const uri = toSVGDataURI(matrix, {
  scale: 8,
  margin: 4,
  dark: '#111827',
});

document.querySelector('#barcode').src = uri;
console.log(svg.startsWith('<svg'));
// true
```

SVG is a good fit for responsive previews and print workflows. Treat the
payload separately from the generated markup, and do not concatenate decoded
barcode text into an HTML context without escaping it.

## PNG

`toPNG()` and `toPNGDataURI()` are asynchronous because PNG encoding returns a
byte array and is allowed to yield through the platform:

```js
import {
  encode,
  toPNG,
} from '@sythos/js_barcode_universal';

const matrix = encode('PNG output', { format: 'datamatrix' });
const bytes = await toPNG(matrix, { scale: 10, margin: 4 });

const blob = new Blob([bytes], { type: 'image/png' });
const href = URL.createObjectURL(blob);
const link = document.querySelector('#download');
link.href = href;
link.download = 'barcode.png';
link.click();
```

In Node.js, the SDK still does not write files for you; pair the returned bytes
with the built-in filesystem API:

```js
import { writeFile } from 'node:fs/promises';
import {
  encode,
  toPNG,
} from '@sythos/js_barcode_universal';

const matrix = encode('node png', { format: 'qr' });
const bytes = await toPNG(matrix, { scale: 8, margin: 4 });
await writeFile('barcode.png', bytes);
```

`toPNG()` returns `Promise<Uint8Array>`, so it can be used in a Worker or a
server without a DOM.

## ImageData-shaped output

`toImageData()` returns a plain object with `Uint8ClampedArray` data, width and
height. It is deliberately usable in Node and Workers without constructing a
DOM `ImageData` instance:

```js
import {
  decode,
  encode,
  toImageData,
} from '@sythos/js_barcode_universal';

const matrix = encode('pixels', { format: 'qr' });
const image = toImageData(matrix, {
  scale: 6,
  margin: 4,
  light: 'none',
});

console.log(image.width, image.height, image.data.length);
const [hit] = decode(image, { formats: ['qr'] });
console.log(hit?.text);
// pixels
```

In a browser, pass the object to `ctx.putImageData()` when a real `ImageData`
instance is required, or pass it directly to this SDK’s `decode()` function.
For a linear barcode, use `barHeight` because the encoded matrix is one module
tall.

## Canvas drawing

`toCanvas()` is the universal synchronous 2D path and returns `true` when it
drew. `renderToCanvasAuto()` returns the backend name and can choose WebGL2 or
fall back to 2D:

```js
import {
  encode,
  renderToCanvasAuto,
  toCanvas,
} from '@sythos/js_barcode_universal';

const canvas = document.querySelector('#barcode');
const matrix = encode('canvas output', { format: 'qr' });

const drawn = toCanvas(matrix, canvas, { scale: 8, margin: 4 });
const autoCanvas = document.querySelector('#barcode-auto');
const backend = renderToCanvasAuto(matrix, autoCanvas, {
  backend: 'auto',
  scale: 8,
  margin: 4,
});

console.log({ drawn, backend: backend.backend });
```

Use the asynchronous variant when WebGPU is useful for the drawing workload:

```js
import {
  encode,
  renderToCanvasAutoAsync,
} from '@sythos/js_barcode_universal';

const matrix = encode('async canvas', { format: 'qr' });
const result = await renderToCanvasAutoAsync(matrix, canvas, {
  backend: 'auto',
  scale: 6,
});

console.log(result.backend);
// webgpu, webgl2, 2d or none
```

The GPU paths accelerate drawing. They do not move QR, Reed–Solomon or other
barcode encoding algorithms onto the GPU. The 2D path remains the fallback for
browsers that do not expose WebGL2 or WebGPU.

## No quiet zone in the matrix

If you use the matrix directly, add a margin yourself:

```js
const printable = matrix.withMargin(4);
const enlarged = printable.scale(4);
```

The renderers already perform the equivalent work from their options. Avoid
interpolated image resizing after rendering: nearest-neighbour scaling keeps
module boundaries crisp, while blurred edges can make a valid symbol fail to
read.
