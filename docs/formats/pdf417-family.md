# PDF417 family

The SDK exposes three different PDF417-family formats:

| Label | `id` | Write | Read | Geometry |
| --- | --- | :---: | :---: | --- |
| PDF417 | `pdf417` | ✅ | ✅ | Full stacked PDF417 symbol. |
| Compact PDF417 | `compactpdf417` | ✅ | ✅ | Truncated/compact PDF417 geometry. |
| MicroPDF417 | `micropdf417` | ✅ | ✅ | 34 fixed MicroPDF417 variants. |

The names are related, but the row indicators, start/stop patterns, dimensions,
capacity tables and detector assumptions differ. A decoder for one family must
not be used as a promise of support for another.

## Full PDF417

`pdf417` supports Text, Byte and Numeric compaction, ECC levels `0..8`,
Reed–Solomon correction and the implemented ECI 3 (ISO-8859-1) and ECI 26
(UTF-8) byte paths:

```js
import {
  decodePDF417,
  encodePDF417,
} from '@sythos/js_barcode_universal/pdf417';

const matrix = encodePDF417('AAMVA SAMPLE', {
  eccLevel: 3,
});

console.log(decodePDF417(matrix).text);
```

The direct matrix decoder expects a symbol matrix without a photographic
localization step. The image detector adds row-height inference, automatic
localization and the fixed 45-degree camera orientation retries. The current
validated image path includes clean module-aligned rasters, integer scale,
mild blur/noise, perspective estimation and an application-supplied
quadrilateral. It does not claim extreme glare, severe occlusion, curved media
or multi-symbol scene handling.

The root reader can keep the search focused:

```js
import { decode } from '@sythos/js_barcode_universal';

const [result] = decode(imageDataLike, {
  formats: ['pdf417'],
  profile: 'camera',
});
```

## Compact PDF417

`compactpdf417` uses truncated PDF417 geometry while retaining the family’s
Text, Byte and Numeric compaction ideas. It has a direct matrix decoder and a
clean raster detector:

```js
import {
  decodeCompactPDF417,
  encodeCompactPDF417,
} from '@sythos/js_barcode_universal/compactpdf417';

const matrix = encodeCompactPDF417('COMPACT PDF417', {
  compaction: 'text',
});

console.log(decodeCompactPDF417(matrix).text);
```

Do not swap a compact symbol into a `pdf417` allow-list merely because both
names contain PDF417. Use `formats: ['compactpdf417']` when the symbol is known
to be compact, or include both IDs when an application explicitly wants both
detectors to run.

## MicroPDF417

`micropdf417` writes and reads the 34 fixed variants. It supports Text, Byte
and Numeric compaction, with Byte ECI 3 and ECI 26. The writer can be guided by
`columns`, `rowHeight` and `aspectRatio` constraints:

```js
import {
  decodeMicroPDF417,
  encodeMicroPDF417,
} from '@sythos/js_barcode_universal/micropdf417';

const matrix = encodeMicroPDF417('MICRO PDF417', {
  compaction: 'text',
  columns: 2,
});

console.log(decodeMicroPDF417(matrix).text);
```

The detector accepts clean integer-scaled raster symbols and the fixed camera
orientation retries. Arbitrary perspective, severe photographic degradation
and multi-symbol scenes remain outside the validated guarantee. MicroPDF417 is
not a general-purpose replacement for full PDF417 when a scanner expects the
full row/indicator structure.

## Payload convention: AAMVA DL/ID data

The data structure carried in the PDF417 barcode on the back of North
American driver's licenses and ID cards is not a symbology of its own —
it is a structured text payload defined by the AAMVA DL/ID Card Design
Standard, encoded here through the existing `pdf417` writer (byte
compaction, since the format embeds raw control characters).
`@sythos/js_barcode_universal/payloads` builds the fixed header, subfile
designator and the Table D.3 mandatory data elements:

```js
import { encodeAAMVA, decodeAAMVA } from '@sythos/js_barcode_universal/payloads';

const matrix = encodeAAMVA({
  iin: '999999', // your jurisdiction's own AAMVA-assigned IIN — never defaulted
  vehicleClass: 'D', restrictions: 'NONE', endorsements: 'NONE',
  issueDate: '01012024', dateOfBirth: '01011990', expirationDate: '01012030',
  lastName: 'ROSSI', firstName: 'MARIO', sex: '1', eyeColor: 'BRO', height: '178 cm',
  street1: 'VIA ROMA 1', city: 'ROMA', state: 'RM', postalCode: '00100',
  customerId: 'X1234567', documentDiscriminator: 'DOC0001', country: 'USA',
});

const fields = decodeAAMVA(matrix); // { iin: '999999', lastName: 'ROSSI', ... }
```

`decodeAAMVA` (and its text-only counterpart `parseAAMVA`) reverses the
fixed header, subfile designator and Table D.3 elements back into the
same structured fields `encodeAAMVA` accepted, including the version and
truncation-code defaults `buildAAMVA` fills in when they're omitted.

This is a structured-data builder — the same kind of tool a real issuing
authority's own card-personalization system, or a business testing its
own age-verification/barcode scanner against the standard, needs. It
carries no jurisdiction's real Issuer Identification Number by default
(`iin` is a required field) and produces only the data structure, nothing
resembling a physical card or its security features. See
[`licenses/payload-conventions.license`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/licenses/payload-conventions.license)
for exactly which parts of the standard were verified, and
[`docs/guides/legal-exclusions.md`](https://sythos.github.io/JS_Barcode_Universal/guides/legal-exclusions/)
for why the similarly-requested AADHAAR format was deliberately left out
instead.

## Byte payloads and interoperation

For binary data, use the format-specific byte/ECI options and preserve the
returned bytes or segments when the application needs byte-for-byte fidelity.
Do not assume that a decoded JavaScript string is a lossless representation of
every external byte sequence. The project records exactly which independent
black-box vectors have passed in [`NOTICE.md`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/NOTICE.md) and the release
notes; round-trip tests alone are not proof of interoperability.

ZXing, bwip-js and other independent implementations were used only as
black-box verification tools where recorded. No third-party source code or
tables are runtime dependencies or distributed assets. The engineering and
legal review inventory is in [`LICENSE`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/LICENSE),
[`NOTICE.md`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/NOTICE.md), [`licenses/pdf417.license`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/licenses/pdf417.license),
[`licenses/compact-pdf417.license`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/licenses/compact-pdf417.license), and
[`licenses/micropdf417.license`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/licenses/micropdf417.license).
