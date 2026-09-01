# DX Film Edge Barcode

The DX film edge barcode is Kodak's latent-image code printed along the
edge of 35mm film below the sprocket holes, invisible until developed. It
identifies the film's manufacturer/type ("DX number"), generation and,
every half frame, the frame number — used by photofinishing equipment to
process and print film automatically. It is a two-track code: a fixed
"clock" track for scanner synchronization, and a "data" track carrying the
actual bits.

This is distinct from the DX cartridge barcode (an ordinary Interleaved 2
of 5 symbol printed on the film cartridge, already coverable by this SDK's
existing `itf` format) and from the DX CAS conductive checkerboard pattern
read electrically by camera contacts — neither of those is what this
format implements.

## Structure

| Field | Bits | Notes |
| --- | --- | --- |
| Start pattern | 6 | Fixed `101010` |
| Product code | 7 | 1-127 |
| Separator | 1 | Fixed `0` |
| Generation | 4 | 0-15; product code + generation together form the DX number |
| Frame number *(optional)* | 6 | 0-63, half-frame intervals |
| Half-frame flag *(optional)* | 1 | Set for the second half of a frame pair |
| Separator *(optional)* | 1 | Fixed `0` |
| Parity | 1 | XOR of every data-track bit between the start and stop patterns |
| Stop pattern | 4 | Fixed `0101` |

A symbol without frame information is 23 bits wide; with frame information,
31 bits. The clock track runs in parallel (row 0 of the rendered matrix,
data track row 1) with its own fixed synchronization pattern determined
purely by the symbol's length — it carries no user data.

Runtime id `dxfilmedge`, reported by `listFormats()` as writable and
readable like any other 1D format.

## Writing

```js
import { encodeDXFilmEdge } from '@sythos/js_barcode_universal/oned';

// Product code + generation only (no frame info)
const noFrame = encodeDXFilmEdge({ productCode: 79, generation: 7 });

// With frame number and half-frame flag
const withFrame = encodeDXFilmEdge({
  productCode: 79,
  generation: 7,
  frameNumber: 23,
  halfFrame: true,
});
```

The root dispatcher accepts the same field object as `value`:

```js
import { encode, toImageData } from '@sythos/js_barcode_universal';

const matrix = encode({ productCode: 79, generation: 7 }, { format: 'dxfilmedge' });
const image = toImageData(matrix, { scale: 5, margin: 16 });
```

## Reading images

```js
import { decode, toImageData } from '@sythos/js_barcode_universal';

const image = toImageData(
  encode({ productCode: 79, generation: 7, frameNumber: 23, halfFrame: true }, { format: 'dxfilmedge' }),
  { scale: 5, margin: 16 },
);

const [result] = decode(image, { formats: ['dxfilmedge'] });
console.log(result?.productCode, result?.generation, result?.frameNumber, result?.halfFrame);
// 79 7 23 true
```

The reader validates the fixed clock-track pattern, the start/stop
patterns and the parity bit before returning a result; any mismatch
returns nothing rather than a guessed value. For camera capture, opt into
the stricter profile:

```js
const hits = decode(cameraFrame, { formats: ['dxfilmedge'], profile: 'camera' });
```

The camera profile requires a measurable quiet zone on both sides of the
symbol, the same requirement as this SDK's other height/track-coded
formats.

## Verification and licensing boundary

The bit-field layout, fixed clock-track patterns and parity algorithm are
original Sythos code, verified against US Patent 4,965,628A's own page
images (not automated text extraction, which — like this SDK's PostBar
implementation — was found to produce a conflicting result compared to
the primary source) and cross-checked against Wikipedia's "DX encoding"
article (itself citing a 2017 peer-reviewed archival-science paper
analyzing real film samples) and Zint's `dxfilmedge.c`, consulted only as
an independent black-box behavioural reference. No source code, table or
image asset from any other barcode implementation is copied or shipped.
See
[`licenses/dx-film-edge-barcode.license`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/licenses/dx-film-edge-barcode.license)
and [`NOTICE.md`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/NOTICE.md).
This implementation is not certified, endorsed or reviewed by Kodak.
