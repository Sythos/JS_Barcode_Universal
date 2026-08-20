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

/** MicroPDF417 encoder. @module micropdf417/encoder */

import { BitMatrix } from '../core/bit-matrix.js';
import { EncodeError } from '../core/errors.js';
import { pdf417PatternForCodeword } from '../pdf417/tables.js';
import { compactMicroPDF417 } from './compaction.js';
import { microPdf417ErrorCorrection } from './error-correction.js';
import {
  MICROPDF417_VARIANTS,
  microPdf417RapSequence,
  microPdf417RowAddress,
  microPdf417VariantByNumber,
  microPdf417VariantForCapacity,
} from './tables.js';

function appendWidths(matrix, y, x, sequence, height) {
  let dark = true;
  for (const digit of sequence) {
    const width = digit.charCodeAt(0) - 48;
    if (!Number.isInteger(width) || width < 1 || width > 6) {
      throw new EncodeError('MicroPDF417: invalid module-width sequence');
    }
    if (dark) matrix.setRegion(x, y, width, height);
    x += width;
    dark = !dark;
  }
  return x;
}

function codewordSequence(codeword, cluster) {
  return pdf417PatternForCodeword(codeword, cluster)
    .toString(2)
    .padStart(17, '0')
    .replace(/0+|1+/g, (run) => String(run.length));
}

function symbolWidth(columns) {
  return 21 + columns * 17 + (columns > 2 ? 10 : 0);
}

function validateOptions(options) {
  const rowHeight = options.rowHeight ?? 2;
  if (!Number.isInteger(rowHeight) || rowHeight < 2) {
    throw new EncodeError('MicroPDF417: rowHeight must be an integer of at least 2');
  }
  if (options.columns !== undefined &&
      (!Number.isInteger(options.columns) || options.columns < 1 || options.columns > 4)) {
    throw new EncodeError('MicroPDF417: columns must be an integer in 1..4');
  }
  if (options.variant !== undefined &&
      (!Number.isInteger(options.variant) || options.variant < 1 || options.variant > 34)) {
    throw new EncodeError('MicroPDF417: variant must be an integer in 1..34');
  }
  if (options.aspectRatio !== undefined &&
      (!Number.isFinite(options.aspectRatio) || options.aspectRatio <= 0)) {
    throw new EncodeError('MicroPDF417: aspectRatio must be positive');
  }
  if (options.rows !== undefined) {
    throw new EncodeError('MicroPDF417: rows are fixed by the selected variant');
  }
  if (options.eccLevel !== undefined) {
    throw new EncodeError('MicroPDF417: error correction is fixed by the selected variant');
  }
  for (const feature of [
    'structuredAppend', 'macro', 'macroPdf417', 'macroControlBlock',
    'readerInit', 'gs1', 'hibc', 'linkage',
  ]) {
    if (options[feature] !== undefined) {
      throw new EncodeError(`MicroPDF417: ${feature} is not implemented`);
    }
  }
  return rowHeight;
}

function chooseVariant(codewordCount, rowHeight, options) {
  if (options.variant !== undefined) {
    const variant = microPdf417VariantByNumber(options.variant);
    if (!variant) throw new EncodeError(`MicroPDF417: unknown variant ${options.variant}`);
    if (options.columns !== undefined && variant.columns !== options.columns) {
      throw new EncodeError(`MicroPDF417: variant ${variant.id} has ${variant.columns} columns`);
    }
    if (codewordCount > variant.dataCodewords) {
      throw new EncodeError(
        `MicroPDF417: payload requires ${codewordCount} data codewords, variant ${variant.id} holds ${variant.dataCodewords}`
      );
    }
    return variant;
  }

  if (options.columns === undefined && options.aspectRatio === undefined) {
    try {
      return microPdf417VariantForCapacity(codewordCount);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      throw new EncodeError(`MicroPDF417: payload requires ${codewordCount} data codewords and exceeds every variant`);
    }
  }

  const candidates = MICROPDF417_VARIANTS.filter((variant) =>
    variant.dataCodewords >= codewordCount &&
    (options.columns === undefined || variant.columns === options.columns)
  );
  if (!candidates.length) {
    const columnText = options.columns === undefined ? '' : ` with ${options.columns} columns`;
    throw new EncodeError(`MicroPDF417: payload does not fit any supported variant${columnText}`);
  }
  if (options.aspectRatio === undefined) {
    return candidates.reduce((best, variant) =>
      variant.dataCodewords < best.dataCodewords ||
      (variant.dataCodewords === best.dataCodewords && variant.totalCodewords < best.totalCodewords)
        ? variant : best
    );
  }

  const target = options.aspectRatio;
  return candidates.reduce((best, variant) => {
    const ratio = symbolWidth(variant.columns) / (variant.rows * rowHeight);
    const score = Math.abs(Math.log(ratio / target)) +
      (variant.dataCodewords - codewordCount) / 10000;
    return !best || score < best.score ? { variant, score } : best;
  }, null).variant;
}

/** Encode a value as one of the 34 fixed MicroPDF417 variants. */
export function encodeMicroPDF417(value, options = {}) {
  const rowHeight = validateOptions(options);
  const payload = compactMicroPDF417(value, options);
  const variant = chooseVariant(payload.length, rowHeight, options);
  const data = payload.slice();
  while (data.length < variant.dataCodewords) data.push(900);
  const ecc = microPdf417ErrorCorrection(data, variant);
  if (ecc.length !== variant.eccCodewords) {
    throw new EncodeError('MicroPDF417: error-correction length does not match the selected variant');
  }
  const codewords = data.concat(ecc);
  if (codewords.length !== variant.totalCodewords || codewords.length !== variant.rows * variant.columns) {
    throw new EncodeError('MicroPDF417: selected variant has inconsistent codeword dimensions');
  }

  const matrix = new BitMatrix(symbolWidth(variant.columns), variant.rows * rowHeight);
  for (let row = 0; row < variant.rows; row++) {
    const y = row * rowHeight;
    const address = microPdf417RowAddress(variant, row);
    let x = appendWidths(matrix, y, 0, microPdf417RapSequence(address.left, 'side'), rowHeight);
    for (let column = 0; column < variant.columns; column++) {
      x = appendWidths(
        matrix,
        y,
        x,
        codewordSequence(codewords[row * variant.columns + column], address.cluster),
        rowHeight
      );
      const hasCentralRap = (variant.columns === 3 && column === 0) ||
        (variant.columns === 4 && column === 1);
      if (hasCentralRap) {
        if (address.center === null) {
          throw new EncodeError('MicroPDF417: selected variant is missing its centre row address');
        }
        x = appendWidths(matrix, y, x, microPdf417RapSequence(address.center, 'center'), rowHeight);
      }
    }
    x = appendWidths(matrix, y, x, microPdf417RapSequence(address.right, 'side'), rowHeight);
    matrix.setRegion(x, y, 1, rowHeight);
    x++;
    if (x !== matrix.width) throw new EncodeError('MicroPDF417: row width does not match the selected variant');
  }

  matrix.micropdf417 = {
    variant: variant.id,
    rows: variant.rows,
    columns: variant.columns,
    eccCodewords: variant.eccCodewords,
    rowHeight,
    payloadCodewords: payload.length,
    dataCodewords: data,
    codewords,
  };
  return matrix;
}
