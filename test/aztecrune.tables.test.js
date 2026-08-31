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
  AZTEC_RUNE_DATA_POSITIONS,
  AZTEC_RUNE_SIZE,
  buildAztecRuneStructure,
  isAztecRuneDataPosition,
  validateAztecRuneTables,
} from '../src/js/aztecrune/tables.js';

test('Aztec Rune tables expose the fixed 11x11 geometry', () => {
  assert.deepEqual(validateAztecRuneTables(), []);
  assert.equal(AZTEC_RUNE_SIZE, 11);
  assert.equal(AZTEC_RUNE_DATA_POSITIONS.length, 28);
  assert.equal(new Set(AZTEC_RUNE_DATA_POSITIONS.map(([x, y]) => `${x},${y}`)).size, 28);
  assert.equal(AZTEC_RUNE_DATA_POSITIONS[0].join(','), '2,0');
  assert.equal(AZTEC_RUNE_DATA_POSITIONS.at(-1).join(','), '0,2');
});

test('Aztec Rune tables keep data and structural coordinates disjoint', () => {
  const structure = buildAztecRuneStructure();
  let fixed = 0;
  for (let y = 0; y < AZTEC_RUNE_SIZE; y++) for (let x = 0; x < AZTEC_RUNE_SIZE; x++) {
    if (isAztecRuneDataPosition(x, y)) continue;
    fixed++;
    assert.equal(typeof structure.get(x, y), 'boolean');
  }
  assert.equal(fixed, 121 - 28);
});

