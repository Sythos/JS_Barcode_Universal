# Code 16K

Code 16K is a compact stacked symbol built from Code 128 data characters. It
is useful when one linear row would be too long but a full PDF417 symbol would
be unnecessary. This SDK provides a deliberately strict, self-contained
writer, matrix decoder and clean-raster detector.

## Supported profile

The implementation supports:

- 2–16 rows, with five Code 128 symbol characters per row;
- 70 modules in every bare row, with configurable integer row and separator
  heights;
- Code 128 data sets A, B and C through `mode: 'A'`, `mode: 'B'` or
  `mode: 'C'` (numeric modes `0`, `1` and `2` are also accepted);
- GS1 variants through `gs1: true`, using the Code 16K B or C GS1 mode;
- the two Code 16K modulo-107 check characters and row-specific start and stop
  patterns;
- clean integer module scales and the four orthogonal orientations in the
  detector.

Modes 5 and 6, which require a dedicated shift encoder, are rejected rather
than being guessed. Payloads are seven-bit ASCII (or equivalent byte values
from 0 through 127), and an empty or oversized payload is rejected before a
large matrix is allocated.

## Write and decode a matrix

```js
import {
  encodeCode16K,
  decodeCode16K,
  detectAndDecodeCode16K,
} from '@sythos/js_barcode_universal/code16k';

const matrix = encodeCode16K('INVENTORY 123456', {
  mode: 'B',
  rows: 3,
  rowHeight: 6,
  separatorHeight: 2,
});

const direct = decodeCode16K(matrix);
console.log(direct.text, direct.rows, direct.columns, direct.checksum);

const located = detectAndDecodeCode16K(matrix);
console.log(located?.text, located?.moduleSize);
```

The top-level image API uses the same validated path:

```js
import { decode, encode, toImageData } from '@sythos/js_barcode_universal';

const symbol = encode('PUBLIC 16K', { format: 'code16k' });
const image = toImageData(symbol, { scale: 2, margin: 10 });
const [hit] = decode(image, { formats: ['code16k'], binarizer: 'global' });
```

The aliases `code16k` and `code-16k` resolve to the same top-level writer.
The subpath export keeps the complete Code 16K table and metadata types
available to TypeScript callers.

## Validation and camera boundaries

Decoding is all-or-nothing. The reader checks row order, row framing, every
Code 128 symbol, the two global check characters and the declared geometry;
missing or damaged rows return no result. The detector accepts one prominent,
clean symbol at an integer scale and handles the four right-angle rotations.
It does not claim arbitrary perspective correction, severe blur, curved media
or multi-symbol scene separation. For camera input, keep the existing
`profile: 'camera'` contract and accept only a complete result.

The public root registry reports Code 16K as both writable and readable. The
format-specific implementation is original Sythos TypeScript with generated
JavaScript runtime files. Independent implementations may be used for
black-box validation only; no third-party source, table or runtime dependency
is copied or shipped. See [`licenses/code16k.license`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/licenses/code16k.license)
and the [project provenance notice](https://github.com/Sythos/JS_Barcode_Universal/blob/main/NOTICE.md).
