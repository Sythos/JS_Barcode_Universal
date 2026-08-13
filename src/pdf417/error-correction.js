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

import { EncodeError } from '../core/errors.js';
import { GF929 } from '../core/galois-field.js';
import { rsDecode, rsEncode } from '../core/reed-solomon.js';

export function pdf417EccLength(level) {
  if (!Number.isInteger(level) || level < 0 || level > 8) throw new EncodeError('PDF417: error correction level must be in 0..8');
  return 1 << (level + 1);
}

export function pdf417ErrorCorrection(data, level) {
  return rsEncode(data, pdf417EccLength(level), GF929, 1);
}

/** Correct PDF417 codewords, optionally marking unreadable codewords as erasures. */
export function pdf417CorrectErrors(codewords, level, erasures = []) {
  return rsDecode(codewords, pdf417EccLength(level), GF929, 1, erasures);
}
