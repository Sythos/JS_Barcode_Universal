import test from 'node:test';
import assert from 'node:assert/strict';
import { BitMatrix } from '../src/js/core/bit-matrix.js';
import { encodeRMQR } from '../src/js/rmqr/encoder.js';
import { decodeRMQR } from '../src/js/rmqr/decoder.js';
import { detectRMQR } from '../src/js/rmqr/detector.js';
import { RMQR_SIZES, validateTables, versionForSize } from '../src/js/rmqr/tables.js';

test('rMQR tables expose exactly the 32 standard geometries', () => {
  assert.equal(RMQR_SIZES.length, 32);
  assert.deepEqual(RMQR_SIZES[0], [43, 7]);
  assert.deepEqual(RMQR_SIZES.at(-1), [139, 17]);
  assert.deepEqual(validateTables(), []);
});

test('rMQR encoder and matrix decoder round-trip modes and ECC', () => {
  for (const [text, options] of [['123456789', { mode: 'numeric', version: 3 }], ['HELLO 123', { mode: 'alphanumeric', version: 4, ecc: 'H' }], ['Hello', { mode: 'byte', version: 2 }], ['é', { mode: 'byte', charset: 'utf-8', version: 1 }], ['あ', { mode: 'kanji', version: 1 }]]) {
    const matrix = encodeRMQR(text, options);
    const result = decodeRMQR(matrix);
    assert.equal(result.text, text);
    assert.equal(result.ecc, options.ecc || 'M');
  }
});

test('all standard geometries encode and decode a minimal payload when forced', () => {
  for (let i = 1; i <= 32; i++) {
    const v = versionForSize(...RMQR_SIZES[i - 1]);
    const matrix = encodeRMQR('A', { version: i });
    assert.equal(matrix.width, v.width, v.name);
    assert.equal(matrix.height, v.height, v.name);
    assert.equal(decodeRMQR(matrix).text, 'A', v.name);
    const high = encodeRMQR('A', { version: i, ecc: 'H' });
    assert.equal(decodeRMQR(high).text, 'A', `${v.name}-H`);
  }
});

test('rMQR detector handles quiet zones and integer scale', () => {
  const symbol = encodeRMQR('HELLO', { version: 2 });
  const raster = symbol.withMargin(4).scale(3);
  const found = detectRMQR(raster);
  assert.equal(found.result.text, 'HELLO');
  assert.equal(found.scale, 3);
});

test('rMQR detector handles quarter-turn orientation', () => {
  const symbol = encodeRMQR('TURN', { version: 2 });
  const rotated = new BitMatrix(symbol.height, symbol.width);
  for (let y = 0; y < symbol.height; y++) for (let x = 0; x < symbol.width; x++) if (symbol.get(x, y)) rotated.set(symbol.height - 1 - y, x);
  const found = detectRMQR(rotated.withMargin(4));
  assert.equal(found.result.text, 'TURN');
  assert.ok(found.rotation === 1 || found.rotation === 3);
});

test('rMQR detector rejects unrelated raster', () => {
  const blank = new BitMatrix(139, 17);
  assert.throws(() => detectRMQR(blank), /rMQR/);
});
