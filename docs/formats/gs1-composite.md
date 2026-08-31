# GS1 DataBar Composite (bounded profile)

GS1 DataBar Composite places a two-dimensional component above a linked GS1
DataBar symbol. This SDK includes a deliberately small and strict profile for
applications that need a deterministic, dependency-free round trip. It is
useful engineering support, not a claim that every ISO/IEC 24723 layout or
scanner is covered.

## What the profile supports

The writer accepts one of these validated linear hosts:

- `databar14` (Omnidirectional)
- `databar-truncated`
- `databar-stacked`
- `databar-stacked-omnidirectional`
- `databar-limited`
- `databar-expanded`

The composite component is selected automatically as `cc-a` for the smallest
payload that fits the compact profile, or as `cc-b` when more capacity is
needed. You can request either component explicitly. The current component
profile uses the project's strict MicroPDF417-derived CC-A/CC-B geometry,
integer module scaling and error correction.

The result is intentionally self-describing. A private component marker,
linkage-enabled linear host, light separator and common module scale must all
validate before a read is returned. This prevents a reader from accidentally
joining two independent nearby barcodes.

## Encoding

`data` is a GS1 element string, either with parentheses or in its encoded form,
or an array of `{ ai, value }` objects. The linear value follows the rules of
the selected DataBar host: GTIN text for the fixed GTIN variants, and a GS1
element string for Expanded.

```js
import { encodeGS1Composite } from '@sythos/js_barcode_universal/composite';
import { toImageData } from '@sythos/js_barcode_universal';

const matrix = encodeGS1Composite({
  linear: {
    format: 'databar14',
    value: '00012345678905',
  },
  data: '(01)09506000134352(17)260101',
  component: 'auto',
  moduleScale: 2,
});

const image = toImageData(matrix.withMargin(4), { scale: 2 });
```

The common `encode` facade accepts the same object with
`format: 'gs1composite'` (aliases: `gs1-composite` and `composite`):

```js
import { encode } from '@sythos/js_barcode_universal';

const matrix = encode({
  linear: { format: 'databar-expanded', value: '(01)00012345678905(17)260101' },
  data: [
    { ai: '01', value: '09506000134352' },
    { ai: '17', value: '260101' },
  ],
}, { format: 'gs1composite', component: 'cc-b' });
```

`rowHeight` controls the MicroPDF417-derived component (minimum 2),
`separatorGap` accepts 1–3 logical rows, and `moduleScale` applies one common
integer nearest-neighbour scale to the complete composition. Nested linear
scaling is rejected so the two components cannot drift out of alignment.

## Decoding and detection

Use `decodeGS1Composite` for a complete axis-aligned `BitMatrix`, or
`detectGS1Composite` / `detectAndDecodeGS1Composite` for a clean binary raster
with an optional light quiet zone. Integer scale and quarter turns are
supported. The detector validates the whole composite as one geometry and
returns `null` for a standalone component, a missing linkage flag, a damaged
separator, an incomplete host or a marker that does not belong to this
profile.

```js
import {
  detectAndDecodeGS1Composite,
  decodeGS1Composite,
} from '@sythos/js_barcode_universal/composite';

const direct = decodeGS1Composite(matrix);
console.log(direct.text, direct.linearFormat, direct.component);

const detected = detectAndDecodeGS1Composite(matrix.withMargin(3).scale(2));
if (detected) {
  console.log(detected.elements, detected.moduleSize, detected.rotation);
}
```

The root `decode` pipeline recognizes `gs1composite` when it is selected in
`formats`. A result has `format: 'gs1composite'`, `profile:
'sythos-gs1-composite-bounded'`, the parsed `elements`, `linearFormat`,
`component` (`cc-a` or `cc-b`), component geometry and validation metadata.

## Interoperability boundary

This profile is intentionally not advertised as a drop-in replacement for a
certified GS1 Composite encoder. The marker and compact component choices are
part of the Sythos profile, while scanner-specific CC-A/CC-B tables, linkage
rules and certification requirements can be broader. For a regulated or
high-volume deployment, validate printed output with the target scanner and
complete the independent standards, patent and trademark review recorded in
[`licenses/gs1-composite.license`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/licenses/gs1-composite.license).

The implementation is original Sythos code under MIT and has no runtime
dependencies. Independent libraries may be used as black-box validation
references; no third-party source code or runtime is shipped.
