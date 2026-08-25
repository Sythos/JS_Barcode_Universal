# Data Matrix ECC 200

The `datamatrix` entry implements classic Data Matrix ECC 200 symbols in both
square and rectangular shapes. The current registry reports:

| `id` | Write | Read | Scope |
| --- | :---: | :---: | --- |
| `datamatrix` | ✅ | ✅ | Classic ECC 200 square and rectangular symbols. |

DMRE (Data Matrix Rectangular Extension) is not included. A symbol that needs
DMRE-specific geometry or features is outside this implementation even if its
payload looks like an ordinary Data Matrix payload.

## Encoding

The public writer supports automatic or forced shape selection, ASCII
compaction, numeric pairs, Base256 binary payloads and the GS1 first-position
FNC1 option:

```js
import {
  encodeDataMatrix,
} from '@sythos/js_barcode_universal/datamatrix';

const retail = encodeDataMatrix('0101234567890128', {
  shape: 'square',
  gs1: true,
});

const binary = encodeDataMatrix(new Uint8Array([0x00, 0xff, 0x7f]), {
  encoding: 'base256',
  shape: 'rectangular',
});
```

The exact capacity depends on the selected symbol size and encoding. With
`shape: 'any'` (the default family behavior), the encoder can choose a fitting
classic symbol. Use `square` or `rectangular` when the physical marking area is
known and the payload fits that family.

## Decoding

The matrix decoder validates the finder border, reads the data region and
applies ECC 200 Reed–Solomon correction. The current high-level decoder
handles ASCII and Base256 codewords. C40, Text, X12 and EDIFACT input symbols
are not currently decoded by the high-level payload path, so they must not be
advertised as supported merely because the symbol geometry is recognized.

```js
import {
  decodeDataMatrix,
} from '@sythos/js_barcode_universal/datamatrix';

const result = decodeDataMatrix(matrix);
console.log(result.text, result.gs1 === true);
```

For an image, use the detector or the root reader:

```js
import { decode } from '@sythos/js_barcode_universal';

const results = decode(imageDataLike, {
  formats: ['datamatrix'],
  profile: 'camera',
});
```

The detector supports axis-aligned square and rectangular symbols. In the
camera profile it evaluates the fixed eight in-plane orientations at 45-degree
steps. Arbitrary perspective, heavily skewed photographs, curved labels,
severe occlusion and multi-symbol scenes are not guaranteed capabilities.

## GS1 DataMatrix boundary

`gs1: true` tells the writer to use the GS1 FNC1 convention in the first
position. That is a data-encoding choice, not a complete business-level GS1
validator. Application Identifiers, field lengths, domain rules and actions
after decoding remain the caller’s responsibility. Use the shared GS1 helpers
described in [GS1, EAN and UPC](gs1-and-ean.md) when the payload is an element
string that the project’s parser knows.

## Choosing Data Matrix instead of another 2D format

Data Matrix is a good fit when the marking area is compact or rectangular and
the application wants ECC 200 rather than QR’s finder-pattern family. It is
not a compatibility layer for DMRE, QR, Micro QR or a vendor-specific symbol.
Choose the exact `format` and keep the read allow-list equally explicit:

```js
import { decode, encode, toImageData } from '@sythos/js_barcode_universal';

const matrix = encode('DM-ECC200', {
  format: 'datamatrix',
  shape: 'square',
});
const image = toImageData(matrix, { scale: 8, margin: 4 });
const [result] = decode(image, { formats: ['datamatrix'] });

if (result) console.log(result.text);
```

The runtime code is MIT-licensed original Sythos work. Provenance, third-party
black-box validation and legal-review labels are recorded in
[`NOTICE.md`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/NOTICE.md), [`LICENSE`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/LICENSE), and
[`licenses/data-matrix.license`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/licenses/data-matrix.license).
