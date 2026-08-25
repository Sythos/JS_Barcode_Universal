# Camera reading guide

Camera capture is an application feature around the SDK, not a hidden scanner
service. The page owns permission, stream lifecycle, frame cadence and the
canvas adapter. The SDK owns image validation, detection, decoding and the
decision not to return an unvalidated payload.

## Browser prerequisites

`navigator.mediaDevices.getUserMedia()` normally works only in a secure context:

- serve the page over HTTPS; or
- use `http://localhost` during local development.

Opening [examples/read.html](../../examples/read.html) from `file://` is useful
for the file-input half of the example, but it cannot grant normal camera
access. The browser also needs a user permission, the document must not be
inside a context that forbids camera use, and the selected device must expose a
camera. A rejected permission is not a “no barcode” result; show a useful UI
message and leave file input available.

On iOS, keep `playsinline` on the `<video>` element. Without it Safari may take
the video fullscreen and the page cannot reliably copy frames into its working
canvas.

## The strict camera profile

Use the opt-in camera profile when decoding frames captured from a moving phone
or webcam:

```js
import { decode } from '@sythos/js_barcode_universal';

const imageData = {
  data: new Uint8ClampedArray(4),
  width: 1,
  height: 1,
};
const results = decode(imageData, {
  profile: 'camera',
  tryHarder: true,
  binarizer: 'auto',
  formats: ['qr', 'pdf417'],
});
```

The profile keeps the ordinary native-orientation pass fast. If no validated
result is found, it retries the frame in the eight in-plane orientations:

```text
0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°
```

The `rotation` field on an accepted camera result reports the orientation of
the supplied raster, clockwise from the canonical orientation. A result at
`rotation: 45` was recovered after the 45-degree camera-profile normalization;
it is not a promise that every detector returns all optional metadata for every
format. The diagonal 2D passes resample luminance before thresholding; linear
passes rotate the already-binarized matrix. `bounds`, `confidence` and
`quality` are also detector-dependent and should be treated as evidence for an
overlay, not as a replacement for decoded text validation.

Ordinary `decode()` does not resample arbitrary angles. The diagonal resampling
is deliberately opt-in to `profile: 'camera'`, because it costs more and can
turn a clean, module-aligned image into a less precise one. The profile also
keeps the decoder's strict validation path: if no format-specific checks pass,
the result is empty rather than a partial or guessed value.

## A complete capture loop

This is a compact browser implementation. It uses a reduced working raster,
reuses its canvas and stops after the first validated result. The complete
repository [read example](../../examples/read.html) adds file input, status
panels and safe DOM rendering.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Camera barcode reader</title>
</head>
<body>
  <button id="start" type="button">Start camera</button>
  <button id="stop" type="button" disabled>Stop</button>
  <video id="video" playsinline muted autoplay hidden></video>
  <canvas id="work" hidden></canvas>
  <output id="result" role="status">Camera is stopped</output>

  <script type="module">
    import { decode } from
      'https://unpkg.com/@sythos/js_barcode_universal/bundle/sythos-barcode.esm.js';

    const start = document.querySelector('#start');
    const stop = document.querySelector('#stop');
    const video = document.querySelector('#video');
    const canvas = document.querySelector('#work');
    const result = document.querySelector('#result');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    let stream = null;
    let frameRequest = 0;

    const secure = window.isSecureContext
      || location.protocol === 'https:'
      || location.hostname === 'localhost';

    function stopCamera() {
      if (frameRequest) cancelAnimationFrame(frameRequest);
      frameRequest = 0;
      if (stream) {
        for (const track of stream.getTracks()) track.stop();
        stream = null;
      }
      video.hidden = true;
      start.disabled = false;
      stop.disabled = true;
      result.textContent = 'Camera is stopped';
    }

    function scan() {
      frameRequest = requestAnimationFrame(scan);
      if (!video.videoWidth || !context) return;

      // A 720p source is normally more detail than the first detector pass
      // needs. Keep enough pixels for the physical module size, but avoid
      // scanning a full phone sensor on every animation frame.
      const scale = Math.min(1, 800 / video.videoWidth);
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      try {
        const hits = decode(
          context.getImageData(0, 0, canvas.width, canvas.height),
          { profile: 'camera', tryHarder: true, binarizer: 'auto' },
        );
        const hit = hits[0];
        if (!hit) return;

        // Decoded text is untrusted data. Keep it text, not HTML.
        const message = `${hit.format}: ${hit.text}`
          + (hit.rotation === undefined ? '' : ` (${hit.rotation}°)`);
        stopCamera();
        result.textContent = message;
      } catch (error) {
        // A malformed or oversized frame is rejected at the input boundary.
        // Keep the loop alive, but do not turn the error into a fake result.
        result.textContent = error instanceof Error
          ? error.message
          : String(error);
      }
    }

    start.addEventListener('click', async () => {
      if (!secure) {
        result.textContent = 'Camera access needs HTTPS or localhost.';
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        result.textContent = 'This browser does not expose a camera API.';
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        video.srcObject = stream;
        video.hidden = false;
        start.disabled = true;
        stop.disabled = false;
        await video.play();
        scan();
      } catch (error) {
        stopCamera();
        result.textContent = `Camera unavailable: ${error instanceof Error
          ? error.message
          : String(error)}`;
      }
    });

    stop.addEventListener('click', stopCamera);
    window.addEventListener('pagehide', stopCamera);
  </script>
</body>
</html>
```

For a busy detector or a worker-backed loop, add an explicit in-flight flag so
the next frame cannot start before the previous decode finishes. The example
above is synchronous and stops on the first hit, so it cannot build an
unbounded queue.

## Frame quality and crop strategy

The decoder needs enough pixels per module, a visible quiet zone where the
format requires one, usable contrast and a symbol that is not hidden by severe
glare, motion blur or focus failure. A larger camera frame is not automatically
a better frame: it increases luminance conversion, thresholding and detector
work and can exceed the input pixel limit.

Prefer this order when a read is marginal:

1. keep the symbol inside the frame and leave its quiet zone visible;
2. focus and hold the device steady for one or two frames;
3. crop or downscale to the region of interest while preserving module detail;
4. restrict `formats` to the expected family;
5. use `profile: 'camera'` for the orientation retries.

Do not report a value merely because a detector returned a candidate. The public
reader returns only results that pass the format decoder and its validation
checks. `[]` means “keep scanning” in a camera loop.

## Secure handling of camera output

Camera pixels are untrusted input. Do not put decoded content into
`innerHTML`, execute a decoded URL automatically or treat `confidence` as an
authorization decision. Render status with `textContent`, validate the payload
against the application's scheme and business rules, and apply the reporting
boundary in [SECURITY.md](../../SECURITY.md) if the behavior looks like a
security issue.

The SDK rejects malformed dimensions, short buffers, non-byte array values and
oversized rasters before detector work. The [image pipeline guide](image-pipeline.md)
explains those checks and the RGBA conversion in detail.
