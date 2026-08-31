# Codablock-F

Codablock-F is the stacked Code 128 family member in Sythos Barcode
Universal. It keeps the familiar Code 128 A/B/C data alphabet while arranging
the stream into a compact, row-checked symbol. That makes it a useful fit when
a single long linear row would be awkward, but a full PDF417 symbol would be
more machinery than the job needs.

## What this implementation does

The current implementation deliberately stays conservative and explicit:

- it writes and reads 2–44 rows;
- each row carries 4–62 data symbols;
- rows contain a Code 128 start, the Code B selector, a row indicator, data,
  a modulo-103 row check and a Code 128 stop;
- two modulo-86 overall check values are kept in the final row;
- ASCII payloads use the shared Code 128 A/B/C tokeniser, so numeric runs can
  still use Code C when that saves space;
- the image detector accepts clean integer module scaling and requires every
  expected row, row check and overall check before returning a result.

This is a real stacked symbol, not a collection of independent Code 128 bars.
The rows must be decoded together; a missing row or a changed module produces
an empty result rather than a partial payload.

## Create a symbol

```js
import { encodeCodablockF } from '@sythos/js_barcode_universal/codablockf';
import { toImageData } from '@sythos/js_barcode_universal';

const matrix = encodeCodablockF('ORDER 12345 / SYTHOS', {
  rows: 3,
  columns: 12,
  rowHeight: 4,
});

const image = toImageData(matrix, { scale: 3, margin: 10 });
```

`rows` and `columns` are optional. When omitted, the writer chooses a compact
pair that fits the Code 128 data stream. `rowHeight` defaults to 3 modules and
`separatorHeight` to 1 module. The returned `BitMatrix` has quiet separator
rows but no pixel or DOM dependency.

## Read a symbol

```js
import {
  decodeCodablockF,
  detectAndDecodeCodablockF,
} from '@sythos/js_barcode_universal/codablockf';

const direct = decodeCodablockF(matrix);
console.log(direct.text, direct.rows, direct.columns);

const located = detectAndDecodeCodablockF(binaryImage);
if (located) console.log(located.text);
```

The root image API is also format-aware:

```js
const [hit] = decode(image, { formats: ['codablockf'] });
```

The detector is intentionally limited to one clean, prominent symbol with
integer module scale. It does not claim arbitrary perspective, curved media,
severe occlusion or multi-symbol scene handling. Camera callers should keep
the existing `profile: 'camera'` validation and accept only a complete result.

## Payload and validation boundaries

The writer accepts non-empty ASCII text. Code 128 control and switch values
are generated internally; the public result is the decoded text. Every row is
checked before the two overall checks are evaluated, and the payload is
returned only after all rows are present and Code 128 interpretation succeeds.

Codablock-F is a format name, not a certification claim. See the project
licence inventory and [`NOTICE.md`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/NOTICE.md)
for provenance and the black-box validation boundary.
