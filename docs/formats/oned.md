# Linear 1D formats

Linear symbols are encoded as a one-module-high `BitMatrix`. The vertical size
is a rendering decision: use the renderer's `barHeight` option when the symbol
needs to be printed or displayed at a useful height.

## Registry entries

| Label | `id` | Write | Generic image read | Notes |
| --- | --- | :---: | :---: | --- |
| EAN-13 | `ean13` | ✅ | ✅ | Twelve input digits receive a check digit; thirteen are verified. |
| EAN-8 | `ean8` | ✅ | ✅ | Seven input digits receive a check digit; eight are verified. |
| UPC-A | `upca` | ✅ | ✅ | Encoded through the EAN/UPC family rules. |
| UPC-E | `upce` | ✅ | ✅ | Compact UPC form with expansion/check validation. |
| ISBN (Bookland) | `isbn` | ✅ | ✅ | ISBN-10/ISBN-13 is emitted as Bookland EAN-13. |
| Code 128 | `code128` | ✅ | ✅ | Automatic code-set selection with checksum validation. |
| GS1-128 | `gs1128` | ✅ | ✅ | Code 128 with GS1 FNC1 semantics and parsed metadata. |
| Code 39 | `code39` | ✅ | ✅ | Optional modulo-43 check character and Full ASCII writer mode. |
| Code 93 | `code93` | ✅ | ✅ | Checksum and start/stop grammar are validated. |
| ITF | `itf` | ✅ | ✅ | Interleaved 2 of 5; the generic reader rejects very short ambiguous reads. |
| ITF-14 | `itf14` | ✅ | ✅ | Fixed-length ITF-14 writer; the shared reader reports the base `itf` format. |
| Code 25 / Standard 2 of 5 | `standard2of5` | ✅ | ✅ | Canonical Industrial frame in this SDK; `code2of5` is an alias. |
| Industrial 2 of 5 | `industrial2of5` | ✅ | ✅ | Two-wide-bar digit grammar with optional modulo-10 check digit. |
| IATA 2 of 5 | `iata2of5` | ✅ | ✅ | Same digit grammar with the shorter IATA guard frame. |
| Codabar | `codabar` | ✅ | ✅ | Optional A/B/C/D start and stop characters. |
| Code 11 | `code11` | ✅ | ✅ | Optional check-digit validation, enabled by default in the writer. |
| MSI Plessey | `msi` | ✅ | ✅ | Optional modulo-10 check digit and scanline reader. |
| Code 32 (Italian Pharmacode) | `code32` | ✅ | ✅ | Eight-digit pharmaceutical body rendered through a validated Code 39 carrier. |
| PZN-7 / PZN-8 | `pzn` | ✅ | ✅ | PZN-7 is the default; `pzn8` selects the eight-digit profile. |
| Telepen (ASCII and Numeric) | `telepen` | ✅ | ✅ | ASCII is the default; Numeric is an explicit pair-compaction mode. |
| Pharmacode | `pharmacode` | ✅ | — | Writer-only by design; unsafe for unrestricted generic autodetection. |

The runtime registry is the source of truth for these flags. `ITF-14` and
Bookland ISBN are meaningful application profiles over their base symbol
grammar, so a shared decoder can return `itf` or `ean13` while preserving the
decoded payload. This is not a data-loss claim; it is the current result-format
contract.

## Writing examples

The format-specific functions are available from the `oned` subpath and the
root facade:

```js
import {
  encodeCode39,
  encodeCode128,
  encodeEAN13,
  encodeTelepen,
  encodeTelepenNumeric,
  encodeIndustrial2of5,
  encodeIATA2of5,
  encodeCode32,
  encodePZN,
  encodePharmacode,
} from '@sythos/js_barcode_universal/oned';

const retail = encodeEAN13('590123412345'); // check digit is appended
const code39 = encodeCode39('A-123', { checkDigit: true });
const code128 = encodeCode128('ABC-123');
const telepen = encodeTelepen('TELEPEN-ASCII');
const telepenNumeric = encodeTelepenNumeric('00112738999X');
const industrial = encodeIndustrial2of5('01234567', { checkDigit: true });
const iata = encodeIATA2of5('31415926');
const code32 = encodeCode32('01234567');
const pzn = encodePZN('123456');
const pharmacode = encodePharmacode(12345);
```

### Code 25 family

`standard2of5` (also `code2of5`) and `industrial2of5` share the canonical
Industrial 2 of 5 frame in this SDK. `iata2of5` uses its shorter IATA guard.
The optional modulo-10 check digit is accepted by every writer and can be
required by `decode(..., { checkDigit: true })` or the strict camera profile.

```js
import { decode, encode, toImageData } from '@sythos/js_barcode_universal';

const matrix = encode('01234567', {
  format: 'industrial2of5',
  checkDigit: true,
});
const [result] = decode(toImageData(matrix, {
  scale: 3,
  margin: 30,
  barHeight: 64,
}), {
  formats: ['industrial2of5'],
  checkDigit: true,
});
console.log(result?.text); // 01234567
```

The scanline reader validates the complete guard/data/stop structure and
rejects clipped or ambiguous candidates. Camera reads also need a coherent
quiet zone and a valid check digit.

### Code 32 and PZN

