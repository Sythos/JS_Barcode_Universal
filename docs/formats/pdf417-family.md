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

## Byte payloads and interoperation

For binary data, use the format-specific byte/ECI options and preserve the
returned bytes or segments when the application needs byte-for-byte fidelity.
Do not assume that a decoded JavaScript string is a lossless representation of
every external byte sequence. The project records exactly which independent
black-box vectors have passed in [`NOTICE.md`](../../NOTICE.md) and the release
notes; round-trip tests alone are not proof of interoperability.

ZXing, bwip-js and other independent implementations were used only as
black-box verification tools where recorded. No third-party source code or
tables are runtime dependencies or distributed assets. The engineering and
legal review inventory is in [`LICENSE`](../../LICENSE),
[`NOTICE.md`](../../NOTICE.md), [`licenses/pdf417.license`](../../licenses/pdf417.license),
[`licenses/compact-pdf417.license`](../../licenses/compact-pdf417.license), and
[`licenses/micropdf417.license`](../../licenses/micropdf417.license).
