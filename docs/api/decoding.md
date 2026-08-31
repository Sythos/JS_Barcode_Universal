# Reading and decoding

The reader accepts pixels, not a browser element. Give it an object with RGBA
bytes, width and height, and it will locate, validate and decode supported
symbols. That keeps the API usable with a canvas, an `OffscreenCanvas`, a
Worker, Node.js image tooling or a test fixture.

## The general reader

```ts
decode(image: ImageLike, options?: DecodeOptions): DecodeResult[]
decodeStrict(image: ImageLike, options?: object): DecodeResult
```

`decode()` returns every validated result it can find for the requested image.
An empty array means “nothing valid in this frame”; it is not an exceptional
condition and is exactly what a camera loop should expect.

The input shape is:

```ts
type ImageLike = {
  data: Uint8ClampedArray | Uint8Array | number[];
  width: number;
  height: number;
};
```

`data` is RGBA, four values per pixel, in row-major order. A browser can pass
the result of `ctx.getImageData(0, 0, width, height)` directly. Transparent
pixels are treated as white by the luminance conversion, which prevents a
transparent quiet zone from turning into artificial black ink.

## Decoder options

| Option | Meaning |
| --- | --- |
| `formats` | Restrict the scan to format ids such as `['qr', 'pdf417']`. Omitting it allows the normal supported-format search. |
| `tryHarder` | Enables the additional retry work used by the reader. It defaults to `true` in the root API. |
| `binarizer` | Selects `'global'`, `'hybrid'` or `'auto'` thresholding. |
| `profile` | Set to `'camera'` for stricter camera-oriented validation. |
| `frameqr` | Passes profile-specific options to the Sythos Canvas QR detector. |
| `customerEncoding` | For Australia Post, select `'character'` or `'numeric'` customer-data groups. |
| `custinfoenc` | Compatibility alias for `customerEncoding`. |

Narrow the `formats` list when the application knows what it is looking for.
That reduces work and avoids interpreting a specialised symbol through an
unwanted format path.

## A complete image round trip

```js
import {
  decode,
  encode,
  toImageData,
} from '@sythos/js_barcode_universal';

const expected = 'read me once';
const generated = encode(expected, { format: 'qr', ecc: 'Q' });
const image = toImageData(generated, { scale: 6, margin: 4 });

const hits = decode(image, {
  formats: ['qr'],
  binarizer: 'auto',
  tryHarder: true,
});

if (hits.length === 0) {
  throw new Error('No validated QR Code was found');
}

console.log(hits[0].format, hits[0].text);
// qr read me once
```

The same call works with an actual camera frame after the application has
copied it into the `ImageLike` shape. The SDK does not request camera access,
draw video frames or manage permissions; those are platform responsibilities.

## Result shape

Every result has the required fields `text` and `format`. Other fields are
optional because different symbologies expose different evidence:

| Field | Present for or useful with |
| --- | --- |
| `bytes` | Byte-oriented payloads. |
| `segments` | PDF417-family compaction segments, in source order. |
| `version`, `ecc` | QR-family metadata. |
| `layers`, `compact`, `corrections` | Aztec metadata and Reed–Solomon work. |
| `rows`, `columns`, `eccLevel`, `rowHeight` | PDF417-family geometry and correction metadata; `rows` and `rowHeight` also describe stacked Code 16K symbols. |
| `moduleSize`, `checksum` | Integer-scale stacked detection and validated row or overall checks for Codablock-F and Code 16K. |
| `variant`, `eccCodewords` | MicroPDF417 variant metadata. |
| `checkDigit`, `pznVariant` | Validated optional numeric checks and PZN-7/PZN-8 identification. |
| `profile`, `certified`, `canvas` | Sythos Canvas QR profile metadata. `certified` is `false` for this project profile. |
| `addon` | An attached EAN-2 or EAN-5 supplement. |
| `confidence`, `bounds`, `rotation`, `quality` | Camera-profile evidence when the detector exposes it. |
| `gs1`, `symbologyIdentifier`, `elements`, `gs1ParseError`, `gtin`, `linkage` | GS1 classification and parsed fields. |

Treat all decoded text and parsed fields as untrusted input. The reader proves
that a symbol is structurally valid; it does not decide whether the payload is
safe for a business action.

## Strict mode belongs at controlled boundaries

`decodeStrict()` throws instead of returning an empty result:

```js
import {
  ChecksumError,
  FormatError,
  NotFoundError,
  decodeStrict,
} from '@sythos/js_barcode_universal';

try {
  const result = decodeStrict(image, { formats: ['datamatrix'] });
  console.log(result.text);
} catch (error) {
  if (error instanceof NotFoundError ||
      error instanceof FormatError ||
      error instanceof ChecksumError) {
    console.log('The image did not contain a validated Data Matrix');
  } else {
    throw error;
  }
}
```

For repeated frames, use `decode()` instead. Throwing for every empty frame
turns an ordinary camera condition into noisy application control flow.

## Camera profile

The optional camera profile asks for stricter validation of camera-oriented
reads:

```js
function readCameraFrame(frame) {
  const hits = decode(frame, {
    profile: 'camera',
    formats: ['qr', 'pdf417', 'datamatrix'],
    tryHarder: true,
  });

  if (!hits[0]) return null;

  const { text, format, confidence, rotation, quality } = hits[0];
  return { text, format, confidence, rotation, quality };
}
```

The returned quality fields are evidence, not a promise that a result should
be acted on. Applications should still debounce repeated results, cap frame
dimensions and require a stable payload when the surrounding workflow is
sensitive. A failed or incoherent frame must produce no application action.

The current detector contracts expose quarter-turn and, where supported by the
camera profile, 45-degree orientation metadata. Arbitrary perspective, blur,
glare and severe module loss remain image-quality problems, not options that
can be solved by setting `tryHarder` forever.

## Lower-level image pipeline

Use the image primitives when you already own a binary image or need a
format-specific detector:

```js
import {
  LuminanceSource,
  binarize,
} from '@sythos/js_barcode_universal';
import {
  detectAndDecodeQR,
} from '@sythos/js_barcode_universal/qr';

const source = LuminanceSource.fromImageData(image);
const binary = binarize(source, 'auto');
const qrHits = detectAndDecodeQR(binary);

for (const hit of qrHits) {
  console.log(hit.text, hit.corners);
}
```

The lower-level QR detector consumes a `BitMatrix` containing the complete
binarized image. Its exact decoder consumes an already sampled, square symbol
without a quiet zone. That distinction matters:

```js
import { decodeQR } from '@sythos/js_barcode_universal/qr';

// sampledMatrix must be the exact QR module grid, not a camera frame.
const exact = decodeQR(sampledMatrix);
```

Use the root reader unless you have a good reason to own detection, sampling
and format selection yourself.

## Accuracy and safety boundaries

The reader is designed to reject partial or ambiguous symbols. It cannot make
a low-resolution or badly exposed photograph trustworthy by returning a guess.
Keep image dimensions within a practical application budget (the project’s
security guidance calls out a high but finite image-pixel ceiling), resize
oversized photos before scanning, and validate any action derived from `text`.
