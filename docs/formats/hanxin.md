# Han Xin Code

Han Xin Code is a two-dimensional symbol designed for dense data in a square
grid. This SDK adds a small, strict profile for the compact, alignment-free
part of the format: versions 1, 2 and 3. It can write a module matrix, read a
complete matrix back, and locate one clean, integer-scaled symbol in a binary
image.

The implementation is intentionally honest about its boundary. It is useful
for compact payloads and for applications that already have a binarized image;
it is not a claim to implement every Han Xin version, every character set or
arbitrary camera geometry.

## Supported profile

The current profile includes:

- versions 1, 2 and 3, with dimensions 23×23, 25×25 and 27×27 modules;
- error-correction levels `L1`, `L2`, `L3` and `L4`;
- numeric mode for digit-only strings;
- text mode for the published ASCII text submodes;
- byte mode for `Uint8Array`, byte arrays and strings that do not fit text
  mode;
- the four standard data masks and the compact-version structural information;
- Reed–Solomon error correction over Han Xin's GF(256) field;
- decoding of the four right-angle orientations and either module polarity;
- strict detection of one complete, axis-aligned symbol at an integer module
  scale.

Versions 1–3 have 25, 37 and 50 total codewords respectively. Their data
capacity depends on the selected error-correction level. The encoder chooses
the smallest version that fits unless `version` is supplied explicitly.

The following parts are deliberately outside this milestone:

- versions 4–84 and their alignment patterns;
- Chinese/GB18030 text compaction, ECI and other extended character-set modes;
- perspective correction, sub-module scaling, curved media and automatic
  multi-symbol scene separation.

When one of those features is needed, pass a sampled canonical matrix to a
compatible implementation or wait for a later, separately reviewed extension.
The decoder returns nothing for an incomplete or ambiguous symbol.

## Write and read a matrix

The format-specific API is available from the Han Xin subpath:

```js
import {
  encodeHanXin,
  decodeHanXin,
  detectAndDecodeHanXin,
} from '@sythos/js_barcode_universal/hanxin';

const matrix = encodeHanXin('HAN XIN 2026', {
  mode: 'text',
  ecc: 'L2',
});

const decoded = decodeHanXin(matrix);
console.log(decoded.text, decoded.version, decoded.ecc);

// Detection expects a binary BitMatrix. A renderer can add a quiet border
// and an integer nearest-neighbour scale before the image reaches the reader.
const located = detectAndDecodeHanXin(matrix.withMargin(4).scale(3));
console.log(located?.text, located?.moduleSize);
```

For arbitrary octets, use byte mode explicitly. The returned `bytes` field is
the lossless result even when the bytes are not valid UTF-8:

```js
import {
  encodeHanXinBytes,
  decodeHanXin,
} from '@sythos/js_barcode_universal/hanxin';

const payload = Uint8Array.from([0x00, 0x7f, 0x80, 0xfe, 0xff]);
const symbol = encodeHanXinBytes(payload, {
  version: 2,
  ecc: 'L3',
  mask: 2,
});
const result = decodeHanXin(symbol);

console.log([...result.bytes]);
```

The TypeScript declarations mirror the generated JavaScript modules. The
public types describe the accepted version, error-correction, mode, rotation
and polarity values, so a caller can keep option validation in the compiler as
well as at runtime.

## Modes

### Numeric

Digit-only strings use the compact numeric grammar. Groups of three digits are
packed into ten bits and the final group length is carried by its terminator.
Leading zeroes are preserved:

```js
const account = encodeHanXin('0012045', { mode: 'numeric' });
console.log(decodeHanXin(account).text); // 0012045
```

### Text

Text mode packs the supported ASCII letters, digits, controls and punctuation
using the two published six-bit text submodes. The encoder inserts an explicit
submode switch when needed and rejects characters that are not representable
in this profile. Use byte mode for Unicode or application-defined encodings.

### Byte

Byte mode carries one to 8191 octets and is the safe escape hatch for payloads
that are not text-mode compatible. A string in byte mode is encoded as UTF-8;
an explicit `Uint8Array` or numeric byte array is never silently converted or
truncated. Empty payloads and values outside `0..255` are rejected before a
symbol is allocated.

## Error correction and masks

Each compact version uses one Reed–Solomon block. `L1` leaves the most room for
data, while `L4` reserves the most room for recovery. The decoder validates the
structural information, reverses the format's 13-column picket-fence ordering,
checks the remainder modules, verifies Reed–Solomon parity and only then parses
the payload.

`mask` accepts a zero-based value from `0` through `3`. If it is omitted, the
encoder scores the four candidates with a small deterministic run penalty and
selects the lowest score. Mask selection affects appearance, never the decoded
payload.

## Detection and camera boundary

`detectHanXin()` and `detectAndDecodeHanXin()` accept a `BitMatrix` containing a
single prominent symbol. Detection finds the dark bounding square, checks that
its width is an exact multiple of 23, 25 or 27, samples module centres and
passes the candidate through the strict matrix decoder. It therefore accepts a
clean integer scale such as `matrix.scale(3)`, with or without a light margin.

The detector does not invent a result from a partial frame. It rejects a
non-square crop, a non-integer module scale, fixed-pattern damage, bad
function information, non-zero remainder modules, failed parity or an
unparseable payload. Perspective and severe camera distortion should be
handled by an application-level quadrilateral sampler before calling
`decodeHanXin()`.

## Provenance and implementation notes

The implementation is original Sythos TypeScript under `src/ts/hanxin/`, with
generated JavaScript runtime modules under `src/js/hanxin/` and declarations
beside the TypeScript sources. Public descriptions of Han Xin's compact
geometry, modes, masks and error correction were used as engineering input.
No third-party source code, lookup table or runtime dependency is copied or
shipped. See [`licenses/hanxin.license`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/licenses/hanxin.license)
for the scoped provenance and legal-review notes.

“Han Xin Code” is used descriptively. This project does not claim certification
by a standards body, a rights holder or an independent decoder.
