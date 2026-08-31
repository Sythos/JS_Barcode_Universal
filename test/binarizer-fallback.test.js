import assert from 'node:assert/strict';
import test from 'node:test';
import { decode, decodeStrict, encode } from '../src/index.js';
import { toImageData } from '../src/js/render/image-data.js';

function raster(format, text, options = {}) {
  return toImageData(encode(text, { format, ...options }), { scale: 8, margin: 8 });
}

test('public decode retries global thresholding for large QR and PDF417 rasters', () => {
  const cases = [
    ['qr', 'https://www.sythos.net/', {}],
    ['pdf417', 'PDF417 automatic binarization fallback regression 0123456789', {}],
  ];

  for (const [format, text, options] of cases) {
    const image = raster(format, text, options);
    const results = decode(image, { formats: [format], binarizer: 'auto', tryHarder: true });
    assert.equal(results[0]?.text, text, `${format} auto fallback`);
    assert.equal(results.length, 1, `${format} fallback has no duplicates`);
  }
});

test('hybrid requests use the same focused QR fallback while global remains direct', () => {
  const text = 'https://www.sythos.net/';
  const image = raster('qr', text);

  assert.equal(
    decode(image, { formats: ['qr'], binarizer: 'hybrid', tryHarder: true })[0]?.text,
    text,
  );
  assert.equal(
    decode(image, { formats: ['qr'], binarizer: 'global', tryHarder: true })[0]?.text,
    text,
  );
  assert.equal(
    decodeStrict(image, { formats: ['qr'], binarizer: 'auto', tryHarder: true }).text,
    text,
  );
});

test('automatic binarization fallback preserves non-target formats and blank-image behavior', () => {
  const cases = [
    ['code128', 'CODE128-8X', {}],
    ['ean13', '5901234123457', {}],
    ['datamatrix', 'DATAMATRIX-8X', {}],
  ];

  for (const [format, text, options] of cases) {
    const results = decode(raster(format, text, options), {
      formats: [format], binarizer: 'auto', tryHarder: true,
    });
    assert.equal(results[0]?.text, text, `${format} remains readable`);
  }

  const white = { data: new Uint8ClampedArray(320 * 320 * 4).fill(255), width: 320, height: 320 };
  assert.deepEqual(decode(white, { binarizer: 'auto', tryHarder: true }), []);
});
