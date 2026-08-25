# Create a barcode

This recipe starts with text, creates a symbol matrix and renders it into an
output that a browser, a file writer or another application can use. The SDK
does not choose a DOM element, image codec or download policy for you. That
small boundary is the reason the same recipe works in a browser, a Worker and
Node.js.

## The shortest round trip

The root API is the best starting point when the format is selected at runtime:

```js
import {
  encode,
  toImageData,
} from '@sythos/js_barcode_universal';

const matrix = encode('Greetings My Lord Sythos', {
  format: 'qr',
  ecc: 'M',
});

const image = toImageData(matrix, {
  scale: 8,
  margin: 4,
});

console.log(matrix.width, matrix.height);
console.log(image.width, image.height);
```

`encode()` returns modules in a `BitMatrix`. It does not contain pixels or a
quiet zone. `toImageData()` adds the margin and returns an RGBA object with
`data`, `width` and `height`, ready for the reader or a browser canvas adapter.

## Render SVG or PNG

SVG is convenient when the consumer wants a vector asset or a data URI:

```js
import {
  encode,
  toSVG,
  toSVGDataURI,
} from '@sythos/js_barcode_universal';

const matrix = encode('https://www.sythos.net/', { format: 'qr' });
const svg = toSVG(matrix, { scale: 6, margin: 4 });
const dataUri = toSVGDataURI(matrix, { scale: 6, margin: 4 });

console.log(svg.startsWith('<svg'));
console.log(dataUri.startsWith('data:image/svg+xml'));
```

PNG output is asynchronous because the SDK constructs the complete byte
stream. In Node.js, write those bytes with the platform filesystem API:

```js
import { writeFile } from 'node:fs/promises';
import { encode, toPNG } from '@sythos/js_barcode_universal';

const matrix = encode('NODE-PNG-1', { format: 'code128' });
const png = await toPNG(matrix, {
  scale: 3,
  margin: 10,
  barHeight: 80,
});

await writeFile('barcode.png', png);
```

The one-dimensional matrix is intentionally one module tall. `barHeight`
stretches it into a useful printed or displayed bar height; it does not change
the encoded data.

## Select a format from the registry

Do not assume that every registry entry has the same read/write contract:

```js
import { encode, listFormats, toSVG } from '@sythos/js_barcode_universal';

const requested = 'pdf417';
const info = listFormats().find((item) => item.id === requested);

if (!info?.canWrite) {
  throw new Error(`This release cannot write ${requested}`);
}

const matrix = encode('SHIPMENT-2026-0001', { format: requested });
document.querySelector('#barcode').src =
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(toSVG(matrix))}`;
```

The current registry exposes separate `canWrite` and `canRead` flags. Pharmacode
is deliberately writer-only in the generic image pipeline. EAN-2 and EAN-5 are
parent-bound supplements, not generic standalone symbols. Read the [format
catalogue](../formats/overview.md) before building a user-facing picker.

## Direct format encoders

When a page already knows its symbology, a public subpath keeps the intent
clear and avoids a runtime string dispatch:

```js
import { encodeDataMatrix } from '@sythos/js_barcode_universal/datamatrix';
import { encodeQR } from '@sythos/js_barcode_universal/qr';
import { encodeCode128 } from '@sythos/js_barcode_universal/oned';

const qr = encodeQR('direct QR', { ecc: 'Q' });
const dataMatrix = encodeDataMatrix('direct Data Matrix');
const linear = encodeCode128('ABC-123');

console.log(qr.width === qr.height);
console.log(dataMatrix.width > 0);
console.log(linear.height === 1);
```

The public subpath declarations are the authority for format-specific options.
Do not import internal files from `src/ts/` or `src/js/` in an application.

## Validate payload and output budgets

The SDK rejects payloads that do not fit the selected symbol; it never silently
truncates text. Your application should also set a practical output budget
before accepting user-controlled render options:

```js
const options = {
  scale: Number(form.scale.value),
  margin: Number(form.margin.value),
};

if (!Number.isSafeInteger(options.scale) || options.scale < 1 || options.scale > 32) {
  throw new Error('Choose a practical integer scale between 1 and 32');
}

const matrix = encode(form.payload.value, { format: form.format.value });
const image = toImageData(matrix, options);
```

The renderer still enforces its own hard limits, but an application-facing
slider usually needs a much smaller limit for predictable performance. See the
[security guide](../guides/security.md) and [performance guide](../guides/performance.md)
for the allocation boundary.

## Browser display

For a plain HTML page using the checked-in IIFE bundle:

```html
<img id="barcode" alt="Generated barcode">
<script src="../bundle/sythos-barcode.js"></script>
<script>
  const matrix = SythosBarcode.encode('BROWSER-QR', { format: 'qr' });
  const svg = SythosBarcode.toSVGDataURI(matrix, { scale: 6, margin: 4 });
  document.querySelector('#barcode').src = svg;
</script>
```

Never use decoded barcode text as HTML. Generation payloads are also application
input: validate business fields before encoding, and keep output labels separate
from any navigation or command path.
