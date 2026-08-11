# Sythos Barcode Suite

Read and write barcodes in JavaScript.

[![npm](https://img.shields.io/npm/v/@sythos/js_barcode_universal.svg)](https://www.npmjs.com/package/@sythos/js_barcode_universal)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Runtime dependencies: 0](https://img.shields.io/badge/runtime%20dependencies-0-brightgreen.svg)](package.json)

100% original code, zero runtime dependencies, MIT. It runs unmodified in Node, in browsers
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

### 1. npm

```sh
npm install @sythos/js_barcode_universal
```

`yarn add @sythos/js_barcode_universal` and `pnpm add @sythos/js_barcode_universal` do the same thing. Nothing is installed
alongside it — there are no runtime dependencies, no postinstall script and no native build. The
package is plain ESM (`"type": "module"`) and asks for Node 18 or newer.

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
| `@sythos/js_barcode_universal/oned` | The per-format 1D writers (`encodeEAN13`, `encodeCode128`, …) and `decodeOneD` |
| `@sythos/js_barcode_universal/qr` | `encodeQR`, `decodeQR`, `detectQR`, `detectAndDecodeQR` |
| `@sythos/js_barcode_universal/datamatrix` | `encodeDataMatrix`, `decodeDataMatrix`, `detectDataMatrix`, `detectAndDecodeDataMatrix` |
| `@sythos/js_barcode_universal/render` | Every renderer plus `isWebGL2Available` / `isWebGPUAvailable` |
| `@sythos/js_barcode_universal/render/svg` | `toSVG`, `toSVGDataURI` |
| `@sythos/js_barcode_universal/render/png` | `toPNG`, `toPNGDataURI` |
| `@sythos/js_barcode_universal/render/image-data` | `toImageData`, `toCanvas` |
| `@sythos/js_barcode_universal/bundle` | The prebuilt ESM bundle, as one file |
| `@sythos/js_barcode_universal/bundle/iife` | The prebuilt IIFE bundle, for a `<script>` tag |

The `unpkg` and `jsdelivr` fields point at the IIFE bundle, so a CDN needs no install at all:

```html
<script src="https://unpkg.com/@sythos/js_barcode_universal"></script>
<script src="https://unpkg.com/@sythos/js_barcode_universal@1.1.0"></script>
<script src="https://cdn.jsdelivr.net/npm/@sythos/js_barcode_universal@1.1.0"></script>
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

[`src/index.js`](src/index.js) is plain ESM with JSDoc types and no build step of its own. Import
it and let your bundler tree-shake; the package is marked side-effect free.

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

---

## Supported formats

Generated from `listFormats()`, which reports writing and reading as separate capabilities.
Writing a symbology is a table lookup; reading one needs a detector that finds it in a
photograph. The two lists legitimately differ, and saying so here is better than failing at call
time.

| Format | `id` | Kind | Write | Read |
|---|---|:---:|:---:|:---:|
| EAN-13 | `ean13` | 1D | ✅ | ✅ |
| EAN-8 | `ean8` | 1D | ✅ | ✅ |
| UPC-A | `upca` | 1D | ✅ | ✅ |
| UPC-E | `upce` | 1D | ✅ | ✅ |
| ISBN (Bookland) | `isbn` | 1D | ✅ | ✅ [^1] |
| Code 128 | `code128` | 1D | ✅ | ✅ |
| GS1-128 | `gs1128` | 1D | ✅ | ✅ [^1] |
| Code 39 | `code39` | 1D | ✅ | ✅ |
| Code 93 | `code93` | 1D | ✅ | ✅ |
| ITF (Interleaved 2 of 5) | `itf` | 1D | ✅ | ✅ |
| ITF-14 | `itf14` | 1D | ✅ | ✅ [^1] |
| Codabar | `codabar` | 1D | ✅ | ✅ |
| Code 11 | `code11` | 1D | ✅ | — |
| MSI Plessey | `msi` | 1D | ✅ | — |
| Pharmacode | `pharmacode` | 1D | ✅ | — |
| QR Code | `qr` | 2D | ✅ | ✅ |
| Data Matrix ECC 200 | `datamatrix` | 2D | ✅ | ✅ |
| Aztec Code | `aztec` | 2D | ✅ | ✅ |

Eighteen formats, all writable, fifteen readable. **Code 11, MSI Plessey and Pharmacode are
write-only** — they encode correctly, but there is no reader for them, and `decode` will never
return one.

[^1]: `gs1128`, `itf14` and `isbn` are sub-variants that share a decoder with their base format, so
they decode under that base id: a GS1-128 comes back as `code128`, an ITF-14 as `itf`, and an ISBN
as `ean13`. The payload is intact either way — a GS1-128 *is* a Code 128 with a leading FNC1, an
ITF-14 *is* an ITF fixed at fourteen digits, and an ISBN barcode *is* an EAN-13 with a 978/979
prefix. Match on `result.format === 'code128'` rather than `'gs1128'`, or a
condition on the sub-variant id will silently never fire.

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
decoded. The current detector accepts axis-aligned square or rectangular symbols; the normal
`decode(image, { formats: ['datamatrix'] })` pipeline also retries quarter-turn rotations.
Arbitrary-angle and perspective-skewed Data Matrix photographs are not yet guaranteed.

### Aztec Code

`aztec` writes Compact layers 1–4 and Full layers 1–32, selecting a fitting symbol automatically
unless `layers` and `compact` are forced. It supports the five Aztec text tables and UTF-8 byte
payloads through Binary Shift, with `eccPercent` (default 23) controlling the requested
error-correction level.
ECI is not yet a configurable public option.

```js
import { encodeAztec, decodeAztec } from '@sythos/js_barcode_universal/aztec';

const symbol = encodeAztec('Ciao, mondo 👋', { eccPercent: 23 });
const result = decodeAztec(symbol);
console.log(result.text); // Ciao, mondo 👋
```

The image detector handles rotation, inverted polarity and quadrilateral sampling around the
central bull’s-eye. Severe photographic perspective remains an interoperability and robustness
gate rather than a guaranteed capability.

### Not implemented

**PDF417, GS1 DataBar and MaxiCode are not implemented** — neither writing
nor reading. Data Matrix ECC 200 is implemented for its classic square and rectangular symbols;
DMRE remains outside the current scope. Some scaffolding for the remaining formats exists in the core (the Galois field code already handles
the prime field PDF417 needs), but none of those remaining symbologies is usable today. See [`PLAN.md`](PLAN.md)
for where they sit.

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

```js
encode('5901234123457', { format: 'ean13' })
encode('ABC-123', { format: 'code39', fullAscii: true, checkDigit: true })
encode('https://example.com', { format: 'qr', ecc: 'H', version: 7 })
encode('0101234567890128', { format: 'datamatrix', gs1: true })
encode('Ciao, mondo 👋', { format: 'aztec', eccPercent: 23 })
```

```js
decode(image, options?) → Result[]
decodeStrict(image, options?) → Result        // throws NotFoundError instead of returning []
```

`image` is `{ data, width, height }` with RGBA bytes. `options`: `formats` (restrict the search,
and go faster), `tryHarder` (retry inverted, default `true`), `binarizer`
(`'global' | 'hybrid' | 'auto'`). A `Result` carries at least `text` and `format`; QR results also
carry `bytes`, `version` and `ecc`.

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
an axis-aligned bounding box plus quarter-turn retries. Error correction repairs what the camera
lost. Only then is the payload decoded.

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

## Licence

MIT © 2026 Sythos. Every source file carries the header.

**The code is 100% original.** No source code and no constant table from any other barcode
implementation is present, under any licence, permissive or otherwise. The symbologies are
implemented from published descriptions of the formats — which are systems and facts, not works of
authorship — and from constant tables generated by this project's own scripts wherever a table is
derivable rather than arbitrary. There is consequently no upstream licence to carry and no
co-author to credit.

**Trademark is not licence.** QR Code® is a registered trademark of DENSO WAVE; Aztec Code,
MaxiCode and GS1 DataBar are likewise marks of their owners. A trademark does not restrict
implementing a symbology, but it does constrain branding — which is why this package is named
descriptively rather than after any mark.

Data Matrix ECC 200 is governed by ISO/IEC 16022:2024; GS1 DataMatrix additionally uses the GS1
General Specifications and a leading FNC1. Its engineering provenance, patent and trademark
research notes are recorded in [`licenses/data-matrix.license`](licenses/data-matrix.license),
with unresolved claims kept explicitly marked `[TO VERIFY]`.

[`LICENSE`](LICENSE) carries the full MIT text plus an informational appendix inventorying the
specification copyrights, patent history and trademarks that surround these symbologies. None of
them encumbers this code; the appendix is an engineering inventory, not legal advice.
[`NOTICE.md`](NOTICE.md) records the origin of the code and how its correctness is verified.

---

## Contributing and roadmap

[`PLAN.md`](PLAN.md) is the live status document: what is shipped, what is next, and the ground
rules — chief among them that no code or constant table from any other barcode implementation
enters this project, which is what keeps the licence clean.

Issues and pull requests are welcome at
[Sythos/JS_Barcode_Universal](https://github.com/Sythos/JS_Barcode_Universal). A patch that adds a
symbology should implement it from the published description of the format, generate its tables
where they are derivable, and come with a symbol that a scanner this project did not write has
actually read — that last one is the check that matters.
