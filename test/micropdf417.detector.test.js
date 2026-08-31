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

import assert from 'node:assert/strict';
import test from 'node:test';
import { BitMatrix } from '../src/js/core/bit-matrix.js';
import { detectAndDecodeMicroPDF417, detectMicroPDF417 } from '../src/js/micropdf417/detector.js';
import { encodeMicroPDF417 } from '../src/js/micropdf417/encoder.js';

function rotateClockwise(source) {
  const out = new BitMatrix(source.height, source.width);
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    if (source.get(x, y)) out.set(source.height - 1 - y, x);
  }
  return out;
}

test('MicroPDF417 detector reads integer-scaled raster with a quiet zone', () => {
  const encoded = encodeMicroPDF417('MICRO DETECTOR', { variant: 17, rowHeight: 3 });
  const image = encoded.withMargin(5).scale(4);
  const found = detectMicroPDF417(image);
  assert.ok(found);
  assert.equal(found.text, 'MICRO DETECTOR');
  assert.equal(found.variant, 17);
  assert.equal(found.moduleSize, 4);
  assert.equal(found.rotation, 0);
  assert.equal(found.matrix.width, encoded.width);
  assert.equal(found.matrix.height, encoded.height);
});

test('MicroPDF417 detector retries all quarter-turns', () => {
  const encoded = encodeMicroPDF417('TURN', { variant: 17, rowHeight: 2 }).withMargin(4).scale(3);
  let image = encoded;
  // `rotation` describes the clockwise orientation of the supplied fixture,
  // rather than the opposite correction the reader applies internally.
  for (const expectedRotation of [0, 90, 180, 270]) {
    const found = detectAndDecodeMicroPDF417(image);
    assert.ok(found, `no detection at ${expectedRotation} degrees`);
    assert.equal(found.text, 'TURN');
    assert.equal(found.rotation, expectedRotation);
    image = rotateClockwise(image);
  }
});

test('MicroPDF417 detector rejects blank and non-MicroPDF417 rasters', () => {
  assert.equal(detectMicroPDF417(new BitMatrix(80, 30)), null);
  const noise = new BitMatrix(82, 20);
  noise.setRegion(0, 0, 82, 20);
  assert.equal(detectMicroPDF417(noise), null);
});
