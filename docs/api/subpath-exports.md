# Subpath exports

The package root is the easiest starting point, but the package also exposes
focused ESM subpaths. They let an application import a format family or a
renderer without maintaining filesystem-relative imports.

The list below mirrors the current `exports` map in [`package.json`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/package.json).
Only these public subpaths are compatibility promises; arbitrary paths under
`src/` are not.

## Public map

| Import specifier | Main surface |
| --- | --- |
| `@sythos/js_barcode_universal` | Full root facade: registry, general encode/decode, core, image, formats and renderers. |
| `@sythos/js_barcode_universal/core` | `BitMatrix`, bit readers/writers, finite fields, Reed–Solomon helpers and SDK errors. |
| `@sythos/js_barcode_universal/image` | `LuminanceSource`, binarizers, perspective transforms and grid samplers. |
| `@sythos/js_barcode_universal/oned` | EAN/UPC, ISBN, Code 11/39/93/128, ITF, Codabar, MSI, Telepen, Pharmacode and EAN add-ons. |
| `@sythos/js_barcode_universal/qr` | QR Code encoder, decoder and detector. |
| `@sythos/js_barcode_universal/datamatrix` | Data Matrix ECC 200 encoder, decoder and detector. |
| `@sythos/js_barcode_universal/databar` | GS1 DataBar, GTIN helpers and GS1 element-string helpers. |
| `@sythos/js_barcode_universal/aztec` | Aztec Code encoder, decoder, detector and table helpers. |
| `@sythos/js_barcode_universal/aztecrune` | Aztec Rune encoder, decoder, detector and table helpers. |
| `@sythos/js_barcode_universal/pdf417` | PDF417 encoder, decoder, detector, compaction and error correction. |
| `@sythos/js_barcode_universal/compactpdf417` | Compact PDF417 encoder, decoder, detector and geometry helpers. |
| `@sythos/js_barcode_universal/micropdf417` | MicroPDF417 encoder, decoder, detector, variants and correction helpers. |
| `@sythos/js_barcode_universal/microqr` | Micro QR encoder, decoder and detector. |
| `@sythos/js_barcode_universal/rmqr` | rMQR encoder, decoder, detector and size/table helpers. |
| `@sythos/js_barcode_universal/frameqr` | Sythos Canvas QR profile encoder, decoder, detector and profile helpers. |
| `@sythos/js_barcode_universal/maxicode` | MaxiCode Modes 2–5 encoder, decoder, detector and fixed-grid helpers. |
| `@sythos/js_barcode_universal/render` | All renderers, canvas backends, option normalisation and colour parsing. |
| `@sythos/js_barcode_universal/render/svg` | `toSVG`, `toSVGDataURI`. |
| `@sythos/js_barcode_universal/render/png` | `toPNG`, `toPNGDataURI`, `deflateStored`. |
| `@sythos/js_barcode_universal/render/image-data` | `toImageData`, `toCanvas`. |
| `@sythos/js_barcode_universal/bundle` | ESM bundle entry point. Prefer the root or focused subpaths for readable imports. |
| `@sythos/js_barcode_universal/bundle/iife` | IIFE bundle asset. Use it as a browser script rather than assuming it is an ESM module. |
| `@sythos/js_barcode_universal/package.json` | Package metadata for tooling that explicitly needs it. |

Every format subpath exposes its public `index.d.ts` alongside the runtime
module. For example, the QR subpath exports `encodeQR`, `decodeQR`,
`detectQR` and `detectAndDecodeQR`; the PDF417 family exposes the corresponding
encoder, decoder and detector functions plus format-specific helpers.

## Import focused code

```js
import { encodeQR } from '@sythos/js_barcode_universal/qr';
import { encodeDataMatrix } from '@sythos/js_barcode_universal/datamatrix';
import { toSVG } from '@sythos/js_barcode_universal/render/svg';

const qr = encodeQR('focused import', { ecc: 'M' });
const dataMatrix = encodeDataMatrix('another focused import');

console.log(toSVG(qr, { scale: 6, margin: 4 }).startsWith('<svg'));
console.log(dataMatrix.width > 0);
// true
// true
```

The focused import does not change the matrix or rendering contract. It only
avoids importing the root facade when the application already knows its format.

## Bundle choices

The ESM bundle is available through the `./bundle` export and as the committed
[`bundle/sythos-barcode.esm.js`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/bundle/sythos-barcode.esm.js) asset. The
IIFE bundle is available through `./bundle/iife` and is the asset used by the
repository’s plain HTML examples:

```html
<script src="https://unpkg.com/@sythos/js_barcode_universal/bundle/sythos-barcode.js"></script>
<script>
  const matrix = SythosBarcode.encode('IIFE import', { format: 'qr' });
</script>
```

For an application build, prefer the package root or a focused subpath so the
toolchain can see named imports. Pin a package version or a bundle URL in
production when reproducible deployed bytes matter.

## What not to import

Avoid imports such as:

```js
import { encodeQR } from '../../src/ts/qr/encoder.js';
```

They couple an application to the repository layout, bypass the package export
map and can load TypeScript source that Node.js cannot execute directly. Use
the documented package specifier instead:

```js
import { encodeQR } from '@sythos/js_barcode_universal/qr';
```

The project may reorganise internal files while keeping the public subpath
stable. That is precisely what the exports map is there to protect.
