# Encoding barcodes

Encoding starts with a payload and ends with a [`BitMatrix`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/src/ts/core/bit-matrix.d.ts).
The matrix contains one bit per barcode module: a set bit is dark ink and an
unset bit is the light background. It has no quiet zone; choose that later in a
renderer.

For the smallest application-facing surface, use `encode()` from the package
root. For format-specific work, import the named encoder from the matching
public subpath.

## The general encoder

```ts
encode(text: string | number, options?: EncodeOptions): BitMatrix
```

The exported declaration spells the options out inline. These are the fields
currently accepted by the root facade:

| Option | Values | Used by |
| --- | --- | --- |
| `format` | A registry id such as `qr`, `datamatrix`, `code128` or `pdf417` | Selects the symbology. Default: `qr`. |
| `ecc` | `L`, `M`, `Q`, `H` | QR Code error correction. |
| `version` | QR version `1`–`40` | QR Code, when a fixed version is needed. |
| `checkDigit` | `boolean` | Optional check digits for supported linear writers. |
| `fullAscii` | `boolean` | Code 39 extended character mapping. |
| `gs1` | `boolean` | Emits a leading FNC1 for GS1-128-compatible Code 128 output. |
| `layers` | `number` | Forces Aztec layer selection. |
| `compact` | `boolean` | Forces the Aztec Compact or Full shape. |
| `eccPercent` | `number` | Requested Aztec error-correction percentage. |
| `eccLevel` | `0`–`8` | PDF417 error-correction level. |
| `columns` | `1`–`30` | PDF417 column count. |
| `rows` | `3`–`90` | PDF417 row count. |
| `rowHeight` | `number` | PDF417 row height in modules. |
| `compaction` | `auto`, `text`, `byte`, `numeric` | PDF417 compaction preference. |
| `eci` | `number` | MicroPDF417 byte-compaction ECI assignment; the public facade documents `3` and `26`. |
| `aspectRatio` | `number` | Preferred MicroPDF417 aspect ratio. |
| `canvas` | Object | Canvas reservation for the Sythos Canvas QR profile. |

Format-specific options are not silently universal. For example, `ecc` is a
QR setting and `columns` is a PDF417 setting. Invalid payloads, unsupported
combinations and values that do not fit are rejected with an encoding error.

## Current format ids

Use these ids with the root encoder. The registry in the running package is the
final authority if a future release changes a capability flag:

| Kind | Format ids |
| --- | --- |
| 1D | `ean13`, `ean8`, `upca`, `isbn`, `upce`, `code128`, `gs1128`, `code39`, `code93`, `itf`, `itf14`, `codabar`, `code11`, `msi`, `pharmacode` |
| Supplements | `ean2`, `ean5` |
| 2D | `qr`, `datamatrix`, `aztec`, `aztecrune`, `pdf417`, `compactpdf417`, `micropdf417`, `microqr`, `rmqr`, `frameqr` |
| GS1 | `gs1databar14` |

The name alone does not mean “readable in every image”. Check
`listFormats()` at runtime; for example, Pharmacode is currently writable but
not enabled in the generic reader, while EAN-2 and EAN-5 are parent-bound
add-ons.

## A root-level example

```js
import {
  encode,
  toSVGDataURI,
} from '@sythos/js_barcode_universal';

const matrix = encode('https://www.sythos.net/', {
  format: 'qr',
  ecc: 'H',
});

const dataUri = toSVGDataURI(matrix, {
  scale: 8,
  margin: 4,
  dark: '#10131a',
  light: '#ffffff',
});

console.log(matrix.width, matrix.height);
console.log(dataUri.startsWith('data:image/svg+xml'));
// true
```

The QR encoder chooses the smallest version that fits unless `version` is
forced. A forced version can make a payload fail even when automatic selection
would succeed. Error correction consumes capacity too, so `H` is more robust
but usually needs a larger symbol than `L`.

## Direct format encoders

The same matrix contract is available without the general dispatcher:

```js
import { encodeDataMatrix } from '@sythos/js_barcode_universal/datamatrix';
import { encodeQR } from '@sythos/js_barcode_universal/qr';
import { encodeCode128 } from '@sythos/js_barcode_universal/oned';

const qr = encodeQR('direct QR', { ecc: 'M' });
const dataMatrix = encodeDataMatrix('direct Data Matrix');
const linear = encodeCode128('ABC-123456');

console.log(qr.width === qr.height); // true
console.log(dataMatrix.width > 0);   // true
console.log(linear.height);          // 1: render it with barHeight later
```

Useful direct families include:

| Import | Representative functions |
| --- | --- |
| `@sythos/js_barcode_universal/oned` | `encodeEAN13`, `encodeCode128`, `encodeCode39`, `encodeITF14`, `encodeMSI`, `encodePharmacode`, add-on and GS1 helpers |
| `@sythos/js_barcode_universal/qr` | `encodeQR` |
| `@sythos/js_barcode_universal/datamatrix` | `encodeDataMatrix`, `encodeDataMatrixCodewords` |
| `@sythos/js_barcode_universal/aztec` | `encodeAztec` |
| `@sythos/js_barcode_universal/aztecrune` | `encodeAztecRune` |
| `@sythos/js_barcode_universal/pdf417` | `encodePDF417` and compaction helpers |
| `@sythos/js_barcode_universal/compactpdf417` | `encodeCompactPDF417` |
| `@sythos/js_barcode_universal/micropdf417` | `encodeMicroPDF417` |
| `@sythos/js_barcode_universal/microqr` | `encodeMicroQR` |
| `@sythos/js_barcode_universal/rmqr` | `encodeRMQR` |
| `@sythos/js_barcode_universal/frameqr` | `encodeFrameQR` |

These direct functions expose format-specific signatures. Their declarations
are the best reference for special payload types and options; the subpath map
is in [Subpath exports](subpath-exports.md).

## Linear symbols and supplements

Linear encoders return a one-module-tall matrix. This is intentional: the
renderer decides the physical bar height. For example:

```js
import {
  encodeEAN13WithAddon,
  encodeCode128,
} from '@sythos/js_barcode_universal/oned';
import { toImageData } from '@sythos/js_barcode_universal';

const ean = encodeEAN13WithAddon('5901234123457', '05');
const code128 = encodeCode128('0101234567890128', { gs1: true });

const retailImage = toImageData(ean, { scale: 4, margin: 9, barHeight: 96 });
const shippingImage = toImageData(code128, { scale: 3, margin: 10, barHeight: 72 });

console.log(retailImage.width, shippingImage.height);
```

Check digits are validated or generated according to the selected writer’s
contract. Do not treat a generated symbol as a proof that a product number is
assigned to your organisation; the SDK only handles the encoding rules.

## Payload limits are real limits

Every symbology has finite capacity. QR version, PDF417 rows/columns,
MicroPDF417 variants, Micro QR versions and rMQR sizes all constrain the
payload. A payload that does not fit must fail rather than be truncated. Bytes
are not the same as Unicode characters for byte-oriented formats, so test the
actual input and selected options.

Keep render dimensions bounded by the application. `scale`, `margin` and
`barHeight` become pixel allocations; do not pass untrusted values straight
from a request or form. The SDK applies its own validation, but an application
should still enforce a practical output budget before calling a renderer.
