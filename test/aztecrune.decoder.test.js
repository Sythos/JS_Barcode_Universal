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
import { BitMatrix } from '../src/js/core/bit-matrix.js';
import { FormatError } from '../src/js/core/errors.js';
import { encodeAztec } from '../src/js/aztec/encoder.js';
import { encodeAztecRune } from '../src/js/aztecrune/encoder.js';
import { decodeAztecRune } from '../src/js/aztecrune/decoder.js';
import { AZTEC_RUNE_DATA_POSITIONS } from '../src/js/aztecrune/tables.js';

function rotateClockwise(source) {
  const out = new BitMatrix(source.height, source.width);
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    if (source.get(x, y)) out.set(source.height - 1 - y, x);
  }
  return out;
}

test('Aztec Rune decoder round-trips every byte value', () => {
  for (let value = 0; value <= 255; value++) {
    const decoded = decodeAztecRune(encodeAztecRune(value));
    assert.equal(decoded.value, value);
    assert.equal(decoded.text, String(value).padStart(3, '0'));
    assert.deepEqual([...decoded.bytes], [value]);
    assert.equal(decoded.corrections, 0);
  }
});

test('Aztec Rune decoder repairs two damaged codewords', () => {
  const damaged = encodeAztecRune(42).clone();
  damaged.flip(...AZTEC_RUNE_DATA_POSITIONS[0]);
  damaged.flip(...AZTEC_RUNE_DATA_POSITIONS[4]);
  const decoded = decodeAztecRune(damaged);
  assert.equal(decoded.value, 42);
  assert.equal(decoded.corrections, 2);
});

test('Aztec Rune decoder handles inversion and quarter turns', () => {
  let matrix = encodeAztecRune(123, { inverted: true });
  for (let turns = 0; turns < 4; turns++) {
    const decoded = decodeAztecRune(matrix);
    assert.equal(decoded.value, 123);
    assert.equal(decoded.inverted, true);
    assert.equal(decoded.rotation, turns * 90);
    matrix = rotateClockwise(matrix);
  }
});

test('Aztec Rune decoder rejects normal Aztec symbols and malformed geometry', () => {
  assert.throws(() => decodeAztecRune(new BitMatrix(10, 10)), FormatError);
  assert.throws(() => decodeAztecRune(encodeAztec('not a Rune')), FormatError);
  const malformed = encodeAztecRune(42).clone();
  malformed.flip(0, 0);
  assert.throws(() => decodeAztecRune(malformed), FormatError);
});

