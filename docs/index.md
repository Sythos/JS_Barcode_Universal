# Sythos Barcode Universal documentation

Sythos Barcode Universal is an MIT-licensed JavaScript and TypeScript SDK for
writing and reading 1D and 2D barcodes. It has zero runtime dependencies and
works in browsers, Web Workers and Node.js 24 or newer.

The short version is simple: give the SDK text when you want a symbol, or an
image-shaped object when you want a read. Everything in between stays plain,
inspectable code. No native addon, WebAssembly module or mystery service is
required.

## Start here

### Install the package

```sh
npm install @sythos/js_barcode_universal
```

The package is ESM-first. It exposes the root API plus focused subpaths for
format families, rendering and lower-level building blocks. The published
package has no runtime dependencies; TypeScript is used by the project’s
development and validation toolchain, not installed as a runtime dependency of
your application.

### Your first JavaScript round trip

This complete ESM example creates a QR symbol, renders it into the plain image
shape accepted by the reader, and reads it back. The same flow works with a
real camera frame or an image decoded by your own browser/Node adapter.

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

if (results.length === 0) {
  throw new Error('No valid QR code found');
}

console.log(results[0].format); // qr
console.log(results[0].text);   // Greetings My Lord Sythos
```

`encode()` returns a `BitMatrix`. It contains barcode modules, not pixels and
not a DOM element. `toImageData()` adds the quiet zone and produces a plain
`{ data, width, height }` object. That object is deliberately close to the
browser `ImageData` shape, so it can be passed to `decode()` without a canvas.

### The same round trip in TypeScript

The public package entry point includes declarations, so the first example can
be typed without importing implementation files:

```ts
import {
  decode,
  encode,
  toImageData,
  type DecodeResult,
} from '@sythos/js_barcode_universal';

const payload = 'Greetings My Lord Sythos';
const matrix = encode(payload, { format: 'qr', ecc: 'M' });
const image = toImageData(matrix, { scale: 8, margin: 4 });
const results: DecodeResult[] = decode(image, { formats: ['qr'] });
const first = results[0];

if (!first) {
  throw new Error('No valid QR code found');
}

console.log(`${first.format}: ${first.text}`);
```

The declarations describe the same JavaScript runtime surface. TypeScript does
not change the barcode algorithms or add a runtime dependency to the SDK.

## What the SDK covers

The runtime registry is the authority for the exact release capability matrix.
Call `listFormats()` instead of maintaining a hand-written count in an app or
documentation page:

```js
import { listFormats } from '@sythos/js_barcode_universal';

