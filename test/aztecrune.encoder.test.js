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
import { EncodeError } from '../src/js/core/errors.js';
import { encodeAztecRune, normalizeAztecRuneValue } from '../src/js/aztecrune/encoder.js';

test('Aztec Rune encoder accepts numeric, decimal and one-byte binary input', () => {
  assert.equal(normalizeAztecRuneValue(42), 42);
  assert.equal(normalizeAztecRuneValue('042'), 42);
  assert.equal(normalizeAztecRuneValue(Uint8Array.of(42)), 42);
  for (const value of [0, 1, 42, 254, 255]) {
    const matrix = encodeAztecRune(value);
    assert.equal(matrix.width, 11);
    assert.equal(matrix.height, 11);
    assert.equal(matrix.format, 'aztecrune');
    assert.equal(matrix.value, value);
    assert.equal(matrix.inverted, false);
  }
});

test('Aztec Rune encoder supports the white-on-black option', () => {
  const normal = encodeAztecRune(42);
  const inverted = encodeAztecRune(42, { inverted: true });
  for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) {
    assert.equal(inverted.get(x, y), !normal.get(x, y));
  }
  assert.equal(inverted.inverted, true);
});

test('Aztec Rune encoder rejects values outside one byte', () => {
  for (const value of [-1, 256, 1.5, '256', 'x', Uint8Array.of(1, 2)]) {
    assert.throws(() => encodeAztecRune(value), EncodeError);
  }
  assert.throws(() => encodeAztecRune(1, { inverted: 'yes' }), EncodeError);
});

