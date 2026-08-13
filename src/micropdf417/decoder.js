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

/**
 * Direct-module MicroPDF417 decoder.
 *
 * This module reads an already sampled, axis-aligned `BitMatrix`. Image finding,
 * perspective correction, and recognition from photographic pixels are deliberately
 * outside this first decoder boundary. The RAP sequence is authoritative for format
 * detection; matrix metadata is used only as an optional row-height hint.
 *
 * @module micropdf417/decoder
 */

import { FormatError } from '../core/errors.js';
import { decodePdf417CompactionDetailed } from '../pdf417/compaction.js';
import { pdf417CodewordForPattern } from '../pdf417/tables.js';
import { microPdf417CorrectErrors } from './error-correction.js';
import {
  MICROPDF417_VARIANTS,
  microPdf417RapSequence,
  microPdf417RowAddress,
  microPdf417VariantByNumber,
} from './tables.js';

function symbolWidth(columns) {
  return 21 + columns * 17 + (columns > 2 ? 10 : 0);
}

function bits(matrix, y, x, width) {
  let value = 0;
  for (let i = 0; i < width; i++) value = (value << 1) | (matrix.get(x + i, y) ? 1 : 0);
  return value;
}

function widthsToBits(widths) {
  let dark = true;
  let out = '';
  for (const digit of widths) {
    out += (dark ? '1' : '0').repeat(digit.charCodeAt(0) - 48);
    dark = !dark;
  }
  return out;
}

function hasExpectedBits(matrix, y, x, sequence) {
  const expected = widthsToBits(sequence);
  for (let i = 0; i < expected.length; i++) {
    if ((matrix.get(x + i, y) ? '1' : '0') !== expected[i]) return false;
  }
  return true;
}

function centralRapAfter(entry, column) {
  return (entry.columns === 3 && column === 0) ||
    (entry.columns === 4 && column === 1);
}

/** Return true when all address patterns for this format candidate agree. */
function hasValidRowAddresses(matrix, entry, rowHeight) {
  for (let row = 0; row < entry.rows; row++) {
    const y = row * rowHeight;
    const address = microPdf417RowAddress(entry, row);
    let x = 0;
    if (!hasExpectedBits(matrix, y, x, microPdf417RapSequence(address.left, 'side'))) return false;
    x += 10;
    for (let column = 0; column < entry.columns; column++) {
      x += 17;
      if (centralRapAfter(entry, column)) {
        if (address.center === null ||
            !hasExpectedBits(matrix, y, x, microPdf417RapSequence(address.center, 'center'))) return false;
        x += 10;
      }
    }
    if (!hasExpectedBits(matrix, y, x, microPdf417RapSequence(address.right, 'side'))) return false;
    x += 10;
    if (!matrix.get(x, y) || x + 1 !== matrix.width) return false;
  }
  return true;
}

function candidateFormats(matrix, options) {
  const metadataHeight = matrix.micropdf417?.rowHeight;
  const requestedHeight = options.rowHeight ?? metadataHeight;
  if (requestedHeight !== undefined && (!Number.isInteger(requestedHeight) || requestedHeight < 1)) {
    throw new FormatError('MicroPDF417: rowHeight must be a positive integer');
  }
  const requestedVariant = options.variant === undefined ? null : microPdf417VariantByNumber(options.variant);
  const pool = requestedVariant ? [requestedVariant] : MICROPDF417_VARIANTS;
  const candidates = [];
  for (const entry of pool) {
    if (matrix.width !== symbolWidth(entry.columns)) continue;
    if (matrix.height % entry.rows) continue;
    const rowHeight = matrix.height / entry.rows;
    if (requestedHeight !== undefined && rowHeight !== requestedHeight) continue;
    if (hasValidRowAddresses(matrix, entry, rowHeight)) candidates.push({ entry, rowHeight });
  }
  return candidates;
}

function resolveFormat(matrix, options) {
  if (!matrix?.width || !matrix?.height || typeof matrix.get !== 'function') {
    throw new FormatError('MicroPDF417: matrix with width, height and get() is required');
  }
  const candidates = candidateFormats(matrix, options);
  if (!candidates.length) throw new FormatError('MicroPDF417: no variant matches matrix geometry and row-address patterns');
  if (candidates.length > 1) throw new FormatError('MicroPDF417: row-address patterns do not identify a unique variant');
  return candidates[0];
}

function readCodewords(matrix, entry, rowHeight) {
  const codewords = [];
  const erasures = [];
  for (let row = 0; row < entry.rows; row++) {
    const y = row * rowHeight;
    const address = microPdf417RowAddress(entry, row);
    let x = 10;
    for (let column = 0; column < entry.columns; column++) {
      const decoded = pdf417CodewordForPattern(bits(matrix, y, x, 17));
      if (!decoded || decoded.cluster !== address.cluster) {
        erasures.push(codewords.length);
        codewords.push(0);
      } else {
        codewords.push(decoded.codeword);
      }
      x += 17;
      if (centralRapAfter(entry, column)) x += 10;
    }
  }
  return { codewords, erasures };
}

/**
 * Decode a sampled MicroPDF417 matrix.
 *
 * The complete fixed data region is compacted after correction. Encoder padding
 * is PDF417 Text latch 900, which contributes no characters at the end of the
 * payload. This avoids relying on non-symbol metadata for payload length.
 */
export function decodeMicroPDF417(matrix, options = {}) {
  const { entry, rowHeight } = resolveFormat(matrix, options);
  const { codewords, erasures } = readCodewords(matrix, entry, rowHeight);
  const corrections = microPdf417CorrectErrors(codewords, entry, erasures);
  const data = codewords.slice(0, entry.dataCodewords);
  const decoded = decodePdf417CompactionDetailed(data);
  return {
    ...decoded,
    codewords,
    rows: entry.rows,
    columns: entry.columns,
    variant: entry.id,
    eccCodewords: entry.eccCodewords,
    rowHeight,
    corrections,
  };
}
