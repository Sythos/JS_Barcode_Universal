# GS1, EAN and UPC formats

This page groups the retail and logistics paths that share application-level
rules, while keeping their physical barcode grammars separate.

| Area | Runtime ID or path | Write | Read | Boundary |
| --- | --- | :---: | :---: | --- |
| EAN-13 | `ean13` | ✅ | ✅ | Modulo-10 check digit; 12 or verified 13 digits. |
| EAN-8 | `ean8` | ✅ | ✅ | Modulo-10 check digit; 7 or verified 8 digits. |
| UPC-A / UPC-E | `upca`, `upce` | ✅ | ✅ | UPC family validation and expansion rules. |
| Bookland ISBN | `isbn` | ✅ | ✅ | ISBN-10/13 validation, then EAN-13 output. |
| GS1-128 | `gs1128` | ✅ | ✅ | Code 128 with FNC1 and GS1 metadata. |
| DataBar-14 | `gs1databar14` | ✅ | ✅ | Omnidirectional and Truncated physical support. |
| EAN-2 / EAN-5 | `ean2`, `ean5` | ✅ | ✅* | `*` parent-bound supplements. |

## EAN, UPC and ISBN

The writers accept the payload forms described by their format-specific API.
For EAN-13 and EAN-8, a payload without its final check digit receives one; a
payload that includes a check digit is verified. UPC-A and UPC-E use the
corresponding UPC rules. ISBN-10 is checked with its ISBN modulo-11 rule and
then emitted as a Bookland EAN-13 symbol with the appropriate EAN check digit.

```js
import {
  encodeEAN13,
  encodeISBN,
  encodeUPCA,
  encodeUPCE,
} from '@sythos/js_barcode_universal/oned';

const ean = encodeEAN13('590123412345');
const book = encodeISBN('978-0-306-40615-7');
const upc = encodeUPCA('04210000526');
const compact = encodeUPCE('01234565');
```

ISBN is an application numbering convention over Bookland EAN-13, not a new
physical symbol grammar. Consequently, the generic reader can report the
underlying EAN result while retaining the decoded digits.

## EAN-2 and EAN-5 supplements

EAN-2 and EAN-5 are small add-on symbols printed to the right of a validated
EAN/UPC symbol. They are not independent retail symbols in this SDK’s generic
image pipeline. The public helpers are exported from the `oned` subpath:

```js
import {
  composeEANAddon,
  encodeEAN13WithAddon,
  encodeEAN2,
  encodeEAN5,
} from '@sythos/js_barcode_universal/oned';

const addon2 = encodeEAN2('12');
const addon5 = encodeEAN5('51234');
const magazine = encodeEAN13WithAddon('590123412345', '12');
const bookWithAddon = composeEANAddon(
  encodeISBN('978-0-306-40615-7'),
  addon5,
  { gap: 9 },
);
```

The helper normally inserts a nine-module quiet gap. EAN-2 uses the payload
modulo four to select its parity. EAN-5 derives its parity from its supplemental
checksum. The decoder validates the start guard, separators, digit patterns
and parity/checksum before accepting a supplement.

When the root image reader sees an add-on, it requires a valid EAN-13, EAN-8,
UPC-A, UPC-E or Bookland parent. The parent remains the primary result format;
the add-on is exposed as `result.addon` when it was valid and requested. A
malformed or absent supplement must not reject an otherwise valid parent.

```js
import { decode } from '@sythos/js_barcode_universal';

const results = decode(imageDataLike, {
  formats: ['ean13', 'ean2', 'ean5'],
  profile: 'camera',
});

const result = results[0];
if (result?.addon) {
  console.log(result.format, result.text, result.addon.text);
}
```

Requesting only `ean2` or `ean5` still requires the validated parent. The
supplement IDs in `listFormats()` describe the available codec and attached
reader path; they do not change that parent-bound contract.

## GS1-128

`gs1128` is the explicit GS1 form of Code 128. The writer emits a leading FNC1
and treats the group separator (`U+001D`) as a field separator where requested:

```js
import { encode } from '@sythos/js_barcode_universal';

const matrix = encode('0101234567890128\u001D17250101', {
  format: 'gs1128',
});
```

The reader validates the Code 128 grammar and classifies a leading FNC1 result
as `gs1128`. It can expose `gs1`, `symbologyIdentifier` and parsed `elements`
metadata. This semantic layer is useful for decoding, but it does not replace
application validation of allowed Application Identifiers, dates, quantities or
business rules.

The GS1 helper functions are available from the `databar` subpath:

```js
import {
  decodeGS1ElementString,
  encodeGS1ElementString,
  parseGS1ElementString,
} from '@sythos/js_barcode_universal/databar';

const encoded = encodeGS1ElementString([
  { ai: '01', value: '01234567890128' },
  { ai: '17', value: '250101' },
]);

console.log(parseGS1ElementString('(01)01234567890128(17)250101'));
console.log(decodeGS1ElementString(encoded));
```

## GS1 DataBar

The implemented physical layer covers GS1 DataBar Omnidirectional and
Truncated. The data layer includes GTIN normalization, check digits and the
shared GS1 Application Identifier helpers. The scanner uses scanline and clean
matrix paths; it does not imply full support for Limited, Stacked, Stacked
Omnidirectional or Expanded physical layouts.

```js
import {
  decodeDataBar14,
  encodeDataBar14,
} from '@sythos/js_barcode_universal/databar';

const matrix = encodeDataBar14('01234567890128', {
  variant: 'omnidirectional',
});

console.log(decodeDataBar14(matrix).text);
```

Use the exact variant accepted by the current type declarations and validate
the physical deployment with a real scanner. The runtime registry label
`GS1 DataBar Omnidirectional / Truncated` is intentionally narrower than the
whole GS1 DataBar family.

## Trust and licensing

GS1 syntax and physical format names are not a grant to use GS1 identifiers in
a business process. Validate decoded content before acting on it. The SDK is
MIT-licensed original Sythos code with no runtime dependencies; its provenance
and review boundaries are recorded in [`NOTICE.md`](../../NOTICE.md),
[`LICENSE`](../../LICENSE), [`licenses/gs1-128.license`](../../licenses/gs1-128.license),
and [`licenses/gs1-databar.license`](../../licenses/gs1-databar.license).
