import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  PLESSEY_DIGIT_PATTERNS,
  decode,
  encode,
  encodePlessey,
  plesseyCheckDigits,
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

test('Plessey digit table has sixteen unique reversed-BCD patterns', () => {
  assert.equal(PLESSEY_DIGIT_PATTERNS.length, 16);
  assert.equal(new Set(PLESSEY_DIGIT_PATTERNS).size, 16);
  for (const [value, pattern] of PLESSEY_DIGIT_PATTERNS.entries()) {
    assert.equal(pattern.length, 8);
    // Reversed BCD: bit i (LSB first) is '1' at pair i when the pattern
    // reads wide-then-narrow ('31'), narrow-then-wide ('13') for a 0 bit.
    let reconstructed = 0;
    for (let i = 0; i < 4; i++) {
      const pair = pattern.slice(i * 2, i * 2 + 2);
      if (pair === '31') reconstructed |= (1 << i);
      else assert.equal(pair, '13', `digit ${value} pair ${i}`);
    }
    assert.equal(reconstructed, value);
  }
});

test('plesseyCheckDigits is deterministic and payload-sensitive', () => {
  const a = plesseyCheckDigits([1, 2, 3, 4, 5]);
  const b = plesseyCheckDigits([1, 2, 3, 4, 5]);
  assert.deepEqual(a, b);
  const c = plesseyCheckDigits([1, 2, 3, 4, 6]);
  assert.notDeepEqual(a, c);
  for (const [c1, c2] of [a, c]) {
    assert.ok(c1 >= 0 && c1 <= 15);
    assert.ok(c2 >= 0 && c2 <= 15);
  }
});

test('Plessey round-trips hex payloads and rejects non-hex input', () => {
  for (const payload of ['0', 'F', '123', 'ABCDEF', '0123456789ABCDEF']) {
    const matrix = encodePlessey(payload);
    const image = rendered(matrix);
    const result = decode(image, { formats: ['plessey'] });
    assert.equal(result.length, 1, payload);
    assert.deepEqual(result[0], { format: 'plessey', text: payload, checkDigit: true });
  }

  assert.throws(() => encodePlessey('G'), /hex digits/);
  assert.throws(() => encodePlessey(''), /hex digits/);

  // Lowercase input is accepted but the decoded text is always uppercase.
  const lower = decode(rendered(encodePlessey('abc')), { formats: ['plessey'] });
  assert.equal(lower[0].text, 'ABC');
});

test('Plessey is exposed through the top-level dispatcher', () => {
  const matrix = encode('DEAD', { format: 'plessey' });
  const result = decode(rendered(matrix), { formats: ['plessey'] });
  assert.equal(result.length, 1);
  assert.equal(result[0].text, 'DEAD');
});

test('a damaged Plessey symbol fails its mandatory CRC check and is rejected', () => {
  const matrix = encodePlessey('123456');
  const damaged = matrix.clone();
  damaged.flip(Math.floor(damaged.width / 2), 0);
  assert.deepEqual(decode(rendered(damaged), { formats: ['plessey'] }), []);
});

test('Plessey camera profile requires a quiet zone and the CRC check', () => {
  const matrix = encodePlessey('9F0C2');
  const image = rendered(matrix, { scale: 4 });
  const result = decode(image, { formats: ['plessey'], profile: 'camera' });
  assert.equal(result.length, 1);
  assert.equal(result[0].text, '9F0C2');
  assert.equal(result[0].quality.checksum, true);
  assert.equal(result[0].quality.quietZone, true);
});

test('Plessey camera profile rejects unrelated content without false positives', () => {
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

  let state = 0x9e3779b9;
  for (let seed = 0; seed < 12; seed++) {
    state = (state * 1664525 + 1013904223 + seed) >>> 0;
    let local = state;
    const noise = proceduralImage(96, 64, () => {
      local = (local * 1664525 + 1013904223) >>> 0;
      return local >>> 24;
    });
    const result = decode(noise, {
      formats: ['plessey'], profile: 'camera', tryHarder: true, binarizer: 'global',
    });
    assert.deepEqual(result, [], `noise seed ${seed}`);
  }

  const checker = proceduralImage(96, 64, (x, y) => ((x >> 3) + (y >> 3)) % 2 ? 96 : 160);
  assert.deepEqual(
    decode(checker, { formats: ['plessey'], profile: 'camera', tryHarder: true, binarizer: 'global' }),
    [],
  );
});
