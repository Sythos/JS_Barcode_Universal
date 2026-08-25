# TypeScript support

The SDK ships JavaScript runtime modules and public `.d.ts` declarations in the
same package. TypeScript is part of the project’s development and validation
toolchain, not a runtime dependency of an application that consumes the SDK.

## Install the SDK

```sh
npm install @sythos/js_barcode_universal
```

You only need to add the TypeScript compiler to your own project when that
project compiles `.ts` files. JavaScript consumers do not need it just to use
the package.

## A typed round trip

```ts
import {
  decode,
  encode,
  toImageData,
  type DecodeResult,
  type FormatInfo,
} from '@sythos/js_barcode_universal';

const formats: FormatInfo[] = [];
const payload = 'TypeScript keeps the edges tidy';
const matrix = encode(payload, { format: 'qr', ecc: 'M' });
const image = toImageData(matrix, { scale: 8, margin: 4 });
const results: DecodeResult[] = decode(image, { formats: ['qr'] });

const first = results[0];
if (!first) {
  throw new Error('No validated QR Code found');
}

console.log(`${first.format}: ${first.text}`);
// qr: TypeScript keeps the edges tidy
```

The `BitMatrix`, `DecodeResult`, `FormatInfo`, `ImageLike` and renderer types
describe the same runtime objects used by JavaScript. No wrapper class or
TypeScript-specific runtime is inserted between your code and the SDK.

## Typed format-specific imports

Public subpaths carry their own declarations:

```ts
import { encodeQR } from '@sythos/js_barcode_universal/qr';
import { encodeDataMatrix } from '@sythos/js_barcode_universal/datamatrix';
import { encodeCode128 } from '@sythos/js_barcode_universal/oned';
import { toSVG, type RenderOptions } from '@sythos/js_barcode_universal/render';

const qr = encodeQR('typed QR', { ecc: 'H' });
const dataMatrix = encodeDataMatrix('typed Data Matrix');
const linear = encodeCode128('ABC-123');
const options: RenderOptions = { scale: 6, margin: 4, barHeight: 72 };

console.log(toSVG(qr, options).startsWith('<svg'));
console.log(dataMatrix.width, linear.height);
```

The package’s [`exports`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/package.json) map points each public subpath to
its JavaScript module and matching declaration. Do not import TypeScript
implementation files by filesystem path; those paths are implementation
details even though the published package includes readable source.

## Compiler settings

The package is ESM-first. A modern application can use a bundler-oriented
configuration such as:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true
  }
}
```

For a Node.js application that uses native ESM, use the equivalent modern
Node/ESM module settings provided by your TypeScript version. Keep the
application’s `package.json` aligned with ESM (`"type": "module"`) when the
generated JavaScript uses `import` statements.

The rendering declarations mention `HTMLCanvasElement` and `OffscreenCanvas`.
A non-DOM server project can use `encode`, `toImageData`, `toSVG` and `toPNG`
without a browser, but should include the DOM library in its TypeScript config
if it imports and type-checks canvas-specific APIs.

## What the project validates

The repository validates its own declarations with:

```sh
npm run types
npm run types:api
```

Those checks compile the TypeScript source and inspect the public API surface.
They are contributor checks; they do not add TypeScript to the SDK’s runtime
dependency graph. The project keeps the compiler pinned as a development
dependency, while the published package remains zero-runtime-dependency.

## Type declarations are the compatibility boundary

The root declaration facade is [`src/index.d.ts`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/src/index.d.ts), and
the generated TypeScript declarations are under [`src/ts/`](https://github.com/Sythos/JS_Barcode_Universal/tree/main/src/ts/).
When a declaration and an internal helper disagree, the exported declaration
and `package.json` export map are the public contract to review first. Report a
real mismatch with a minimal TypeScript reproduction rather than relying on a
deep import that the package does not promise to preserve.
