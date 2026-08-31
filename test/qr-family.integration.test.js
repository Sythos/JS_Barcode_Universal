import assert from 'node:assert/strict';
import test from 'node:test';
import { decode, encode, listFormats } from '../src/index.js';
import { toImageData } from '../src/js/render/image-data.js';

test('public API exposes Micro QR, rMQR and Canvas QR capabilities', () => {
  const formats = new Map(listFormats().map((entry) => [entry.id, entry]));
  for (const id of ['microqr', 'rmqr', 'frameqr']) {
    assert.equal(formats.get(id)?.canWrite, true, `${id} write capability`);
    assert.equal(formats.get(id)?.canRead, true, `${id} read capability`);
  }
});

test('generic image pipeline reads Micro QR and rMQR', () => {
  const cases = [
    ['microqr', '12345', { version: 'M2', ecc: 'L' }],
    ['rmqr', 'rMQR SAMPLE', { ecc: 'M' }],
    ['frameqr', 'https://www.sythos.net/', {
      version: 5,
      canvas: { shape: 'square', size: 5 },
      frameqr: { canvas: { shape: 'square', size: 5 } },
    }],
  ];
  for (const [format, text, options] of cases) {
    const matrix = encode(text, { format, ...options });
    const image = toImageData(matrix, { scale: 2, margin: 2 });
    const results = decode(image, { formats: [format], binarizer: 'global' });
    assert.equal(results.length, 1, `${format}: one result`);
    assert.equal(results[0].format, format);
    assert.equal(results[0].text, text);
  }
});
