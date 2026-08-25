# Web Workers guide

The core API is worker-friendly because it does not require a DOM, a canvas, a
filesystem or a browser global. The worker receives an image-shaped value,
calls `decode()`, and sends plain result data back to the page. Move the
greyscale conversion and detector work off the UI thread when a camera or a
large file would otherwise make the page feel sticky. A JavaScript module worker
can import the package root or a public subpath; a TypeScript worker uses the
same package specifier after the application's bundler compiles it. Neither
should import implementation files from `src/ts/`.

## A complete module-worker example

The following pair of files uses the public ESM bundle from a module worker. In
a bundled application, the worker can import the npm package root instead.

`barcode-worker.js`:

```js
import { decode } from
  'https://unpkg.com/@sythos/js_barcode_universal/bundle/sythos-barcode.esm.js';

self.addEventListener('message', (event) => {
  const { buffer, width, height, formats } = event.data;
  const image = {
    data: new Uint8ClampedArray(buffer),
    width,
    height,
  };

  try {
    const results = decode(image, {
      formats,
      profile: 'camera',
      tryHarder: true,
    });

    // DecodeResult values are structured-clone friendly. Send only the
    // fields the UI needs if the application does not need full metadata.
    self.postMessage({ ok: true, results });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
```

`index.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Worker barcode reader</title>
</head>
<body>
  <video id="camera" playsinline muted autoplay></video>
  <canvas id="frame" hidden></canvas>
  <output id="status" role="status">Waiting for a frame</output>

  <script type="module">
    const video = document.querySelector('#camera');
    const canvas = document.querySelector('#frame');
    const status = document.querySelector('#status');
    const worker = new Worker('./barcode-worker.js', { type: 'module' });
    const context = canvas.getContext('2d', { willReadFrequently: true });
    let busy = false;

    worker.addEventListener('message', (event) => {
      busy = false;
      if (!event.data.ok) {
        status.textContent = event.data.error;
        return;
      }
      const result = event.data.results[0];
      status.textContent = result
        ? `${result.format}: ${result.text}`
        : 'No validated symbol in this frame';
    });

    async function start() {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();

      function loop() {
        requestAnimationFrame(loop);
        if (busy || !video.videoWidth) return;

        const scale = Math.min(1, 800 / video.videoWidth);
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);

        busy = true;
        // Transfer ownership of the pixel buffer so this frame is not copied.
        worker.postMessage({
          buffer: image.data.buffer,
          width: image.width,
          height: image.height,
          formats: ['qr', 'datamatrix', 'pdf417'],
        }, [image.data.buffer]);
      }

      loop();
    }

    start().catch((error) => {
      status.textContent = `Camera unavailable: ${error.message || error}`;
    });
  </script>
</body>
</html>
```

The transfer list detaches the frame buffer from the page after
`postMessage()`. That is intentional: the page does not use that `ImageData`
again. If the page needs to retain the pixels, omit the transfer list and
accept the structured-clone copy, or create a separate buffer for the worker.

The example uses a camera only to demonstrate the worker boundary. Camera
permissions still require HTTPS or `localhost`, and iOS needs `playsinline`.
The [camera guide](camera-reading.md) covers the lifecycle and secure-context
failure cases.

## Importing from an npm application

When a bundler owns the worker build, prefer a normal package import:

```js
// barcode-worker.js
import { decode } from '@sythos/js_barcode_universal';

self.onmessage = ({ data }) => {
  const image = {
    data: new Uint8ClampedArray(data.buffer),
    width: data.width,
    height: data.height,
  };
  self.postMessage(decode(image, { formats: data.formats }));
};
```

Use a module worker (`{ type: 'module' }`) so the ESM import is preserved. A
classic worker cannot consume an ESM import without a bundler or a separate
script-loading strategy.

If the worker is authored in TypeScript, keep the request and response boundary
typed while retaining the same runtime import:

```ts
import { decode, type DecodeResult } from '@sythos/js_barcode_universal';

type WorkerRequest = {
  buffer: ArrayBuffer;
  width: number;
  height: number;
  formats?: string[];
};

type WorkerResponse =
  | { ok: true; results: DecodeResult[] }
  | { ok: false; error: string };

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const { buffer, width, height, formats } = event.data;
  try {
    const results = decode({
      data: new Uint8ClampedArray(buffer),
      width,
      height,
    }, { formats });
    self.postMessage({ ok: true, results } satisfies WorkerResponse);
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    } satisfies WorkerResponse);
  }
});
```

The worker still needs the application's normal TypeScript-to-JavaScript
build step; Node.js does not execute `.ts` files natively.

## Message and result design

Keep the worker message boundary explicit. A practical message contains:

```js
{
  buffer: image.data.buffer,
  width: image.width,
  height: image.height,
  formats: ['qr'],
}
```

The worker reconstructs `Uint8ClampedArray` and the SDK validates its dimensions
and byte length before detector work. Do not trust a width and height supplied
by an external page merely because the buffer was transferred; catch the
decoder error and report a safe status to the UI.

`DecodeResult` can include `format`, `text`, `rotation`, `bounds`,
`confidence` and format-specific metadata. Send the entire result when the UI
needs the camera overlay; otherwise project it to a small view model and keep
the raw payload out of an HTML sink. The [security policy](../../SECURITY.md)
defines the trust boundary for camera and file rasters.

## Worker performance rules

- Keep one worker per sustained pipeline unless profiling proves otherwise.
- Use a `busy` flag or a queue limit so a slow decode cannot build an unbounded
  backlog of camera frames.
- Downscale before transfer when the symbol still has enough module detail.
- Restrict `formats` and avoid `tryHarder` retries when the capture contract is
  already controlled.
- Transfer buffers when ownership can move; copy them when the main thread must
  continue using the same pixels.
- Stop the worker and camera stream when the page is hidden.

The [performance guide](performance.md) explains why these choices matter and
when the camera profile's eight orientation passes are worth the extra work.
