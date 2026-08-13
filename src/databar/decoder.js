/*!
 * Sythos Barcode Suite
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
 *
 * Original work. No code from any other barcode implementation.
 */

/** Clean-matrix decoder for GS1 DataBar Omnidirectional and Truncated. @module databar/decoder */

import { ChecksumError, FormatError } from '../core/errors.js';
import { decodeDataBar14GTIN } from './codec.js';
import {
  DATABAR14_CHECKSUM_WEIGHTS,
  DATABAR14_FINDERS,
  dataBar14ValueForWidths,
} from './patterns.js';

function sampledRuns(matrix) {
  if (!matrix || !Number.isInteger(matrix.width) || !Number.isInteger(matrix.height)) {
    throw new TypeError('GS1 DataBar decoder expects a BitMatrix-like value');
  }
  if (matrix.width % 96 !== 0) throw new FormatError('GS1 DataBar-14 matrix width must be an integer multiple of 96 modules');
  const scale = matrix.width / 96;
  const y = Math.floor(matrix.height / 2);
  const bits = Array.from({ length: 96 }, (_, x) => matrix.get(x * scale + Math.floor(scale / 2), y));
  if (bits[0] || !bits[95]) throw new FormatError('GS1 DataBar-14 guard pattern is invalid');
  const runs = [];
  let current = bits[0];
  let length = 0;
  for (const bit of bits) {
    if (bit === current) length++;
    else {
      runs.push(length);
      current = bit;
      length = 1;
    }
  }
  runs.push(length);
  if (runs.length !== 46 || runs[0] !== 1 || runs[1] !== 1 || runs[44] !== 1 || runs[45] !== 1) {
    throw new FormatError('GS1 DataBar-14 element count or guard widths are invalid');
  }
  return runs;
}

function finderIndex(widths) {
  const key = widths.join(',');
  return DATABAR14_FINDERS.findIndex((candidate) => candidate.join(',') === key);
}

function expectedChecksum(widths) {
  const offsets = [0, 8, 24, 16];
  let checksum = 0;
  for (let character = 0; character < 4; character++) {
    for (let element = 0; element < 8; element++) {
      checksum += widths[character][element] * DATABAR14_CHECKSUM_WEIGHTS[offsets[character] + element];
    }
  }
  checksum %= 79;
  if (checksum >= 8) checksum++;
  if (checksum >= 72) checksum++;
  return checksum;
}

/** Decode a clean or integer-scaled 96-module DataBar-14 matrix. */
export function decodeDataBar14(matrix) {
  const runs = sampledRuns(matrix);
  const widths = [
    runs.slice(2, 10),
    runs.slice(15, 23).slice().reverse(),
    runs.slice(23, 31),
    runs.slice(36, 44).slice().reverse(),
  ];
  const leftFinder = finderIndex(runs.slice(10, 15));
  const rightFinder = finderIndex(runs.slice(31, 36).slice().reverse());
  if (leftFinder < 0 || rightFinder < 0) throw new FormatError('GS1 DataBar-14 finder pattern is invalid');
  const encodedChecksum = leftFinder * 9 + rightFinder;
  if (encodedChecksum !== expectedChecksum(widths)) throw new ChecksumError('GS1 DataBar-14 checksum mismatch');

  const outerLeft = dataBar14ValueForWidths(widths[0], 'outside');
  const innerLeft = dataBar14ValueForWidths(widths[1], 'inside');
  const innerRight = dataBar14ValueForWidths(widths[2], 'inside');
  const outerRight = dataBar14ValueForWidths(widths[3], 'outside');
  const decoded = decodeDataBar14GTIN({ outerLeft, innerLeft, outerRight, innerRight });
  return Object.freeze({
    format: 'databar-omnidirectional',
    text: decoded.gtin,
    gtin: decoded.gtin,
    linkage: decoded.linkage,
    symbologyIdentifier: ']e0',
  });
}
