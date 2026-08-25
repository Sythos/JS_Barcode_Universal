# API overview

The public API is deliberately small. It follows one piece of data through
three clear stages:

1. an encoder turns text or bytes into a [`BitMatrix`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/src/ts/core/bit-matrix.d.ts);
2. a renderer turns that matrix into SVG, PNG, canvas pixels or an
   `ImageData`-shaped object;
3. a decoder validates an image and returns zero or more decoded results.

That separation keeps the barcode code independent from the browser, Node.js,
Workers and whatever image adapter your application already uses. The package
is ESM-first, ships JavaScript and TypeScript declarations, and has no runtime
dependencies.

For installation choices, see [Installation](../installation.md). For a quick
end-to-end start, see [Getting started](../getting-started.md).

## The root entry point

Most applications need only the package root:

```js
import {
  decode,
  decodeStrict,
  encode,
  listFormats,
  toImageData,
  toSVG,
} from '@sythos/js_barcode_universal';
```

The stable root surface contains these main groups:

| Group | Exports | What it does |
| --- | --- | --- |
| Registry | `listFormats`, `VERSION` | Describes the release and its read/write capability flags. |
| Encoding | `encode` plus format-specific encoders | Creates a `BitMatrix` from a payload. |
| Reading | `decode`, `decodeStrict` plus format-specific decoders/detectors | Reads RGBA image data or an exact sampled matrix. |
| Rendering | `toSVG`, `toSVGDataURI`, `toPNG`, `toPNGDataURI`, `toImageData`, `toCanvas` | Produces portable output. |
| Accelerated drawing | `renderToCanvasAuto`, `renderToCanvasAutoAsync`, `isWebGL2Available`, `isWebGPUAvailable` | Selects a canvas drawing backend. |
| Image primitives | `LuminanceSource`, `binarize`, `binarizeGlobal`, `binarizeHybrid` | Converts image-shaped data into detector input. |
| Core primitives | `BitMatrix`, `BarcodeError`, `EncodeError`, `NotFoundError`, `FormatError`, `ChecksumError` | Exposes the common matrix and error types. |

The declarations in [`src/index.d.ts`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/src/index.d.ts) are the root API
contract. The TypeScript implementation and the declarations beside it live
under [`src/ts/`](https://github.com/Sythos/JS_Barcode_Universal/tree/main/src/ts/); those files are useful references, but an
application should import the package root or one of the documented exports.

## A complete round trip

This example runs in Node.js or any ESM-capable browser. It creates a QR Code,
renders it into the plain image shape accepted by the reader, and reads it
back:

```js
import {
  decode,
  encode,
  toImageData,
} from '@sythos/js_barcode_universal';

const payload = 'Greetings My Lord Sythos';
const matrix = encode(payload, { format: 'qr', ecc: 'M' });
const image = toImageData(matrix, { scale: 8, margin: 4 });
const results = decode(image, { formats: ['qr'] });

if (results.length !== 1 || results[0].text !== payload) {
  throw new Error('The generated symbol was not verified');
}

console.log(results[0].format, results[0].text);
// qr Greetings My Lord Sythos
```

`encode()` returns modules, not pixels. It does not add a quiet zone. The
renderer adds the margin because a screen preview, an SVG export and a printed
label may need different output dimensions.

## Ask the registry instead of guessing

Format names are intentionally data-driven. `listFormats()` returns
`FormatInfo[]` entries with an `id`, human label, `kind`, `canWrite` and
`canRead` flag:

```js
import { listFormats } from '@sythos/js_barcode_universal';

const readable = listFormats().filter((item) => item.canRead);
const writeOnly = listFormats().filter((item) => item.canWrite && !item.canRead);

console.log(readable.map((item) => item.id));
console.log(writeOnly.map((item) => item.id));
// Pharmacode is currently the notable write-only entry.
```

EAN-2 and EAN-5 are marked as supplements. They are not standalone EAN/UPC
parents in a retail layout; use the dedicated add-on helpers when composing a
complete symbol. The registry is the release-time authority, so an application
that builds a format picker should consume it rather than hard-code a count.

## Reading is intentionally conservative

`decode()` returns `[]` when an image does not contain a symbol that passes the
requested detector and validation checks. That is a normal outcome for a
camera frame. It does not return a partial payload simply because some modules
look plausible.

Use `decodeStrict()` only at a boundary where “nothing found” is exceptional:

```js
import { decodeStrict } from '@sythos/js_barcode_universal';

try {
  const result = decodeStrict(image, { formats: ['pdf417'] });
  console.log(result.text);
} catch (error) {
  // NotFoundError, FormatError or ChecksumError can reach this boundary.
  console.error('No validated PDF417 symbol:', error.message);
}
```

Inside a continuous camera loop, prefer `decode()` and treat an empty array as
“scan the next frame”. See [Reading and decoding](decoding.md) for the input
contract, camera profile and result metadata.

## Errors and validation

The root exports five error classes:

| Error | Typical meaning |
| --- | --- |
| `BarcodeError` | Common base class for SDK barcode errors. |
| `EncodeError` | Payload or encoding options cannot produce the requested symbol. |
| `NotFoundError` | A strict operation found no valid symbol. |
| `FormatError` | A sampled matrix or format structure is malformed. |
| `ChecksumError` | Error correction or checksum validation failed. |

The exact operation decides whether an error is thrown or converted into an
empty result. Never use decoded text as a command, URL or trusted identifier
without applying the validation and allowlisting rules of your own application.

## Source and package boundaries

The package’s public subpaths are declared in [`package.json`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/package.json)
and documented in [Subpath exports](subpath-exports.md). Deep imports into
unlisted source files are not part of the compatibility contract. The committed
browser examples remain the most concrete platform references:

- [Create example](https://github.com/Sythos/JS_Barcode_Universal/blob/main/examples/create.html) for generation and rendering;
- [Read example](https://github.com/Sythos/JS_Barcode_Universal/blob/main/examples/read.html) for image input and camera reading.
