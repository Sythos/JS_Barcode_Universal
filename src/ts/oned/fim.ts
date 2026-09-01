/*!
 * Sythos Barcode Suite
 *
 * MIT License
 *
 * Copyright (c) 2026 Sythos
 * SPDX-FileCopyrightText: 2026 Sythos (https://www.sythos.net)
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
 * USPS Facing Identification Mark (FIM).
 *
 * A FIM is not a general-purpose data carrier: it is one of five fixed,
 * USPS-defined nine-position patterns (A-E) printed near the upper edge of a
 * mailpiece to indicate mail class/handling to automated facing equipment.
 * Each pattern is a palindrome (reads the same forward and backward) and
 * always starts and ends with a bar, so there is no reversed-read ambiguity
 * between the five types. The width descriptions below are expressed as
 * module presence/absence rather than copied implementation tables.
 *
 * @module oned/fim
 */

import { BitMatrix } from '../core/bit-matrix.js';
import { EncodeError } from '../core/errors.js';

export type FIMType = 'A' | 'B' | 'C' | 'D' | 'E';

/** The five USPS-defined nine-position patterns, bar = '1', blank = '0'. */
export const FIM_PATTERNS: Readonly<Record<FIMType, string>> = {
  A: '110010011',
  B: '101101101',
  C: '110101011',
  D: '111010111',
  E: '101000101',
};

function resolveType(value: unknown): FIMType {
  const type = String(value ?? '').trim().toUpperCase();
  if (type === 'A' || type === 'B' || type === 'C' || type === 'D' || type === 'E') return type;
  throw new EncodeError(`FIM: unknown type "${value}", expected one of A, B, C, D, E`);
}

/**
 * Encode a Facing Identification Mark.
 *
 * @param {FIMType|string} value One of 'A'..'E' (case-insensitive).
 * @returns {BitMatrix} A nine-module-wide, one-row matrix.
 */
export function encodeFIM(value: FIMType | string): BitMatrix {
  const type = resolveType(value);
  const pattern = FIM_PATTERNS[type];
  const matrix = new BitMatrix(pattern.length, 1);
  for (let x = 0; x < pattern.length; x++) {
    if (pattern[x] === '1') matrix.set(x, 0);
  }
  return matrix;
}
