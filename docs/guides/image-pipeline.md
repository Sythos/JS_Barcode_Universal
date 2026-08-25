# Image pipeline guide

The reader's platform boundary is one deliberately boring object:

```js
{
  data: Uint8ClampedArray | Uint8Array | number[],
  width: number,
  height: number,
}
```

`data` is **RGBA**, four channel values per pixel, row-major, in the order
`red, green, blue, alpha`. A browser `ImageData` already has this shape. Node,
a Web Worker, a canvas, `OffscreenCanvas` or an application-owned image adapter
can all provide the same value without an SDK-specific wrapper.

## Validate the image before decoding

The runtime validates the boundary before it starts detection:

| Check | Rule |
| --- | --- |
| `width`, `height` | Positive safe integers |
| Each side | At most `16,384` pixels |
| Total pixels | At most `16,777,216` |
| Array type | `Uint8ClampedArray`, `Uint8Array` or `number[]` |
| Array length | At least `width * height * 4` values |
| `number[]` values | Every required value must be an integer from `0` to `255` |

The total ceiling is still high—roughly twice the pixel count of a normal 4K
image—but it is an allocation guard, not a target resolution. A camera loop
usually runs faster and more reliably on a carefully downscaled working frame.
Do not “fix” invalid input by silently coercing dimensions or channel values;
reject it at your application boundary and log only the non-sensitive context
needed to diagnose the issue.

## What happens to RGBA data

`LuminanceSource.fromImageData()` converts the image to one byte of luminance
per pixel. It uses a Rec. 601-style integer approximation and composites
transparent pixels over white before calculating luminance. This matters for a
barcode exported as a transparent PNG: transparent quiet-zone pixels are not
mistaken for black ink.

The conversion snapshots the resulting greyscale buffer. Later mutations of
the caller's source array do not rewrite a decode that has already crossed the
boundary. The SDK does not retain a DOM image, a canvas or a file handle.

```js
import { LuminanceSource } from '@sythos/js_barcode_universal';

const source = LuminanceSource.fromImageData({
  data: new Uint8ClampedArray([
    0, 0, 0, 255,       // dark pixel
    255, 255, 255, 255, // light pixel
  ]),
  width: 2,
  height: 1,
});

console.log(source.width, source.height, source.get(0, 0), source.get(1, 0));
```

For a pipeline that already owns a validated one-channel raster, use
`LuminanceSource.fromGrey(grey, width, height)`. It still checks dimensions and
copies the caller-owned bytes. The factor must leave at least one output pixel
on each side:

```js
import { LuminanceSource } from '@sythos/js_barcode_universal';

const width = 4;
const height = 4;
const greyscaleBytes = new Uint8Array([
  0, 0, 255, 255,
  0, 0, 255, 255,
  255, 255, 0, 0,
  255, 255, 0, 0,
]);
const source = LuminanceSource.fromGrey(greyscaleBytes, width, height);
const inverted = source.invert();
const quarterTurn = source.rotate90();
const smaller = source.downscale(2);
```

`downscale()` uses integer-factor box averaging. It is useful before a camera
or batch detector when the original frame has more pixels than the physical
module size can use. It is not a substitute for preserving enough pixels per
module; a tiny symbol should be cropped or captured closer instead.

## Binarization choices

`decode()` defaults to `binarizer: 'auto'`. The public choices are:

| Strategy | Best fit | Trade-off |
| --- | --- | --- |
| `global` | Clean generated PNGs, screenshots and flat scans | Fast and consistent, but one threshold can lose a shadowed symbol |
| `hybrid` | Uneven camera lighting, glare and page falloff | More work, with a local threshold per block |
| `auto` | General use | Uses the normal adaptive path and targeted global fallbacks where the decoder supports them |

The low-level functions are public when an application needs to inspect the
stages itself:

```js
import {
  LuminanceSource,
  binarizeGlobal,
  binarizeHybrid,
} from '@sythos/js_barcode_universal';

const imageData = {
  data: new Uint8ClampedArray(32 * 32 * 4),
  width: 32,
  height: 32,
};
const source = LuminanceSource.fromImageData(imageData);
const globalBits = binarizeGlobal(source);
const cameraBits = binarizeHybrid(source);

console.log(globalBits.getBounds(), cameraBits.getBounds());
```

A `BitMatrix` uses one set bit for a dark module. Low-level detector APIs consume
that matrix, but most applications should call root `decode()` so format
selection, validation, de-duplication and camera metadata stay consistent.

## Perspective and orientation

Some detectors recover a symbol quadrilateral and sample it through a
perspective transform; others use an axis-aligned bounding box or a format-
specific scanline. Rotation and perspective are not interchangeable:

- a quarter-turn can be normalized with a raster rotation;
- a 45-degree camera-profile pass resamples greyscale input for 2D detectors;
  linear detectors rotate the binarized matrix;
- an oblique photograph needs usable module contrast and a detector that can
  recover its geometry;
- no option can restore information destroyed by clipping, blur or a missing
  quiet zone.

For the eight camera-profile angles and the `rotation` metadata, see
[Camera reading](camera-reading.md). Ordinary decoding intentionally avoids
arbitrary-angle resampling.

## Browser canvas adapter

The safe, direct browser path is:

```js
const context = canvas.getContext('2d', { willReadFrequently: true });
if (!context) throw new Error('A 2D canvas context is required');

context.drawImage(imageOrVideo, 0, 0, canvas.width, canvas.height);
const frame = context.getImageData(0, 0, canvas.width, canvas.height);
const hits = decode(frame, { formats: ['qr'], binarizer: 'auto' });
```

`getImageData()` can fail before the SDK sees the bytes when a cross-origin
image taints the canvas. Configure CORS or use a same-origin resource. The
canonical [read example](https://github.com/Sythos/JS_Barcode_Universal/blob/main/examples/read.html) uses a hidden work canvas
for both file and camera frames.

## Input errors and empty results

Malformed or oversized images can raise a library error at the input boundary.
Catch that error around an untrusted file or frame and show a safe status. A
valid image with no validated symbol returns `[]`; that is expected for most
camera frames and is not an exception.

Do not process partial text, a candidate bounding box or a low-quality visual
guess as a barcode result. Only the returned `DecodeResult` has crossed the
format decoder and validation path. If the input is user-controlled, apply
application-level checks to `result.text` and keep it out of HTML sinks.

The resource boundary mirrors [SECURITY.md](https://github.com/Sythos/JS_Barcode_Universal/blob/main/SECURITY.md): image data is
untrusted, allocations are bounded, and a crash that becomes denial of service,
memory abuse or code/data compromise should be treated as a security report.
