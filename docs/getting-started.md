# Getting started

This guide takes the shortest useful path from an empty project to a verified
barcode round trip. The SDK is an ESM package with no runtime dependencies, so
there is no native module, browser plug-in or background service hiding behind
the first `npm install`.

## Install once

From an application directory:

```sh
npm install @sythos/js_barcode_universal
```

The package declares Node.js 24 or newer for Node consumers, with Bun working
as an alternative runtime. In a browser, use
the IIFE bundle or the ESM bundle described in [Installation](installation.md).
TypeScript declarations are included in the package; add TypeScript to your
own development toolchain only if your application compiles `.ts` files.

## Encode, render, decode

The core flow has three explicit steps:

1. `encode()` creates a `BitMatrix`.
2. A renderer turns that matrix into SVG, PNG, canvas pixels or the plain image
   object used by the reader.
3. `decode()` validates the image and returns zero or more results.

Here is a complete Node.js (or Bun) or ESM application example:

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
  throw new Error('The generated QR code was not verified');
}

console.log(results[0].format, results[0].text);
```

Expected output is:

```text
qr Greetings My Lord Sythos
```

The round trip above proves that this input and this renderer output can pass
through the same release. It is not a substitute for an independent scanner
check when you are validating a new physical format or print process.

## Use TypeScript without changing the runtime

The public package root supplies declarations for the same JavaScript entry
points:

```ts
import {
  decode,
  encode,
  toImageData,
  type DecodeResult,
} from '@sythos/js_barcode_universal';

const matrix = encode('TS-START', { format: 'code128' });
const image = toImageData(matrix, { scale: 4, margin: 4, barHeight: 64 });
const results: DecodeResult[] = decode(image, { formats: ['code128'] });

if (!results[0]) {
  throw new Error('No validated Code 128 result');
}

console.log(results[0].text);
```

TypeScript is a development-time compiler and type-checker. It does not add a
runtime dependency to the published SDK and it does not replace the JavaScript
modules consumed by Node, Bun or a browser.

## Let the registry describe the release

Do not guess how a format behaves from its name. The runtime registry exposes
writing and reading separately:

```js
import { listFormats } from '@sythos/js_barcode_universal';

const writable = listFormats().filter((format) => format.canWrite);
const readable = listFormats().filter((format) => format.canRead);

console.log({ writable: writable.length, readable: readable.length });
```

Some entries are intentionally qualified. Pharmacode is write-only in the
generic image reader, while EAN-2 and EAN-5 are supplements that need a
validated EAN/UPC parent. Treat those flags as API behavior, not as a missing
feature that an application should silently assume.

## Read your own image

The reader accepts a platform-neutral RGBA object:

```js
const image = {
  data: rgbaBytes,
  width: frameWidth,
  height: frameHeight,
};

const hits = decode(image, { formats: ['qr', 'datamatrix'] });
```

`data` must contain four channel values per pixel in row-major order. Browser
code can pass the `ImageData` values returned by
`CanvasRenderingContext2D.getImageData()`. A Worker or a Node or Bun adapter can create
the same shape without creating a DOM object.

An empty array is a normal result: it means the image did not produce a
validated symbol for the requested formats. Use `decodeStrict()` only at a
boundary where “nothing found” is exceptional; a continuous camera loop should
normally keep scanning instead of throwing for every empty frame.

## Where to go next

- [Installation options](installation.md) covers npm, CDN, bundles and source
  layout.
- [Create example](https://github.com/Sythos/JS_Barcode_Universal/blob/main/examples/create.html) shows browser-side generation.
- [Read example](https://github.com/Sythos/JS_Barcode_Universal/blob/main/examples/read.html) shows image input and camera setup.
- [Project README](https://github.com/Sythos/JS_Barcode_Universal/blob/main/README.md) contains the current compact API and format
  overview.
- [Security policy](https://github.com/Sythos/JS_Barcode_Universal/blob/main/SECURITY.md) defines reporting channels and impact
  boundaries.
- [Documentation architecture](https://github.com/Sythos/JS_Barcode_Universal/blob/main/docs/DOCS_ARCHITECTURE.md) explains the source map
  and the pages planned for later milestones.
