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
 * SPDX-FileCopyrightText: 2026 Sythos (https://www.sythos.net)
 * SPDX-License-Identifier: MIT
 *
 * Original work. No code from any other barcode implementation.
 */

/** Compact PDF417 decoder. @module compactpdf417/decoder */

import { FormatError } from '../core/errors.js';
import { decodePdf417CompactionDetailed } from '../pdf417/compaction.js';
import { pdf417CorrectErrors, pdf417EccLength } from '../pdf417/error-correction.js';
import { pdf417CodewordForPattern } from '../pdf417/tables.js';
import {
  COMPACT_PDF417_START_BITS,
  compactPdf417Geometry,
  compactPdf417Indicators,
  compactPdf417MatchingLevels,
} from './tables.js';

function bits(matrix, y, x, width) {
  let value = 0;
  for (let index = 0; index < width; index++) value = (value << 1) | (matrix.get(x + index, y) ? 1 : 0);
  return value;
}

function patternString(matrix, y, x, width) {
  return bits(matrix, y, x, width).toString(2).padStart(width, '0');
}

/**
 * Decode a compact/truncated PDF417 module matrix.
 *
 * The high-level payload uses the normal PDF417 Text/Byte/Numeric compaction
 * rules. This function only changes the physical row parser: no right row
 * indicator is expected and the final module of each row must be dark.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 * @param {object} [options]
 * @param {number} [options.rowHeight]
 */
export function decodeCompactPDF417(matrix, options = {}) {
  if (!matrix?.width || !matrix?.height) throw new FormatError('Compact PDF417: no matrix supplied');
  const rowHeight = options.rowHeight ?? matrix.compactPdf417?.rowHeight ?? 3;
  let geometry;
  try { geometry = compactPdf417Geometry(matrix.width, matrix.height, rowHeight); }
  catch (error) { throw new FormatError(error.message); }

  const { rows, columns } = geometry;
  const all = [];
  const erasures = [];
  const leftIndicators = [];

  for (let row = 0; row < rows; row++) {
    const y = row * rowHeight;
    if (patternString(matrix, y, 0, 17) !== COMPACT_PDF417_START_BITS) {
      throw new FormatError('Compact PDF417: missing start pattern');
    }
    const cluster = (row % 3) * 3;
    const leftDecoded = pdf417CodewordForPattern(bits(matrix, y, 17, 17));
    if (!leftDecoded || leftDecoded.cluster !== cluster) {
      throw new FormatError('Compact PDF417: invalid left row indicator');
    }
    leftIndicators.push(leftDecoded.codeword);

    const dataStart = 34;
    const stopX = dataStart + columns * 17;
    if (!matrix.get(stopX, y)) throw new FormatError('Compact PDF417: missing reduced stop module');
    for (let column = 0; column < columns; column++) {
      const decoded = pdf417CodewordForPattern(bits(matrix, y, dataStart + column * 17, 17));
      if (!decoded || decoded.cluster !== cluster) {
        erasures.push(all.length);
        all.push(0);
      } else {
        all.push(decoded.codeword);
      }
    }
  }

  const levels = compactPdf417MatchingLevels(leftIndicators, rows, columns);
  if (levels.length !== 1) throw new FormatError('Compact PDF417: row indicator mismatch');
  const level = levels[0];
  const eccLength = pdf417EccLength(level);
  if (all.length <= eccLength) throw new FormatError('Compact PDF417: insufficient codewords for ECC');

  const corrected = all.slice();
  const corrections = pdf417CorrectErrors(corrected, level, erasures);
  const length = corrected[0];
  if (length < 1 || length > corrected.length - eccLength) {
    throw new FormatError('Compact PDF417: invalid symbol length descriptor');
  }
  const payload = corrected.slice(1, length);
  const decoded = decodePdf417CompactionDetailed(payload);
  return {
    ...decoded,
    format: 'compact-pdf417',
    compact: true,
    codewords: corrected,
    rows,
    columns,
    eccLevel: level,
    rowHeight,
    corrections,
  };
}
