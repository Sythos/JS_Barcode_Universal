# Sythos Canvas QR profile

The runtime ID `frameqr` names the **Sythos Canvas QR profile**. It is a
deliberately scoped Sythos profile built on QR Code Model 2. It is **not** a
native DENSO FrameQR implementation, does not claim DENSO interoperability and
is not certified by DENSO.

## Compatibility boundary

The profile identity is `sythos-canvas-qr/1` and its structural contract is:

| Property | Current profile |
| --- | --- |
| Base symbology | QR Code Model 2 |
| Error correction | QR `H`, forced by the profile |
| Certified | No |
| DENSO FrameQR compatible | No |
| Canvas shapes | `square`, `circle`, `diamond` |
| Canvas rotation | `0`, `90`, `180` or `270` degrees |
| QR version | 1–40, automatic or forced |

The encoder reserves a bounded group of QR data modules, clears them for the
canvas artwork and checks the worst-case codeword damage per Reed–Solomon block.
It rejects a canvas that overlaps QR function modules or exceeds the correction
budget. This makes the profile deterministic and testable without pretending
that a proprietary format has been re-created.

## Encoding

The `frameqr` subpath exposes a QR-like API with a `canvas` option:

```js
import {
  decodeFrameQR,
  encodeFrameQR,
} from '@sythos/js_barcode_universal/frameqr';

const matrix = encodeFrameQR('https://www.sythos.net/', {
  canvas: {
    shape: 'circle',
    size: 5,
    centerX: 20,
    centerY: 20,
    angle: 90,
  },
});

const result = decodeFrameQR(matrix);
console.log(result.text, matrix.frameqr.profile);
```

The `ecc` option is fixed to `H`; passing another level is rejected. The other
QR-level options include `version`, `mask`, `charset` and `kanji`. Canvas
dimensions are module units and are normalized to odd dimensions so the centre
is unambiguous. The profile limits the centre away from the finder-pattern
boundary and keeps the canvas inside the symbol.

## Artwork is an application concern

The SDK returns a module matrix and profile metadata. It does not fetch or
embed an image asset for you. A browser application can composite its own
artwork into a safe canvas after rendering, but it should keep the profile
geometry and error-correction budget intact. The repository’s create example
uses a remote Sythos favicon as an optional preview source and does not ship a
copied graphic asset.

If a remote image is blocked by CORS or fails to load, keep the QR payload and
render a plain profile symbol. Artwork is decoration; it must never be allowed
to turn an otherwise invalid symbol into a claimed successful decode.

## Reading and metadata

The profile keeps the ordinary QR payload decoder underneath. A normal QR
matrix must not be silently relabelled as a Canvas QR symbol. The decoder uses
the profile marker and validated canvas metadata; an unmarked matrix requires
an explicit trusted opt-in from a caller that has already verified the profile.

```js
import { decode } from '@sythos/js_barcode_universal';

const results = decode(imageDataLike, {
  formats: ['frameqr'],
  profile: 'camera',
});

if (results[0]) {
  console.log(results[0].format, results[0].text);
}
```

The image path is validated on clean profile rasters and follows the supported
fixed camera orientation policy. It is not a promise of arbitrary perspective,
curved media, severe occlusion or native DENSO FrameQR reading.

## Do not use this page as a DENSO implementation guide

DENSO SQRC, Face Authentication SQRC and native DENSO FrameQR are outside this
MIT SDK. A user with the appropriate DENSO licence may adapt generic QR,
Reed–Solomon, rendering and image-processing routines for a licensed
integration, but that adaptation is governed by the applicable DENSO terms.
This repository does not grant or replace that licence.

The project’s compatibility boundary and consultation record are in
[`PLAN.md`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/PLAN.md), [`NOTICE.md`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/NOTICE.md),
[`LICENSE`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/LICENSE) and [`licenses/frameqr.license`](https://github.com/Sythos/JS_Barcode_Universal/blob/main/licenses/frameqr.license).
