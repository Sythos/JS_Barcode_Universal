import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BitMatrix } from '../src/js/core/bit-matrix.js';
import {
  decode,
  encode,
  toImageData,
} from '../src/index.js';
import {
  decodeDataBarExpanded,
  detectAndDecodeDataBarExpanded,
  detectDataBarExpanded,
  encodeDataBarExpanded,
} from '../src/js/databar/expanded.js';

const NUMERIC = '(01)09506000134352(17)260101';
const ALPHANUMERIC = '(01)09506000134352(10)ABC-123(17)260101';
const NUMERIC_RAW = '010950600013435217260101';
const ALPHANUMERIC_RAW = `010950600013435210ABC-123\x1d17260101`;
const BWIPP_METHOD_1_AI01_RUNS = Object.freeze([
  1, 1, 3, 2, 4, 1, 4, 1, 1, 1, 1, 8, 4, 1, 1, 3, 4, 3, 1, 2,
  2, 1, 1, 1, 1, 3, 6, 1, 2, 1, 2, 1, 1, 4, 6, 3, 1, 4, 3, 1,
  2, 1, 3, 2, 1, 2, 1, 1, 3, 2, 3, 4, 3, 6, 4, 1, 1, 1, 1,
]);
const BWIPP_METHOD_1_AI01_DATE_RUNS = Object.freeze([
  1, 1, 2, 2, 5, 3, 2, 1, 1, 1, 1, 8, 4, 1, 1, 3, 2, 1, 4, 1,
  1, 2, 3, 1, 1, 3, 6, 1, 2, 1, 2, 1, 1, 6, 4, 3, 1, 4, 3, 1,
  2, 1, 3, 2, 1, 2, 1, 1, 3, 2, 3, 4, 3, 6, 4, 1, 1, 2, 1, 1,
  5, 2, 2, 2, 2, 1, 1, 4, 1, 1, 1, 6, 2, 1, 1, 8, 2, 3, 3, 1,
  2, 3, 1, 2, 3, 2, 1, 1,
]);

function matrixFromRuns(runs, height = 34) {
  const matrix = new BitMatrix(runs.reduce((sum, width) => sum + width, 0), height);
  let x = 0;
  let dark = true;
  for (const width of runs) {
    if (dark) matrix.setRegion(x, 0, width, height);
    x += width;
    dark = !dark;
  }
  return matrix;
}

function rotateClockwise(source) {
  const output = new BitMatrix(source.height, source.width);
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (source.get(x, y)) output.set(source.height - 1 - y, x);
    }
  }
  return output;
}

test('GS1 DataBar Expanded round-trips numeric and general-purpose element strings', () => {
  const numeric = encodeDataBarExpanded(NUMERIC);
  const alphanumeric = encodeDataBarExpanded(ALPHANUMERIC);

  assert.equal(numeric.databar.variant, 'expanded');
  assert.equal(decodeDataBarExpanded(numeric).text, NUMERIC_RAW);
  assert.equal(decodeDataBarExpanded(alphanumeric).text, ALPHANUMERIC_RAW);
  assert.deepEqual(decodeDataBarExpanded(alphanumeric).elements, [
    { ai: '01', value: '09506000134352', fixed: true },
    { ai: '10', value: 'ABC-123', fixed: false },
    { ai: '17', value: '260101', fixed: true },
  ]);
  assert.ok(alphanumeric.width > numeric.width, 'payload length selects a wider linear geometry');
});

test('GS1 DataBar Expanded decodes BWIPP compressed method 1 AI(01) vectors', () => {
  const ai01 = decodeDataBarExpanded(matrixFromRuns(BWIPP_METHOD_1_AI01_RUNS));
  const ai01Date = decodeDataBarExpanded(matrixFromRuns(BWIPP_METHOD_1_AI01_DATE_RUNS));

  assert.equal(ai01.text, '0109506000134352');
  assert.deepEqual(ai01.elements, [{ ai: '01', value: '09506000134352', fixed: true }]);
  assert.equal(ai01Date.text, NUMERIC_RAW);
  assert.deepEqual(ai01Date.elements, [
    { ai: '01', value: '09506000134352', fixed: true },
    { ai: '17', value: '260101', fixed: true },
  ]);
});

test('GS1 DataBar Expanded keeps the long finder sequences aligned', () => {
  for (const length of [15, 17]) {
    const value = `(01)09506000134352(10)${'ABCDEFGHIJKLMNOPQRST'.slice(0, length)}(17)260101`;
    const symbol = encodeDataBarExpanded(value);
    assert.ok([18, 19].includes(symbol.databar.dataCharacters));
    assert.equal(decodeDataBarExpanded(symbol).text, `010950600013435210${'ABCDEFGHIJKLMNOPQRST'.slice(0, length)}\x1d17260101`);
  }
});

test('GS1 DataBar Expanded preserves linkage and integer physical scaling', () => {
  const matrix = encodeDataBarExpanded(ALPHANUMERIC, {
    linkage: true,
    moduleScale: 2,
    height: 68,
  });
  const decoded = decodeDataBarExpanded(matrix);

  assert.equal(matrix.databar.linkage, true);
  assert.equal(decoded.linkage, true);
  assert.equal(decoded.moduleScale, 2);
  assert.equal(decoded.height, 68);
  assert.equal(decoded.text, ALPHANUMERIC_RAW);
});

test('GS1 DataBar Expanded detector finds clean quiet-zoned symbols in quarter turns', () => {
  let image = encodeDataBarExpanded(ALPHANUMERIC, { moduleScale: 2 }).withMargin(2);
  for (let turn = 0; turn < 4; turn++) {
    const found = detectDataBarExpanded(image);
    assert.ok(found);
    assert.equal(found.text, ALPHANUMERIC_RAW);
    assert.equal(found.moduleSize, 2);
    assert.ok([0, 90, 180, 270].includes(found.rotation));
    image = rotateClockwise(image);
  }
});

test('GS1 DataBar Expanded rejects damaged, partial and detector-bound artwork', () => {
  const damaged = encodeDataBarExpanded(NUMERIC);
  damaged.flip(12, 0);
  assert.throws(() => decodeDataBarExpanded(damaged), /inconsistent|invalid|mismatch|run count/);

  const complete = encodeDataBarExpanded(NUMERIC);
  const partial = new BitMatrix(complete.width - 1, complete.height);
  for (let y = 0; y < partial.height; y++) {
    for (let x = 0; x < partial.width; x++) if (complete.get(x, y)) partial.set(x, y);
  }
  assert.throws(() => decodeDataBarExpanded(partial), /width|invalid|mismatch/);

  const artifact = encodeDataBarExpanded(NUMERIC).withMargin(2);
  artifact.set(0, 0);
  assert.equal(detectAndDecodeDataBarExpanded(artifact), null);
});

test('root encode/decode aliases expose GS1 DataBar Expanded', () => {
  const matrix = encode(ALPHANUMERIC, {
    format: 'gs1-databar-expanded',
    linkage: true,
    moduleScale: 2,
  });
  const results = decode(toImageData(matrix.withMargin(4)), {
    formats: ['databar-expanded'],
    binarizer: 'global',
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].format, 'gs1databar-expanded');
  assert.equal(results[0].text, ALPHANUMERIC_RAW);
  assert.equal(results[0].linkage, true);
});
