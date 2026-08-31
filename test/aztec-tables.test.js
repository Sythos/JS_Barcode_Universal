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
import {
  AZTEC_COMPACT_LAYERS,
  AZTEC_FULL_LAYERS,
  AZTEC_RS_GENERATOR_BASE,
  aztecSymbolSize,
  eccCodewordsFor,
  fieldForWordSize,
  selectAztecLayer,
  validateAztecTables,
  wordSizeForLayers,
} from '../src/js/aztec/tables.js';

test('Aztec layer tables expose ISO geometry and codeword capacities', () => {
  assert.equal(AZTEC_COMPACT_LAYERS.length, 4);
  assert.equal(AZTEC_FULL_LAYERS.length, 32);
  assert.deepEqual(
    AZTEC_COMPACT_LAYERS.map(({ totalBits, wordSize, totalCodewords, symbolSize }) => [totalBits, wordSize, totalCodewords, symbolSize]),
    [[104, 6, 17, 15], [240, 6, 40, 19], [408, 8, 51, 23], [608, 8, 76, 27]],
  );
  assert.equal(aztecSymbolSize(1), 19);
  assert.equal(aztecSymbolSize(4), 31);
  assert.equal(aztecSymbolSize(5), 37);
  assert.equal(aztecSymbolSize(32), 151);
  assert.equal(AZTEC_COMPACT_LAYERS[3].maxDataCodewords, 64);
  assert.deepEqual(validateAztecTables(), []);
});

test('Aztec fields and RS generator base match the data-word boundaries', () => {
  assert.deepEqual([1, 2, 3, 8, 9, 22, 23, 32].map(wordSizeForLayers), [6, 6, 8, 8, 10, 10, 12, 12]);
  assert.deepEqual([4, 6, 8, 10, 12].map((size) => fieldForWordSize(size).size), [16, 64, 256, 1024, 4096]);
  assert.equal(AZTEC_RS_GENERATOR_BASE, 1);
  assert.equal(eccCodewordsFor(10), 6);
});

test('Aztec symbol selection accounts for ECC and Compact word limit', () => {
  const compactTwo = selectAztecLayer(96);
  assert.equal(compactTwo.compact, true);
  assert.equal(compactTwo.layers, 2);
  assert.throws(() => selectAztecLayer(65 * 8, { compact: true, layers: 4 }), /do not fit/);
  assert.throws(() => selectAztecLayer(8, { layers: 1 }), /compact must be specified/);
});
