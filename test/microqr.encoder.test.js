import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeMicroQR } from '../src/js/microqr/encoder.js';

function compact(matrix) {
  return Array.from({ length: matrix.height }, (_, y) =>
    Array.from({ length: matrix.width }, (_, x) => matrix.get(x, y) ? '1' : '0').join('')
  ).join('/');
}

// Independent black-box fixtures produced by Segno 1.6.6 with explicit
// version, error level, mode and mask. They are test evidence, not runtime code.
const fixtures = [
  [
    '1', { version: 1, ecc: 'DETECT', mode: 'numeric', mask: 1 },
    '11111110101/10000010000/10111010111/10111010011/10111010000/10000010100/11111110111/00000000110/11000001000/00111100001/10011100111',
  ],
  [
    '01234567', { version: 2, ecc: 'L', mode: 'numeric', mask: 1 },
    '1111111010101/1000001011101/1011101001101/1011101001111/1011101011100/1000001010001/1111111001111/0000000001100/1101000010001/0110101010101/1110011111110/0001010000110/1110100110111',
  ],
  [
    'HELLO', { version: 3, ecc: 'L', mode: 'alphanumeric', mask: 1 },
    '111111101010101/100000101001110/101110101111110/101110101111000/101110101000100/100000100000100/111111100111001/000000001111010/111100110000101/000001110000111/100000101111001/000010010111010/100001010000101/010000110000101/111001111111010',
  ],
  [
    'ABC', { version: 4, ecc: 'Q', mode: 'alphanumeric', mask: 1 },
    '11111110101010101/10000010010011100/10111010001100011/10111010111000011/10111010011111100/10000010100000001/11111110011100101/00000000100101110/10110001111111101/01101011100011110/11101110100011010/00001100110110000/10001100010100100/01011101101110011/11100100100100111/00001101000001110/10011000111011100',
  ],
  [
    '漢', { version: 3, ecc: 'L', mode: 'kanji', mask: 2 },
    '111111101010101/100000100000111/101110101110110/101110101010101/101110100101101/100000101011100/111111100111100/000000000000100/111111000110101/000001001010101/111001001101110/011001001011110/101111010111110/001110101000111/101001101110101',
  ],
];

test('Micro QR encoder matches independent M1-M4 black-box matrices', () => {
  for (const [text, options, expected] of fixtures) {
    assert.equal(compact(encodeMicroQR(text, options)), expected, `${text} ${JSON.stringify(options)}`);
  }
});

test('Micro QR encoder rejects unsupported features and invalid capacity', () => {
  assert.throws(() => encodeMicroQR('€', { mode: 'byte' }), /ISO-8859-1/);
  assert.throws(() => encodeMicroQR('1', { eci: 26 }), /ECI/);
  assert.throws(() => encodeMicroQR('1', { gs1: true }), /GS1/);
  assert.throws(() => encodeMicroQR('123456', { version: 1 }), /does not fit/);
});
