import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BitMatrix } from '../src/js/core/bit-matrix.js';
import {
  decodeDataBarLimited,
  detectDataBarLimited,
  encodeDataBarLimited,
} from '../src/js/databar/limited.js';

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

function assertCanonicalCorners(corners) {
  const [topLeft, topRight, bottomRight, bottomLeft] = corners;
  assert.equal(topLeft.y, topRight.y);
  assert.equal(bottomLeft.y, bottomRight.y);
  assert.equal(topLeft.x, bottomLeft.x);
  assert.equal(topRight.x, bottomRight.x);
  assert.ok(topLeft.x < topRight.x && topLeft.y < bottomLeft.y);
}

test('GS1 DataBar Limited preserves standard geometry and linkage', () => {
  const matrix = encodeDataBarLimited(GTIN, { linkage: true, moduleScale: 2 });
  assert.equal(matrix.width, 158);
  assert.equal(matrix.height, 20);
  assert.equal(matrix.databar.modules, 79);
  assert.equal(matrix.databar.variant, 'limited');

  const decoded = decodeDataBarLimited(matrix);
  assert.equal(decoded.gtin, GTIN);
  assert.equal(decoded.linkage, true);
  assert.equal(decoded.moduleScale, 2);
});

test('GS1 DataBar Limited detector keeps source corners canonical in quarter turns', () => {
  let image = encodeDataBarLimited(GTIN, { moduleScale: 2 }).withMargin(2);
  for (let turn = 0; turn < 4; turn++) {
    const detected = detectDataBarLimited(image);
    assert.ok(detected);
    assert.equal(detected.gtin, GTIN);
    assert.equal(detected.moduleSize, 2);
    assertCanonicalCorners(detected.corners);
    image = rotateClockwise(image);
  }
});

test('GS1 DataBar Limited rejects partial bars and detector-bound artifacts', () => {
  const partialBar = encodeDataBarLimited(GTIN).scale(2);
  partialBar.flip(2, 0);
  assert.throws(() => decodeDataBarLimited(partialBar), /rows are inconsistent/);
  assert.equal(detectDataBarLimited(partialBar.withMargin(2)), null);

  const artifact = encodeDataBarLimited(GTIN).withMargin(2).scale(2);
  artifact.set(6, 0);
  assert.equal(detectDataBarLimited(artifact), null);
});
