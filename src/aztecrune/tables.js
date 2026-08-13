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

/**
 * Aztec Rune geometry.
 *
 * Aztec Rune is the 11x11, one-byte member of the Aztec family. Two 4-bit
 * data words and five 4-bit Reed-Solomon check words are XORed with the fixed
 * Aztec Rune mask and written clockwise on the outer data ring. The finder and
 * corner orientation marks are independent of the value.
 *
 * The constants below are derived from the public Aztec Code specification and
 * are kept separate from the general Aztec implementation so a normal Aztec
 * decoder can never accidentally treat an 11x11 Rune as a regular symbol.
 *
 * @module aztecrune/tables
 */

import { BitMatrix } from '../core/bit-matrix.js';
import { fieldForWordSize } from '../aztec/tables.js';

export const AZTEC_RUNE_SIZE = 11;
export const AZTEC_RUNE_DATA_BITS = 8;
export const AZTEC_RUNE_WORD_SIZE = 4;
export const AZTEC_RUNE_DATA_CODEWORDS = 2;
export const AZTEC_RUNE_ECC_CODEWORDS = 5;
export const AZTEC_RUNE_TOTAL_CODEWORDS = AZTEC_RUNE_DATA_CODEWORDS + AZTEC_RUNE_ECC_CODEWORDS;
export const AZTEC_RUNE_MASK = 0b1010;

/**
 * Data-module coordinates in wire order: clockwise, starting at the top.
 * Every side contributes seven modules, for 28 bits in total.
 */
export const AZTEC_RUNE_DATA_POSITIONS = Object.freeze([
  ...Array.from({ length: 7 }, (_, i) => [i + 2, 0]),
  ...Array.from({ length: 7 }, (_, i) => [10, i + 2]),
  ...Array.from({ length: 7 }, (_, i) => [8 - i, 10]),
  ...Array.from({ length: 7 }, (_, i) => [0, 8 - i]),
].map(([x, y]) => Object.freeze([x, y])));

const DATA_KEYS = new Set(AZTEC_RUNE_DATA_POSITIONS.map(([x, y]) => `${x},${y}`));

/** @param {number} x @param {number} y @returns {boolean} */
export function isAztecRuneDataPosition(x, y) {
  return DATA_KEYS.has(`${x},${y}`);
}
/**
 * Return the value of a structural module. Data positions return `null`.
 * The bull's-eye has five square rings including its one-module centre; its
 * even-radius rings are dark. The four corner groups are the orientation marks
 * described by the Aztec Rune specification.
 *
 * @param {number} x @param {number} y
 * @returns {boolean|null}
 */
export function aztecRuneStructuralValue(x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= AZTEC_RUNE_SIZE || y >= AZTEC_RUNE_SIZE) {
    return null;
  }
  if (isAztecRuneDataPosition(x, y)) return null;

  const distance = Math.max(Math.abs(x - 5), Math.abs(y - 5));
  if (distance <= 4) return (distance & 1) === 0;

  // Corner orientation groups, clockwise from the upper-left corner:
  // three dark, white-dark-dark, dark-white-white, three white.
  if ((x === 0 && y <= 1) || (y === 0 && x <= 1)) return true;
  if ((x === 10 && y <= 1) || (y === 0 && x === 10)) return true;
  if (x === 9 && y === 0) return false;
  if (x === 10 && y === 10) return false;
  if (y === 10 && x >= 0 && x <= 1) return false;
  if (x === 0 && y >= 9) return false;
  if (x === 10 && y === 9) return true;

  // All non-data cells are covered by the bull's-eye or the four corners.
  return false;
}

/** Build only the fixed finder/orientation structure. */
export function buildAztecRuneStructure() {
  const matrix = new BitMatrix(AZTEC_RUNE_SIZE);
  for (let y = 0; y < AZTEC_RUNE_SIZE; y++) {
    for (let x = 0; x < AZTEC_RUNE_SIZE; x++) {
      const value = aztecRuneStructuralValue(x, y);
      if (value === true) matrix.set(x, y);
    }
  }
  return matrix;
}

/** Return the field used by Rune data/check words. */
export function aztecRuneField() {
  return fieldForWordSize(AZTEC_RUNE_WORD_SIZE);
}

/** Validate the fixed Rune contract and coordinate layout. */
export function validateAztecRuneTables() {
  const problems = [];
  if (AZTEC_RUNE_SIZE !== 11) problems.push('Rune symbol size must be 11');
  if (AZTEC_RUNE_TOTAL_CODEWORDS * AZTEC_RUNE_WORD_SIZE !== 28) problems.push('Rune outer ring must carry 28 bits');
  if (AZTEC_RUNE_DATA_POSITIONS.length !== 28) problems.push('Rune data ring must contain 28 modules');
  if (new Set(AZTEC_RUNE_DATA_POSITIONS.map(([x, y]) => `${x},${y}`)).size !== 28) problems.push('Rune data coordinates must be unique');
  const structure = buildAztecRuneStructure();
  for (let y = 0; y < AZTEC_RUNE_SIZE; y++) for (let x = 0; x < AZTEC_RUNE_SIZE; x++) {
    if (isAztecRuneDataPosition(x, y)) continue;
    const expected = aztecRuneStructuralValue(x, y) === true;
    if (structure.get(x, y) !== expected) problems.push(`Rune structure mismatch at ${x},${y}`);
  }
  return problems;
}
