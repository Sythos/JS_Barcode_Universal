# Use the SDK from TypeScript

The package ships JavaScript runtime files and matching declarations. TypeScript
is a development-time tool for the consuming application; it is not a runtime
dependency of the published SDK.

## Install and configure

```sh
npm install @sythos/js_barcode_universal
npm install --save-dev typescript
```

A minimal `tsconfig.json` for a Node.js 24+ ESM application is:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

The browser bundler can use its own module settings, but the import specifier
should remain the package root or a documented public subpath. Do not import
`src/ts/` directly: those files are implementation sources, not compatibility
entry points.

## A typed encode/decode round trip

```ts
import {
  decode,
  encode,
  toImageData,
  type DecodeResult,
} from '@sythos/js_barcode_universal';

const payload = 'TYPED-QR-1';
const matrix = encode(payload, { format: 'qr', ecc: 'M' });
const image = toImageData(matrix, { scale: 6, margin: 4 });
const results: DecodeResult[] = decode(image, { formats: ['qr'] });

const first = results[0];
if (!first || first.text !== payload) {
  throw new Error('The generated symbol was not validated');
}

console.log(first.format, first.text);
```

`DecodeResult` contains required `format` and `text` fields plus optional
metadata. A consumer should narrow optional fields before using them:

```ts
const rotation = first.rotation ?? 0;
const confidence = first.confidence ?? null;
console.log({ rotation, confidence });
```

Optional camera evidence is not a guarantee that a business action is safe.
Validate payloads and destinations at the application boundary.

## Import a focused subpath

Public subpaths expose format-specific functions with their declarations:

```ts
import { encodeDataMatrix } from '@sythos/js_barcode_universal/datamatrix';
import { encodeMicroQR } from '@sythos/js_barcode_universal/microqr';
import { toSVG } from '@sythos/js_barcode_universal/render/svg';

const matrix = encodeDataMatrix('TYPED-DM');
const micro = encodeMicroQR('12345', { version: 'M2', ecc: 'L' });
const svg = toSVG(micro, { scale: 8, margin: 4 });

console.log(matrix.width, svg.startsWith('<svg'));
```

The [subpath export reference](../api/subpath-exports.md) lists the supported
paths. `package.json` remains the source of truth when a future release adds or
removes an export.

## Keep generated output out of the type check

For an application that emits JavaScript elsewhere, replace `noEmit` with the
project's chosen output directory. The SDK does not require a generated copy of
its own declarations in the consumer project. In this repository, the
maintainer checks declarations with:

```sh
npm run types
npm run types:api
```

Those commands validate the SDK's source and public declaration surface. They
do not replace the consuming application's own `tsc` run.

## Common TypeScript mistakes

- Use ESM `import`, not `require()`, because the package is ESM-first.
- Keep `module` and `moduleResolution` compatible with the bundler or Node.js
  version used by the application.
- Import `type DecodeResult` as a type when the compiler is configured for
  verbatim module syntax.
- Do not assume every `listFormats()` entry has `canRead: true`; keep the two
  capabilities separate.
- Do not place decoded text in an HTML sink without escaping or using
  `textContent`.
