# MaxiCode

MaxiCode is a fixed 30×33-module 2D symbol. This SDK supports writing and
reading Modes 2, 3, 4 and 5 through a dedicated subpath:

```js
import {
  encodeMaxiCode,
  decodeMaxiCode,
  detectAndDecodeMaxiCode,
} from '@sythos/js_barcode_universal/maxicode';

const symbol = encodeMaxiCode('HELLO FROM SYTHOS', { mode: 4 });
const decoded = decodeMaxiCode(symbol);
console.log(decoded.mode, decoded.text);
```

## Modes and payloads

- **Modes 2 and 3** carry structured primary data. Pass `primary` with a
  postal code, numeric country code and three-digit service class.
- **Modes 4 and 5** carry an unstructured secondary message. Mode 5 has the
  smaller secondary capacity defined by the symbol grammar.
- Text and byte input use ISO-8859-1. The encoder accepts a string, a
  `Uint8Array` or an array of byte values from `0` through `255`.

```js
const freight = encodeMaxiCode('SYTHOS-42', {
  mode: 2,
  primary: {
    postalCode: '12345',
    countryCode: 840,
    serviceClass: 123,
  },
  charset: 'latin1',
});
```

The result includes the decoded mode, raw bytes, and the number of
Reed–Solomon corrections applied. Modes 2 and 3 also return the structured
`primary` object.

## Image detection boundary

`decodeMaxiCode()` accepts a canonical 30×33 `BitMatrix`, including an inverted
or 180-degree-rotated matrix. `detectMaxiCode()` and
`detectAndDecodeMaxiCode()` accept a clean binary raster containing one
prominent symbol at an integer or near-integer scale. They deliberately reject
partial symbols, structural noise and ambiguous multi-symbol scenes. For
arbitrary perspective, sample the quadrilateral in the application and then
call the matrix decoder.

An empty result from the root `decode()` API means that the frame did not
contain a validated MaxiCode; partial or low-confidence payloads are never
returned.

## Provenance and naming

The implementation is original Sythos TypeScript with generated JavaScript and
is distributed under the MIT License. ISO/IEC 16023 and independent runtimes
were used for engineering review and black-box checks only; no third-party
source code or tables are shipped. See the [`maxicode.license`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/licenses/maxicode.license)
file and [`NOTICE.md`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/NOTICE.md)
for the scoped provenance and legal-review notes. “MaxiCode” is used
descriptively and does not imply certification or endorsement by a standards
body or mark owner.
