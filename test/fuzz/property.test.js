import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';

import {
  BitMatrix,
  decodeAztec,
  decodeCompactPDF417,
  decodeDataMatrix,
  decodeFrameQR,
  decodeMicroPDF417,
  decodeMicroQR,
  decodePDF417,
  decodeQR,
  decodeRMQR,
  encode,
} from '../../src/index.js';

const SAFE_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz -._/:';
const MICRO_SAFE_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Generate small printable payloads so the property run stays bounded while
 * still exercising the public routing and round-trip paths with varied data.
 *
 * @param {string} alphabet
 * @param {number} maxLength
 */
function payloads(alphabet, maxLength) {
  return fc.array(fc.constantFrom(...alphabet), { minLength: 1, maxLength })
    .map((characters) => characters.join(''));
}

/** @param {BitMatrix} matrix @param {string} format */
function assertMatrixInvariant(matrix, format) {
  assert.ok(matrix instanceof BitMatrix, `${format} must return a BitMatrix`);
  assert.ok(Number.isSafeInteger(matrix.width) && matrix.width > 0, `${format} width must be positive`);
  assert.ok(Number.isSafeInteger(matrix.height) && matrix.height > 0, `${format} height must be positive`);
  assert.ok(matrix.width <= 2048 && matrix.height <= 2048, `${format} dimensions must remain bounded`);
  assert.equal(matrix.bits.length, matrix.rowWords * matrix.height, `${format} storage must match its geometry`);
  assert.ok(matrix.bits.some((word) => word !== 0), `${format} must contain dark modules`);
}

const ROUND_TRIP_CASES = [
  ['qr', decodeQR, payloads(SAFE_ALPHABET, 12)],
  ['datamatrix', decodeDataMatrix, payloads(SAFE_ALPHABET, 12)],
  ['aztec', decodeAztec, payloads(SAFE_ALPHABET, 12)],
  ['pdf417', decodePDF417, payloads(SAFE_ALPHABET, 12)],
  ['compactpdf417', decodeCompactPDF417, payloads(SAFE_ALPHABET, 12)],
  ['micropdf417', decodeMicroPDF417, payloads(SAFE_ALPHABET, 12)],
  ['microqr', decodeMicroQR, payloads(MICRO_SAFE_ALPHABET, 12)],
  ['rmqr', decodeRMQR, payloads(SAFE_ALPHABET, 12)],
  ['frameqr', decodeFrameQR, payloads(SAFE_ALPHABET, 12)],
];

for (const [format, decode, arbitrary] of ROUND_TRIP_CASES) {
  test(`property-based ${format} encode/decode round trip`, () => {
    fc.assert(
      fc.property(arbitrary, (value) => {
        const matrix = encode(value, { format });
        assertMatrixInvariant(matrix, format);
        const result = decode(matrix);
        assert.equal(result.text, value, `${format} must preserve the generated payload`);
      }),
      {
        numRuns: 24,
        seed: 20260828,
        endOnFailure: true,
      },
    );
  });
}
