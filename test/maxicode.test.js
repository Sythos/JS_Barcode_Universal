import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decode, toImageData } from '../src/index.js';
import { BitMatrix } from '../src/js/core/bit-matrix.js';
import {
  decodeMaxiCode,
  detectAndDecodeMaxiCode,
  encodeMaxiCode,
  MAXICODE_GRID,
  validateMaxiCodeTables,
} from '../src/js/maxicode/index.js';

const PRIMARY = {
  postalCode: '123456789',
  countryCode: 840,
  serviceClass: 999,
};

function invert(source) {
  const result = source.clone();
  for (let y = 0; y < result.height; y++) {
    for (let x = 0; x < result.width; x++) result.flip(x, y);
  }
  return result;
}

test('MaxiCode module table is complete and one-to-one', () => {
  assert.deepEqual(validateMaxiCodeTables(), []);
  assert.equal(MAXICODE_GRID.length, 30 * 33);
  assert.equal(MAXICODE_GRID.filter((value) => value > 0).length, 864);
});

test('MaxiCode modes 2 and 3 preserve structured primary data', () => {
  const mode2 = decodeMaxiCode(encodeMaxiCode('MODE2 PAYLOAD', { mode: 2, primary: PRIMARY }));
  assert.equal(mode2.mode, 2);
  assert.equal(mode2.text, 'MODE2 PAYLOAD');
  assert.deepEqual(mode2.primary, PRIMARY);

  const mode3 = decodeMaxiCode(encodeMaxiCode('MODE3 PAYLOAD', {
    mode: 3,
    primary: { ...PRIMARY, postalCode: 'ABC123' },
  }));
  assert.equal(mode3.mode, 3);
  assert.equal(mode3.text, 'MODE3 PAYLOAD');
  assert.deepEqual(mode3.primary, { ...PRIMARY, postalCode: 'ABC123' });
});

test('MaxiCode modes 4 and 5 round-trip text and Latin-1 bytes', () => {
  for (const mode of [4, 5]) {
    const decoded = decodeMaxiCode(encodeMaxiCode('Hello-123/Ä', { mode }));
    assert.equal(decoded.mode, mode);
    assert.equal(decoded.text, 'Hello-123/Ä');
    assert.deepEqual([...decoded.bytes], [72, 101, 108, 108, 111, 45, 49, 50, 51, 47, 196]);
  }
});

test('MaxiCode round-trips every ISO-8859-1 byte through Code Sets C, D and E', () => {
  for (let start = 0; start < 256; start += 24) {
    const bytes = Uint8Array.from({ length: Math.min(24, 256 - start) }, (_, index) => start + index);
    const decoded = decodeMaxiCode(encodeMaxiCode(bytes, { mode: 4 }));
    assert.deepEqual([...decoded.bytes], [...bytes]);
  }
});

test('root decoder falls back to global binarization for rendered MaxiCode', () => {
  const image = toImageData(encodeMaxiCode('BUNDLE SMOKE Ä', { mode: 4 }));
  for (const binarizer of ['auto', 'hybrid']) {
    const results = decode(image, { formats: ['maxicode'], binarizer });
    assert.equal(results.length, 1);
    assert.equal(results[0].text, 'BUNDLE SMOKE Ä');
  }
});

test('MaxiCode decoder handles inversion, 180-degree rotation and integer scaling', () => {
  const source = encodeMaxiCode('ORIENTATION CHECK', { mode: 4 });
  const rotated = source.clone();
  rotated.rotate180();
  assert.equal(decodeMaxiCode(rotated).text, 'ORIENTATION CHECK');
  assert.equal(decodeMaxiCode(invert(source), { inverted: true }).text, 'ORIENTATION CHECK');

  const scaled = new BitMatrix(source.width * 3, source.height * 3);
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (source.get(x, y)) scaled.setRegion(x * 3, y * 3, 3, 3);
    }
  }
  const detected = detectAndDecodeMaxiCode(scaled);
  assert.ok(detected);
  assert.equal(detected.text, 'ORIENTATION CHECK');
  assert.equal(detected.moduleSize, 3);
});

test('MaxiCode Reed-Solomon correction repairs isolated module damage', () => {
  const source = encodeMaxiCode('CORRECT ME', { mode: 4 });
  const damaged = source.clone();
  let flipped = 0;
  for (let y = 0; y < damaged.height && flipped < 3; y++) {
    for (let x = 0; x < damaged.width && flipped < 3; x++) {
      if (MAXICODE_GRID[y * damaged.width + x] > 0) {
        damaged.flip(x, y);
        flipped++;
      }
    }
  }
  assert.equal(decodeMaxiCode(damaged).text, 'CORRECT ME');
});

test('MaxiCode rejects malformed dimensions and structural noise', () => {
  assert.throws(() => decodeMaxiCode(new BitMatrix(30, 32)), /expected a 30x33/);
  assert.equal(detectAndDecodeMaxiCode(new BitMatrix(30, 33)), null);

  const source = encodeMaxiCode('STRUCTURE', { mode: 4 });
  source.flip(28, 0);
  assert.throws(() => decodeMaxiCode(source), /finder|structure|validation/i);
});
