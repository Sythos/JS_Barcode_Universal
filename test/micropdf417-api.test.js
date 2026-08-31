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

import { decode, encode, listFormats } from '../src/index.js';
import { toImageData } from '../src/js/render/image-data.js';

test('MicroPDF417 public API encodes, renders and decodes a clean raster', () => {
  const input = 'MICRO PDF417 API';
  const symbol = encode(input, { format: 'micropdf417', compaction: 'text' });
  const image = toImageData(symbol, { scale: 4, margin: 4 });
  const [result] = decode(image, { formats: ['micropdf417'] });

  assert.equal(result.text, input);
  assert.equal(result.format, 'micropdf417');
  assert.equal(Number.isInteger(result.variant), true);
  assert.equal(listFormats().find((format) => format.id === 'micropdf417')?.canRead, true);
});
