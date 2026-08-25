# Frequently asked questions

## Is this a JavaScript or a TypeScript package?

Both. The published runtime is JavaScript, and the package includes TypeScript
declarations for the same public API. TypeScript is useful for editor and build
checks, but it is not a runtime dependency of the SDK.

## Does the package have runtime dependencies?

No. The package has zero `dependencies` and `optionalDependencies`. A consuming
application still needs its own image adapter when it starts from PNG, JPEG,
WebP or camera data, because the SDK intentionally accepts RGBA pixels rather
than bundling an image codec.

## Which Node.js version is supported?

The package declares Node.js 24 or newer. Browser and Worker use do not require
Node.js, but the application must still provide the platform APIs used by its
adapter.

## Why did `decode()` return an empty array?

An empty array means that no symbol passed the requested detector and format
validation for that image. Check the RGBA shape, module detail, quiet zone,
contrast, focus, crop and selected `formats`. A partial candidate is deliberately
not returned as application data. See [troubleshooting](troubleshooting.md).

## Why does the camera work in one browser but not another?

Camera access belongs to the browser. Use HTTPS or `localhost`, request the
permission after a user action, keep `playsinline` on iOS video, and check that
the page's embedding policy permits camera access. The SDK does not request or
manage permissions. The [camera loop recipe](examples/camera-loop.md) shows a
complete lifecycle.

## Does the reader accept an image file directly?

No. Decode the file with an application-owned image adapter, then pass an
object containing row-major RGBA bytes, `width` and `height`. Passing the bytes
of a PNG or JPEG file directly is not the same thing as passing decoded pixels.

## Why should I pass `formats`?

It narrows detector work and prevents a valid symbol from an unexpected family
being accepted. Use `listFormats()` to build a dynamic picker and respect
`canWrite` and `canRead` independently.

## Is Pharmacode readable?

Pharmacode is currently writable but intentionally reports `canRead: false` in
the generic image pipeline. Do not present it as a complete read/write format.

## Are EAN-2 and EAN-5 standalone formats?

They are parent-bound supplements. They are printed next to a validated EAN/UPC
symbol and should not be treated as independent generic retail barcodes.

## Does “FrameQR” mean native DENSO FrameQR compatibility?

No. The SDK's `frameqr` entry is the non-certified Sythos Canvas QR profile. It
is not native DENSO FrameQR interoperability or certification. DENSO SQRC and
Face Authentication SQRC are excluded from this MIT SDK; see the [format
boundaries](formats/excluded-formats.md).

## What are the image and render limits?

The current hard boundary is 16,384 pixels per side and 16,777,216 pixels in
total. `scale`, `margin` and `barHeight` must also be safe integers within the
renderer limits. Applications should set smaller budgets for user-controlled
requests and camera loops.

## Can I use the GPU to decode a camera frame?

GPU helpers accelerate drawing a matrix to a canvas. They do not move the
barcode encoder or camera decoder to the GPU. Feature-detect WebGL2/WebGPU and
keep the 2D fallback; measure before adding a GPU path.

## Is a successful decode safe to open or execute?

No. A valid barcode can contain a phishing URL, an unexpected identifier or
data that is dangerous for the host application. Display it as text, validate
schemes and hosts, and keep application actions behind an allow-list.

## Where should I report a vulnerability?

Do not put exploit details in a public Issue. Use GitHub Private Vulnerability
Reporting and notify `devsec@sythos.net` for High or Critical impact, including
code execution, data exposure, package/CI compromise, host compromise or an
input-validation trust-boundary bypass. Ordinary non-security bugs belong in
Issues after security impact has been ruled out. Read [SECURITY.md](https://github.com/Sythos/JS_Barcode_Universal/blob/main/SECURITY.md).

## Are ZXing, Zint or other barcode libraries dependencies?

No. Independent implementations may be used as black-box verification tools,
but their source and tables are not shipped and their licenses are not changed
by this MIT package. The [licensing guide](guides/licensing.md) explains the
boundary.

## How do I verify a release?

Start with the [release verification checklist](release-verification.md). It
covers the tag/package match, lockfile-backed checks, npm archive contents,
SHA256SUMS, GitHub attestations and npm provenance.
