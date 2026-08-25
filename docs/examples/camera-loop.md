# Run a bounded camera loop

Camera reading combines browser permissions, video capture, canvas extraction
and the SDK's strict camera profile. The SDK does not request permission or
manage a media stream for you.

## A compact loop

This example keeps one canvas, one animation loop and one synchronous decode in
flight. It stops the stream after the first validated hit:

```html
<button id="start" type="button">Start camera</button>
<button id="stop" type="button" disabled>Stop</button>
<video id="video" playsinline muted autoplay hidden></video>
<canvas id="work" hidden></canvas>
<output id="status" role="status">Camera is stopped</output>

<script type="module">
  import { decode } from '@sythos/js_barcode_universal';

  const start = document.querySelector('#start');
  const stop = document.querySelector('#stop');
  const video = document.querySelector('#video');
  const canvas = document.querySelector('#work');
  const status = document.querySelector('#status');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  let stream = null;
  let frameRequest = 0;

  function stopCamera() {
    if (frameRequest) cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    for (const track of stream?.getTracks() ?? []) track.stop();
    stream = null;
    video.srcObject = null;
    video.hidden = true;
    start.disabled = false;
    stop.disabled = true;
    status.textContent = 'Camera is stopped';
  }

  function scan() {
    frameRequest = requestAnimationFrame(scan);
    if (!context || !video.videoWidth || !video.videoHeight) return;

    const ratio = Math.min(1, 800 / video.videoWidth);
    canvas.width = Math.max(1, Math.round(video.videoWidth * ratio));
    canvas.height = Math.max(1, Math.round(video.videoHeight * ratio));
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const results = decode(
        context.getImageData(0, 0, canvas.width, canvas.height),
        {
          profile: 'camera',
          formats: ['qr', 'datamatrix', 'pdf417'],
          tryHarder: true,
        },
      );
      const result = results[0];
      if (!result) return;

      stopCamera();
      status.textContent = `${result.format}: ${result.text}`;
    } catch (error) {
      // Reject a malformed frame without turning it into a fake hit.
      status.textContent = error instanceof Error ? error.message : String(error);
    }
  }

  start.addEventListener('click', async () => {
    if (!window.isSecureContext && location.hostname !== 'localhost') {
      status.textContent = 'Camera access needs HTTPS or localhost.';
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      status.textContent = 'This browser does not expose a camera API.';
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
      status.textContent = `Camera unavailable: ${error instanceof Error
        ? error.message
        : String(error)}`;
    }
  });

  stop.addEventListener('click', stopCamera);
  window.addEventListener('pagehide', stopCamera);
</script>
```

In a module-worker implementation, add an explicit busy flag or bounded queue
so capture cannot outrun decoding. Dropping stale frames is preferable to
building an unbounded backlog.

## Orientation and quality

`profile: 'camera'` keeps the native pass first and then retries the fixed
in-plane set `0°`, `45°`, `90°`, `135°`, `180°`, `225°`, `270°` and `315°` when
needed. This is not a promise of arbitrary perspective, curved-media or
severe-blur recovery. Keep enough module detail, quiet zone and contrast in
the working crop.

The result may include `rotation`, `bounds`, `confidence` and `quality`. Treat
those fields as evidence for UI stabilization, not as permission to skip
payload validation. A result should be accepted only after the decoder has
validated the format and the application has applied its own stability rule.

## Permission and lifecycle rules

- Serve camera pages from HTTPS or `localhost`.
- Keep `playsinline` on iOS video elements.
- Stop every media track on page hide, navigation and an explicit Stop action.
- Keep file input available when permission is denied.
- Display decoded text and errors with `textContent`, never `innerHTML`.
- Treat every decoded URL, identifier and GS1 field as untrusted application data.

For the lower-level RGBA contract, see the [read recipe](read-barcode.md) and
the [image pipeline guide](../guides/image-pipeline.md).
