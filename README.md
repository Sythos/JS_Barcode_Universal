# Sythos Barcode Universal — MIT 1D/2D Barcode SDK

Open-source MIT-licensed JavaScript/TypeScript barcode generator and barcode reader SDK for encoding and decoding 1D linear and 2D matrix barcodes. It has zero runtime dependencies and runs in browsers, Web Workers and Node.js.

[![npm](https://img.shields.io/npm/v/@sythos/js_barcode_universal.svg)](https://www.npmjs.com/package/@sythos/js_barcode_universal) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Runtime dependencies: 0](https://img.shields.io/badge/runtime%20dependencies-0-brightgreen.svg)](package.json) [![ESM](https://img.shields.io/badge/ESM-supported-3178C6.svg?logo=javascript&logoColor=white)](https://nodejs.org/api/esm.html) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)

[![npm downloads](https://img.shields.io/npm/dm/%40sythos%2Fjs_barcode_universal.svg?label=npm%20downloads)](https://www.npmjs.com/package/@sythos/js_barcode_universal) [![GitHub last commit](https://img.shields.io/github/last-commit/Sythos/JS_Barcode_Universal.svg)](https://github.com/Sythos/JS_Barcode_Universal/commits/main/) [![GitHub issues](https://img.shields.io/github/issues/Sythos/JS_Barcode_Universal.svg)](https://github.com/Sythos/JS_Barcode_Universal/issues) [![Node](https://img.shields.io/node/v/%40sythos%2Fjs_barcode_universal.svg)](https://www.npmjs.com/package/@sythos/js_barcode_universal)

Original Sythos implementation, zero runtime dependencies, MIT. It runs unmodified in Node, in browsers
(including Safari on iOS) and in web workers. The core requires no canvas, no filesystem and no
DOM — images go in and come out as plain `{ data, width, height }` RGBA objects, which is exactly
what an `ImageData` is.

**The code is complete and entirely human-readable.** The full source ships. There is no
WebAssembly, no native addon, no compiled artefact, no binary blob and no minified file anywhere
in this repository — every tracked file is text you can open and read.

That includes the prebuilt bundles. They are *generated*, concatenated and wrapped from `src/` by
the project's own bundler, but nothing is stripped in the process:
[`bundle/sythos-barcode.js`](bundle/sythos-barcode.js) runs to roughly 7,900 lines, about a third
of them comments, averaging a little over 30 characters a line. Open it anywhere and you are
reading the same annotated code as the source, in the same order — a convenience, not a black box.

Don't take that on trust either; it takes one command:

```sh
awk '{ n += length($0) } END { print "lines:", NR, " avg length:", int(n/NR) }' bundle/sythos-barcode.js
```

A minified bundle gives you a handful of lines averaging thousands of characters. This one does
not, and that is the whole point.

This is deliberate. A barcode library decides what a scanner believes a label says, so it belongs
in the category of code you can audit rather than have to trust. Every constant table, every
check digit and every error-correction step is here in full, with the reasoning next to it.

```js
import { encode, decode, toSVG, toImageData } from './src/index.js';

const matrix = encode('https://example.com', { format: 'qr', ecc: 'M' });
const svg    = toSVG(matrix, { scale: 8 });

const found = decode(toImageData(matrix, { scale: 4 }), { formats: ['qr'] });
console.log(found[0].text);   // 'https://example.com'
```

---

## Quick start

There are four ways in, and none of them needs a build step.

> Full documentation lives at [sythos.github.io/JS_Barcode_Universal](https://sythos.github.io/JS_Barcode_Universal/).

### 1. npm

```sh
npm install @sythos/js_barcode_universal
```

`yarn add @sythos/js_barcode_universal` and `pnpm add @sythos/js_barcode_universal` do the same thing. Nothing is installed
alongside it — there are no runtime dependencies, no postinstall script and no native build. The
package is plain ESM (`"type": "module"`) and asks for Node 24 or newer.

```js
import { encode, decode, toSVG, toImageData } from '@sythos/js_barcode_universal';

const code = encode('SYT-2026-0042', { format: 'code128' });

const svg = toSVG(code, { scale: 2, margin: 10, barHeight: 60 });
// '<svg xmlns="http://www.w3.org/2000/svg" width="374" height="100" …'

const found = decode(toImageData(code, { scale: 4, margin: 10 }), { formats: ['code128'] });
console.log(found[0].text);   // 'SYT-2026-0042'
```

**Subpath exports** hand you one layer instead of the whole surface, which is what lets a
tree-shaking bundler drop everything you did not ask for. Importing only the QR writer and only
the SVG renderer never pulls in the 1D formats, the PNG encoder or the read pipeline:

```js
import { encodeQR } from '@sythos/js_barcode_universal/qr';
import { toSVG }    from '@sythos/js_barcode_universal/render/svg';

const svg = toSVG(encodeQR('https://example.com', { ecc: 'M' }), { scale: 8 });
// a 25×25 module symbol — 264×264 px at scale 8 with the default 4-module quiet zone
```

| Subpath | What it exports |
|---|---|
| `@sythos/js_barcode_universal` | The whole surface: `encode`, `decode`, every renderer, every error type |
| `@sythos/js_barcode_universal/core` | `BitMatrix`, `GaloisField`, Reed–Solomon, the error classes |
| `@sythos/js_barcode_universal/image` | `LuminanceSource`, the binarizers, grid sampling, `PerspectiveTransform` |
| `@sythos/js_barcode_universal/oned` | The per-format 1D writers (`encodeEAN13`, `encodeCode128`, `encodeCode32`, `encodePZN`, `encodeTelepen`, `encodePostnet`, `encodePlanet`, `encodeRM4SCC`, `encodeKIX`, `encodeAustraliaPost`, `encodeJapanPost`, `encodeIMB`, …), Code 25 variants and `decodeOneD` |
| `@sythos/js_barcode_universal/qr` | `encodeQR`, `decodeQR`, `detectQR`, `detectAndDecodeQR` |
| `@sythos/js_barcode_universal/datamatrix` | `encodeDataMatrix`, `decodeDataMatrix`, `detectDataMatrix`, `detectAndDecodeDataMatrix` |
| `@sythos/js_barcode_universal/aztec` | `encodeAztec`, `decodeAztec`, `detectAztec`, `detectAndDecodeAztec` |
| `@sythos/js_barcode_universal/aztecrune` | `encodeAztecRune`, `decodeAztecRune`, `detectAztecRune`, `detectAndDecodeAztecRune` |
| `@sythos/js_barcode_universal/pdf417` | `encodePDF417`, `decodePDF417`, `detectPDF417`, `detectAndDecodePDF417` |
| `@sythos/js_barcode_universal/compactpdf417` | `encodeCompactPDF417`, `decodeCompactPDF417`, `detectCompactPDF417`, `detectAndDecodeCompactPDF417` |
| `@sythos/js_barcode_universal/databar` | GS1 DataBar GTIN/AI codecs plus Omnidirectional/Truncated, Limited, Stacked, Stacked Omnidirectional and Expanded physical helpers |
| `@sythos/js_barcode_universal/micropdf417` | `encodeMicroPDF417`, `decodeMicroPDF417`, `detectMicroPDF417`, `detectAndDecodeMicroPDF417` |
| `@sythos/js_barcode_universal/microqr` | `encodeMicroQR`, `decodeMicroQR`, `detectMicroQR`, `detectAndDecodeMicroQR` |
| `@sythos/js_barcode_universal/rmqr` | `encodeRMQR`, `decodeRMQR`, `detectRMQR`, `detectAndDecodeRMQR` |
| `@sythos/js_barcode_universal/frameqr` | `encodeFrameQR`, `decodeFrameQR`, `detectFrameQR`, `detectAndDecodeFrameQR` |
| `@sythos/js_barcode_universal/maxicode` | `encodeMaxiCode`, `decodeMaxiCode`, `detectMaxiCode`, `detectAndDecodeMaxiCode` |
| `@sythos/js_barcode_universal/dotcode` | `encodeDotCode`, `decodeDotCode`, `detectDotCode`, `detectAndDecodeDotCode` |
| `@sythos/js_barcode_universal/hanxin` | `encodeHanXin`, `encodeHanXinBytes`, `decodeHanXin`, `detectHanXin`, `detectAndDecodeHanXin` |
| `@sythos/js_barcode_universal/composite` | `encodeGS1Composite`, `decodeGS1Composite`, `detectGS1Composite`, `detectAndDecodeGS1Composite` |
| `@sythos/js_barcode_universal/kartrak` | `encodeKarTrak`, `decodeKarTrak`, `decodeKarTrakMatrix`, `detectKarTrak` — experimental, colour-coded, not part of `encode()`/`decode()` |
| `@sythos/js_barcode_universal/jabcode` | `encodeJABCode`, `decodeJABCode`, `decodeJABCodeMatrix` — experimental, colour-coded, not part of `encode()`/`decode()` |
| `@sythos/js_barcode_universal/color` | `PolychromeMatrix`, `toColorImageData`, `classifyGrid` — the experimental colour primitives KarTrak and JAB Code are built on; not registered in `listFormats()`, no stability guarantee yet |
| `@sythos/js_barcode_universal/render` | Every renderer plus `isWebGL2Available` / `isWebGPUAvailable` |
| `@sythos/js_barcode_universal/render/svg` | `toSVG`, `toSVGDataURI` |
| `@sythos/js_barcode_universal/render/png` | `toPNG`, `toPNGDataURI` |
| `@sythos/js_barcode_universal/render/image-data` | `toImageData`, `toCanvas` |
| `@sythos/js_barcode_universal/bundle` | The prebuilt ESM bundle, as one file |
| `@sythos/js_barcode_universal/bundle/iife` | The prebuilt IIFE bundle, for a `<script>` tag |

The `unpkg` and `jsdelivr` fields point at the IIFE bundle, so a CDN needs no install at all:

```html
<script src="https://unpkg.com/@sythos/js_barcode_universal"></script>
<script src="https://unpkg.com/@sythos/js_barcode_universal@1.5.15"></script>
<script src="https://cdn.jsdelivr.net/npm/@sythos/js_barcode_universal@1.5.15"></script>
```

Pin the version for anything you ship; the unpinned form resolves to `latest` and will move under
you.

Both CDNs serve the same file the repository ships in
[`bundle/sythos-barcode.js`](bundle/sythos-barcode.js) — byte for byte, since that is exactly what
npm publishes.

### 2. A `<script>` tag

[`bundle/sythos-barcode.js`](bundle/sythos-barcode.js) is a self-contained IIFE that exposes a
single global, `SythosBarcode`. It works straight from `file://` — open an HTML file off your
disk and it runs.

```html
<script src="bundle/sythos-barcode.js"></script>
<script>
  var encode = SythosBarcode.encode;
  var toSVGDataURI = SythosBarcode.toSVGDataURI;

  var img = new Image();
  img.src = toSVGDataURI(encode('https://example.com', { format: 'qr' }), { scale: 8 });
  document.body.appendChild(img);
</script>
```

### 3. ESM bundle

[`bundle/sythos-barcode.esm.js`](bundle/sythos-barcode.esm.js) is the same code as a single ES
module, for `<script type="module">`, a bundler, or Node.

```js
import { encode, toSVG, toPNG } from './bundle/sythos-barcode.esm.js';

const ean = encode('5901234123457', { format: 'ean13' });

const svg = toSVG(ean, { scale: 3, margin: 10, barHeight: 80 });
// '<svg xmlns="http://www.w3.org/2000/svg" width="345" height="141" …'

toPNG(ean, { scale: 3, barHeight: 80 }).then((bytes) => {
  // Uint8Array — a 1-bit palette PNG
});
```

### 4. The source directly

[`src/index.js`](src/index.js) is the generated ESM facade emitted from the TypeScript source
tree. The source layout is deliberately explicit:

- `src/ts/` contains the TypeScript runtime sources and their adjacent machine-readable `.d.ts`
  declarations, including `src/ts/index.ts` and `src/ts/index.d.ts`.
- `src/js/` contains the compiled JavaScript runtime modules used by Node, browsers and the CDN
  bundles.
- `src/index.js` and `src/index.d.ts` are the stable package-root facades.

From the development workspace, `npm run build:ts` compiles `src/ts/` into `src/js/` and the
root JavaScript facade; `npm run build` then regenerates both bundles. The published package
keeps both source languages visible while retaining zero runtime dependencies.

The package subpath exports therefore pair compiled runtime modules under `src/js/` with their
TypeScript sources and declarations under `src/ts/`; direct source imports should continue to use
the JavaScript facade above.

```js
import { encode, decode, toImageData, listFormats } from './src/index.js';

const matrix = encode('https://example.com', { format: 'qr', ecc: 'M' });
const image  = toImageData(matrix, { scale: 4, margin: 4 });

const found = decode(image, { formats: ['qr'] });
// [ { text: 'https://example.com', format: 'qr', version: 2, ecc: 'M', … } ]
```

Decoding takes anything `ImageData`-shaped, so a canvas, an `OffscreenCanvas`,
`createImageBitmap`, or an image library's raw buffer all satisfy it without an adapter:

```js
const ctx = canvas.getContext('2d');
ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

for (const hit of decode(ctx.getImageData(0, 0, canvas.width, canvas.height))) {
  console.log(hit.format, hit.text);
}
```

`decode` returns an array, empty when nothing is found. A frame with no barcode is an ordinary
outcome for a camera loop, not an error, so the common case needs no `try`/`catch`. Use
`decodeStrict` when absence really is a failure.

### Strict camera profile

For a live camera loop, opt into the stricter 1D policy:

```js
decode(frame, { formats, profile: 'camera', tryHarder: true })
```

The profile requires a compatible quiet zone and the same complete 1D symbol on at least two
scan samples. It evaluates the eight fixed in-plane orientations `0°`, `45°`, `90°`, `135°`,
`180°`, `225°`, `270°` and `315°` when the native orientation has no validated read. The same
orientation set is available to the supported 2D detector passes in the strict camera profile.
Code 11 and MSI require a verified check digit in this profile; other formats retain their own
structural and checksum validation. A frame without a validated barcode still returns `[]`. No
partial, structurally inconsistent or low-confidence value is emitted to the caller. This is a
finite in-plane retry policy, not a guarantee for arbitrary perspective, curved media, severe
occlusion or multi-symbol scenes.

Camera-profile 1D results add `confidence` (0–1), `bounds`, `rotation`, and
`quality: { quietZone, checksum, rows, consistency }`. `bounds` is reported in the raster
orientation that was scanned; unavailable quality data is represented by `null` where applicable.

---

## Supported barcode formats

Generated from `listFormats()`, which reports writing and reading as separate capabilities.
Writing a symbology is a table lookup; reading one needs a detector that finds it in a
photograph. The two lists legitimately differ, and saying so here is better than failing at call
time.

`Kind` is the literal `'1D' | '2D'` value `format.kind` returns from the API — it never changes.
`Structure` is a descriptive grouping only, not part of the API: **Linear** (a single row),
**Stacked** (multiple linear-derived rows, including PDF417-style and stacked GS1 DataBar
variants), or **Matrix** (a true two-dimensional grid, e.g. QR or Data Matrix). A few formats are
`2D` by Kind but row-stacked rather than gridded (Codablock-F, Code 16K), and two are `1D` by Kind
but physically stacked (GS1 DataBar Stacked and Stacked Omnidirectional) — Structure exists to
make that distinction visible.

| Format | `id` | Kind | Structure | Write | Read |
|---|---|:---:|:---:|:---:|:---:|
| Australia Post 4-State | `auspost` | 1D | Linear | ✅ | ✅ |
| Codabar | `codabar` | 1D | Linear | ✅ | ✅ |
| Code 11 | `code11` | 1D | Linear | ✅ | ✅ |
| Code 128 | `code128` | 1D | Linear | ✅ | ✅ |
| Code 2 of 5 Data Logic (China Post) | `datalogic2of5` | 1D | Linear | ✅ | ✅ |
| Code 25 / Standard 2 of 5 | `standard2of5` | 1D | Linear | ✅ | ✅ [^4] |
| Code 32 (Italian Pharmacode) | `code32` | 1D | Linear | ✅ | ✅ |
| Code 39 | `code39` | 1D | Linear | ✅ | ✅ |
| Code 93 | `code93` | 1D | Linear | ✅ | ✅ |
| DX Film Edge Barcode | `dxfilmedge` | 1D | Linear | ✅ | ✅ |
| EAN-13 | `ean13` | 1D | Linear | ✅ | ✅ |
| EAN-2 supplement | `ean2` | 1D | Linear | ✅ | ✅ [^2] |
| EAN-5 supplement | `ean5` | 1D | Linear | ✅ | ✅ [^2] |
| EAN-8 | `ean8` | 1D | Linear | ✅ | ✅ |
| Facing Identification Mark (FIM) | `fim` | 1D | Linear | ✅ | ✅ |
| GS1 DataBar Expanded | `gs1databar-expanded` | 1D | Linear | ✅ | ✅ |
| GS1 DataBar Limited | `gs1databar-limited` | 1D | Linear | ✅ | ✅ |
| GS1 DataBar Omnidirectional / Truncated | `gs1databar14` | 1D | Linear | ✅ | ✅ |
| GS1-128 | `gs1128` | 1D | Linear | ✅ | ✅ [^1] |
| IATA 2 of 5 | `iata2of5` | 1D | Linear | ✅ | ✅ [^4] |
| Industrial 2 of 5 | `industrial2of5` | 1D | Linear | ✅ | ✅ [^4] |
| ISBN (Bookland) | `isbn` | 1D | Linear | ✅ | ✅ [^1] |
| ITF (Interleaved 2 of 5) | `itf` | 1D | Linear | ✅ | ✅ |
| ITF-14 | `itf14` | 1D | Linear | ✅ | ✅ [^1] |
| ITF-6 | `itf6` | 1D | Linear | ✅ | ✅ [^5] |
| JAB Code (colour, experimental — default mode profile) | `jabcode` | 2D | Matrix | ✅ | ✅ [^8] |
| JAN (Japanese Article Number) | `jan` | 1D | Linear | ✅ | ✅ [^1] |
| Japan Post 4-State | `japanpost` | 1D | Linear | ✅ | ✅ |
| KarTrak ACI (colour, experimental — bounded Sythos profile) | `kartrak` | 1D | Linear | ✅ | ✅ [^6] |
| KIX postal code | `kix` | 1D | Linear | ✅ | ✅ |
| Matrix 2 of 5 | `matrix2of5` | 1D | Linear | ✅ | ✅ |
| MSI Plessey | `msi` | 1D | Linear | ✅ | ✅ |
| Pharmacode | `pharmacode` | 1D | Linear | ✅ | — |
| Plessey Code | `plessey` | 1D | Linear | ✅ | ✅ |
| PostBar.C10 (Canada Post, internal) | `postbarc10` | 1D | Linear | ✅ | ✅ [^7] |
| PostBar.D22 (Canada Post, domestic) | `postbard22` | 1D | Linear | ✅ | ✅ [^7] |
| PostBar.G12 (Canada Post, international) | `postbarg12` | 1D | Linear | ✅ | ✅ [^7] |
| PZN-7 / PZN-8 | `pzn` | 1D | Linear | ✅ | ✅ |
| Royal Mail 4-State (RM4SCC) | `rm4scc` | 1D | Linear | ✅ | ✅ |
| Telepen (ASCII and Numeric) | `telepen` | 1D | Linear | ✅ | ✅ [^3] |
| UPC-A | `upca` | 1D | Linear | ✅ | ✅ |
| UPC-E | `upce` | 1D | Linear | ✅ | ✅ |
| USPS Intelligent Mail (IMb / OneCode) | `imb` | 1D | Linear | ✅ | ✅ |
| USPS PLANET | `planet` | 1D | Linear | ✅ | ✅ |
| USPS POSTNET | `postnet` | 1D | Linear | ✅ | ✅ |
| Codablock-F | `codablockf` | 2D | Stacked | ✅ | ✅ |
| Code 16K | `code16k` | 2D | Stacked | ✅ | ✅ |
| Compact PDF417 | `compactpdf417` | 2D | Stacked | ✅ | ✅ |
| GS1 DataBar Composite (bounded Sythos profile) | `gs1composite` | 2D | Stacked | ✅ | ✅ |
| GS1 DataBar Stacked | `gs1databar-stacked` | 1D | Stacked | ✅ | ✅ |
| GS1 DataBar Stacked Omnidirectional | `gs1databar-stacked-omnidirectional` | 1D | Stacked | ✅ | ✅ |
| MicroPDF417 | `micropdf417` | 2D | Stacked | ✅ | ✅ |
| PDF417 | `pdf417` | 2D | Stacked | ✅ | ✅ |
| Aztec Code | `aztec` | 2D | Matrix | ✅ | ✅ |
| Aztec Rune | `aztecrune` | 2D | Matrix | ✅ | ✅ |
| Data Matrix ECC 200 | `datamatrix` | 2D | Matrix | ✅ | ✅ |
| DotCode | `dotcode` | 2D | Matrix | ✅ | ✅ |
| Han Xin Code | `hanxin` | 2D | Matrix | ✅ | ✅ |
| MaxiCode | `maxicode` | 2D | Matrix | ✅ | ✅ |
| Micro QR Code | `microqr` | 2D | Matrix | ✅ | ✅ |
| QR Code | `qr` | 2D | Matrix | ✅ | ✅ [^9] |
| rMQR Code | `rmqr` | 2D | Matrix | ✅ | ✅ |
| Sythos Canvas QR profile — not DENSO FrameQR® compatible | `frameqr` | 2D | Matrix | ✅ | ✅ |

Sixty-one listed formats are writable and sixty are readable through the counted
`listFormats()` registry and the top-level `encode()`/`decode()` dispatcher (EAN-2 and EAN-5 are
parent-bound supplements). **KarTrak ACI and JAB Code sit outside that count**: both are
colour-coded, not black/white, so neither can go through `BitMatrix`-based `encode()`/`decode()`
at all — each ships only as its own subpath (`@sythos/js_barcode_universal/kartrak`,
`@sythos/js_barcode_universal/jabcode`), listed in the table above for visibility, not counted in
that total. **Pharmacode remains intentionally
write-only in the generic image pipeline.** Code 11 and MSI Plessey use the scanline reader. Telepen supports both its full
seven-bit ASCII mode and explicit Numeric pair mode; Numeric reads must request
`formats: ['telepennumeric']` so digit pairs are never guessed as ASCII control characters. The
Code 25 family shares one numeric digit grammar while exposing explicit Standard/Industrial and
IATA guard profiles; Code 2 of 5 Data Logic (China Post) and Matrix 2 of 5 share a different,
width-modulated digit grammar and both reject the 2:1 wide:narrow ratio, which collides with a
different valid reading once the symbol is mirrored — they differ only in their guard frame. Code
32 and PZN validate their pharmaceutical check digits before a read is returned. Plessey Code
(`plessey`), the format MSI Plessey descends from, encodes hexadecimal payloads and always
validates a mandatory two-nibble CRC-8 check — unlike MSI's optional check digit, an unchecked
Plessey read does not exist. Facing Identification Mark (`fim`) is not a general data carrier: it selects one of five
fixed USPS-defined nine-position patterns (`A`-`E`), each a palindrome, so there is no reversed-read
ambiguity between them. Postal formats use operator-specific four-state alphabets with strict
framing and checksum validation; KIX deliberately has no check character, while Australia Post
supports explicit character or numeric customer-data groups and IMb accepts its four legal payload
lengths.
The
GS1 DataBar physical variants use
strict clean-raster readers and variant-specific detectors over the verified GTIN/GS1 element-string
decoder. Expanded also accepts the common compressed GTIN-14 method on the read path. MaxiCode
uses a fixed 30×33 matrix and a clean binary-raster detector for one prominent symbol. PDF417 exposes direct matrix decoding, automatic
camera localization and an assisted quadrilateral sampler through its subpath. Its detector is
validated on degraded synthetic photographs and real Pixel 10/Chrome and iPhone 17/Safari camera
tests; external black-box vectors from ZXing 3.5.3 and bwip-js also pass in both directions.
Text and Numeric vectors are covered bidirectionally; binary byte-for-byte interop remains
explicitly unclaimed until a dedicated external byte corpus is added.

Codablock-F uses stacked Code 128 rows with per-row modulo-103 checks and two
overall modulo-86 checks. The writer chooses a compact 2–44 row layout (or
accepts explicit `rows` and `columns`), while the detector returns a result only
when every expected row and check agrees:

```js
import { encodeCodablockF, detectAndDecodeCodablockF } from '@sythos/js_barcode_universal/codablockf';

const matrix = encodeCodablockF('STACKED ORDER 12345', { rows: 3, columns: 12 });
const hit = detectAndDecodeCodablockF(matrix);
console.log(hit?.text, hit?.rows, hit?.columns);
```

The clean integer-scale detector is designed to reject incomplete or damaged
rows. It does not promise arbitrary perspective, severe occlusion or
multi-symbol camera scenes. See [`docs/formats/codablockf.md`](docs/formats/codablockf.md)
and [`licenses/codablockf.license`](licenses/codablockf.license).

Code 16K keeps the Code 128 A/B/C data sets in a compact stacked symbol. The
writer supports 2–16 rows, five Code 128 symbols per row, optional GS1 modes
and explicit row or separator heights. The reader validates every row, both
modulo-107 check characters and the complete geometry before returning text:

```js
import { encodeCode16K, detectAndDecodeCode16K } from '@sythos/js_barcode_universal/code16k';

const matrix = encodeCode16K('INVENTORY 123456', { mode: 'B', rows: 3 });
const hit = detectAndDecodeCode16K(matrix);
console.log(hit?.text, hit?.rows, hit?.mode);
```

The detector accepts clean integer-scale rasters and orthogonal rotations. It
rejects missing rows, altered modules, invalid checks and ambiguous geometry;
arbitrary perspective and multi-symbol camera scenes remain outside the
validated envelope. See [`docs/formats/code16k.md`](docs/formats/code16k.md)
and [`licenses/code16k.license`](licenses/code16k.license).

DotCode uses an alternating dot grid rather than a solid finder pattern. The
writer and reader cover the bounded five-of-nine pattern set, four masks,
prime-field Reed–Solomon correction, UTF-8 and byte payloads, with optional
GS1/FNC1 handling:

```js
import { encodeDotCode, detectAndDecodeDotCode } from '@sythos/js_barcode_universal/dotcode';

const matrix = encodeDotCode('DOTCODE ORDER 123', { width: 29, height: 30, mask: 1 });
const hits = detectAndDecodeDotCode(matrix.withMargin(3).scale(2), { moduleSize: 2 });
console.log(hits[0]?.text, hits[0]?.moduleSize);
```

The detector is intentionally strict: it accepts complete clean binary rasters
at integer scale, quarter-turn orientations and either polarity, then returns
only a checksum-validated symbol. Perspective, curved media, severe blur and
multi-symbol scenes remain outside the supported profile. See
[`docs/formats/dotcode.md`](docs/formats/dotcode.md) and
[`licenses/dotcode.license`](licenses/dotcode.license).

Han Xin Code is available as a bounded compact profile covering versions 1–3,
the four `L1`–`L4` error-correction levels, numeric/text/byte modes, four masks
and strict Reed–Solomon validation. The root dispatcher accepts both
`format: 'hanxin'` and the compatibility alias `format: 'han-xin'`; the focused
subpath is useful when byte payloads or format metadata are needed:

```js
import {
  encodeHanXin,
  detectAndDecodeHanXin,
} from '@sythos/js_barcode_universal/hanxin';

const matrix = encodeHanXin('HAN XIN 2026', { mode: 'text', ecc: 'L2' });
const hit = detectAndDecodeHanXin(matrix.withMargin(3).scale(2));
console.log(hit?.text, hit?.version, hit?.moduleSize);
```

The Han Xin detector accepts one complete, axis-aligned symbol at an integer
module scale and either polarity. Versions 4–84, Chinese/GB18030 compaction,
ECI, perspective correction and multi-symbol camera scenes remain outside this
profile. See [`docs/formats/hanxin.md`](docs/formats/hanxin.md) and
[`licenses/hanxin.license`](licenses/hanxin.license).

GS1 DataBar Composite is available as the bounded `gs1composite` profile. It
links one validated DataBar host to one strict CC-A or CC-B component and
requires the complete geometry, linkage flag, private profile marker and
shared integer module scale to validate before returning data:

```js
import {
  encodeGS1Composite,
  detectAndDecodeGS1Composite,
} from '@sythos/js_barcode_universal/composite';

const matrix = encodeGS1Composite({
  linear: { format: 'databar14', value: '00012345678905' },
  data: '(01)09506000134352(17)260101',
});
const hit = detectAndDecodeGS1Composite(matrix.withMargin(3).scale(2));
console.log(hit?.text, hit?.linearFormat, hit?.component);
```

This is an original Sythos engineering profile, not a claim of complete
ISO/IEC 24723 certification or universal scanner interoperability. Its full
limits and legal boundary are in [`docs/formats/gs1-composite.md`](docs/formats/gs1-composite.md)
and [`licenses/gs1-composite.license`](licenses/gs1-composite.license).

[^1]: `itf14`, `isbn` and `jan` share a decoder with their base format, so an ITF-14 comes back as
`itf`, an ISBN as `ean13`, and a JAN as `ean13`. GS1-128 is classified separately as `gs1128` when
its leading FNC1 is present and exposes `gs1`, `symbologyIdentifier` and parsed `elements`
metadata. The payload is intact either way — an ITF-14 is an ITF fixed at fourteen digits, an ISBN
barcode is an EAN-13 with a 978/979 prefix, and a JAN barcode is an EAN-13 with a 45/49 prefix.

[^2]: EAN-2 and EAN-5 are recognized only when attached to a validated EAN-13, EAN-8, UPC-A or
UPC-E parent; they are not independent generic retail-symbol readers.

[^3]: Telepen Numeric is an explicit mode because its compact digit-pair glyphs share the same
guards as Telepen Alpha. Use `format: 'telepennumeric'` when encoding or
`formats: ['telepennumeric']` when reading.

[^4]: Code 25/Standard 2 of 5 and Industrial 2 of 5 use the canonical Industrial frame in this
SDK, so — as with footnote 1 — a Standard 2 of 5 read comes back reported as `industrial2of5`;
the payload is intact, only the reported id differs. IATA 2 of 5 uses its shorter guard frame and
is reported under its own `iata2of5` id. Check digits are optional for ordinary reads and are
required by the strict camera profile.

[^5]: `itf6` is not a separate symbology — it is the same ITF grammar validated as exactly six
digits with a mandatory check digit. Unlike footnote 1's formats, it keeps its own `itf6` id rather
than folding into `itf`: requesting `formats: ['itf', 'itf6']` (or leaving `formats` unset) on a
valid ITF-6 symbol legitimately returns both an `itf` result and a validated `itf6` result for the
same payload, the same way a Code 32 symbol returns both `code32` and its Code 39 carrier.
Requesting `itf6` alone returns nothing for a six-digit ITF fragment whose check digit does not
validate.

[^6]: KarTrak ACI (AAR Automatic Car Identification, 1967-1977) encodes each of 13 stacked label
lines as which of four *colours* (blue, checkerboard/white, red, black) appears in its two
stripes, not by bar width — so it needs `PolychromeMatrix`, not `BitMatrix`, and is not reachable
through `encode()`/`decode()`, `listFormats()` or the `formats:` allow-list. Use
`encodeKarTrak`/`decodeKarTrak`/`detectKarTrak` from `@sythos/js_barcode_universal/kartrak`
directly. Reading is scoped honestly: `detectKarTrak` locates one axis-aligned plate against a
roughly uniform background — no rotation or perspective search, the same "clean single-symbol"
boundary already documented for MaxiCode. See `docs/formats/kartrak.md` and
`docs/COLOR_PIPELINE_NOTES.md` for the full picture, including what real-world validation is
still outstanding.

[^7]: Canada Post's own PostBar engineering specification is not published; this SDK implements
the C10 (internal), D22 (customer-applied domestic) and G12 (international) profiles from the
technical disclosure in US Patent 5,602,382A (expired), verified against the patent's own fully
worked examples. `postbard07`/`postbard12`/`postbarg22`/`postbars06`/`postbars11`/`postbars21`
are documented by the same patent but not implemented — see `docs/formats/postbar.md`. Reading
corrects errors via the format's own Reed-Solomon check (over GF(64)) before returning a result.

[^8]: JAB Code (ISO/IEC 23634:2022, Fraunhofer SIT) encodes several bits per module as one of
several module *colours* rather than bar width, so — like KarTrak — it needs `PolychromeMatrix`,
not `BitMatrix`, and is not reachable through `encode()`/`decode()`, `listFormats()` or the
`formats:` allow-list. Use `encodeJABCode`/`decodeJABCode`/`decodeJABCodeMatrix` from
`@sythos/js_barcode_universal/jabcode` directly. This is the reference encoder's own "default
mode" profile (8 colours, ECC level 3, mask type 7, no metadata Part I/II, byte-mode-only data
encoding, single symbol) — not the full ISO specification, and reading requires the symbol's
corners to already be known, the same "known geometry" boundary as KarTrak (no detector exists
for this format yet). See `docs/formats/jabcode.md` and `docs/JABCODE_NOTES.md` for the full
scope, including the PRNG bit-exactness limitation and what real-world validation is still
outstanding.

[^9]: "SPARQCode" (a MSKYNET/Yahoo-era product name) is not a separate barcode symbology and this
SDK does not implement or need a dedicated mode for it: it is a text-payload convention (structured
URLs, phone numbers, WiFi config, vCard-style contacts, and similar) written inside an ordinary,
unmodified ISO/IEC 18004 QR code — the same physical code `qr` already produces and reads. Any
payload following such a convention already round-trips through `encodeQR`/`decodeQR` above. See
`docs/formats/qr-family.md`.

### Code 11 and MSI Plessey image reading

The generic image pipeline now recognizes Code 11 and MSI Plessey through the existing
scanline reader. Check-digit validation is opt-in with `decode(image, { checkDigit: true })`;
without that option the physical grammar is still required, while the literal check character is
preserved for MSI and reliably stripped for Code 11 when its C/K grammar is unambiguous. The
reader keeps Pharmacode write-only because its unframed narrow/wide grammar is not safe for
unrestricted image autodetection.

### Telepen

Telepen is available from the `oned` subpath and the root dispatcher. The default
`telepen` format carries full seven-bit ASCII with an even parity bit and a modulo-127
check value. The explicit `telepennumeric` format compacts digit pairs and allows `X`
only as the second character of a pair. Both writers enforce the format grammar, a
500-character input limit and complete start/check/stop structure.

```js
import { encodeTelepen, encodeTelepenNumeric } from '@sythos/js_barcode_universal/oned';
import { decode, toImageData } from '@sythos/js_barcode_universal';

const alpha = encodeTelepen('TELEPEN-ASCII');
const numeric = encodeTelepenNumeric('00112738999X');
const image = toImageData(alpha, { scale: 3, margin: 30, barHeight: 64 });
const [hit] = decode(image, { formats: ['telepen'] });
console.log(hit?.text); // TELEPEN-ASCII
```

For Numeric symbols, select the numeric identifier explicitly:

```js
const numericImage = toImageData(numeric, { scale: 3, margin: 30, barHeight: 64 });
const [numericHit] = decode(numericImage, { formats: ['telepennumeric'] });
console.log(numericHit?.text); // 00112738999X
```

The scanline reader measures the complete symbol at scale-independent run widths,
rejects ambiguous candidates, verifies parity and the modulo-127 check value, and
returns no partial result. A camera-profile read additionally requires a coherent
quiet-zone-qualified symbol across repeated scan samples.

### Code 25, Industrial 2 of 5, IATA 2 of 5, Data Logic 2 of 5 and Matrix 2 of 5

The Code 25 family is available from both the root dispatcher and the `oned`
subpath. `standard2of5` (also `code2of5`) and `industrial2of5` use the same
canonical two-wide-bar frame here; `iata2of5` uses the shorter IATA guard. The
optional modulo-10 check digit is appended by the writer and can be required by
the reader or by the strict camera profile:

```js
import { decode, encode, toImageData } from '@sythos/js_barcode_universal';

const matrix = encode('01234567', {
  format: 'industrial2of5',
  checkDigit: true,
  wideRatio: 3,
});
const [hit] = decode(toImageData(matrix, {
  scale: 3,
  margin: 30,
  barHeight: 64,
}), {
  formats: ['industrial2of5'],
  checkDigit: true,
});
console.log(hit?.text); // 01234567
```

Use `format: 'iata2of5'` for IATA framing. The reader validates the complete
start/data/stop structure and rejects clipped or ambiguous candidates; a camera
read additionally requires a quiet zone and a valid check digit.

`format: 'datalogic2of5'` (aliases: `data-logic-2-of-5`, `chinapost`,
`china-post`) uses a different, width-modulated digit grammar and the shorter
IATA-style guard. Its `wideRatio` accepts `3..8`, not `2..8`: a 2:1 wide:narrow
ratio makes this specific digit table's mirrored reading collide with a
different valid full-length reading, so both the writer and reader reject it.
Reads shorter than five digits without a check digit are rejected as not
distinctive enough to trust.

`format: 'matrix2of5'` (alias: `matrix-2-of-5`) shares that exact
width-modulated digit grammar with Data Logic 2 of 5 but uses its own,
longer guard frame — the same `wideRatio: 3..8` restriction and five-digit
minimum apply, for the same reason (the digit table, not the guard, is what
creates the mirrored-reading collision at 2:1).

### Code 32 and PZN

Code 32 (the Italian pharmaceutical code) and PZN-7/PZN-8 are explicit,
check-digit-validated pharmaceutical formats. Code 32 accepts an eight-digit
body (or the same body with its validated check digit) and renders the compact
base-32 payload through the Code 39 carrier. PZN accepts six digits for PZN-7 or
seven digits with `{ pzn8: true }` for PZN-8; the decoder exposes `pznVariant`.

```js
import { decode, encode, toImageData } from '@sythos/js_barcode_universal';

const code32 = encode('01234567', { format: 'code32' });
const pzn8 = encode('1234567', { format: 'pzn8' });
const image = toImageData(pzn8, { scale: 3, margin: 30, barHeight: 64 });
const [result] = decode(image, { formats: ['pzn8'] });
console.log(result?.format, result?.pznVariant, result?.text);
// pzn pzn8 1234567
```

Both readers return no value when the carrier or pharmaceutical check digit is
not valid. The format-specific engineering notes and the independent
black-box validation boundary are recorded in [`licenses/`](licenses/).

### Facing Identification Mark (FIM)

FIM is not a general-purpose data carrier. It selects one of five fixed,
USPS-defined nine-position patterns (`A` through `E`) printed near the upper
edge of a mailpiece to tell automated facing equipment the mail class. Every
pattern is a palindrome and always starts and ends with a bar, so a mirrored
read never resolves to a different type:

```js
import { decode, encode, toImageData } from '@sythos/js_barcode_universal';

const matrix = encode('C', { format: 'fim' });
const [result] = decode(toImageData(matrix, {
  scale: 3,
  margin: 20,
  barHeight: 40,
}), {
  formats: ['fim'],
});
console.log(result?.text); // C
```

`encodeFIM`/`decodeFIM` are also exported from the `oned` subpath. The reader
requires a substantial leading and trailing quiet zone before promoting a
match; this was tuned against an adversarial sweep of random noise and
repeating textures during implementation, since a nine-module pattern is
short enough that a naive scale-invariant matcher would otherwise false-match
unrelated camera content.

### ITF-6

ITF-6 is not a separate symbology: it is the existing ITF grammar
constrained to exactly six digits (five significant digits plus a
mandatory modulo-10 check digit), the JIS X 0502 add-on printed alongside
ITF-14/ITF-16 for item quantity or container weight. It reuses the same
check digit routine already used for ITF-14 and EAN:

```js
import { decode, encode, toImageData } from '@sythos/js_barcode_universal';

const matrix = encode('12345', { format: 'itf6' }); // check digit appended
const [result] = decode(toImageData(matrix, {
  scale: 3,
  margin: 20,
  barHeight: 40,
}), {
  formats: ['itf6'],
});
console.log(result?.text); // 123457
```

Because ITF-6 shares its grammar with plain ITF, an unrestricted or
`['itf', 'itf6']` read of a valid ITF-6 symbol legitimately returns both an
`itf` result and a validated `itf6` result — see footnote 5. Requesting
`itf6` alone returns nothing unless the check digit is valid, which is the
only thing distinguishing a genuine ITF-6 read from an ordinary six-digit
ITF fragment.

### Plessey Code

Plessey Code (1971, Plessey Company) is the original format that Modified
Plessey/MSI Plessey (already shipped here as `msi`) is a variant of. It
encodes hexadecimal payloads (`0`-`9`, `A`-`F`) and always appends a
mandatory two-nibble CRC-8 check — there is no unchecked mode, unlike MSI's
optional check digit:

```js
import { decode, encode, plesseyCheckDigits, toImageData } from '@sythos/js_barcode_universal';

console.log(plesseyCheckDigits([1, 2, 3, 4, 5])); // [6, 14] -> "6E"

const matrix = encode('12345', { format: 'plessey' });
const [result] = decode(toImageData(matrix, {
  scale: 3,
  margin: 20,
  barHeight: 40,
}), {
  formats: ['plessey'],
});
console.log(result?.text); // 12345
```

The reader validates the CRC before returning a value; a damaged symbol or
one with an incorrect check simply does not decode as Plessey.

### Postal 4-state formats

The postal family shares a strict height-coded raster classifier while keeping
each operator's alphabet and checksum separate. The root dispatcher and the
`oned` subpath expose USPS POSTNET and PLANET, Royal Mail RM4SCC, Dutch KIX,
Australia Post, Japan Post and USPS Intelligent Mail (IMb/OneCode):

```js
import { decode, encode, toImageData } from '@sythos/js_barcode_universal';

const matrix = encode('5956439111ABC', {
  format: 'auspost',
  customerEncoding: 'character',
});
const image = toImageData(matrix, { scale: 3, margin: 24, barHeight: 72 });
const [result] = decode(image, {
  formats: ['auspost'],
  customerEncoding: 'character',
});
console.log(result?.format, result?.text, result?.checkDigit);
// auspost 5956439111ABC true
```

POSTNET accepts 5/9/11 body digits and PLANET 11/13; both append and verify a
Mod-10 check digit. RM4SCC generates and verifies its row/column check
character, while KIX has no check character. Japan Post expands its public
alphabet into fixed groups and verifies a Mod-19 check. Australia Post starts
with an FCC and eight-digit DPID, supports `customerEncoding: 'character'` or
`'numeric'` (also `custinfoenc`) and verifies GF(64) parity. IMb accepts exactly
20, 25, 29 or 31 digits and verifies its frame check sequence. Convenience
aliases such as `onecode`, `usps-postnet` and `royal-mail` resolve to the
canonical ids shown in the format table.

The generic image reader returns an empty array for a clipped, ambiguous or
checksum-invalid symbol. `profile: 'camera'` additionally requires a measurable
quiet zone on both sides of the bars; it is intentionally conservative for
blurred, curved, heavily occluded or multi-symbol photographs. See the
[postal format guide](https://sythos.github.io/JS_Barcode_Universal/formats/postal/)
for payload limits, direct subpath functions and the complete provenance note.

### Data Matrix ECC 200

`datamatrix` writes and reads the 30 classic ECC 200 square and rectangular symbol sizes. The
encoder supports ASCII compaction (including numeric pairs), Base256 binary payloads, automatic
or forced square/rectangular shape, Reed–Solomon error correction and GS1 FNC1 in the first
position. DMRE is not included.

```js
import { encodeDataMatrix, decodeDataMatrix } from '@sythos/js_barcode_universal/datamatrix';

const symbol = encodeDataMatrix('0101234567890128', { gs1: true, shape: 'square' });
const result = decodeDataMatrix(symbol);
console.log(result.text, result.gs1); // 0101234567890128 true
```

Binary content is accepted as a `Uint8Array` with `encoding: 'base256'`. The current high-level
decoder handles ASCII and Base256 codewords; C40, Text, X12 and EDIFACT input symbols are not yet
decoded. The current detector accepts axis-aligned square or rectangular symbols; with
`profile: 'camera'`, the decode pipeline evaluates the eight fixed in-plane orientations at 45°
steps. Arbitrary perspective and perspective-skewed Data Matrix photographs are not yet guaranteed.

### Aztec Code

`aztec` writes Compact layers 1–4 and Full layers 1–32, selecting a fitting symbol automatically
unless `layers` and `compact` are forced. It supports the five Aztec text tables and UTF-8 byte
payloads through Binary Shift, with `eccPercent` (default 23) controlling the requested
error-correction level.
ECI is not yet a configurable public option.

```js
import { encodeAztec, decodeAztec } from '@sythos/js_barcode_universal/aztec';

const symbol = encodeAztec('Greetings My Lord Sythos  👋', { eccPercent: 23 });
const result = decodeAztec(symbol);
console.log(result.text); // Greetings My Lord Sythos  👋
```

The image detector handles the eight fixed camera-profile orientations, inverted polarity and
quadrilateral sampling around the central bull’s-eye. Severe photographic perspective remains an
interoperability and robustness gate rather than a guaranteed capability.

### PDF417 (writer, matrix decoder and camera reader)

`pdf417` supports PDF417 Text, Byte and Numeric compaction, ECI 3 (ISO-8859-1) and ECI 26
(UTF-8), ECC levels 0–8, row-height inference and Reed–Solomon erasure correction. The direct
matrix decoder is available from `@sythos/js_barcode_universal/pdf417`.

The image helper handles clean module-aligned raster symbols, integer scale, fixed 45°-step
camera orientations, automatic perspective estimation, mild blur/noise and an application-supplied
quadrilateral. Results expose `bytes` and ordered `segments` for byte-preserving payloads. Real
device validation covers Pixel 10/Chrome and iPhone 17/Safari with printed symbols and continuous
camera capture. Extreme glare, severe occlusion, curved media and multi-symbol scenes remain
outside the validated robustness envelope.

```js
import { encodePDF417, decodePDF417 } from '@sythos/js_barcode_universal/pdf417';

const symbol = encodePDF417('AAMVA SAMPLE', { eccLevel: 3 });
console.log(decodePDF417(symbol).text);
```

### MicroPDF417

`micropdf417` writes and reads the 34 fixed MicroPDF417 variants. It supports Text, Byte and
Numeric compaction, plus Byte-compaction ECI 3 (ISO-8859-1) and 26 (UTF-8). `columns`,
`rowHeight` and `aspectRatio` let callers constrain automatic variant selection.

```js
import { encodeMicroPDF417, decodeMicroPDF417 } from '@sythos/js_barcode_universal/micropdf417';

const symbol = encodeMicroPDF417('MICRO PDF417', { compaction: 'text' });
console.log(decodeMicroPDF417(symbol).text);
```

The detector accepts clean, integer-scaled raster symbols and the eight fixed camera-profile
orientations. Arbitrary perspective, severe photographic degradation and multi-symbol scenes are
not yet claimed as robust capabilities.

### Micro QR Code

`microqr` implements the M1–M4 family with Numeric, Alphanumeric, ISO-8859-1 Byte and Kanji
payloads, BCH format protection, the four Micro QR masks and Reed–Solomon correction. M1 is
detection-only. ECI, FNC1/GS1 and Structured Append are intentionally outside the current API.
The detector accepts clean scaled rasters, the eight fixed camera-profile orientations, inverted
polarity and mild projective sampling, and rejects normal QR Model 2 symbols. Arbitrary perspective
and curved-media robustness are not claimed.

```js
import { encodeMicroQR, decodeMicroQR } from '@sythos/js_barcode_universal/microqr';

const symbol = encodeMicroQR('12345', { version: 'M2', ecc: 'L' });
console.log(decodeMicroQR(symbol).text);
```

### rMQR Code

`rmqr` implements all 32 standard rectangular geometries, M/H ECC, Numeric, Alphanumeric, Byte,
Kanji and ECI payloads. The detector accepts clean integer-scaled rasters, quiet zones and the
eight fixed camera-profile orientations; arbitrary photographic perspective and multi-symbol
scenes are not claimed.

```js
import { encodeRMQR, decodeRMQR } from '@sythos/js_barcode_universal/rmqr';

const symbol = encodeRMQR('rMQR SAMPLE', { ecc: 'M' });
console.log(decodeRMQR(symbol).text);
```

### Sythos Canvas QR profile

`frameqr` is an explicitly scoped, non-certified Sythos Canvas QR profile — not DENSO FrameQR® compatible. It reserves a bounded
square, circle or diamond artwork canvas inside an ECC-H QR Model 2 symbol. It is **not** a native
DENSO FrameQR encoder or decoder, and the package makes no DENSO interoperability claim. The
profile can be read from clean rendered rasters and is exposed through the normal `encode`/`decode`
API and the `frameqr` subpath.

```js
import { encodeFrameQR, decodeFrameQR } from '@sythos/js_barcode_universal/frameqr';

const symbol = encodeFrameQR('https://www.sythos.net/', {
  canvas: { shape: 'square', size: 5 },
});
console.log(decodeFrameQR(symbol).text);
```

The canonical `examples/create.html` preview loads `https://www.sythos.net/favicon.ico` and
falls back to `https://www.sythos.net/apple-touch-icon.png`. The image is never copied into the
repository; if browser CORS prevents safe compositing, the page keeps a preview overlay and
exports the QR symbol without embedding the remote artwork.

### Aztec Rune, Compact PDF417 and EAN supplements

`aztecrune` implements the fixed 11×11 Rune values 0–255 with clean raster
detection, inversion and the eight fixed camera-profile orientations. Its matrices were compared
exhaustively with ZXing-C++ as an independent black-box runtime; no ZXing
source or table is shipped.

`compactpdf417` implements the truncated PDF417 geometry with Text, Byte and
Numeric compaction. It has a clean raster detector and direct matrix decoder.

EAN-2 and EAN-5 are writable supplements exposed by the `oned` subpath and by
the generic `ean2` and `ean5` format IDs. The image reader recognizes them only
when attached to a validated EAN/UPC parent; use the composition helpers with
an EAN/UPC base symbol.

EAN-2 and EAN-5 are parent-bound supplements, never standalone image results. They may be
listed with EAN-13, EAN-8, UPC-A, UPC-E or Bookland ISBN in `formats`: the parent remains valid
without a supplement, and a valid requested supplement is exposed only through `result.addon`.
If only `ean2` or `ean5` is requested, a validated EAN/UPC parent is still required and remains
the returned `format`; an absent, malformed or unrequested supplement never rejects the parent.

### GS1 DataBar

The `databar` subpath exposes original GS1 GTIN/AI codecs and five physical
variants: Omnidirectional and Truncated through `encodeDataBar14`, Limited through
`encodeDataBarLimited`, Stacked through `encodeDataBar14Stacked`, Stacked
Omnidirectional through `encodeDataBarStackedOmnidirectional`, and linear Expanded
through `encodeDataBarExpanded`. The physical paths encode the fixed GS1 `(01)`
GTIN element and can carry the standard composite linkage flag. The complete
bounded composition is exposed separately through the `composite` subpath.

The clean readers require a complete dark-on-light or inverted binary raster,
integer module scaling and valid checksum/guard structure. The Limited and
Stacked readers accept quarter turns; the Stacked Omnidirectional reader accepts
the same clean integer-scaled geometry. Their detectors intentionally reject
partial symbols, arbitrary perspective and grayscale input. Use a binarized
image or call the matrix decoder after an application-owned perspective sample.

The Stacked variant uses a 50-module row with a five-module top row, one-module
separator and seven-module bottom row. Stacked Omnidirectional uses two 50-module
rows, a three-module separator and a minimum 33-module row height. Limited uses
a 79-module row and a minimum 10-module output height; its accepted GTIN
indicator is 0 or 1. Expanded uses the linear finder sequence and constrained
17-module data characters defined by GS1 DataBar; its writer emits the general-
purpose method and its reader also accepts the common compressed GTIN-14 method.
These geometry constraints are part of the format API, not an interoperability
claim for arbitrary photographs.

```js
import {
  encodeDataBarLimited,
  encodeDataBar14Stacked,
  encodeDataBarStackedOmnidirectional,
} from '@sythos/js_barcode_universal/databar';

const limited = encodeDataBarLimited('01234567890128', { moduleScale: 2 });
const stacked = encodeDataBar14Stacked('01234567890128');
const stackedOmni = encodeDataBarStackedOmnidirectional('01234567890128');
```

For a GS1 element string, use the Expanded helper. It returns a clean linear
symbol without a quiet zone, just like the other DataBar writers:

```js
import {
  decodeDataBarExpanded,
  encodeDataBarExpanded,
} from '@sythos/js_barcode_universal/databar';

const expanded = encodeDataBarExpanded('(01)09506000134352(10)ABC-123');
const decoded = decodeDataBarExpanded(expanded);
console.log(decoded.elements, decoded.linkage);
```

Expanded reading accepts a complete dark-on-light or inverted binary raster,
integer module scaling and a valid finder/checksum structure. The detector is
deliberately conservative: it handles a single clean linear symbol (including
quarter turns) and rejects partial, ambiguous, grayscale or arbitrary-perspective
input instead of returning a guessed GS1 payload.

### MaxiCode

The `maxicode` subpath exposes `encodeMaxiCode`, `decodeMaxiCode`,
`detectMaxiCode` and `detectAndDecodeMaxiCode`. The implementation uses the
fixed 30×33-module MaxiCode geometry and supports modes 2–5. Modes 2 and 3
require structured `primary` data (`postalCode`, `countryCode` and
`serviceClass`); modes 4 and 5 carry an unstructured secondary message. Text
and byte input are restricted to ISO-8859-1 (`charset: 'latin1'`).

```js
import { encodeMaxiCode, decodeMaxiCode } from '@sythos/js_barcode_universal/maxicode';

const symbol = encodeMaxiCode('HELLO FROM SYTHOS', { mode: 4 });
const result = decodeMaxiCode(symbol);
console.log(result.text, result.mode);
```

`decodeMaxiCode` works on a canonical 30×33 matrix and can validate its
180-degree and inverted forms. `detectMaxiCode` is deliberately a clean binary
detector for one prominent symbol at integer or near-integer scale. It does not
promise arbitrary perspective, grayscale thresholding, severe occlusion or
multi-symbol scene handling.

### Remaining out of scope

Data Matrix ECC 200 is implemented for its classic square and rectangular symbols;
DMRE remains outside the current scope. See [`PLAN.md`](PLAN.md) for the remaining
symbologies.

---

## Live examples

Two self-contained pages, each loading the IIFE bundle with a plain `<script>` tag. **Both open
directly from disk** — double-click the file, no server and no build. This `examples/` directory is
the single canonical source; the development workspace references these files instead of keeping
a second copy.

### [`examples/create.html`](examples/create.html)

Pick any writable format, type a payload, and watch the symbol redraw as you type; download it as
PNG or SVG. For QR it adds a **content-type builder** that assembles the payload for you across
URL, email, phone, SMS, Wi-Fi network, contact card (both vCard and MeCard), geo location and
calendar event — with correct escaping for each — and shows you the exact string it produced, so
you can see what a Wi-Fi or vCard QR actually contains. ECC level, version, scale, margin and both
colours are exposed.

### [`examples/read.html`](examples/read.html)

Decode from an image: drop one onto the page, or click to choose a file. It then offers a live
camera loop that decodes continuously from the video stream.

> The file and drag-drop path works anywhere, `file://` included. **The camera needs http(s)**,
> because `getUserMedia` requires a secure context and refuses to run from `file://`. Serve the
> folder over localhost for that half; the page detects the situation and says so rather than
> failing silently.

---

## Documentation

The full, searchable documentation lives on [GitHub Pages](https://sythos.github.io/JS_Barcode_Universal/)
and is built from the checked-in [`docs/`](docs/) tree with MkDocs Material. It includes the
[API reference](https://sythos.github.io/JS_Barcode_Universal/api/overview/),
[format catalogue](https://sythos.github.io/JS_Barcode_Universal/formats/overview/),
[camera and image guides](https://sythos.github.io/JS_Barcode_Universal/guides/camera-reading/),
[practical recipes](https://sythos.github.io/JS_Barcode_Universal/examples/create-barcode/),
[FAQ](https://sythos.github.io/JS_Barcode_Universal/faq/) and
[troubleshooting](https://sythos.github.io/JS_Barcode_Universal/troubleshooting/).

Every documentation change is checked for local links, navigation coverage and registry drift in
CI before the Pages build is published. The compact README remains the versioned project
overview; the Pages site is the place for the longer explanations and copy-ready examples.

---

## API summary

Two functions carry the whole surface. Everything else is a renderer or a format-specific escape
hatch.

### Encoding and decoding

```js
encode(text, options?) → BitMatrix
```

`options`: `format` (default `'qr'`), `ecc` (`'L'|'M'|'Q'|'H'`), `version` (QR 1–40, auto if
omitted), `checkDigit`, `fullAscii` (Code 39 extended), `gs1` (emit a leading FNC1). Data Matrix
ECC 200 accepts `shape: 'any' | 'square' | 'rectangular'` and `encoding: 'ascii' | 'base256'`.
Aztec accepts `layers`, `compact` and `eccPercent`; it transports UTF-8 byte payloads through
Binary Shift, and it does not expose configurable ECI yet.
MicroPDF417 accepts `compaction: 'auto' | 'text' | 'byte' | 'numeric'`, ECI 3 or 26 for Byte
compaction, and optional `columns`, `rowHeight` and `aspectRatio` constraints.
Micro QR accepts `version: 'M1' | 'M2' | 'M3' | 'M4'`, its legal ECC level and mask; its
unsupported ECI, FNC1/GS1 and Structured Append features are rejected explicitly. rMQR accepts
`ecc: 'M' | 'H'`, optional geometry/version constraints and ECI for byte payloads. The FrameQR
Code profile accepts `canvas: { shape: 'square' | 'circle' | 'diamond', size, width, height,
centerX, centerY, angle }`; it is non-certified and separate from DENSO FrameQR.

```js
encode('5901234123457', { format: 'ean13' })
encode('ABC-123', { format: 'code39', fullAscii: true, checkDigit: true })
encode('https://example.com', { format: 'qr', ecc: 'H', version: 7 })
encode('0101234567890128', { format: 'datamatrix', gs1: true })
encode('Greetings My Lord Sythos  👋', { format: 'aztec', eccPercent: 23 })
encode('MICRO PDF417', { format: 'micropdf417', compaction: 'text' })
encode('12345', { format: 'microqr', version: 'M2', ecc: 'L' })
encode('rMQR SAMPLE', { format: 'rmqr', ecc: 'M' })
encode('https://www.sythos.net/', {
  format: 'frameqr',
  canvas: { shape: 'square', size: 5 },
})
```

```js
decode(image, options?) → Result[]
decodeStrict(image, options?) → Result        // throws NotFoundError instead of returning []
```

`image` is `{ data, width, height }` with RGBA bytes. `options`: `formats` (restrict the search,
and go faster), `tryHarder` (retry inverted, default `true`), `binarizer`
(`'global' | 'hybrid' | 'auto'`). A `Result` carries at least `text` and `format`; QR results also
carry `bytes`, `version` and `ecc`.

For larger clean QR Code, PDF417 and MaxiCode rasters, `auto` and `hybrid` retain their primary local-threshold pass and retry once with the global threshold only when that pass finds no result. An explicit `binarizer: 'global'` request remains single-pass.

```js
listFormats() → { id, label, canWrite, canRead, kind }[]
```

The table above is this function's output. Read it at runtime rather than hard-coding a format
list — that is how the demo pages build their dropdowns.

### Renderers

```js
toSVG(matrix, options?) → string                       // one merged <path>, not a rect per module
toSVGDataURI(matrix, options?) → string                // data: URI for an <img src>
toImageData(matrix, options?) → { data, width, height }
toPNG(matrix, options?) → Promise<Uint8Array>          // 1-bit palette PNG
toPNGDataURI(matrix, options?) → Promise<string>
toCanvas(matrix, canvas, options?) → boolean           // 2D context
renderToCanvasAuto(matrix, canvas, options?) → { backend: 'webgl2' | '2d' | 'none' }
renderToCanvasAutoAsync(matrix, canvas, options?) → Promise<{ backend: 'webgpu' | 'webgl2' | '2d' | 'none' }>
```

The two PNG functions are async because they use the platform's deflate — `node:zlib` or
`CompressionStream` — and fall back to stored blocks where neither exists.

`renderToCanvasAuto` is synchronous and therefore cannot reach WebGPU: acquiring an adapter is
asynchronous, and a synchronous function can never wait for one. Use `renderToCanvasAutoAsync`
when you want WebGPU in the chain. Both fall through to the 2D context, which always exists.

All renderers share the same options:

| Option | Default | Meaning |
|---|---|---|
| `scale` | `8` | Pixels per module |
| `margin` | `4` | Quiet-zone modules on every side |
| `dark` | `'#000000'` | Colour of set modules |
| `light` | `'#ffffff'` | Colour of clear modules; `'none'` for transparent |
| `barHeight` | auto | 1D only: total bar height in pixels |

Also exported: `BitMatrix`, the error types (`BarcodeError`, `EncodeError`, `NotFoundError`,
`FormatError`, `ChecksumError`), the per-format writers (`encodeEAN13`, `encodeCode128`, …), the
QR entry points (`encodeQR`, `decodeQR`, `detectQR`, `detectAndDecodeQR`), the image primitives
(`LuminanceSource`, `binarize`, `binarizeGlobal`, `binarizeHybrid`), and the capability probes
`isWebGL2Available` / `isWebGPUAvailable`.

---

## How it works

**`BitMatrix` is the interchange type.** Every writer produces one, every reader consumes one,
every renderer draws one. That single currency is what keeps symbologies and output targets
independent of each other — adding a format touches no renderer, and adding a renderer touches no
format. Storage is row-packed into a `Uint32Array`: one allocation, cache-friendly row scans, and
cheap whole-row operations for the 1D readers.

**A set bit is a dark module.** This matches how every specification describes its symbols;
renderers invert where their medium needs it.

**`encode` returns no quiet zone.** The margin is a rendering decision, not an encoding one — how
much white space a symbol needs depends on where it is going — so the renderers add it and the
matrix stays the pure symbol. For the same reason, **linear symbols come back exactly one module
tall**: height carries no information in a 1D barcode, so encoding one would be inventing data.
The renderer stretches the single row to `barHeight` *before* applying the quiet zone, so the
margin ends up uniform on all four sides.

**The read pipeline** is a straight line, each stage a separate module:

```
RGBA bytes → luminance → binarize → detect → sample → error-correct → decode
```

Luminance conversion flattens the image to greyscale. Binarization turns that into a `BitMatrix`,
either globally or with a hybrid local threshold that survives uneven lighting. Detection locates
a symbol and its corners in that bit plane. Detectors that recover four perspective-aware corners
(currently QR) sample the symbol back through a perspective transform. Data Matrix currently uses
an axis-aligned bounding box; the strict camera profile evaluates the eight fixed in-plane
orientations before error correction repairs what the camera lost. Only then is the payload decoded.

**Reed–Solomon is generic over the finite field.** The `GaloisField` class is constructed with a
field order and a primitive polynomial rather than hard-coding GF(256), which is what lets one
implementation serve QR, and the prime field GF(929) that PDF417 needs. Prime fields are the
subtle case: in a binary field addition and subtraction are both XOR, so a decoder that inlines
`^` for field addition passes every binary field and fails only the prime one.

---

## About the GPU path

The WebGL2 and WebGPU backends accelerate **drawing** a barcode, not **computing** one. That is
worth stating plainly, because "GPU barcode generation" naturally suggests the latter.

Encoding is sequential integer work: Reed–Solomon polynomial division, mask penalty scoring, bit
placement along a zig-zag path. Each step depends on the one before it, which is precisely the
shape a GPU cannot exploit. A complete QR encode takes well under a millisecond on the CPU — less
time than dispatching a compute shader and reading the result back would cost. Moving it to the
GPU would make it slower.

So encoding stays on the CPU because that is the correct engineering answer, not because
something is missing. Where the GPU genuinely earns its place is drawing large symbols, or many
symbols per frame, straight into a canvas without a CPU-side pixel buffer — and it would earn it
again on the read side, where per-frame greyscale conversion and block statistics over a 4K camera
image are both the real bottleneck and embarrassingly parallel.

---

## Browser support

The syntax floor is **iOS Safari 15**. No `Array.prototype.at`, no top-level `await`, no
`Object.groupBy`.

`OffscreenCanvas`, WebGL2 and WebGPU are feature-detected, never assumed. The 2D canvas path
always exists, so nothing is unreachable on an older device — `renderToCanvasAuto` degrades to it
and reports which backend actually drew.

---

## Security automation

The repository is covered by GitHub's configured [CodeQL default setup](https://github.com/Sythos/JS_Barcode_Universal/security/code-scanning)
for JavaScript and TypeScript code-scanning analysis. GitHub manages the analysis schedule and
the security-events upload; this avoids running a duplicate advanced workflow alongside the
repository-level default setup.

[Dependabot](.github/dependabot.yml) checks the development TypeScript toolchain and GitHub Actions
references weekly. Updates are repository-development controls only; the published SDK remains
zero-dependency at runtime.

The read-only quality gate in [`.github/workflows/pr-quality.yml`](.github/workflows/pr-quality.yml)
runs for pull requests and pushes to `main`. Its Node jobs install the locked development toolchain
with `npm ci --ignore-scripts --no-audit --no-fund`, then run ESLint, the TypeScript compiler and
public-type checks, package-surface and zero-runtime-dependency checks, documentation checks and
the workflow attestation validator. It has no publish credentials and cannot publish a package or
create a release.

Pull-request dependency changes are checked by GitHub's Dependency Review action with read-only
permissions. Separate tokenless workflows run OSV Scanner for known dependency vulnerabilities,
OSSF Scorecard for repository supply-chain posture and `actionlint` for GitHub Actions syntax and
expression mistakes. The allow-list records Blue Oak 1.0.0 only for the development-only `minimatch`
transitive dependency; it is not shipped in the SDK package. These checks use repository or
GitHub-provided permissions only; they do not add runtime dependencies to the SDK.

The same pull-request gate runs a bounded, deterministic `fast-check` property suite across the
supported 1D and 2D encoders and decoders. It checks matrix invariants and round-trip payloads with
small, reproducible inputs; the fuzzing harness stays in development-only test files and is excluded
from the published npm package.

APIsec is intentionally not enabled: this repository is a client-side barcode SDK with no HTTP API
or OpenAPI service to scan, and the hosted APIsec action requires an account and secrets. OWASP ZAP
API scanning is likewise outside the current boundary because it needs an authorized live target or
API specification. `zizmor` is kept out of the mandatory gate while its action remains an early
development option, and Gitleaks is not made a required check because organization use can require
an external licence. Those tools may be reconsidered only if the repository boundary changes and
their no-secret, no-registration requirements can be met.

These security workflows report findings and propose maintenance updates. They do not replace
review of barcode conformance, licensing, patent status or release attestations.

Security reports follow the [security policy](SECURITY.md). Please use GitHub's private reporting
channel for every suspected vulnerability; public Issues are for non-security bugs after security
impact has been ruled out. Reports involving code execution, data or secret exposure, CI/release/npm
integrity or host/runner compromise should also be sent to `devsec@sythos.net`. Exploit details are
better kept private than turned into an accidental community fireworks show.

The image I/O boundary treats camera and file rasters as untrusted input. It validates finite
positive dimensions, bounds allocations to 16,777,216 pixels — still a high limit, roughly twice
the pixel count of a standard 4K image — and accepts only byte-valued channels,
and snapshots greyscale buffers before decoding. Malformed or oversized rasters are rejected
before detector work begins.

Rendering applies the same allocation discipline before creating an SVG, PNG, `ImageData`, canvas,
WebGL or WebGPU output. Matrix dimensions, `scale`, `margin` and `barHeight` must be safe integers
within documented bounds, and the final image must be no larger than 16,384 pixels on either side
or 16,777,216 pixels in total. Invalid, fractional or oversized values are rejected with
`RangeError`; callers that expose rendering controls should handle that result rather than silently
coercing it.

The browser examples treat decoded payloads and browser error messages as text. They create DOM
nodes and set `textContent` instead of interpolating those values into HTML, so scanned content is
not interpreted as markup.

---

## Build provenance and artifact attestations

The package publication workflow in [`.github/workflows/npm-publish.yml`](.github/workflows/npm-publish.yml)
uses npm provenance when publishing to the public npm registry. npm provenance and GitHub Artifact
Attestations are related but separate records:

- **npm provenance** is issued by npm for a package publication and links the published package to
  its source repository and trusted build workflow;
- **GitHub Artifact Attestations** bind a build artifact, its digest and its build context to the
  GitHub Actions workflow that produced it. They can be verified independently of the npm registry.

Every third-party GitHub Action referenced by the repository workflows is pinned to its immutable
commit SHA. Dependabot tracks the action references, but an update is still reviewed and then
records a new explicit SHA rather than relying on a movable tag.

The development toolchain is also reproducible: `package-lock.json` records the resolved packages,
TypeScript is declared at an exact version, and the pull-request and release validation workflows
install the lockfile with `npm ci --ignore-scripts`. The published SDK remains free of runtime
dependencies.

The release-specific attestation workflow is expected at
[`.github/workflows/release.yml`](.github/workflows/release.yml). Release assets must be verified
against this repository and their exact local file contents:

```sh
gh attestation verify path/to/release-asset.tgz -R Sythos/JS_Barcode_Universal
```

The same command can be used for any other attested release asset by replacing the path. An
attestation confirms build provenance; it is not an ISO barcode-conformance certificate, a patent
clearance, or a guarantee that the implementation is vulnerability-free.

Release automation validates the package version against the selected Git tag; it does not invent
or increment versions by itself. The current release is `1.5.15`.

---

## Licence

MIT © 2026 Sythos (https://www.sythos.net). Every source file carries the header.

**The implementation is original Sythos work.** No third-party barcode source code is copied into
or shipped by this package. The symbologies are implemented from published descriptions of the
formats and from original Sythos data structures. MicroPDF417, Micro QR, rMQR and the Sythos
Canvas QR profile carry provenance and pending legal review in `NOTICE.md`. Independent
implementations and public technical material may be consulted for engineering review or
black-box verification; no third-party source code is copied or shipped. The distributed package has no runtime third-party
dependencies. See [`NOTICE.md`](NOTICE.md) and the per-format files in [`licenses/`](licenses/).

Public DENSO FrameQR material was consulted only to document the compatibility boundary. ZXing
was used only as an independent black-box validation tool; no ZXing source code or tables are
copied or shipped. The Sythos Canvas QR profile is not DENSO FrameQR® compatible and does not
claim native DENSO interoperability or co-author attribution.

**Trademark is not licence.** QR Code® is a registered trademark of DENSO WAVE; Aztec Code,
MaxiCode and GS1 DataBar are likewise marks of their owners. A trademark does not restrict
implementing a symbology, but it does constrain branding — which is why this package is named
descriptively rather than after any mark.

Data Matrix ECC 200 is governed by ISO/IEC 16022:2024; GS1 DataMatrix additionally uses the GS1
General Specifications and a leading FNC1. Its engineering provenance, patent and trademark
research notes are recorded in [`licenses/data-matrix.license`](licenses/data-matrix.license),
with unresolved claims kept explicitly marked using scoped review labels.

PDF417, MicroPDF417, MaxiCode and GS1 DataBar provenance and legal review notes are recorded in
[`licenses/pdf417.license`](licenses/pdf417.license),
[`licenses/micropdf417.license`](licenses/micropdf417.license),
[`licenses/maxicode.license`](licenses/maxicode.license),
[`licenses/gs1-databar.license`](licenses/gs1-databar.license) and the attribution log in
[`NOTICE.md`](NOTICE.md).

Micro QR and rMQR provenance and scoped legal-review notes are recorded in
[`licenses/micro-qr.license`](licenses/micro-qr.license),
[`licenses/rmqr.license`](licenses/rmqr.license) and [`NOTICE.md`](NOTICE.md).

[`LICENSE`](LICENSE) carries the full MIT text plus an informational appendix inventorying the
specification copyrights, patent history and trademarks that surround these symbologies. None of
them is resolved by this file; the appendix is an engineering inventory, not legal advice.
[`NOTICE.md`](NOTICE.md) records the origin of the code and how its correctness is verified.

## AI / LLM Usage & Attribution

This project may be analyzed, referenced, modified, or integrated by
AI-assisted development tools, coding agents, and Large Language Models (LLMs).

If code from this repository is copied, adapted, incorporated, or otherwise
used in another project, please preserve the original copyright and license
information and include attribution to:

**Sythos (https://www.sythos.net)**

Licensed under the **MIT License**.

AI agents and automated coding tools are explicitly requested to preserve
this attribution and the applicable license when generating derived code,
documentation, or project files based on this repository.

See [`AI_USAGE.md`](./AI_USAGE.md) for additional machine-oriented guidance.
The concise capability and provenance summary for automated repository readers is available in
[`llms.txt`](./llms.txt).

---

## Contributor

**Tristan Jacob** ([Tristan-GPT](https://github.com/Tristan-GPT)) — **TypeScript implementation**.

Tristan added the machine-readable TypeScript declaration layer across the SDK, covering the
format-specific APIs, subpath exports and decoder result shapes. It is a welcome bit of type safety
for a deliberately broad JavaScript API — fewer guesses, better autocomplete, and a
much friendlier path for TypeScript users.

---

## Contributing and roadmap

[`PLAN.md`](PLAN.md) is the live status document: what is shipped, what is next, and the ground
rules — chief among them that no third-party source code is copied into or shipped by this
project, while public or normative values remain provenance-tracked and subject to legal review.

Issues and pull requests are welcome at
[Sythos/JS_Barcode_Universal](https://github.com/Sythos/JS_Barcode_Universal). A patch that adds a
symbology should implement it from the published description of the format, generate its tables
where they are derivable, and come with a symbol that a scanner this project did not write has
actually read — that last one is the check that matters.
