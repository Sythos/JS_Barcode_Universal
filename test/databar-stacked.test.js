import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BitMatrix } from '../src/js/core/bit-matrix.js';
import { ChecksumError, FormatError } from '../src/js/core/errors.js';
import {
  decodeDataBar14Stacked,
  detectAndDecodeDataBar14Stacked,
  detectDataBar14Stacked,
  encodeDataBar14Stacked,
} from '../src/js/databar/stacked.js';

const GTIN = '00012345678905';

function rotateClockwise(source) {
  const output = new BitMatrix(source.height, source.width);
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (source.get(x, y)) output.set(source.height - 1 - y, x);
    }
  }
  return output;
}

test('GS1 DataBar Stacked encodes the canonical two-row geometry', () => {
  const matrix = encodeDataBar14Stacked(GTIN);
  assert.equal(matrix.width, 50);
  assert.equal(matrix.height, 13);
  assert.equal(matrix.databar.variant, 'stacked');
  assert.equal(matrix.databar.rows, 2);
  assert.equal(matrix.databar.checksum, 38);
  assert.deepEqual(decodeDataBar14Stacked(matrix).text, GTIN);
});

test('GS1 DataBar Stacked preserves linkage and supports an integer raster scale', () => {
  const matrix = encodeDataBar14Stacked(GTIN, { linkage: true, moduleScale: 2 });
  assert.equal(matrix.width, 100);
  assert.equal(matrix.height, 26);
  const decoded = decodeDataBar14Stacked(matrix);
  assert.equal(decoded.gtin, GTIN);
  assert.equal(decoded.linkage, true);
  assert.equal(decoded.moduleScale, 2);
  assert.equal(decoded.topHeight, 10);
  assert.equal(decoded.separatorHeight, 2);
  assert.equal(decoded.bottomHeight, 14);
});

test('GS1 DataBar Stacked accepts valid explicit row heights', () => {
  const matrix = encodeDataBar14Stacked(GTIN, {
    topHeight: 6,
    separatorHeight: 2,
    bottomHeight: 8,
  });
  assert.equal(matrix.height, 16);
  assert.equal(decodeDataBar14Stacked(matrix).text, GTIN);
});

test('GS1 DataBar Stacked rejects non-GTIN-14 values and bad geometry', () => {
  assert.throws(() => encodeDataBar14Stacked('12345670'), RangeError);
  assert.throws(() => encodeDataBar14Stacked('00012345678906'), RangeError);
  assert.throws(() => encodeDataBar14Stacked(GTIN, { topHeight: 4 }), /normative minima/);
  assert.throws(() => decodeDataBar14Stacked(new BitMatrix(96, 33)), FormatError);
});

test('GS1 DataBar Stacked rejects separator and checksum damage', () => {
  const separatorDamage = encodeDataBar14Stacked(GTIN);
  separatorDamage.flip(10, 6);
  assert.throws(() => decodeDataBar14Stacked(separatorDamage), FormatError);

  const checksumDamage = encodeDataBar14Stacked(GTIN);
  for (let y = 0; y < 5; y++) checksumDamage.flip(16, y);
  assert.throws(
    () => decodeDataBar14Stacked(checksumDamage),
    (error) => error instanceof ChecksumError || error instanceof FormatError,
  );
});

test('GS1 DataBar Stacked detector finds quiet-zoned scaled symbols in all quarter turns', () => {
  let image = encodeDataBar14Stacked(GTIN).withMargin(2).scale(2);
  for (let turn = 0; turn < 4; turn++) {
    const detection = detectDataBar14Stacked(image);
    assert.ok(detection);
    assert.equal(detection.text, GTIN);
    assert.equal(detection.moduleSize, 2);
    assert.equal(detectAndDecodeDataBar14Stacked(image).gtin, GTIN);
    image = rotateClockwise(image);
  }
});
