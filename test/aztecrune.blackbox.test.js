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
import fixture from './fixtures/aztecrune-zxing-2026-08-13.json' with { type: 'json' };
import { BitMatrix } from '../src/js/core/bit-matrix.js';
import { encodeAztecRune } from '../src/js/aztecrune/encoder.js';
import { decodeAztecRune } from '../src/js/aztecrune/decoder.js';

function rowsOf(matrix) {
  return matrix.toString('1', '0').split('\n');
}

test('Aztec Rune black-box vectors match ZXing-C++ output without source reuse', () => {
  assert.equal(fixture.sourceCodeCopied, false);
  for (const vector of fixture.vectors) {
    const ours = encodeAztecRune(vector.value);
    assert.deepEqual(rowsOf(ours), vector.rows, `value ${vector.value}`);
    const sampled = BitMatrix.parse(vector.rows.join('\n'));
    const decoded = decodeAztecRune(sampled);
    assert.equal(decoded.text, vector.text);
    assert.equal(decoded.value, vector.value);
  }
});

