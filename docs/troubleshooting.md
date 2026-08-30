# Troubleshooting

This page is a quick path from a symptom to the boundary that normally explains
it. If a check fails, keep the smallest reproducible input and record the
package version, tag or commit before changing several variables at once.

## Installation fails with an engine error

Check the runtime first:

```sh
node --version
npm --version
```

The package requires Node.js 24 or newer for Node applications. In a browser,
use the package's ESM entry or the committed browser bundle. Do not work around
an engine error by importing internal source files.

## `require()` or a CommonJS import fails

The package is ESM-first. Use an ESM module and `import`:

```js
import { encode } from '@sythos/js_barcode_universal';
```

If a larger application is still CommonJS, let its bundler or an explicit ESM
boundary load the SDK. Do not copy a generated file into a private path and
expect that path to remain stable across releases.

## TypeScript cannot find declarations

Install the SDK normally and import its root or documented subpaths. The package
maps each public JavaScript entry to its declaration file. Run the consuming
project's `tsc` with a compatible ESM module configuration and check that the
package version is not shadowed by a stale local link or duplicate install.

```sh
npm ls @sythos/js_barcode_universal
npm install @sythos/js_barcode_universal
```

Do not import `src/ts/` directly. Those files are implementation sources, not
the package compatibility surface.

## `decode()` always returns `[]`

Check these in order:

1. Confirm the object is decoded RGBA, not compressed PNG/JPEG/WebP bytes.
2. Confirm `data.length >= width * height * 4` and dimensions are positive
   safe integers.
3. Confirm the barcode is large enough in the working crop and its quiet zone
   is visible.
4. Try the correct `formats` id rather than an unrelated family.
5. Use `binarizer: 'auto'` for mixed camera lighting and `global` for a clean
   generated image.
6. Use `profile: 'camera'` for the eight-angle retry policy.
7. Check focus, motion blur, glare, clipping and print contrast.

An empty result is not a decoder bug by itself. The SDK intentionally rejects
partial, ambiguous or checksum-invalid candidates instead of returning a guess.

## The image object is rejected

The reader accepts `Uint8Array`, `Uint8ClampedArray` or validated `number[]`
RGBA data. It rejects fractional dimensions, short buffers, non-byte array
values and images larger than 16,384 pixels on a side or 16,777,216 pixels in
total. Resize or crop before calling the SDK, and keep an application-level
budget smaller than the hard safety ceiling when input is remote.

## The camera permission is denied

Serve the page from HTTPS or `localhost`, request the camera after a user
gesture, and check `navigator.mediaDevices?.getUserMedia`. On iOS, include
`playsinline` on the video. Keep file input as a fallback. A denied permission
is a platform state, not a “no barcode” decode result.

## The camera loop becomes slow or uses too much memory

Reuse one canvas and one 2D context, downscale or crop the frame, restrict the
format list, and prevent a new decode from starting while the previous one is in
flight. In a Worker, transfer one buffer at a time or use a small bounded queue.
Dropping stale frames is safer than decoding an unbounded backlog.

## A 45-degree symbol is not found

Use `profile: 'camera'`. Ordinary `decode()` does not resample arbitrary angles;
the camera profile adds the fixed 45-degree steps after its native pass. Keep
the symbol inside the crop with enough module pixels and contrast. The profile
does not repair severe blur, missing quiet zones, curved media or clipped data.

## A format appears writable but not readable

Read the registry flags instead of inferring behavior from a format name:

```js
import { listFormats } from '@sythos/js_barcode_universal';

console.table(listFormats().map(({ id, canWrite, canRead }) => ({
  id,
  canWrite,
  canRead,
})));
```

Pharmacode is intentionally write-only in the generic reader. EAN-2 and EAN-5
are parent-bound supplements. GS1 DataBar and the QR/PDF417 families also have
supported and unsupported variants; Telepen Numeric must be selected explicitly
with `formats: ['telepennumeric']`. Use the [format catalogue](formats/overview.md)
and the [linear-format guide](formats/oned.md) for the exact boundaries.

## Rendering throws a dimension or allocation error

Treat `scale`, `margin` and `barHeight` as untrusted numeric input. Require safe
integers, apply a practical UI/service budget, and inspect the matrix dimensions
before rendering. The SDK's hard limits protect the allocation boundary; they
are not a reason to accept a 16-million-pixel frame for every scan.

## The SVG or PNG looks blank or clipped

Remember that `encode()` returns modules without a quiet zone. Render with a
positive margin, use a sufficient scale, and for a one-dimensional symbol set
`barHeight`. Check the output dimensions before placing it in a constrained
layout. For a browser canvas, create the context before drawing and retain the
2D fallback when GPU feature detection fails.

## The GitHub documentation build fails

Run the same static checks locally where possible:

```sh
npm run types
npm run types:api
node .github/ci/validate-package.mjs
node .github/ci/validate-attestations.mjs
git diff --check
```

The Pages workflows install the pinned CI-only `mkdocs-material` requirement.
The deploy workflow runs on documentation pushes; the PR workflow builds
without deploy permissions. Inspect the exact failing page or navigation path
before changing the workflow permissions.

## A release asset or attestation is missing

Do not infer provenance from a green job summary. Verify the tag/package match,
the four release assets, `SHA256SUMS`, the GitHub attestation and npm provenance
using the [release checklist](release-verification.md). If the issue involves
package integrity or CI publication, use the private security reporting path.

## Is this a security issue?

Public Issues are appropriate for ordinary reproducible decoder, rendering or
documentation bugs after security impact is ruled out. Use GitHub Private
Vulnerability Reporting for code execution, data exposure, CI/package
compromise, host compromise, denial of service or input-validation bypasses;
notify `devsec@sythos.net` for High or Critical impact. See [SECURITY.md](https://github.com/Sythos/JS_Barcode_Universal/blob/main/SECURITY.md).