for (const format of listFormats()) {
  console.log(
    `${format.id}: write=${format.canWrite} read=${format.canRead}`,
  );
}
```

The current implementation covers these families:

| Family | Examples | Important note |
| --- | --- | --- |
| Linear 1D | EAN/UPC, ISBN, Code 11, Code 39, Code 93, Code 128, ITF, ITF-14, Code 25, Industrial/IATA 2 of 5, Codabar, MSI, Code 32, PZN, Telepen and Pharmacode | Writing and reading are separate capabilities. Pharmacode is intentionally write-only; Code 25 aliases, pharmaceutical variants and Telepen Numeric remain explicit modes. |
| QR family | QR Code, Micro QR Code and rMQR Code | Profile and feature support is narrower than the names alone suggest; check the format metadata and the format guide when available. |
| Matrix 2D | Data Matrix ECC 200, Aztec Code, Aztec Rune and MaxiCode | The reader returns no result when validation does not establish a trustworthy symbol. |
| PDF417 family | PDF417, Compact PDF417 and MicroPDF417 | These formats expose different geometry and metadata; they are not interchangeable aliases. |
| Project profile | Sythos Canvas QR profile | This is a Sythos profile, not DENSO FrameQR compatibility or certification. |
| GS1 | GS1 DataBar Omnidirectional/Truncated, Limited, Stacked, Stacked Omnidirectional and Expanded plus GS1-128-related paths | EAN-2 and EAN-5 are parent-bound supplements and need a validated EAN/UPC parent; Expanded Stacked remains outside scope. |
| MaxiCode | Fixed 30×33 Modes 2–5 | The detector is intentionally limited to one clean, prominent symbol; see the dedicated format guide. |

`canWrite` answers whether the release can create the format. `canRead`
answers whether its generic image pipeline can identify and decode it. A
write-only or parent-bound entry is a deliberate contract, not a decoder
failure hidden behind a friendly label.

## Pick the right input and output

The core API stays independent of the platform around it:

- **Encode:** `encode(text, options)` returns a `BitMatrix`.
- **Render:** `toSVG`, `toPNG`, `toImageData` and `toCanvas` turn that matrix
  into a useful output.
- **Decode:** `decode(image, options)` returns an array and returns `[]` when
  no validated symbol is found.
- **Strict decode:** `decodeStrict(image, options)` throws when no symbol is
  found, which is useful at a controlled boundary but usually not inside a
  continuous camera loop.

An input image must have this shape:

```js
{
  data: Uint8ClampedArray | Uint8Array | number[],
  width: number,
  height: number,
}
```

The data is RGBA, four values per pixel, row-major. A browser canvas can supply
it with `ctx.getImageData(0, 0, width, height)`. A Worker or Node adapter can
provide the same shape without constructing a DOM `ImageData` object.

For a runnable browser reference, see the repository’s [create example](https://github.com/Sythos/JS_Barcode_Universal/blob/main/examples/create.html)
and [read example](https://github.com/Sythos/JS_Barcode_Universal/blob/main/examples/read.html). They use the checked-in IIFE bundle
and demonstrate file input, camera permissions, rendering and safe display of
decoded text.

## Camera and image-reading expectations

Camera reading is a progressive enhancement, not a promise that every browser
or every photograph will decode every symbol. The browser must grant camera
access, and `getUserMedia()` normally requires HTTPS or localhost. The input
pipeline should resize very large frames, preserve enough module detail, and
pass only a coherent frame to the decoder.

For a camera loop, treat an empty result as normal:

```js
const hits = decode(frameImage, {
  profile: 'camera',
  tryHarder: true,
});

