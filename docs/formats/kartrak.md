# KarTrak ACI (experimental)

KarTrak ACI (Automatic Car Identification) was a 1967-1977 AAR-mandated
railcar barcode: instead of bar width, it encodes data as which of four
*colours* — blue, checkerboard/white, red, black — appears in each of
thirteen stacked stripe pairs on a plate. It is genuinely different from
every other format in this SDK, and it is documented, wired and tested
differently as a result.

**This format is not reachable through `encode()`, `decode()`,
`listFormats()` or the `formats:` allow-list.** Every other symbology in
this SDK is monochrome, backed by `BitMatrix`; KarTrak needs a colour
grid (`PolychromeMatrix`) and classifies raw RGBA pixels against a
four-colour palette instead of binarizing them. Wiring a fundamentally
different data type into the generic dispatcher would break the "always a
`BitMatrix`" contract every other format relies on, so KarTrak ships as
its own dedicated subpath instead. See
[`docs/COLOR_PIPELINE_NOTES.md`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/docs/COLOR_PIPELINE_NOTES.md)
for the underlying colour infrastructure this format is built on.

## What is implemented, and what is not

| Capability | Status |
| --- | --- |
| Encoding a valid plate from 10 data digits | ✅ Full, with an automatically computed mod-11 check digit |
| Decoding an already-classified colour grid | ✅ Full, with structural and checksum validation |
| Locating one axis-aligned plate in a raw image | ✅ Bounding-box search against a roughly uniform background |
| Rotation or perspective correction | ❌ Not implemented — the same "clean single-symbol" boundary already documented for MaxiCode, not a promise of arbitrary photographic robustness |
| Validation against a real printed sample photographed by a real camera | ❌ Not done — every result below comes from synthetic raster images |

## Writing

```js
import { encodeKarTrak } from '@sythos/js_barcode_universal/kartrak';

// 1 equipment-type digit + 3-digit ownership code + 6-digit car number.
// The check digit is computed automatically, not supplied.
const matrix = encodeKarTrak('8350199918');

console.log(matrix.kartrak);
// {
//   profile: 'sythos-kartrak-aci', text: '8350199918',
//   equipmentCode: '8', ownershipCode: '350', carNumber: '199918',
//   checkDigit: 5,
// }
```

`matrix` is a `PolychromeMatrix`, not a `BitMatrix`: a 4-column by 26-row
colour grid (13 label lines, two stripes each). Render it with the colour
renderer, not `toImageData`:

```js
import { toColorImageData } from '@sythos/js_barcode_universal/kartrak';

const image = toColorImageData(matrix, { scale: 10, margin: 10 });
// { data: Uint8ClampedArray, width, height } — draw to a canvas as usual.
```

(`toColorImageData` and `PolychromeMatrix` are re-exported from this
subpath so nothing else needs to reach into the still-experimental,
unwired `color/` primitives directly.)

The worked example above reproduces the photograph shown on Wikipedia's
"KarTrak" article, captioned *"Start 8350199918 Stop 5"* — this SDK's
independently-implemented checksum and colour table agree with it exactly.

## Reading

```js
import { decodeKarTrak, decodeKarTrakMatrix, detectKarTrak } from '@sythos/js_barcode_universal/kartrak';

// Decode a PolychromeMatrix you already have (e.g. your own round trip).
const fromMatrix = decodeKarTrakMatrix(matrix);

// Decode a raw RGBA image — internally calls detectKarTrak.
const fromImage = decodeKarTrak(image);

// Or call the detector directly to get `null` instead of a thrown error.
const found = detectKarTrak(image);
```

A decoded result is:

```js
{
  format: 'kartrak',
  profile: 'sythos-kartrak-aci',
  text: '8350199918',
  equipmentCode: '8',
  ownershipCode: '350',
  carNumber: '199918',
  checkDigit: 5,
  bounds: { x, y, width, height }, // only from detectKarTrak/decodeKarTrak(image)
}
```

`detectKarTrak` finds the plate's bounding box by nearest-colour
classification against a 5-entry palette (background plus the four label
colours) — the same relative, tint-robust technique `classifyGrid` uses
for modules, not a fixed-distance threshold, so a uniform lighting shift
does not by itself break detection. A row or column only counts toward
the box once it contains a contiguous run of foreground pixels, so
isolated background noise cannot expand it. What it does **not** do is
search for rotation, skew or perspective, or handle more than one plate
per image.

`decodeKarTrakMatrix` validates the START/STOP marker glyphs (each a
three-zone composite, not a simple two-stripe digit — see
`licenses/kartrak-aci.license` for how their geometry was verified),
requires every data line to be a uniform colour pair, and rejects a
mismatched check digit.

## Colour and geometry tolerance

Synthetic testing (`test/kartrak.test.js`) found:

- **Colour/lighting robustness is strong.** A uniform tint up to roughly
  ±50 on the grey axis, or independent per-channel noise up to at least
  ±50, does not break detection or decoding.
- **Geometric precision is the real constraint**, consistent with
  `docs/COLOR_PIPELINE_NOTES.md`'s findings for the underlying
  infrastructure: `detectKarTrak` only handles an axis-aligned plate. A
  rotated or perspective-skewed photograph is out of scope for this pass.

## Provenance

The colour table, 13-line label structure and mod-11 checksum were
verified against the raw wikitext of Wikipedia's "KarTrak" article and an
independent technical guide (nakina.net), which agree exactly, and the
digit and START/STOP glyph geometry was additionally cross-checked
pixel-for-pixel against that article's own reference SVG diagrams — not
read off a rendered/summarized page, after an earlier automated fetch of
the same article was found to have transposed the table's rows and
columns. Full detail, including the patent and trademark position, is in
[`licenses/kartrak-aci.license`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/licenses/kartrak-aci.license)
and [`NOTICE.md`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/NOTICE.md).
No source code, table or image asset from any other barcode implementation
is copied or shipped.