Code 32 accepts an eight-digit body and validates its pharmaceutical check
digit after converting the payload to the documented six-character base-32
carrier. PZN-7 accepts six body digits by default; PZN-8 accepts seven body
digits when `{ pzn8: true }` is passed. The decoder exposes `pznVariant` so an
application never has to infer the profile from a partial string.

```js
import { decode, encode, toImageData } from '@sythos/js_barcode_universal';

const matrix = encode('1234567', { format: 'pzn8' });
const [result] = decode(toImageData(matrix, { scale: 3, margin: 30, barHeight: 64 }), {
  formats: ['pzn8'],
});
console.log(result?.format, result?.pznVariant, result?.text);
// pzn pzn8 1234567
```

Both readers return no result when the Code 39 carrier or pharmaceutical check
digit is invalid. See the matching [format licence notes](https://github.com/Sythos/JS_Barcode_Universal/tree/main/licenses/)
for the provenance and independent black-box boundary.

### Telepen modes

`encodeTelepen()` emits full seven-bit ASCII by default. It adds even parity to
each character and a modulo-127 check value between the start and stop glyphs.
The writer accepts the same mode through `encode(value, { format: 'telepen',
telepenMode: 'numeric' })`, but `encodeTelepenNumeric()` or
`format: 'telepennumeric'` is clearer when the compact mode is intentional.

Telepen Numeric consumes an even number of characters as pairs of digits. `X`
is legal only in the second position of a pair, for example `12`, `90` and
`9X`. The reader keeps this mode explicit:

```js
import { decode, toImageData } from '@sythos/js_barcode_universal';

const image = toImageData(telepenNumeric, { scale: 3, margin: 30, barHeight: 64 });
const [result] = decode(image, { formats: ['telepennumeric'] });
console.log(result?.format, result?.text); // telepennumeric 00112738999X
```

Unrestricted auto-detection enables Telepen Alpha but does not try the Numeric
decoder. The two modes share start and stop guards, so treating a Numeric glyph
sequence as arbitrary ASCII could produce plausible control characters. An
explicit format keeps that boundary honest.

The generic dispatcher is useful when the format is selected at runtime:

```js
import { encode, toImageData } from '@sythos/js_barcode_universal';

const matrix = encode('1234567890123', { format: 'itf14' });
const image = toImageData(matrix, {
  scale: 4,
  margin: 10,
  barHeight: 96,
});
```

`encodeCode128()` chooses a legal Code 128 representation from the payload.
The writer does not expose a separate public `codeSet: 'A' | 'B' | 'C'`
switch in the current API; callers should pass a valid payload and let the
encoder select the efficient set transitions. `gs1128` is the explicit GS1
dispatcher entry and is not just a label applied after arbitrary Code 128 data.

## Reading images

The root reader accepts an RGBA image object. For a linear format, it samples
multiple horizontal rows, measures run widths, checks the format grammar and
validates checksums where the format defines them:

```js
import { decode } from '@sythos/js_barcode_universal';

const results = decode(imageDataLike, {
  formats: ['ean13', 'code128', 'code39'],
  profile: 'camera',
  tryHarder: true,
});

if (results[0]) {
  console.log(results[0].format, results[0].text);
}
```

The camera profile is deliberately stricter than a quick scanline probe. It
expects a coherent, quiet-zone-qualified read and never turns a partial run or
an uncertain character into application data. An empty array is the expected
answer for a blank, noisy or structurally inconsistent frame.

For Telepen, a complete symbol also means valid parity, a modulo-127 check value,
all start/stop runs and a non-ambiguous run-width match. The reader returns an
empty result for a clipped symbol, a close optical tie or a failed check value.

The current camera rotation policy tries the fixed eight in-plane angles in
45-degree steps where the format detector path supports them. It does not
claim arbitrary projective distortion, curved labels, multiple overlapping
symbols or severe glare. The generic reader also remains useful for a clean
module-aligned image and for an application that already extracted a suitable
scanline.

## Pharmacode is deliberately write-only

Pharmacode is present in `listFormats()` so an application can generate a
symbol, but it reports `canRead: false`. The one-track narrow/wide grammar has
no strong finder frame for unrestricted image autodetection. Guessing a value
from an arbitrary row would create false positives, so the generic image path
returns no Pharmacode result instead.

Use the writer only when the application already owns the input value and has a
separate, trusted reading strategy:

```js
import { encodePharmacode } from '@sythos/js_barcode_universal/oned';
import { toSVG } from '@sythos/js_barcode_universal';

const matrix = encodePharmacode(12345); // legal range: 3..131070
const svg = toSVG(matrix, { scale: 4, margin: 10, barHeight: 80 });
```

This document does not suggest that a downstream OCR or scanner result should
be fed back into the generic decoder without its own validation boundary.

## Licensing and naming

The runtime code is MIT-licensed original Sythos work. The format names are
descriptive; they are not a certification or endorsement. The engineering
inventory and review labels live in [`LICENSE`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/LICENSE),
[`NOTICE.md`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/NOTICE.md), and the matching files in
[`licenses/`](https://github.com/Sythos/JS_Barcode_Universal/tree/main/licenses/).
The Telepen-specific engineering inventory is [`telepen.license`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/licenses/telepen.license).
