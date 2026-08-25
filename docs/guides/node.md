# Node.js guide

The package is native ESM and declares Node.js **24 or newer**. It has zero
runtime dependencies, so Node provides the module loader and file primitives;
the SDK provides barcode encoding, decoding and rendering. There is no hidden
image codec, filesystem scan or native addon.

Use the package root or a public subpath from `package.json` in both JavaScript
and TypeScript applications. The package is ESM-only: use `import` in an ESM
application rather than a CommonJS `require()` call. TypeScript consumes the
same JavaScript entry point and receives the matching declarations; do not
import implementation files from `src/ts/`.

## A complete Node round trip

Save this as `barcode.mjs` in an application that has installed
`@sythos/js_barcode_universal`:

```js
import { writeFile } from 'node:fs/promises';
import {
  decode,
  encode,
  toImageData,
  toPNG,
  toSVG,
} from '@sythos/js_barcode_universal';

const payload = 'Greetings My Lord Sythos';
const matrix = encode(payload, { format: 'qr', ecc: 'M' });

// The matrix is modules, not pixels. Render it into the SDK's plain RGBA shape.
const image = toImageData(matrix, { scale: 8, margin: 4 });
const hits = decode(image, { formats: ['qr'] });

if (hits.length !== 1 || hits[0].text !== payload) {
  throw new Error('The generated QR code was not validated by the reader');
}

await writeFile('barcode.svg', toSVG(matrix, { scale: 8, margin: 4 }));
await writeFile('barcode.png', await toPNG(matrix, { scale: 8, margin: 4 }));

console.log({ format: hits[0].format, text: hits[0].text });
```

Run it with:

```sh
node barcode.mjs
```

Expected output:

```text
{ format: 'qr', text: 'Greetings My Lord Sythos' }
```

The bytes written to `barcode.png` come from the SDK's `Uint8Array` and Node's
built-in filesystem API. `toPNG()` is asynchronous because it produces a
complete PNG byte stream; `toSVG()` is synchronous and returns a string.

The same flow can use focused public exports when the application only needs a
format and a renderer:

```js
import { encodeQR } from '@sythos/js_barcode_universal/qr';
import { toSVG } from '@sythos/js_barcode_universal/render/svg';

const svg = toSVG(encodeQR('NODE-SUBPATH', { ecc: 'M' }), {
  scale: 6,
  margin: 4,
});
```

For a typed Node application, keep the import specifier unchanged and let the
application's TypeScript toolchain check the declarations:

```ts
import {
  decode,
  encode,
  toImageData,
  type DecodeResult,
} from '@sythos/js_barcode_universal';

const matrix = encode('NODE-TS', { format: 'qr' });
const image = toImageData(matrix, { scale: 6, margin: 4 });
const results: DecodeResult[] = decode(image, { formats: ['qr'] });

if (results[0]?.text !== 'NODE-TS') {
  throw new Error('The generated QR code was not validated');
}
```

## Reading an external image

`decode()` deliberately does not parse PNG, JPEG, WebP or TIFF files. It accepts
an image-shaped value:

```js
const rgbaImage = {
  data: new Uint8ClampedArray(rgbaBytes),
  width: 1280,
  height: 720,
};

const results = decode(rgbaImage, {
  formats: ['qr', 'pdf417'],
  tryHarder: true,
  binarizer: 'auto',
});
```

Your application or an image adapter must turn the source file or camera frame
into four-channel, row-major RGBA bytes. That boundary is intentionally
explicit: the SDK stays dependency-free and the choice of image decoder remains
with the application. Do not pass encoded PNG bytes as if they were RGBA
pixels. The [image pipeline guide](image-pipeline.md) lists the accepted array
types, alpha behavior and hard limits.

If your adapter produces a single-channel image, expand it to RGBA or use the
public `LuminanceSource.fromGrey()` path deliberately. The latter is useful for
an application that already owns validated greyscale bytes:

```js
import { LuminanceSource, binarize } from '@sythos/js_barcode_universal';

const source = LuminanceSource.fromGrey(greyscaleBytes, width, height);
const bits = binarize(source, 'global');
console.log(bits.width, bits.height);
```

The format-specific detector APIs consume a `BitMatrix`; the root `decode()`
function is normally the safer boundary because it applies the format registry,
validation and de-duplication for you.

## Format selection and trustworthy results

Pass `formats` when the application already knows what it expects. It reduces
work and avoids accepting a valid symbol of an unexpected family:

```js
const results = decode(rgbaImage, { formats: ['code128'] });

if (results.length === 0) {
  console.log('No validated Code 128 symbol found');
} else {
  for (const result of results) console.log(result.format, result.text);
}
```

`decode()` returns an array because one image can contain more than one symbol.
An empty array is an ordinary outcome. `decodeStrict()` returns the first result
or throws `NotFoundError`; use that at a controlled batch boundary, not as the
exception mechanism for every frame in a continuous scan.

`listFormats()` is the runtime capability source. It reports `canWrite` and
`canRead` separately, so a producer can reject an unsupported read expectation
before processing a large input:

```js
import { listFormats } from '@sythos/js_barcode_universal';

const pdf417 = listFormats().find((item) => item.id === 'pdf417');
if (!pdf417?.canRead) throw new Error('This release cannot read PDF417 images');
```

Pharmacode is intentionally write-only in the generic image reader, while
EAN-2/EAN-5 are parent-bound supplements. Do not infer a read guarantee from a
format name alone.

## Batch and service-side advice

- Validate file sizes and decode dimensions before creating the RGBA buffer.
- Restrict `formats` when the input contract knows the expected symbology.
- Reuse buffers where the upstream image adapter allows it, but remember that
  the SDK snapshots greyscale data at its boundary.
- Treat decoded text as untrusted application data. Validate URLs, identifiers
  and business fields before taking an action.
- Keep `tryHarder` and the camera profile for cases that need them; they can
  perform additional threshold and orientation work.
- Use a queue or bounded concurrency for batches. A large number of full camera
  frames processed in parallel is a memory problem before it is a barcode
  problem.

The same resource limits apply in Node as in a browser: positive safe-integer
dimensions, no more than 16,384 pixels on either side and no more than
16,777,216 pixels in total. Render options are bounded too. These checks are
part of the input boundary and should be allowed to fail loudly enough for the
caller to reject an untrusted job.

## What Node does not provide

Node has no `navigator.mediaDevices`, DOM canvas or browser camera permission
flow. A camera service must capture frames itself and hand the SDK RGBA data.
Likewise, rendering to SVG or PNG does not create a browser `<img>` or write a
file automatically; the application chooses the destination. For browser
capture and permission rules, read [Camera reading](camera-reading.md).
