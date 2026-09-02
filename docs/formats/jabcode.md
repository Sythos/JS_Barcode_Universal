# JAB Code (experimental)

JAB Code (Just Another Barcode, ISO/IEC 23634:2022) is a full-colour 2D
matrix barcode developed by Fraunhofer SIT: instead of black-and-white
modules, each module carries one of several colours, so a symbol packs
several bits per module rather than one. Like KarTrak, it needs a colour
grid, not a `BitMatrix`, so it is documented, wired and tested separately.

**This format is not reachable through `encode()`, `decode()`,
`listFormats()` or the `formats:` allow-list**, for the same reason as
KarTrak: it produces/consumes a `PolychromeMatrix`, not a `BitMatrix`. See
[`docs/COLOR_PIPELINE_NOTES.md`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/docs/COLOR_PIPELINE_NOTES.md)
for the shared colour infrastructure, and
[`docs/JABCODE_NOTES.md`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/docs/JABCODE_NOTES.md)
for this format's own verification notes and honest limits — read that
file before relying on this module for anything beyond its own round trip.

## What is implemented, and what is not

This module implements one real, deliberately scoped configuration of the
format — the reference encoder's own "default mode" fast path — not the
full ISO specification.

| Capability | Status |
| --- | --- |
| Single master symbol, 8 colours, ECC level 3 (default mode) | ✅ Full |
| Byte-mode data encoding (any byte payload) | ✅ Full |
| LDPC error correction (hard-decision decode) | ✅ Full, self-consistency tested — see `docs/JABCODE_NOTES.md` for what "full" does not mean here |
| Decoding a `PolychromeMatrix` you already have | ✅ Full |
| Decoding from a raw image, given known symbol corners | ✅ Full — `PerspectiveTransform` + `classifyGrid`, the same known-geometry approach as KarTrak |
| Locating a symbol in an arbitrary photo | ❌ Not implemented — no detector exists for this format yet |
| Text-mode compaction (upper/lower/numeric/punct/mixed/alphanumeric) | ❌ Not implemented — byte mode alone can always encode any input (the reference's own comment), so this is a capacity/efficiency gap, not a correctness one |
| Metadata Part I/Part II, cascaded slave symbols, non-default colour counts or ECC levels, mask-pattern optimisation search | ❌ Not implemented — all skipped by design along with default mode itself |
| Live palette calibration from a photographed symbol | ❌ Not implemented — decoding classifies against the fixed default palette, like KarTrak |
| Verified interop with the real `jabcode` reference encoder/decoder | ❌ Not done — no compiler or working reference build was available; see `docs/JABCODE_NOTES.md` |

## Writing

```js
import { encodeJABCode } from '@sythos/js_barcode_universal/jabcode';

const matrix = encodeJABCode(new TextEncoder().encode('Hello, JAB Code!'));

console.log(matrix.jabcode);
// { version: 1, payloadLength: 16 }
```

`matrix` is a `PolychromeMatrix`, not a `BitMatrix`: a square grid whose
side is `4 * version + 17` modules, `version` chosen automatically as the
smallest side-version (1-32) whose net LDPC capacity fits the encoded
payload. Render it with the colour renderer:

```js
import { toColorImageData } from '@sythos/js_barcode_universal/jabcode';

const image = toColorImageData(matrix, { scale: 8, margin: 4 });
// { data: Uint8ClampedArray, width, height } — draw to a canvas as usual.
```

A single byte-mode segment tops out at 8207 bytes (`encodeJABCode` throws
past that) — moot in practice, since no side-version's real capacity gets
anywhere near that many bytes anyway (version 32's net capacity is around
4.2 KB).

## Reading

```js
import { decodeJABCode, decodeJABCodeMatrix } from '@sythos/js_barcode_universal/jabcode';

// Decode a PolychromeMatrix you already have (e.g. your own round trip).
const fromMatrix = decodeJABCodeMatrix(matrix);

// Decode a raw RGBA image, given the symbol's four corners and version —
// known geometry, like KarTrak; there is no detector for this format.
const fromImage = decodeJABCode(image, {
  topLeft: { x, y }, topRight: { x, y },
  bottomRight: { x, y }, bottomLeft: { x, y },
}, matrix.jabcode.version);
```

Both return the decoded payload as a `Uint8Array`.

## Provenance

JAB Code's reference implementation (github.com/jabcode/jabcode) was
consulted directly, read in full for the pieces this module implements,
and used only to understand the format — no code from it is copied into
this SDK. See
[`licenses/jab-code.license`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/licenses/jab-code.license)
for the license history and patent position, and
[`docs/JABCODE_NOTES.md`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/docs/JABCODE_NOTES.md)
for exactly what was verified and how.
