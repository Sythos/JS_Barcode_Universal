import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BitMatrix } from '../src/js/core/bit-matrix.js';
import {
  DOTCODE_MAX_DIMENSION,
  DOTCODE_MIN_DIMENSION,
  detectAndDecodeDotCode,
  detectDotCode,
  dotCodeActivePositions,
  dotCodeCodewordCapacity,
  encodeDotCode,
  encodeDotCodeCodewords,
  validateDotCodeTables,
} from '../src/js/dotcode/index.js';
import { decodeDotCode } from '../src/js/dotcode/index.js';

function rotate(matrix, degrees) {
  if (degrees === 0) return matrix.clone();
  const output = degrees === 90 || degrees === 270
    ? new BitMatrix(matrix.height, matrix.width)
    : new BitMatrix(matrix.width, matrix.height);
  for (let y = 0; y < matrix.height; y++) {
    for (let x = 0; x < matrix.width; x++) {
      let nx = x;
      let ny = y;
      if (degrees === 90) {
        nx = matrix.height - 1 - y;
        ny = x;
      } else if (degrees === 180) {
        nx = matrix.width - 1 - x;
        ny = matrix.height - 1 - y;
      } else {
        nx = y;
        ny = matrix.width - 1 - x;
      }
      output.setValue(nx, ny, matrix.get(x, y));
    }
  }
  return output;
}

function invert(matrix) {
  const output = matrix.clone();
  for (let y = 0; y < output.height; y++) {
    for (let x = 0; x < output.width; x++) output.flip(x, y);
  }
  return output;
}

test('DotCode tables and geometry expose the bounded public profile', () => {
  assert.deepEqual(validateDotCodeTables(), []);
  assert.equal(DOTCODE_MIN_DIMENSION, 5);
  assert.equal(DOTCODE_MAX_DIMENSION, 200);
  const matrix = encodeDotCode('DOT-M12', { width: 23, height: 12, mask: 0 });
  assert.equal(matrix.width + matrix.height, 35);
  assert.equal(dotCodeActivePositions(matrix.width, matrix.height), 138);
  assert.ok(dotCodeCodewordCapacity(matrix.width, matrix.height) > 0);
  assert.deepEqual(matrix.dotcode && {
    format: matrix.dotcode.format,
    width: matrix.dotcode.width,
    height: matrix.dotcode.height,
    mask: matrix.dotcode.mask,
  }, { format: 'dotcode', width: 23, height: 12, mask: 0 });
});

test('DotCode writes and reads UTF-8, numeric, GS1 and binary payloads', () => {
  const payloads = [
    'HELLO123',
    'DOT-M12',
    '1234567890',
    'abc xyz',
    'line\nfeed\tend',
    'line\rfeed\r\nend',
    'éclair',
  ];
  for (const text of payloads) {
    for (const mask of [0, 1, 2, 3]) {
      const matrix = encodeDotCode(text, { mask });
      const result = decodeDotCode(matrix, { rotation: 0, inverted: false });
      assert.equal(result.format, 'dotcode');
      assert.equal(result.text, text);
      assert.equal(result.mask, mask);
      assert.ok(result.dataCodewords > 0);
    }
  }

  const gs1 = decodeDotCode(encodeDotCode('12345', { gs1: true, mask: 0 }), {
    rotation: 0,
    inverted: false,
  });
  assert.equal(gs1.text, '12345');
  assert.equal(gs1.gs1, true);

  const bytes = Uint8Array.from([0, 1, 2, 31, 32, 127, 128, 159, 160, 200, 254, 255]);
  for (const mask of [0, 1, 2, 3]) {
    const binary = decodeDotCode(encodeDotCode(bytes, { mask }), {
      rotation: 0,
      inverted: false,
    });
    assert.deepEqual(Array.from(binary.bytes), Array.from(bytes));
  }

  // Exercise a longer binary stream and the negative modulo edge of masks.
  const longBytes = Uint8Array.from({ length: 48 }, (_, index) => (index * 37 + 11) & 0xff);
  for (const mask of [2, 3]) {
    const binary = decodeDotCode(encodeDotCode(longBytes, { mask }), {
      rotation: 0,
      inverted: false,
    });
    assert.deepEqual(Array.from(binary.bytes), Array.from(longBytes));
  }
});

test('DotCode supports explicit data codewords and strict orientation/polarity decoding', () => {
  const fixture = encodeDotCodeCodewords(
    [106, 40, 37, 44, 44, 47, 106, 12, 106, 19],
    { width: 20, height: 21, mask: 0 },
  );
  assert.equal(decodeDotCode(fixture, { rotation: 0, inverted: false }).text, 'HELLO123');

  const source = encodeDotCode('ORIENTED DOTCODE', { width: 29, height: 30, mask: 2 });
  assert.equal(decodeDotCode(rotate(source, 90), { rotation: 'auto', inverted: false }).text, 'ORIENTED DOTCODE');
  assert.equal(decodeDotCode(rotate(source, 180), { rotation: 'auto', inverted: false }).text, 'ORIENTED DOTCODE');
  assert.equal(decodeDotCode(invert(source), { rotation: 0, inverted: true }).text, 'ORIENTED DOTCODE');
});

test('DotCode detector accepts clean integer scale, margin and inverted input', () => {
  const source = encodeDotCode('DETECT DOTCODE', { width: 29, height: 30, mask: 1 });
  const raster = source.withMargin(3).scale(2);
  const detections = detectAndDecodeDotCode(raster, { moduleSize: 2, inverted: false });
  assert.equal(detections.length, 1);
  assert.equal(detections[0].text, 'DETECT DOTCODE');
  assert.equal(detections[0].moduleSize, 2);

  const invertedRaster = invert(raster);
  const invertedDetections = detectAndDecodeDotCode(invertedRaster, { moduleSize: 2, inverted: true });
  assert.equal(invertedDetections.length, 1);
  assert.equal(invertedDetections[0].text, 'DETECT DOTCODE');

  const rotated = detectAndDecodeDotCode(rotate(source, 90), { moduleSize: 1, inverted: false });
  assert.equal(rotated.length, 1);
  assert.equal(rotated[0].text, 'DETECT DOTCODE');
});

test('DotCode rejects malformed matrices and unsafe allocation requests', () => {
  const source = encodeDotCode('STRICT DOTCODE', { mask: 0 });
  const malformed = source.clone();
  // (1, 0) is an inactive checkerboard position for this symbol, never data.
  malformed.set(1, 0);
  assert.throws(
    () => decodeDotCode(malformed, { rotation: 0, inverted: false }),
    /DotCode: inactive alternating position is dark/,
  );
  assert.deepEqual(detectAndDecodeDotCode(malformed, { moduleSize: 1, inverted: false }), []);

  assert.throws(() => encodeDotCode(''), /non-empty/);
  assert.throws(() => encodeDotCode([256]), /0 to 255/);
  assert.throws(() => encodeDotCodeCodewords([113]), /0\.\.112/);
  assert.throws(() => decodeDotCode(new BitMatrix(4, 5)), /dimensions/);
  assert.throws(() => detectDotCode({
    width: 4097,
    height: 4097,
    get: () => false,
  }), /at most 16777216 pixels/);
});
