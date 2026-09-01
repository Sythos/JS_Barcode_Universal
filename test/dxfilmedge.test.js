import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decode, encode, toImageData } from '../src/index.js';
import {
  decodeDXFilmEdgeMatrix,
  encodeDXFilmEdge,
} from '../src/js/oned/dxfilmedge.js';

function rendered(matrix, options = {}) {
  return toImageData(matrix, { scale: 5, margin: 16, ...options });
}

test('encodeDXFilmEdge round-trips through the matrix decoder, with and without frame info', () => {
  const noFrame = encodeDXFilmEdge({ productCode: 79, generation: 7 });
  assert.equal(noFrame.width, 23);
  assert.equal(noFrame.height, 2);
  assert.deepEqual(decodeDXFilmEdgeMatrix(noFrame), {
    format: 'dxfilmedge', productCode: 79, generation: 7,
  });

  const withFrame = encodeDXFilmEdge({ productCode: 79, generation: 7, frameNumber: 23, halfFrame: true });
  assert.equal(withFrame.width, 31);
  assert.deepEqual(decodeDXFilmEdgeMatrix(withFrame), {
    format: 'dxfilmedge', productCode: 79, generation: 7, frameNumber: 23, halfFrame: true,
  });
});

test('encodeDXFilmEdge validates field ranges', () => {
  assert.throws(() => encodeDXFilmEdge({ productCode: 0, generation: 0 }), /productCode/);
  assert.throws(() => encodeDXFilmEdge({ productCode: 128, generation: 0 }), /productCode/);
  assert.throws(() => encodeDXFilmEdge({ productCode: 1, generation: 16 }), /generation/);
  assert.throws(() => encodeDXFilmEdge({ productCode: 1, generation: 0, frameNumber: 64 }), /frameNumber/);
  assert.throws(() => encodeDXFilmEdge({ productCode: 1, generation: 0, halfFrame: true }), /halfFrame/);
});

test('decodeDXFilmEdgeMatrix rejects a tampered parity bit and a tampered clock track', () => {
  const matrix = encodeDXFilmEdge({ productCode: 79, generation: 7 });

  const badParity = matrix.clone();
  const parityX = matrix.width - 4 - 1; // position just before the 4-bit stop pattern
  badParity.flip(parityX, 1);
  assert.equal(decodeDXFilmEdgeMatrix(badParity), null);

  const badClock = matrix.clone();
  badClock.flip(0, 0);
  assert.equal(decodeDXFilmEdgeMatrix(badClock), null);
});

test('DX Film Edge round-trips through the top-level dispatcher and image pipeline', () => {
  const matrix = encode({ productCode: 79, generation: 7, frameNumber: 23, halfFrame: true }, { format: 'dxfilmedge' });
  const [result] = decode(rendered(matrix), { formats: ['dxfilmedge'] });
  assert.equal(result.productCode, 79);
  assert.equal(result.generation, 7);
  assert.equal(result.frameNumber, 23);
  assert.equal(result.halfFrame, true);
});

test('image decode works across a range of scales and margins', () => {
  for (const scale of [3, 5, 8]) {
    for (const margin of [4, 15]) {
      for (const fields of [
        { productCode: 1, generation: 0 },
        { productCode: 127, generation: 15, frameNumber: 0, halfFrame: false },
        { productCode: 50, generation: 8, frameNumber: 63, halfFrame: true },
      ]) {
        const matrix = encodeDXFilmEdge(fields);
        const image = toImageData(matrix, { scale, margin });
        const [result] = decode(image, { formats: ['dxfilmedge'] });
        assert.ok(result, `scale=${scale} margin=${margin} ${JSON.stringify(fields)}`);
        assert.equal(result.productCode, fields.productCode);
        assert.equal(result.generation, fields.generation);
      }
    }
  }
});

test('DX Film Edge camera profile requires a measurable quiet zone', () => {
  const matrix = encodeDXFilmEdge({ productCode: 79, generation: 7, frameNumber: 23, halfFrame: true });
  const wide = rendered(matrix, { margin: 16 });
  assert.equal(decode(wide, { formats: ['dxfilmedge'], profile: 'camera' }).length, 1);

  const tight = rendered(matrix, { margin: 0 });
  assert.deepEqual(decode(tight, { formats: ['dxfilmedge'], profile: 'camera' }), []);
});

test('an unrequested DX Film Edge symbol is not returned when formats is restricted', () => {
  const matrix = encodeDXFilmEdge({ productCode: 79, generation: 7 });
  assert.deepEqual(decode(rendered(matrix), { formats: ['postbarc10'] }), []);
});

test('DX Film Edge rejects unrelated procedural raster without false positives', () => {
  let state = 0x1234abcd;
  for (let seed = 0; seed < 20; seed++) {
    state = (state * 1664525 + 1013904223 + seed) >>> 0;
    let local = state;
    const width = 80, height = 20;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      local = (local * 1664525 + 1013904223) >>> 0;
      const v = local >>> 24;
      data.set([v, v, v, 255], i * 4);
    }
    const result = decode({ data, width, height }, {
      formats: ['dxfilmedge'], tryHarder: true, binarizer: 'global',
    });
    assert.deepEqual(result, [], `noise seed ${seed}`);
  }
});
