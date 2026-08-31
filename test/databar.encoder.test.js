import assert from 'node:assert/strict';
import test from 'node:test';

import { encodeDataBar14 } from '../src/js/databar/encoder.js';
import { decodeDataBar14 } from '../src/js/databar/decoder.js';

function rowHex(matrix) {
  let bits = '';
  for (let x = 0; x < matrix.width; x++) bits += matrix.get(x, 0) ? '1' : '0';
  return bits.match(/.{1,8}/g).map((byte) =>
    Number.parseInt(byte.padEnd(8, '0'), 2).toString(16).padStart(2, '0').toUpperCase()
  ).join(' ');
}

const ZINT_2_16_0_BLACK_BOX_VECTORS = [
  ['00012345678905', '54 80 4F E1 72 DE E5 61 7F 1C CF 75'],
  ['00034567890125', '54 80 4F 81 4E 66 DD D1 60 1C 2C 8D'],
  ['20012345678909', '51 D0 4F E1 4D BE C1 29 60 1C 6D 8D'],
  ['09506000134352', '41 41 5C 01 6B 7C CD 89 7C 1C EF 4D'],
];

test('DataBar Omnidirectional matches independent Zint black-box vectors bit-for-bit', () => {
  for (const [gtin, expected] of ZINT_2_16_0_BLACK_BOX_VECTORS) {
    const matrix = encodeDataBar14(gtin);
    assert.equal(matrix.width, 96);
    assert.equal(matrix.height, 33);
    assert.equal(rowHex(matrix), expected, gtin);
  }
});

test('DataBar Truncated preserves the 96-module pattern at its normative height', () => {
  const omnidirectional = encodeDataBar14('00012345678905');
  const truncated = encodeDataBar14('00012345678905', { variant: 'truncated' });
  assert.equal(truncated.width, 96);
  assert.equal(truncated.height, 13);
  assert.equal(rowHex(truncated), rowHex(omnidirectional));
});

test('DataBar-14 clean decoder reverses every qualified black-box vector', () => {
  for (const [gtin] of ZINT_2_16_0_BLACK_BOX_VECTORS) {
    const decoded = decodeDataBar14(encodeDataBar14(gtin));
    assert.equal(decoded.gtin, gtin);
    assert.equal(decoded.symbologyIdentifier, ']e0');
  }
});

test('DataBar-14 encoder enforces normative minimum heights and supported physical variants', () => {
  assert.throws(() => encodeDataBar14('00012345678905', { height: 32 }), /normative minimum/);
  assert.throws(() => encodeDataBar14('00012345678905', { variant: 'truncated', height: 12 }), /normative minimum/);
  assert.throws(() => encodeDataBar14('00012345678905', { variant: 'limited' }), /currently supports/);
});
