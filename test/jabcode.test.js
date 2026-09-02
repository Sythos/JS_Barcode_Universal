import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  JABCODE_PALETTE,
  PolychromeMatrix,
  decodeJABCode,
  decodeJABCodeMatrix,
  encodeJABCode,
  toColorImageData,
} from '../src/js/jabcode/index.js';

function textPayload(text) {
  return new TextEncoder().encode(text);
}

test('encodeJABCode round-trips a range of payload sizes through the matrix decoder', () => {
  for (const text of [
    'A',
    'Hello, JAB Code!',
    'The quick brown fox jumps over the lazy dog.',
    'x'.repeat(50),
    'y'.repeat(300),
  ]) {
    const payload = textPayload(text);
    const matrix = encodeJABCode(payload);
    assert.ok(matrix instanceof PolychromeMatrix);
    const decoded = decodeJABCodeMatrix(matrix);
    assert.deepEqual(Array.from(decoded), Array.from(payload));
  }
});

test('encodeJABCode round-trips exactly at the 15/16-byte length-prefix boundary and near max capacity', () => {
  for (const length of [15, 16, 17, 4000]) {
    const payload = new Uint8Array(length);
    for (let i = 0; i < length; i++) payload[i] = (i * 13 + 5) & 0xff;
    const matrix = encodeJABCode(payload);
    const decoded = decodeJABCodeMatrix(matrix);
    assert.deepEqual(Array.from(decoded), Array.from(payload));
  }
});

test('encodeJABCode rejects a payload past the single byte-mode segment limit', () => {
  assert.throws(() => encodeJABCode(new Uint8Array(8208)), /8207-byte/);
});

test('encodeJABCode rejects an empty payload', () => {
  assert.throws(() => encodeJABCode(new Uint8Array(0)), /non-empty/);
});

test('a large payload spans multiple LDPC sub-blocks and still round-trips', () => {
  const payload = new Uint8Array(3000);
  for (let i = 0; i < payload.length; i++) payload[i] = (i * 31 + 7) & 0xff;
  const matrix = encodeJABCode(payload);
  const decoded = decodeJABCodeMatrix(matrix);
  assert.deepEqual(Array.from(decoded), Array.from(payload));
});

test('picks the smallest side-version that fits the payload, growing monotonically', () => {
  let lastVersion = 0;
  for (const length of [1, 20, 100, 500, 1500]) {
    const matrix = encodeJABCode(new Uint8Array(length).fill(0xab));
    assert.ok(matrix.jabcode.version >= lastVersion);
    assert.equal(matrix.width, matrix.height);
    assert.equal(matrix.width, 4 * matrix.jabcode.version + 17);
    lastVersion = matrix.jabcode.version;
  }
});

test('LDPC hard-decision decoding recovers a handful of flipped data modules', () => {
  const payload = textPayload('Error correction should recover a few flipped modules.');
  const matrix = encodeJABCode(payload);
  let flips = 0;
  for (let y = 8; y < matrix.height - 8 && flips < 5; y += 3) {
    for (let x = 8; x < matrix.width - 8 && flips < 5; x += 3) {
      const current = matrix.get(x, y);
      if (current > 0) {
        matrix.set(x, y, ((current - 1 + 1) % 8) + 1);
        flips++;
      }
    }
  }
  assert.ok(flips > 0);
  const decoded = decodeJABCodeMatrix(matrix);
  assert.deepEqual(Array.from(decoded), Array.from(payload));
});

test('decodeJABCodeMatrix rejects a matrix whose size is not a valid side-version', () => {
  const matrix = new PolychromeMatrix(20, 20, JABCODE_PALETTE);
  assert.throws(() => decodeJABCodeMatrix(matrix), /side-version/);
});

test('round-trips through a rendered raster via known-geometry corners, at a realistic module scale', () => {
  for (const [text, scale, margin] of [
    ['Hello!', 4, 2],
    ['A longer payload to test multi-scale image decode robustness.', 3, 4],
    ['z'.repeat(200), 3, 1],
  ]) {
    const payload = textPayload(text);
    const matrix = encodeJABCode(payload);
    const image = toColorImageData(matrix, { scale, margin });
    const size = matrix.width;
    const px = margin * scale;
    const corners = {
      topLeft: { x: px, y: px },
      topRight: { x: px + size * scale, y: px },
      bottomRight: { x: px + size * scale, y: px + size * scale },
      bottomLeft: { x: px, y: px + size * scale },
    };
    const decoded = decodeJABCode(image, corners, matrix.jabcode.version);
    assert.deepEqual(Array.from(decoded), Array.from(payload));
  }
});