if (hits.length > 0) {
  // Stop the loop only after the SDK has returned a validated result.
  console.log(hits[0].format, hits[0].text);
}
```

The camera profile reports validation evidence such as confidence, bounds,
rotation and quality when available. It is still the caller’s job to decide
whether a result should be accepted once, displayed, or required to remain
stable across multiple frames. Do not treat a partial or low-quality visual
guess as application data.

## Security and trust boundaries

Decoded barcode content is untrusted input. Display it as text, validate URLs
before navigating, and keep application-specific actions behind an explicit
allowlist. The SDK does not decide whether a URL, command, account identifier
or GS1 field is safe for your application.

Render dimensions are also input. Keep `scale`, `margin`, `barHeight` and the
source image dimensions within an application-appropriate budget, especially
when values come from a request, form or remote configuration. A barcode reader
should return no result when detection or checksum validation is not convincing
enough; “almost readable” is not a useful success state.

For the project’s reporting boundary and contact rules, read
[SECURITY.md](https://github.com/Sythos/JS_Barcode_Universal/blob/main/SECURITY.md). The repository’s [security automation](https://github.com/Sythos/JS_Barcode_Universal/tree/main/.github/workflows)
and package validation are useful release checks, but a green workflow is not a
substitute for reviewing the inputs and trust boundary of the application that
embeds the SDK.

## Licensing and provenance

The distributed SDK is released under the [MIT License](https://github.com/Sythos/JS_Barcode_Universal/blob/main/LICENSE). The
provenance and engineering notes are collected in [NOTICE.md](https://github.com/Sythos/JS_Barcode_Universal/blob/main/NOTICE.md)
and the files under [`licenses/`](https://github.com/Sythos/JS_Barcode_Universal/tree/main/licenses/). Those notes document the
materials and verification boundaries used by the project; they are not a
patent opinion, trademark clearance or certification.

Independent barcode implementations may be used as black-box verification
oracles. That does not make their source code, tables or licenses part of this
SDK. In particular, DENSO SQRC and Face Authentication SQRC are excluded from
this MIT distribution; an integrator would need the appropriate rights and a
separate adaptation before using those formats.

## Documentation map

This landing page is the first user-facing page of the documentation set. The
[documentation architecture record](https://github.com/Sythos/JS_Barcode_Universal/blob/main/docs/DOCS_ARCHITECTURE.md)
explains the source map, ownership rules and the navigation in more detail.

Existing repository references:

- [Project README](https://github.com/Sythos/JS_Barcode_Universal/blob/main/README.md) — the compact project overview and current
  release-facing quick start.
- [Create example](https://github.com/Sythos/JS_Barcode_Universal/blob/main/examples/create.html) — browser-side generation and
  rendering.
- [Read example](https://github.com/Sythos/JS_Barcode_Universal/blob/main/examples/read.html) — image input and progressive camera
  reading.
- [Project plan](https://github.com/Sythos/JS_Barcode_Universal/blob/main/PLAN.md) — implemented formats, exclusions and future
  work.
- [Machine-readable summary](https://github.com/Sythos/JS_Barcode_Universal/blob/main/llms.txt) — concise facts for tools and
  external indexing systems.

The following destinations are either complete or planned for later milestones;
the list stays explicit so this page does not pretend that unfinished pages
already exist:

- **M1:** landing, installation and getting-started foundation — complete.
- **M2:** API reference for encoding, decoding, rendering, TypeScript and
  subpath exports — complete.
- **M3:** format-by-format capability and limitation guides — complete; start
  with the [format catalogue](formats/overview.md).
- **M4:** browser, Node.js, Worker, camera, image-pipeline and performance
  guides — complete; start with the [browser guide](guides/browser.md) or the
  [camera guide](guides/camera-reading.md).
- **M5:** dedicated security, licensing and release-verification guides —
  complete; start with the [security guide](guides/security.md) or the
  [release verification checklist](release-verification.md).
- **M6:** focused recipes, FAQ and troubleshooting pages — complete; start
  with the [create recipe](examples/create-barcode.md), [FAQ](faq.md) or
  [troubleshooting guide](troubleshooting.md).
- **M7:** link checks, navigation coverage and generated capability checks —
  complete; CI runs `tools/check-docs.mjs` before the Pages build.
- **M8:** README, PLAN, package metadata and machine-readable release
  integration — complete; all public entry points link to the same Pages site.
- **M9:** MkDocs Material configuration and automatic GitHub Pages deployment
  on documentation changes — implemented.
- **M10:** first public Pages deployment, custom-domain/SEO checks and
  consumer-side verification — complete; the site is live at
  [sythos.github.io/JS_Barcode_Universal](https://sythos.github.io/JS_Barcode_Universal/).

Until the remaining pages land, this file links only to checked-in repository files.
That little rule prevents the documentation menu from becoming a collection of
beautiful 404s. The Pages workflow follows the same rule and publishes only
the checked-in navigation.

## Build and verification notes

Documentation changes do not alter the published runtime surface. Before a
release, the project’s normal checks should still be run from the repository
root:

```sh
npm run types
npm run types:api
node .github/ci/validate-package.mjs
node tools/check-zero-deps.mjs
npm pack --dry-run --ignore-scripts --no-audit --no-fund --json
```

For a documentation-only change, `git diff --check` is the first useful local
gate. The release version remains owned by `package.json`; examples and guides
should avoid hard-coding patch versions unless they are explicitly documenting
a historical release.

The onboarding and installation pages are part of the checked-in M1
foundation. Future milestones can extend the guides without changing the
published runtime surface.
