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
import { encodeAztecRune } from '../src/js/aztecrune/encoder.js';
import { detectAztecRune, detectAndDecodeAztecRune } from '../src/js/aztecrune/detector.js';

function rotateClockwise(source) {
  const out = new BitMatrix(source.height, source.width);
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    if (source.get(x, y)) out.set(source.height - 1 - y, x);
  }
  return out;
}

test('Aztec Rune detector reads a quiet-zone integer raster', () => {
  const symbol = encodeAztecRune(42).withMargin(4).scale(3);
  const found = detectAztecRune(symbol);
  assert.ok(found);
  assert.equal(found.result.value, 42);
  assert.equal(found.dimension, 11);
  assert.ok(Math.abs(found.moduleSize - 3) < 0.8);
  assert.equal(detectAndDecodeAztecRune(symbol).text, '042');
});

test('Aztec Rune detector reads inverted symbols and quarter turns', () => {
  let symbol = encodeAztecRune(123, { inverted: true }).withMargin(3).scale(2);
  for (let turns = 0; turns < 4; turns++) {
    const found = detectAndDecodeAztecRune(symbol);
    assert.ok(found, `${turns} quarter turns`);
    assert.equal(found.value, 123, `${turns} quarter turns value`);
    assert.equal(found.inverted, true, `${turns} quarter turns polarity`);
    assert.equal(found.rotation, turns * 90, `${turns} quarter turns rotation`);
    symbol = rotateClockwise(symbol);
  }
});

test('Aztec Rune detector rejects unrelated rasters', () => {
  const blank = new BitMatrix(100, 80);
  assert.equal(detectAztecRune(blank), null);
  assert.equal(detectAndDecodeAztecRune(blank), null);
  const stripes = new BitMatrix(100, 80);
  for (let x = 0; x < stripes.width; x += 7) stripes.setRegion(x, 0, 2, stripes.height);
  assert.equal(detectAndDecodeAztecRune(stripes), null);
});

