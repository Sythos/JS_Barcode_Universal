# Read a barcode from pixels

The reader accepts an image-shaped object, not a filename, `<img>`, `<video>`
or encoded PNG buffer. Your application owns the image adapter; the SDK owns
validation, detection and format decoding.

## Read a generated image

This is a deterministic local round trip that is useful in a test or a first
integration:

```js
import {
  decode,
  encode,
  toImageData,
} from '@sythos/js_barcode_universal';

const expected = 'read me once';
const matrix = encode(expected, { format: 'qr', ecc: 'Q' });
const image = toImageData(matrix, { scale: 6, margin: 4 });
const results = decode(image, { formats: ['qr'] });

if (results.length !== 1 || results[0].text !== expected) {
  throw new Error('The generated symbol was not validated');
}

console.log(results[0].format, results[0].text);
```

This proves that the current implementation can read its own generated matrix.
It is regression coverage, not independent interoperability evidence. Use the
[black-box and release checks](../release-verification.md) when that distinction
matters.

## Adapt a browser canvas

`ImageData` already has the required RGBA shape:

```js
import { decode } from '@sythos/js_barcode_universal';

const context = canvas.getContext('2d', { willReadFrequently: true });
if (!context) throw new Error('A 2D canvas context is required');

const frame = context.getImageData(0, 0, canvas.width, canvas.height);
const results = decode(frame, {
  formats: ['qr', 'datamatrix', 'pdf417'],
  binarizer: 'auto',
});

const first = results[0];
status.textContent = first
  ? `${first.format}: ${first.text}`
  : 'No validated symbol in this frame';
```

Canvas extraction can fail before the SDK is called when a cross-origin image
taints the canvas. Configure CORS or use a same-origin resource. Display both
decoded text and error messages with `textContent`, never `innerHTML`.

## Adapt an external RGBA buffer

An image adapter can provide any supported byte container, as long as the data
is row-major RGBA and the dimensions match the buffer:

```js
import { decode } from '@sythos/js_barcode_universal';

const image = {
  data: new Uint8ClampedArray(rgbaBytes),
  width: 1280,
  height: 720,
};

const results = decode(image, {
  formats: ['pdf417'],
  profile: 'camera',
  tryHarder: true,
});
```

The SDK rejects non-positive or fractional dimensions, short buffers and
oversized rasters. It accepts `Uint8Array`, `Uint8ClampedArray` and validated
`number[]` channel data. Encoded JPEG/PNG bytes are not RGBA pixels; decode the
file with an application-owned image library first.

## Restrict the format set

If an application knows what it expects, pass `formats`:

```js
const results = decode(image, { formats: ['code128'] });

for (const result of results) {
  if (result.format !== 'code128') continue;
  acceptCode128Text(result.text);
}
```

This reduces detector work and prevents a valid symbol of an unexpected family
from being accepted by a broad scan. The runtime registry is available through
`listFormats()` when a UI must build its list dynamically.

## Handle no-result frames correctly

An empty array is normal. A camera or file can be valid but contain no symbol,
or the symbol can be too small, blurred, clipped or outside the supported
variant. Do not turn a candidate bounding box, partial payload or low-confidence
guess into application data.

```js
const results = decode(image, { formats: ['qr'], profile: 'camera' });

if (results.length === 0) {
  // Continue the capture loop or ask for a clearer image.
  return;
}

const result = results[0];
if (!isAllowedPayload(result.text)) return;
showResultAsText(result.text);
```

Use `decodeStrict()` only at a controlled batch boundary where “nothing found”
is exceptional. In a continuous loop, `decode()` keeps normal misses out of
exception-based control flow. See [camera-loop.md](camera-loop.md) for a
bounded repeated reader.

## Use a typed result

TypeScript consumers can retain the public result shape without importing
implementation modules:

```ts
import {
  decode,
  type DecodeResult,
} from '@sythos/js_barcode_universal';

const results: DecodeResult[] = decode(image, { formats: ['qr'] });
const text = results[0]?.text ?? null;
```

The optional metadata differs by symbology. `rotation`, `bounds`, `confidence`
and `quality` are evidence for a camera overlay, not a replacement for your
own payload and business validation.
