# PostBar (Canada Post CPC four-state)

PostBar is Canada Post Corporation's (CPC) name for its four-state,
height-coded bar code family. Unlike the rest of this SDK's postal family
(POSTNET, PLANET, RM4SCC, KIX, Australia Post, Japan Post, IMb), a PostBar
symbol's payload is protected by a real Reed-Solomon code, not a simple
check character.

Canada Post's own engineering specification for PostBar is not published —
it is available only on request from Canada Post. This SDK does not hold
or rely on that document. Instead, it implements PostBar from the complete
technical disclosure in
[US Patent 5,602,382A](https://patents.google.com/patent/US5602382A/en)
("Multiple Bar Code Processing," Canada Post Corporation, filed 1994,
expired around 2014), verified directly against the patent's own fully
worked examples — see
[`licenses/postbar.license`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/licenses/postbar.license)
for the full provenance record, including why an earlier automated read of
the same patent produced unreliable results and how that was resolved.

## Supported profiles

| Format | Runtime id | Application | Total bars | Reed-Solomon |
| --- | --- | --- | :---: | :---: |
| PostBar.C10 | `postbarc10` | Canada Post internal machines | 56 | (16,6) over GF(64) |
| PostBar.D22 | `postbard22` | Customer-applied, domestic (Canada) | 79 | (25,21) over GF(64) |
| PostBar.G12 | `postbarg12` | International / global | 49 | (15,11) over GF(64) |

The patent also names PostBar.D07, D12, G22, S06, S11 and S21, but this SDK
implements only the three profiles above — the ones whose full field
layouts and (for C10 and D22) worked numerical examples were directly
verified against the patent. Extending to another named profile would need
the same treatment, not an assumption that the pattern generalizes.

All three are reported as `canWrite: true` and `canRead: true` by
`listFormats()` and are part of the counted format registry — unlike
KarTrak ACI, PostBar renders as an ordinary monochrome `BitMatrix`
(height-coded bars, the same visual language as the rest of the postal
family), so it fits the standard `encode()`/`decode()` contract directly.

## Writing

```js
import { encodePostBarC10, encodePostBarD22, encodePostBarG12 } from '@sythos/js_barcode_universal/oned';

// PostBar.C10: a 6-character ANANAN postal code and a 4-digit quaternary
// (0-3) machine ID. This is the patent's own worked example.
const c10 = encodePostBarC10({ postalCode: 'K1S5B6', machineId: '2010' });

// PostBar.D22: postal code, a 4-character address locator and an
// 11-character customer information field (both from the alphanumeric
// alphabet: space, A-Z, 0-9).
const d22 = encodePostBarD22({
  postalCode: 'L3B4T9',
  addressLocator: '1420',
  customerInfo: 'CFFMIPLXF6V',
});

// PostBar.G12: a 3-digit country code and an 8-character postal code (no
// letter/digit grammar for this profile -- pad with spaces as needed).
const g12 = encodePostBarG12({ countryCode: '180', postalCode: '91266   ' });
```

The root dispatcher accepts the same profile ids and field objects as `value`:

```js
import { encode, toImageData } from '@sythos/js_barcode_universal';

const matrix = encode({ postalCode: 'K1S5B6', machineId: '2010' }, { format: 'postbarc10' });
const image = toImageData(matrix, { scale: 4, margin: 24, barHeight: 60 });
```

A postal code may include the conventional space (`K1S 5B6`); it is
stripped before validation. `addressLocator` and `customerInfo` accept any
combination of space, A-Z and 0-9 (Table 2 of the patent); the postal-code
positions in C10/D22 strictly alternate letter/digit (A-N-A-N-A-N).

## Reading images

```js
import { decode, toImageData } from '@sythos/js_barcode_universal';

const image = toImageData(encodePostBarC10({ postalCode: 'K1S5B6', machineId: '2010' }), {
  scale: 4, margin: 24, barHeight: 60,
});

const [result] = decode(image, { formats: ['postbarc10'] });
console.log(result?.postalCode, result?.machineId, result?.corrections);
// K1S5B6 2010 0
```

Every result includes `corrections`: the number of Reed-Solomon symbol
errors actually corrected (0 for a clean read). Damage within the format's
correction capacity (`2t+e <= 2*checkSymbols`, see the patent) is repaired
silently; damage beyond it returns no result rather than plausible-looking
wrong data — this SDK's Reed-Solomon decoder verifies every correction
against the syndromes before accepting it.

For camera capture, opt into the stricter profile:

```js
const hits = decode(cameraFrame, { formats: ['postbarc10'], profile: 'camera' });
```

The camera profile requires a measurable quiet zone on both sides of the
bars, the same requirement as the rest of the postal family. PostBar
decoding does not promise arbitrary projective distortion, curved media,
severe glare or multiple overlapping symbols.

## Verification and licensing boundary

The 'A'/'N'/'Z' symbol tables and field layouts are original Sythos data,
transcribed directly from the patent's rendered page images (not any
automated OCR/text extraction, which was found to garble them) and
independently verified by reproducing the patent's own fully worked
PostBar.C10 example — DCI=Z, postal code K1S 5B6, machine ID DHAH — exactly,
symbol for symbol, plus PostBar.D22's own worked example. Reed-Solomon
arithmetic reuses this SDK's existing, already-shipped
`GaloisField`/Reed-Solomon primitives (the same `GF(64)` constant used
elsewhere in this SDK), not a second implementation. No source code, table
or image asset from any other barcode implementation is copied or shipped;
none is known to publicly implement PostBar (BWIPP, Zint and ZXing were
checked). See
[`licenses/postbar.license`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/licenses/postbar.license)
and [`NOTICE.md`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/NOTICE.md).
This implementation is not certified, endorsed or reviewed by Canada Post.
