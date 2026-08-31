import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  decode,
  decodeCodablockF,
  detectAndDecodeCodablockF,
  encode,
  encodeCodablockF,
  listFormats,
  toImageData,
} from '../src/index.js';
import { BitMatrix } from '../src/js/core/bit-matrix.js';

test('Codablock-F writes and reads a stacked Code 128 payload', () => {
  const matrix = encodeCodablockF('CODEBLOCK-F / SYTHOS 12345', {
    rows: 3,
    columns: 12,
    rowHeight: 4,
  });
  assert.equal(matrix.height, 2 + 3 * 4 + 2);
  const result = decodeCodablockF(matrix);
  assert.equal(result.format, 'codablockf');
  assert.equal(result.text, 'CODEBLOCK-F / SYTHOS 12345');
  assert.equal(result.rows, 3);
  assert.equal(result.columns, 12);
  assert.equal(result.checksum, true);
});

test('Codablock-F detector and root image path preserve geometry checks', () => {
  const matrix = encodeCodablockF('STACKED DETECTOR', { rows: 2, columns: 10 });
  const detected = detectAndDecodeCodablockF(matrix);
  assert.ok(detected);
  assert.equal(detected.text, 'STACKED DETECTOR');
  assert.equal(detected.rows, 2);

  const image = toImageData(matrix.scale(2).withMargin(10));
  const root = decode(image, { formats: ['codablockf'] });
  assert.equal(root.length, 1);
  assert.equal(root[0].format, 'codablockf');
  assert.equal(root[0].text, 'STACKED DETECTOR');
});

test('Codablock-F rejects damaged rows and invalid dimensions', () => {
  const damaged = encodeCodablockF('DO NOT ACCEPT DAMAGE', { rows: 2, columns: 12 });
  damaged.flip(Math.floor(damaged.width / 2), 2);
  assert.throws(() => decodeCodablockF(damaged), /invalid|checks|framing/i);
  assert.throws(() => encodeCodablockF('x', { rows: 1 }), /rows/);
  assert.throws(() => encodeCodablockF('x', { columns: 3 }), /columns/);
  assert.equal(detectAndDecodeCodablockF(new BitMatrix(90, 20)), null);
});

test('Codablock-F is exposed by the registry and top-level dispatcher', () => {
  const entry = listFormats().find((format) => format.id === 'codablockf');
  assert.deepEqual(entry && { canWrite: entry.canWrite, canRead: entry.canRead }, {
    canWrite: true,
    canRead: true,
  });
  const matrix = encode('TOP LEVEL CODEBLOCK', { format: 'codablock-f', rows: 2, columns: 12 });
  assert.equal(decodeCodablockF(matrix).text, 'TOP LEVEL CODEBLOCK');
});
