# DotCode

DotCode is a compact two-dimensional symbology made from isolated dots on an
alternating grid. It is a good fit when a symbol has to stay readable on fast
production lines, direct-part marking or other surfaces where a solid block of
ink is not especially welcome. There is no big finder square to lock on to:
the matrix geometry, its six reserved corner positions and the Reed-Solomon
check all do the heavy lifting.

This SDK includes an original, dependency-free DotCode writer, strict matrix
reader and clean-raster detector. TypeScript is the authoritative source;
generated JavaScript and declarations are shipped beside it.

## Supported profile

The implementation currently covers:

- the 113 legal five-of-nine dot patterns;
- the alternating-grid layout, six reserved corner positions and the four
  DotCode masks;
- prime-field Reed-Solomon error correction over GF(113);
- Code Set A, B and C for the ordinary printable/control subset;
- the binary latch path, including base-259 to base-103 packing for byte
  payloads;
- ordinary text, UTF-8 strings, byte arrays and optional GS1/FNC1 handling;
- strict matrix decoding with structural, pattern, padding and checksum
  validation;
- clean integer-scale detection at the four quarter-turn orientations and
  either polarity.

The writer accepts logical dimensions from 5 through 200 modules. Width plus
height must be odd, as required by the alternating layout. If dimensions are
not supplied, the writer chooses a legal compact matrix; pass `width` and
`height` when a particular label shape matters more than compactness.

## Write a symbol

```js
import { encodeDotCode } from '@sythos/js_barcode_universal/dotcode';

const matrix = encodeDotCode('DOTCODE / SYTHOS 123', {
  width: 29,
  height: 30,
  mask: 1,
});

console.log(matrix.width, matrix.height, matrix.dotcode?.mask);
```

Strings use UTF-8 by default. `Uint8Array` and number arrays are treated as
binary input and preserve every byte from 0 through 255:

```js
const binary = encodeDotCode(Uint8Array.from([0, 1, 127, 128, 255]));
```

Useful options are:

| Option | Meaning |
| --- | --- |
| `width`, `height` | Exact logical dimensions; provide both together. |
| `columns`, `rows` | Readable aliases for the exact dimensions. |
| `mask` | Explicit mask `0` through `3`; leaving it out selects a deterministic mask. |
| `gs1` | Enables GS1/FNC1 semantics. ASCII 29 is encoded as FNC1. |
| `encoding` | `utf8`, `latin1` or `binary`; byte arrays stay byte-exact. |
| `aspectRatio` | Target ratio used only when dimensions are automatic. |

For conformance fixtures or a known external codeword stream, the format
module also exposes `encodeDotCodeCodewords(codewords, options)`. It accepts
unmasked data codewords from 0 through 112, then applies the DotCode mask,
interleaved error correction and matrix folding exactly like the normal
writer. It is intentionally a low-level API: validate the source stream
before using it with production data.

## Read a matrix

```js
import { decodeDotCode } from '@sythos/js_barcode_universal/dotcode';

const result = decodeDotCode(matrix, {
  rotation: 'auto',
  inverted: 'auto',
});

console.log(result.text, result.bytes, result.corrections);
```

`decodeDotCode` is all-or-nothing. It rejects an inactive checkerboard dot,
an unassigned five-of-nine pattern, invalid padding, an impossible dimension,
an unsupported control sequence or a failed Reed-Solomon check. A caller gets
no partial text from a damaged or ambiguous matrix. The result includes the
decoded bytes, logical dimensions, selected mask, corrected codeword count,
GS1 flag, detected orientation and polarity.

`rotation` can be `0`, `90`, `180`, `270` or `auto`. `inverted` can be a
boolean or `auto`. The default tries all four right-angle orientations and
both polarities. This is orientation handling, not perspective correction.

## Locate a clean raster

DotCode has no finder pattern, so a detector must be conservative. The clean
raster detector searches integer module scales, proposes only bounded
geometry hypotheses and returns a candidate only after the strict decoder
accepts it:

```js
import { detectAndDecodeDotCode } from '@sythos/js_barcode_universal/dotcode';

const hits = detectAndDecodeDotCode(binaryImage, {
  moduleSize: 2,
  inverted: 'auto',
});

for (const hit of hits) {
  console.log(hit.text, hit.moduleSize, hit.corners);
}
```

`detectDotCode` throws for an invalid raster/options object; the convenience
`detectAndDecodeDotCode` converts that condition into an empty result. The
detector accepts a clean, axis-aligned binary image at an integer scale, a
small quiet-zone margin and the four quarter-turns. It deliberately does not
claim arbitrary camera perspective, curved media, severe blur, sub-pixel
scaling or reliable multi-symbol scene separation. Camera integrations should
crop and rectify a complete candidate first, then accept only a strict
decoded result.

The detector also applies the SDK's 16,777,216-pixel raster safety ceiling and
limits a searched module scale to a bounded range. These guards keep hostile
or accidental image dimensions from turning a scan into an unbounded memory
allocation.

## Deliberate boundaries

The reader supports the ordinary A/B/C controls and binary latch needed by the
implemented writer and common interoperability fixtures. Structured append,
ECI, macro/AI 17 and FNC2/FNC3 sequences are rejected explicitly because
silently inventing a payload for an unsupported control would be worse than a
clean failure. Add support only with a format fixture, round-trip tests and a
matching update to this guide.

This module has no runtime dependency on ZXing, Zint, BWIPP or any other
barcode package. It does not copy source code or generated lookup tables from
them. Independent implementations may be used as black-box interoperability
checks only.

## References and provenance

The implementation was derived from public DotCode format descriptions and
independently checked against the following public material:

- [AIM standards and technical symbology resources](https://www.aimglobal.org/standards/)
  for the standards context;
- [DotCode overview](https://en.wikipedia.org/wiki/DotCode) for the public
  layout and control-set overview;
- [GS1 General Specifications](https://ref.gs1.org/standards/genspecs/) for
  the meaning of GS1/FNC1 use;
- [Zint's DotCode backend](https://github.com/zint/zint/blob/master/backend/dotcode.c)
  as an independent interoperability reference only.

None of those projects is a runtime dependency, and no third-party source is
included in this SDK. See
[`licenses/dotcode.license`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/licenses/dotcode.license)
for the format-specific licensing and review boundary.
