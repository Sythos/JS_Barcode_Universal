import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  FIM_PATTERNS,
  decode,
  encode,
  encodeFIM,
  toImageData,
} from '../src/index.js';

function rendered(matrix, options = {}) {
  return toImageData(matrix, {
    scale: 3,
    margin: 20,
    barHeight: 40,
    ...options,
  });
}

test('FIM patterns are five distinct nine-bit palindromes starting and ending with a bar', () => {
  const types = Object.keys(FIM_PATTERNS);
  assert.deepEqual(types.sort(), ['A', 'B', 'C', 'D', 'E']);
  assert.equal(new Set(Object.values(FIM_PATTERNS)).size, 5);
  for (const pattern of Object.values(FIM_PATTERNS)) {
    assert.equal(pattern.length, 9);
    assert.equal(pattern, [...pattern].reverse().join(''), 'must be a palindrome');
    assert.equal(pattern[0], '1');
    assert.equal(pattern[pattern.length - 1], '1');
  }
});

test('every FIM type round-trips through the generic image reader', () => {
  for (const type of ['A', 'B', 'C', 'D', 'E']) {
    const matrix = encodeFIM(type);
    const image = rendered(matrix);
    const result = decode(image, { formats: ['fim'] });
    assert.equal(result.length, 1, type);
    assert.deepEqual(result[0], { format: 'fim', text: type });

    const lowercase = decode(rendered(encodeFIM(type.toLowerCase())), { formats: ['fim'] });
    assert.equal(lowercase.length, 1, type);
    assert.equal(lowercase[0].text, type);
  }
});

test('FIM is exposed through the top-level dispatcher and its alias', () => {
  const matrix = encode('C', { format: 'fim' });
  const result = decode(rendered(matrix), { formats: ['facing-identification-mark'] });
  assert.equal(result.length, 1);
  assert.equal(result[0].text, 'C');
});

test('encodeFIM rejects anything outside A-E', () => {
  assert.throws(() => encodeFIM('F'), /unknown type/);
  assert.throws(() => encodeFIM(''), /unknown type/);
  assert.throws(() => encodeFIM('AB'), /unknown type/);
});

test('FIM camera profile rejects unrelated content without false positives', () => {
  function proceduralImage(width, height, pixel) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const value = pixel(x, y);
        data.set([value, value, value, 255], (y * width + x) * 4);
      }
    }
    return { data, width, height };
  }

  let state = 0x2f6e2b1;
  for (let seed = 0; seed < 12; seed++) {
    state = (state * 1664525 + 1013904223 + seed) >>> 0;
    let local = state;
    const noise = proceduralImage(96, 64, () => {
      local = (local * 1664525 + 1013904223) >>> 0;
      return local >>> 24;
    });
    const result = decode(noise, {
      formats: ['fim'], profile: 'camera', tryHarder: true, binarizer: 'global',
    });
    assert.deepEqual(result, [], `noise seed ${seed}`);
  }

  const checker = proceduralImage(96, 64, (x, y) => ((x >> 3) + (y >> 3)) % 2 ? 96 : 160);
  assert.deepEqual(
    decode(checker, { formats: ['fim'], profile: 'camera', tryHarder: true, binarizer: 'global' }),
    [],
  );
});

test('FIM camera profile requires a quiet zone and rejects a damaged symbol', () => {
  const matrix = encodeFIM('D');
  const image = rendered(matrix, { scale: 4 });
  const result = decode(image, { formats: ['fim'], profile: 'camera' });
  assert.equal(result.length, 1);
  assert.equal(result[0].text, 'D');
  assert.equal(result[0].quality.quietZone, true);

  const damaged = matrix.clone();
  damaged.flip(Math.floor(damaged.width / 2), 0);
  assert.equal(
    decode(rendered(damaged, { scale: 4 }), { formats: ['fim'], profile: 'camera' }).length,
    0,
  );
});
