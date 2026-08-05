# Sythos Barcode Suite

Read and write barcodes in JavaScript.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Runtime dependencies: 0](https://img.shields.io/badge/runtime%20dependencies-0-brightgreen.svg)](package.json)

100% original code, zero runtime dependencies, MIT. It runs unmodified in Node, in browsers
(including Safari on iOS) and in web workers. The core requires no canvas, no filesystem and no
DOM — images go in and come out as plain `{ data, width, height }` RGBA objects, which is exactly
what an `ImageData` is.

```js
import { encode, decode, toSVG, toImageData } from './src/index.js';

const matrix = encode('https://example.com', { format: 'qr', ecc: 'M' });
const svg    = toSVG(matrix, { scale: 8 });

const found = decode(toImageData(matrix, { scale: 4 }), { formats: ['qr'] });
console.log(found[0].text);   // 'https://example.com'
```

---

## Quick start

There are three ways in, and none of them needs a build step.

### 1. A `<script>` tag

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

### 2. ESM bundle

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

### 3. The source directly

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

Fifteen formats, all writable, twelve readable. **Code 11, MSI Plessey and Pharmacode are
write-only** — they encode correctly, but there is no reader for them, and `decode` will never
return one.

[^1]: `gs1128`, `itf14` and `isbn` are sub-variants that share a decoder with their base format, so
they decode under that base id: a GS1-128 comes back as `code128`, an ITF-14 as `itf`, and an ISBN
as `ean13`. The payload is intact either way — a GS1-128 *is* a Code 128 with a leading FNC1, an
ITF-14 *is* an ITF fixed at fourteen digits, and an ISBN barcode *is* an EAN-13 with a 978/979
prefix. Match on `result.format === 'code128'` rather than `'gs1128'`, or a
condition on the sub-variant id will silently never fire.

### Not implemented

**Data Matrix, PDF417, Aztec, GS1 DataBar and MaxiCode are not implemented** — neither writing
nor reading. Some scaffolding for them exists in the core (the Galois field code already handles
the prime field PDF417 needs), but no symbology above is usable today. See [`PLAN.md`](PLAN.md)
for where they sit.

---

## Live examples

Two self-contained pages, each loading the IIFE bundle with a plain `<script>` tag. **Both open
directly from disk** — double-click the file, no server and no build.

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
omitted), `checkDigit`, `fullAscii` (Code 39 extended), `gs1` (emit a leading FNC1).

```js
encode('5901234123457', { format: 'ean13' })
encode('ABC-123', { format: 'code39', fullAscii: true, checkDigit: true })
encode('https://example.com', { format: 'qr', ecc: 'H', version: 7 })
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
a symbol and its corners in that bit plane. Sampling reads the symbol back onto its module grid
through a perspective transform, so a photograph taken at an angle still yields a square grid.
Error correction repairs what the camera lost. Only then is the payload decoded.

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
