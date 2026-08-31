import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BitMatrix } from '../src/js/core/bit-matrix.js';
import { decode, encode, toImageData } from '../src/index.js';
import {
  CODE16K_MAX_ROWS,
  CODE16K_MIN_ROWS,
  CODE16K_ROW_PAIRS,
  decodeCode16K,
  detectAndDecodeCode16K,
  encodeCode16K,
  validateCode16KTables,
} from '../src/js/code16k/index.js';

test('Code 16K tables identify every legal row and preserve the 70-module width', () => {
  assert.deepEqual(validateCode16KTables(), []);
  assert.equal(CODE16K_ROW_PAIRS.length, CODE16K_MAX_ROWS);
  assert.equal(CODE16K_MIN_ROWS, 2);
  for (const pair of CODE16K_ROW_PAIRS) assert.equal(pair.length, 2);
  for (let row = 0; row < CODE16K_MAX_ROWS; row++) {
    const matrix = encodeCode16K(`ROW-${row + 1}`, { rows: CODE16K_MAX_ROWS });
    assert.equal(matrix.width, 70);
  }
});

test('Code 16K round-trips text, numeric compression and explicit row height', () => {
  const cases = [
    ['Hello Code 16K', {}],
    ['123456789012345678901234567890', { rows: 4, rowHeight: 5, separatorHeight: 2 }],
    ['Control\tValue', { mode: 'B', rows: 4 }],
    ['A\u0001Z', { mode: 'A', rows: 3 }],
  ];
  for (const [text, options] of cases) {
    const matrix = encodeCode16K(text, options);
    const result = decodeCode16K(matrix);
    assert.equal(result.format, 'code16k');
    assert.equal(result.text, text);
    assert.equal(result.checksum, true);
    assert.equal(result.columns, 5);
    const detected = detectAndDecodeCode16K(matrix);
    assert.ok(detected);
    assert.equal(detected.text, text);
    assert.equal(detected.moduleSize, 1);
  }
});

test('Code 16K public image API handles integer scaling and aliases', () => {
  const matrix = encode('PUBLIC CODE16K', { format: 'code16k' });
  const image = toImageData(matrix, { scale: 2, margin: 10 });
  const result = decode(image, { formats: ['code16k'], binarizer: 'global' });
  assert.equal(result.length, 1);
  assert.equal(result[0].format, 'code16k');
  assert.equal(result[0].text, 'PUBLIC CODE16K');

  const subpath = encodeCode16K('SUBPATH');
  assert.equal(decodeCode16K(subpath).text, 'SUBPATH');
});

test('Code 16K rejects damaged rows, bad checks and unsafe input', () => {
  const matrix = encodeCode16K('CHECKED DATA');
  const damaged = matrix.clone();
  damaged.flip(12, 4);
  assert.throws(() => decodeCode16K(damaged), /Code 16K/);
  assert.equal(detectAndDecodeCode16K(damaged), null);

  assert.throws(() => encodeCode16K('é'), /seven-bit ASCII/);
  assert.throws(() => encodeCode16K(new Uint8Array([0, 128])), /values from 0 to 127/);
  assert.throws(() => encodeCode16K('A'.repeat(200)), /between 2 and 16 rows|does not fit/);
  assert.throws(() => encodeCode16K('A', { rows: 1 }), /rows must be an integer in 2..16/);
  assert.throws(() => encodeCode16K('A', { mode: 5 }), /shift encoder/);
});

test('Code 16K detector rejects unrelated and incomplete matrices', () => {
  assert.equal(detectAndDecodeCode16K(new BitMatrix(70, 20)), null);
  const source = encodeCode16K('STRUCTURE');
  const cropped = new BitMatrix(source.width - 1, source.height);
  for (let y = 0; y < cropped.height; y++) {
    for (let x = 0; x < cropped.width; x++) if (source.get(x, y)) cropped.set(x, y);
  }
  assert.equal(detectAndDecodeCode16K(cropped), null);
});
