# Installation

Choose the entry point that matches where your application runs. All options
use the same Sythos implementation and keep the runtime dependency count at
zero.

## npm: the normal application path

```sh
npm install @sythos/js_barcode_universal
```

The package is native ESM (`"type": "module"`) and declares Node.js 24 or
newer. In a Node application, import the package root or one of its public
subpaths:

```js
import { encode, toSVG } from '@sythos/js_barcode_universal';
import { encodeQR } from '@sythos/js_barcode_universal/qr';

const matrix = encodeQR('https://www.sythos.net/', { ecc: 'M' });
const svg = toSVG(matrix, { scale: 8, margin: 4 });
```

The root package includes TypeScript declarations. You do not need to install
the TypeScript compiler just to consume the SDK from JavaScript; install it as
a development tool when your own project needs to compile TypeScript.

## CDN: an IIFE `<script>` tag

The published IIFE bundle exposes the global `SythosBarcode` object. Pin a
release in production so a future `latest` release cannot change your deployed
bytes unexpectedly:

```html
<script src="https://unpkg.com/@sythos/js_barcode_universal"></script>
<script>
  const matrix = SythosBarcode.encode('https://www.sythos.net/', {
    format: 'qr',
  });
  const image = SythosBarcode.toSVGDataURI(matrix, { scale: 8 });
  document.querySelector('#barcode').src = image;
</script>
<img id="barcode" alt="Generated QR code">
```

The repository’s [IIFE bundle](../bundle/sythos-barcode.js) is the same browser
surface used by the package. It also works from a local HTML file, while camera
access still follows browser permission and secure-context rules.

## CDN or local ESM

Use the ESM bundle when the page already uses modules:

```html
<script type="module">
  import {
    encode,
    toSVGDataURI,
  } from 'https://unpkg.com/@sythos/js_barcode_universal/bundle/sythos-barcode.esm.js';

  const matrix = encode('ESM-START', { format: 'qr' });
  document.querySelector('#barcode').src = toSVGDataURI(matrix, { scale: 6 });
</script>
<img id="barcode" alt="Generated QR code">
```

For a checked-in, offline-friendly copy, import
`bundle/sythos-barcode.esm.js` from the repository or package archive instead
of relying on a network request at runtime.

## Browser examples

The canonical examples are already part of the repository:

- [Create](../examples/create.html) uses the IIFE bundle to render symbols and
  lets the user choose a payload and format.
- [Read](../examples/read.html) accepts image input and demonstrates the
  progressive camera profile.

They are plain HTML files. Opening the create example from `file://` is enough
for generation. Camera reading normally requires HTTPS or `localhost`, a
browser permission grant and a frame that contains enough detail for the
selected format.

## TypeScript projects

The package’s declarations are available automatically from the root import:

```ts
import { encode, type BitMatrix } from '@sythos/js_barcode_universal';

const symbol: BitMatrix = encode('TS-INSTALL', { format: 'qr' });
```

The SDK’s own development workspace pins its TypeScript compiler exactly, but
that compiler is not a dependency of the published runtime. Your application
may choose its own compatible TypeScript toolchain.

## Source layout for contributors

The package publishes readable source alongside the compiled runtime:

- `src/ts/` contains the TypeScript implementation and declarations;
- `src/js/` contains the compiled JavaScript modules used by consumers;
- `src/index.js` and `src/index.d.ts` are the stable root facades;
- `bundle/` contains the committed IIFE and ESM bundles.

From a development checkout, `npm run build:ts` regenerates the JavaScript
facade and compiled modules. Type and public-API checks are available through
`npm run types` and `npm run types:api`. These commands are contributor checks,
not installation steps for an application using the package.

## Common installation surprises

### “It tried to install another barcode library”

The SDK has no runtime dependencies. Check the application lockfile and the
command that installed it; development tools are separate from the published
runtime graph.

### “The browser module does not load”

Use `type="module"` for the ESM bundle or the IIFE bundle for a classic
`<script>` tag. Do not mix the two loading styles in the same snippet.

### “The camera is blocked”

Camera access is a browser capability, not an npm installation feature. Use
HTTPS or `localhost`, grant permission, and make sure the page is not inside a
context that forbids camera access. See the [read example](../examples/read.html)
and the [security policy](../SECURITY.md) before treating an empty decode as a
software installation failure.
