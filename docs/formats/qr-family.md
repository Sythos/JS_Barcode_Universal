# QR family

The QR family in this SDK contains three separate runtime formats:

| Label | `id` | Write | Read | Geometry |
| --- | --- | :---: | :---: | --- |
| QR Code | `qr` | ✅ | ✅ | Square QR Model 2, versions 1–40. |
| Micro QR Code | `microqr` | ✅ | ✅ | Compact M1–M4 family. |
| rMQR Code | `rmqr` | ✅ | ✅ | 32 standard rectangular geometries. |

They share broad ideas such as masking and Reed–Solomon error correction, but
their function patterns, format information, capacity tables and detectors are
different. Do not treat one ID as a spelling variant of another.

## QR Code Model 2

The `qr` module implements the ordinary square QR Model 2 family, versions
1–40 and error-correction levels `L`, `M`, `Q` and `H`. When no version is
forced, the encoder selects the smallest version that fits the payload and the
requested options. It can use Numeric, Alphanumeric, Byte and Kanji modes when
the input and runtime provide the required character support. Byte handling can
use automatic charset selection, UTF-8 or ISO-8859-1.

```js
import {
  decodeQR,
  encodeQR,
} from '@sythos/js_barcode_universal/qr';

const matrix = encodeQR('https://www.sythos.net/', {
  ecc: 'H',
  charset: 'utf-8',
});

const decoded = decodeQR(matrix);
console.log(decoded.text);
```

The public encoder options are `ecc`, `version`, `mask`, `charset` and
`kanji`. `mask` is normally selected by the penalty score; forcing it is useful
for fixtures and interoperability work, not usually for application code.
The root `encode()` and `decode()` functions select this family with
`format: 'qr'` or `formats: ['qr']`.

The QR reader validates format and version information, unmasks the data,
corrects Reed–Solomon blocks and rejects ambiguous or structurally invalid
symbols. The image detector can estimate a quadrilateral and sample a symbol
from a clean or mildly degraded image. The camera profile retries the fixed
eight in-plane orientations at 45-degree steps. That is not a guarantee for
arbitrary perspective, curved media, severe occlusion or a multi-symbol scene.

QR Model 1 is not silently treated as Model 2. It is deliberately absent from
the registry because the current evidence set does not contain the complete
placement figures and fixtures required for a trustworthy writer and reader.
See [Excluded formats](excluded-formats.md).

## Micro QR Code

Micro QR uses a different symbol geometry and a much smaller capacity range.
The implementation covers the M1–M4 family and the supported Numeric,
Alphanumeric, Byte and Kanji payload paths. The public option set includes a
version (`'M1' | 'M2' | 'M3' | 'M4'`), its legal error-correction level and a
mask where applicable.

```js
import {
  decodeMicroQR,
  encodeMicroQR,
} from '@sythos/js_barcode_universal/microqr';

const matrix = encodeMicroQR('12345', {
  version: 'M2',
  ecc: 'L',
});

console.log(decodeMicroQR(matrix).text);
```

M1 supports numeric payloads but provides error detection only: it has no
correctable payload error-correction level in the same sense as M2–M4. ECI,
FNC1/GS1 and Structured Append are intentionally outside this API. A normal QR
Model 2 symbol must not be relabelled as Micro QR merely because it is small.

The detector accepts clean scaled rasters, inverted polarity and mild
projective sampling, with the fixed 45-degree camera orientation retries. It
does not claim arbitrary perspective, curved-media or multi-symbol robustness.

## rMQR Code

`rmqr` covers the 32 standard rectangular geometries in the checked-in table.
It supports M/H error correction and Numeric, Alphanumeric, Byte and Kanji
payloads, plus the implemented ECI path for byte payloads.

```js
import {
  decodeRMQR,
  encodeRMQR,
} from '@sythos/js_barcode_universal/rmqr';

const matrix = encodeRMQR('rMQR SAMPLE', {
  ecc: 'M',
});

console.log(decodeRMQR(matrix).text);
```

The encoder can be constrained by the available geometry/version options when
an installation has a fixed rectangular area. The detector expects a quiet
zone and enough scale to resolve modules, and supports the fixed camera
orientation retry policy. Arbitrary photographic perspective and multi-symbol
scenes remain outside the documented guarantee.

## What the three formats do not share

| Question | QR Model 2 | Micro QR | rMQR |
| --- | --- | --- | --- |
| Symbol shape | Square | Small square | Rectangular |
| Registry ID | `qr` | `microqr` | `rmqr` |
| ECC levels | `L`, `M`, `Q`, `H` | M1 uses error detection only; M2–M4 use their legal levels | `M`, `H` |
| Version/geometry | 1–40 | M1–M4 | 32 fixed geometries |
| ECI/feature scope | Charset/byte path as exposed by QR encoder | ECI, FNC1/GS1 and Structured Append out of scope | ECI byte path implemented; check options for exact payload constraints |
| Native DENSO SQRC | Not included | Not included | Not included |

The table is a product boundary, not a claim that every QR-compatible scanner
will accept every variant. An application that needs a vendor-specific feature
must use the vendor’s licensed implementation or a separately validated
adapter.

## Independent checks and legal boundary

ZXing and other independent implementations may be used as black-box
verification tools, as recorded in [`NOTICE.md`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/NOTICE.md). No external
barcode source code or tables are shipped as runtime dependencies. Standard,
patent and trademark questions remain subject to the review labels in
[`LICENSE`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/LICENSE) and the individual files under
[`licenses/`](https://github.com/Sythos/JS_Barcode_Universal/tree/main/licenses/).
