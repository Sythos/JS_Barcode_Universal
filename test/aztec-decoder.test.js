/*!
 * Sythos Barcode Suite — tests
 *
 * MIT License
 *
 * Copyright (c) 2026 Sythos
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * SPDX-License-Identifier: MIT
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeAztec } from '../src/js/aztec/encoder.js';
import { decodeAztec, decodeHighLevelBits } from '../src/js/aztec/decoder.js';

function bits(value, width) {
  return Array.from({ length: width }, (_, i) => ((value >>> (width - i - 1)) & 1) !== 0);
}

test('Aztec high-level decoder reads UPPER, latches and punctuation shifts', () => {
  // UPPER A, latch LOWER, b, then a one-token shift to PUNCT (!).
  const stream = [
    ...bits(2, 5),   // A
    ...bits(28, 5),  // CTRL_LL
    ...bits(3, 5),   // b
    ...bits(0, 5),   // LOWER CTRL_PS
    ...bits(6, 5),   // PUNCT !
  ];
  assert.equal(new TextDecoder().decode(decodeHighLevelBits(stream)), 'Ab!');
});

test('Aztec high-level decoder preserves Binary Shift bytes and FNC1', () => {
  const stream = [
    ...bits(31, 5), // UPPER CTRL_BS
    ...bits(2, 5),
    ...bits(0x7e, 8), ...bits(0xff, 8),
    ...bits(0, 5),  // UPPER CTRL_PS
    ...bits(0, 5),  // PUNCT FLG(n)
    ...bits(0, 3),  // FNC1
  ];
  assert.deepEqual([...decodeHighLevelBits(stream)], [0x7e, 0xff, 0x1d]);
});

test('Aztec matrix decoder round-trips Compact and Full symbols', () => {
  const cases = [
    ['HELLO', {}],
    ['lower / punctuation!', { compact: true, layers: 3 }],
    ['Full symbol: UTF-8 €', { compact: false, layers: 3 }],
  ];
  for (const [value, options] of cases) {
    const matrix = encodeAztec(value, options);
    const decoded = decodeAztec(matrix);
    assert.equal(decoded.text, value);
    assert.equal(decoded.compact, matrix.compact);
    assert.equal(decoded.layers, matrix.layers);
    assert.equal(decoded.corrections, 0);
  }
});

test('Aztec matrix decoder repairs a damaged Compact data codeword', () => {
  const matrix = encodeAztec('HELLO');
  const damaged = matrix.clone();
  // A payload module in the outer ring (not the mode message or bulls-eye).
  damaged.flip(0, 1);
  const decoded = decodeAztec(damaged);
  assert.equal(decoded.text, 'HELLO');
  assert.equal(decoded.corrections, 1);
});
