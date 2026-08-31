# GS1 DataBar Expanded

GS1 DataBar Expanded (often called RSS Expanded) is the linear member of the
DataBar family for GS1 element strings that need more room than a single
GTIN-14. It keeps the familiar GS1 application-identifier rules, but spreads
the payload across a sequence of 17-module data characters separated by finder
patterns.

This SDK implements the **linear Expanded** symbol. Expanded Stacked and GS1
Composite components are separate physical grammars and are not silently
treated as aliases here.

## Import the helpers

The public helpers live in the `databar` subpath:

```js
import {
  decodeDataBarExpanded,
  decodeDataBarExpandedScanline,
  detectDataBarExpanded,
  encodeDataBarExpanded,
} from '@sythos/js_barcode_universal/databar';
```

The root `encode()` and `decode()` APIs also accept the aliases
`gs1databar-expanded`, `gs1-databar-expanded` and `databar-expanded`.

## Write a GS1 element string

The writer accepts the parenthesized form used in GS1 documentation. It checks
Application Identifiers, fixed and variable lengths, separators and the normal
GS1 character set before creating the symbol.

```js
const symbol = encodeDataBarExpanded(
  '(01)09506000134352(10)ABC-123(17)260101',
  { moduleScale: 2, height: 68 },
);

console.log(symbol.width, symbol.height, symbol.databar.dataCharacters);
```

The returned `BitMatrix` contains the symbol only. Add a quiet zone when
rendering or when preparing a camera image:

```js
import { toImageData } from '@sythos/js_barcode_universal';

const image = toImageData(symbol.withMargin(4), { scale: 1 });
```

`linkage: true` sets the composite-linkage flag. It does not generate a
composite component by itself; applications that need the bounded Sythos
profile can use the dedicated [`gs1composite` guide](gs1-composite.md), which
composes and validates both halves as one geometry.

## Read a matrix or scanline

For a complete clean matrix, the strict decoder validates the guards, every
finder, every data character, the check character and the GS1 element string:

```js
const result = decodeDataBarExpanded(symbol);

console.log(result.text);
// 010950600013435210ABC-123\x1d17260101
console.log(result.elements);
// [{ ai: '01', value: '09506000134352', fixed: true }, ...]
```

`decodeDataBarExpandedScanline()` accepts a complete one-module-tall scanline.
It is useful when an application already owns the binarization and sampling
step. Both readers reject partial symbols, non-canonical run widths, checksum
errors and malformed GS1 data instead of returning a plausible fragment.

The reader understands the general-purpose information method emitted by this
writer and the common compressed method 1 used for a GTIN-14 `(01)` primary
field. Other compressed primary-field methods are intentionally rejected until
they have their own fixtures and interoperability evidence.

## Detect a clean raster

`detectDataBarExpanded()` searches for one complete dark-on-light or inverted
linear symbol in a binary `BitMatrix`. It accepts integer module scaling and
the fixed quarter-turn orientations used by the other DataBar detectors:

```js
const detected = detectDataBarExpanded(binaryImage);
if (detected) {
  console.log(detected.text, detected.rotation, detected.moduleSize);
}
```

The detector is deliberately conservative. A quiet zone, coherent contrast,
enough module detail and a single prominent symbol are still required. It does
not claim arbitrary perspective, grayscale thresholding, curved media, severe
occlusion or multi-symbol scene handling. For those inputs, binarize and
perspective-sample in the application, then call the strict matrix reader.

## Validation and provenance

The implementation uses original Sythos TypeScript and generated JavaScript,
with no runtime dependency. The constrained-composition tables, finder order,
check weights and GS1 parser are checked by focused round trips, malformed-input
tests and independent black-box vectors from BWIPP. BWIPP was used only as an
external validation oracle; no BWIPP source, tables or runtime code is copied or
shipped. The engineering provenance record is in
[`NOTICE.md`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/NOTICE.md)
and [`licenses/gs1-databar.license`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/licenses/gs1-databar.license).

GS1 and DataBar names remain trademarks of their respective owners. This page
describes an MIT-licensed implementation and does not claim GS1 certification,
patent clearance or trademark endorsement.
