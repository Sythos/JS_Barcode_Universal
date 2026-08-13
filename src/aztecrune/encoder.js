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
 * Aztec Rune encoder.
 *
 * A Rune carries exactly one byte. Numeric strings are accepted for convenient
 * human-readable input and are normalized to the canonical three-digit text;
 * binary callers can pass one byte in an ArrayBuffer or typed-array view.
 *
 * @module aztecrune/encoder
 */

import { BitMatrix } from '../core/bit-matrix.js';
import { EncodeError } from '../core/errors.js';
import { rsEncode } from '../core/reed-solomon.js';
import {
  AZTEC_RUNE_DATA_POSITIONS,
  AZTEC_RUNE_ECC_CODEWORDS,
  AZTEC_RUNE_MASK,
  AZTEC_RUNE_SIZE,
  aztecRuneField,
  buildAztecRuneStructure,
} from './tables.js';

/** @param {unknown} value @returns {number} */
export function normalizeAztecRuneValue(value) {
  if (typeof value === 'number') {
    if (Number.isInteger(value) && value >= 0 && value <= 255) return value;
    throw new EncodeError('Aztec Rune: numeric value must be an integer from 0 to 255');
  }

  if (typeof value === 'string') {
    if (!/^\d{1,3}$/.test(value)) throw new EncodeError('Aztec Rune: text input must contain one to three decimal digits');
    const numeric = Number(value);
    if (numeric > 255) throw new EncodeError('Aztec Rune: decimal value must be from 000 to 255');
    return numeric;
  }

  let bytes = null;
  if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
  else if (ArrayBuffer.isView(value)) bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (bytes) {
    if (bytes.length !== 1) throw new EncodeError('Aztec Rune: binary input must contain exactly one byte');
    return bytes[0];
  }
  throw new EncodeError('Aztec Rune: expected a number, decimal string or one-byte binary value');
}

/** @param {number} value @returns {number[]} */
function codewordsForValue(value) {
  const data = [value >>> 4, value & 0x0f];
  const parity = rsEncode(data, AZTEC_RUNE_ECC_CODEWORDS, aztecRuneField(), 1);
  return data.concat(parity).map((word) => word ^ AZTEC_RUNE_MASK);
}

/** @param {BitMatrix} matrix @param {number[]} codewords */
function writeDataRing(matrix, codewords) {
  for (let word = 0; word < codewords.length; word++) {
    for (let bit = 0; bit < 4; bit++) {
      const at = word * 4 + bit;
      const [x, y] = AZTEC_RUNE_DATA_POSITIONS[at];
      matrix.setValue(x, y, ((codewords[word] >>> (3 - bit)) & 1) !== 0);
    }
  }
}

/**
 * Encode one byte as an Aztec Rune.
 *
 * @param {number|string|ArrayBuffer|ArrayBufferView} value
 * @param {{inverted?: boolean}} [options]
 * @returns {import('../core/bit-matrix.js').BitMatrix & {
 *   format: 'aztecrune', value: number, inverted: boolean
 * }}
 */
export function encodeAztecRune(value, options = {}) {
  const numeric = normalizeAztecRuneValue(value);
  if (options.inverted !== undefined && typeof options.inverted !== 'boolean') {
    throw new EncodeError('Aztec Rune: inverted must be boolean');
  }
  const inverted = options.inverted === true;
  const matrix = buildAztecRuneStructure();
  writeDataRing(matrix, codewordsForValue(numeric));
  if (inverted) {
    for (let y = 0; y < AZTEC_RUNE_SIZE; y++) for (let x = 0; x < AZTEC_RUNE_SIZE; x++) matrix.flip(x, y);
  }
  matrix.format = 'aztecrune';
  matrix.value = numeric;
  matrix.inverted = inverted;
  return matrix;
}

export { codewordsForValue };
