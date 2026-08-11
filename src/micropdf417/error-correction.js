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

/** MicroPDF417 error correction over the existing GF(929) core. @module micropdf417/error-correction */

import { EncodeError } from '../core/errors.js';
import { GF929 } from '../core/galois-field.js';
import { generatorPoly, rsDecode, rsEncode } from '../core/reed-solomon.js';

function eccLength(entry) {
  if (!entry || !Number.isInteger(entry.eccCodewords)) throw new EncodeError('MicroPDF417: a variant with an ECC length is required');
  if (entry.eccCodewords < 1 || entry.eccCodewords >= GF929.size) throw new EncodeError('MicroPDF417: ECC length is outside GF(929) bounds');
  return entry.eccCodewords;
}

/** Return the fixed number of parity codewords for a MicroPDF417 variant. */
export function microPdf417EccLength(entry) { return eccLength(entry); }

/** Build the MicroPDF417 generator polynomial for a variant's fixed ECC length. */
export function microPdf417Generator(entry) { return generatorPoly(eccLength(entry), GF929, 1); }

/** Compute systematic MicroPDF417 parity codewords. `data` must already include padding. */
export function microPdf417ErrorCorrection(data, entry) { return rsEncode(data, eccLength(entry), GF929, 1); }

/** Correct a complete MicroPDF417 codeword stream, optionally marking erasures. */
export function microPdf417CorrectErrors(codewords, entry, erasures = []) {
  return rsDecode(codewords, eccLength(entry), GF929, 1, erasures);
}
