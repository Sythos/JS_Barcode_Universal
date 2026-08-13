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

/** Compact PDF417 (truncated PDF417) encoder. @module compactpdf417/encoder */

import { BitMatrix } from '../core/bit-matrix.js';
import { EncodeError } from '../core/errors.js';
import { compactPdf417 } from '../pdf417/compaction.js';
import { pdf417ErrorCorrection, pdf417EccLength } from '../pdf417/error-correction.js';
import { pdf417PatternForCodeword } from '../pdf417/tables.js';
import {
  COMPACT_PDF417_START,
  compactPdf417Indicators,
  compactPdf417Width,
  validateCompactPdf417Options,
} from './tables.js';

function appendWidths(matrix, y, x, sequence, height) {
  let dark = true;
  for (const digit of sequence) {
    const width = digit.charCodeAt(0) - 48;
    if (!Number.isInteger(width) || width < 1 || width > 8) {
      throw new EncodeError('Compact PDF417: invalid module-width sequence');
    }
    if (dark) matrix.setRegion(x, y, width, height);
    x += width;
    dark = !dark;
  }
  return x;
}

function patternSequence(pattern) {
  return pattern.toString(2).padStart(17, '0').replace(/0+|1+/g, (run) => String(run.length));
}

function dimensions(needed, level, options, rowHeight) {
  const ecc = pdf417EccLength(level);
  let best = null;
  for (let rows = options.rows ?? 3; rows <= (options.rows ?? 90); rows++) {
    for (let columns = options.columns ?? 1; columns <= (options.columns ?? 30); columns++) {
      if (rows * columns > 928 || rows * columns - ecc < needed) continue;
      const ratio = compactPdf417Width(columns) / (rows * rowHeight);
      const score = (rows * columns - ecc - needed) * 10 +
        Math.abs(ratio - (options.aspectRatio ?? 3));
      if (!best || score < best.score) best = { rows, columns, score };
    }
  }
  if (!best) {
    throw new EncodeError(
      'Compact PDF417: payload does not fit the requested dimensions and error correction level'
    );
  }
  return best;
}

/**
 * Encode Compact PDF417.
 *
 * High-level Text/Byte/Numeric compaction is intentionally delegated to the
 * existing PDF417 compaction implementation. `compact` here describes only
 * the physical truncated layout: right row indicators are omitted and the
 * stop pattern is reduced to one dark module.
 *
 * @param {string|Uint8Array|number[]} value
 * @param {object} [options]
 * @returns {import('../core/bit-matrix.js').BitMatrix}
 */
export function encodeCompactPDF417(value, options = {}) {
  const rowHeight = validateCompactPdf417Options(options);
  const level = options.eccLevel ?? 2;
  if (!Number.isInteger(level) || level < 0 || level > 8) {
    throw new EncodeError('Compact PDF417: eccLevel must be an integer in 0..8');
  }

  const payload = compactPdf417(value, { compaction: options.compaction, charset: options.charset });
  const { rows, columns } = dimensions(payload.length + 1, level, options, rowHeight);
  const eccLength = pdf417EccLength(level);
  const dataLength = rows * columns - eccLength;
  const data = [dataLength, ...payload];
  while (data.length < dataLength) data.push(900);
  const codewords = data.concat(pdf417ErrorCorrection(data, level));

  const matrix = new BitMatrix(compactPdf417Width(columns), rows * rowHeight);
  for (let row = 0; row < rows; row++) {
    const y = row * rowHeight;
    const cluster = (row % 3) * 3;
    let x = appendWidths(matrix, y, 0, COMPACT_PDF417_START, rowHeight);
    const left = compactPdf417Indicators(row, rows, columns, level);
    x = appendWidths(matrix, y, x, patternSequence(pdf417PatternForCodeword(left, cluster)), rowHeight);
    for (let column = 0; column < columns; column++) {
      const codeword = codewords[row * columns + column];
      x = appendWidths(matrix, y, x,
        patternSequence(pdf417PatternForCodeword(codeword, cluster)), rowHeight);
    }
    // Compact PDF417 terminates every row with one dark module, not the normal
    // right indicator plus 18-module stop pattern.
    matrix.setRegion(x, y, 1, rowHeight);
    x++;
    if (x !== matrix.width) throw new EncodeError('Compact PDF417: internal row width mismatch');
  }

  matrix.compactPdf417 = {
    rows,
    columns,
    eccLevel: level,
    rowHeight,
    codewords,
    layout: 'compact',
  };
  return matrix;
}

export { dimensions as compactPdf417Dimensions };
