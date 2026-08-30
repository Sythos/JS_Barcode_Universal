import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BitMatrix } from '../src/js/core/bit-matrix.js';
import { FormatError } from '../src/js/core/errors.js';
import {
  decodeDataBarStackedOmnidirectional,
  detectDataBarStackedOmnidirectional,
  encodeDataBarStackedOmnidirectional,
} from '../src/js/databar/stacked-omnidirectional.js';

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

test('GS1 DataBar Stacked Omnidirectional round-trips the canonical symbol', () => {
  const matrix = encodeDataBarStackedOmnidirectional(GTIN);
  assert.equal(matrix.width, 50);
  assert.equal(matrix.height, 69);
  assert.equal(matrix.databar.variant, 'stacked-omnidirectional');
  assert.equal(matrix.databar.rowHeight, 33);

  const decoded = decodeDataBarStackedOmnidirectional(matrix);
  assert.equal(decoded.format, 'databar-stacked-omnidirectional');
  assert.equal(decoded.gtin, GTIN);
  assert.equal(decoded.linkage, false);
  assert.equal(decoded.checksumValid, true);
  assert.equal(decoded.rows, 2);
});

test('GS1 DataBar Stacked Omnidirectional preserves linkage and integer raster scaling', () => {
  const matrix = encodeDataBarStackedOmnidirectional(GTIN, {
    linkage: true,
    rowHeight: 40,
  }).scale(2);
  const decoded = decodeDataBarStackedOmnidirectional(matrix, { rowHeight: 40 });

  assert.equal(matrix.width, 100);
  assert.equal(matrix.height, 166);
  assert.equal(decoded.gtin, GTIN);
  assert.equal(decoded.linkage, true);
  assert.equal(decoded.rowHeight, 40);
});

test('GS1 DataBar Stacked Omnidirectional detector handles a quiet zone and quarter turns', () => {
  let image = encodeDataBarStackedOmnidirectional(GTIN).withMargin(2).scale(2);
  for (let turn = 0; turn < 4; turn++) {
    const detection = detectDataBarStackedOmnidirectional(image);
    assert.ok(detection);
    assert.equal(detection.gtin, GTIN);
    assert.equal(detection.moduleSize, 2);
    assert.equal(detection.quality.checksum, true);
    image = rotateClockwise(image);
  }
});

test('GS1 DataBar Stacked Omnidirectional rejects partial or inconsistent input', () => {
  const rowDamage = encodeDataBarStackedOmnidirectional(GTIN);
  rowDamage.flip(10, 0);
  assert.throws(
    () => decodeDataBarStackedOmnidirectional(rowDamage),
    FormatError,
  );

  const moduleDamage = encodeDataBarStackedOmnidirectional(GTIN).scale(2);
  moduleDamage.flip(10, 0);
  assert.throws(
    () => decodeDataBarStackedOmnidirectional(moduleDamage),
    FormatError,
  );

  const separatorDamage = encodeDataBarStackedOmnidirectional(GTIN);
  separatorDamage.flip(10, 33);
  assert.throws(
    () => decodeDataBarStackedOmnidirectional(separatorDamage),
    FormatError,
  );
  assert.equal(detectDataBarStackedOmnidirectional(separatorDamage), null);
});

test('GS1 DataBar Stacked Omnidirectional rejects unsafe geometry and options', () => {
  assert.throws(
    () => encodeDataBarStackedOmnidirectional(GTIN, { rowHeight: 32 }),
    /safe range/,
  );
  assert.throws(
    () => encodeDataBarStackedOmnidirectional(GTIN, { separatorModules: 1 }),
    /three-module separator/,
  );
  assert.throws(
    () => decodeDataBarStackedOmnidirectional(new BitMatrix(96, 69)),
    FormatError,
  );
});
