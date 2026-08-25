# Aztec family

The Aztec family has two separate entries in the runtime registry:

| Label | `id` | Write | Read | Geometry |
| --- | --- | :---: | :---: | --- |
| Aztec Code | `aztec` | ✅ | ✅ | Compact layers 1–4 and full layers 1–32. |
| Aztec Rune | `aztecrune` | ✅ | ✅ | Fixed 11×11 rune carrying a value from 0 to 255. |

Aztec Code and Aztec Rune share a name and a bull’s-eye family resemblance,
but they do not share the same payload grammar, capacity model or decoder
contract. Select the exact format ID.

## Aztec Code

The `aztec` writer selects a fitting symbol automatically. Callers can force a
compact/full layer choice, a layer count and a requested error-correction
percentage:

```js
import {
  decodeAztec,
  encodeAztec,
} from '@sythos/js_barcode_universal/aztec';

const matrix = encodeAztec('Greetings My Lord Sythos  👋', {
  eccPercent: 23,
});

console.log(decodeAztec(matrix).text);
```

The implemented high-level encoder covers the five Aztec text tables and UTF-8
byte payloads through Binary Shift. Configurable public ECI is not currently
exposed, so do not assume that an arbitrary external ECI-labelled symbol is
interoperable with the high-level decoder.

The image detector looks for the central bull’s-eye, supports inverted
polarity and can sample a detected quadrilateral. The camera profile retries
the fixed eight in-plane orientations at 45-degree steps. Severe photographic
perspective, curved media, heavy occlusion, glare and multi-symbol scenes are
outside the validated guarantee.

## Aztec Rune

Aztec Rune is a small fixed-value symbol, not a short text encoder. The writer
accepts an integer in the range `0..255`, and the decoder returns the validated
rune value:

```js
import {
  decodeAztecRune,
  encodeAztecRune,
} from '@sythos/js_barcode_universal/aztecrune';

const matrix = encodeAztecRune(42);
const result = decodeAztecRune(matrix);
console.log(result.value); // 42
```

The symbol is fixed at 11×11 modules with GF(16) error correction and a
dedicated detector. It is not an alias for an Aztec Code Compact layer and it
does not accept an arbitrary string payload.

## Generic dispatch

Both variants can be selected from the root facade:

```js
import { decode, encode, toImageData } from '@sythos/js_barcode_universal';

const matrix = encode('AZTEC-READY', { format: 'aztec', eccPercent: 25 });
const image = toImageData(matrix, { scale: 6, margin: 4 });
const results = decode(image, { formats: ['aztec'] });
```

For a Rune value, prefer the dedicated `encodeAztecRune()` API because the
generic string dispatcher is designed for text formats and does not change the
Rune’s numeric contract.

## Verification and legal boundary

Aztec Rune values were compared exhaustively with an independent black-box
implementation during project validation. External tools are test oracles
only; their source code and tables are not shipped. The project’s provenance
record and scope labels are in [`NOTICE.md`](../../NOTICE.md),
[`LICENSE`](../../LICENSE) and [`licenses/aztec-rune.license`](../../licenses/aztec-rune.license).
The names are used descriptively and do not imply certification or endorsement.
