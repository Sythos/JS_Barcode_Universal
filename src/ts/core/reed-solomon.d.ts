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
 * Build the generator polynomial for `eccLen` parity symbols.
 *
 *   g(x) = product over i of (x - a^(base + i)),  i = 0 .. eccLen-1
 *
 * `base` is 0 for QR; 1 for Aztec, Data Matrix and PDF417.
 *
 * @param {number} eccLen
 * @param {import('./galois-field.js').GaloisField} field
 * @param {number} [base]
 * @returns {number[]} Monic, degree-descending, length eccLen + 1.
 */
export declare function generatorPoly(eccLen: number, field: import('./galois-field.js').GaloisField, base?: number): number[];
/**
 * Compute `eccLen` parity symbols for `data`.
 *
 * @param {ArrayLike<number>} data
 * @param {number} eccLen
 * @param {import('./galois-field.js').GaloisField} field
 * @param {number} [base]
 * @returns {number[]} The parity symbols alone, length eccLen.
 */
export declare function rsEncode(data: ArrayLike<number>, eccLen: number, field: import('./galois-field.js').GaloisField, base?: number): number[];
/**
 * Correct errors in a received codeword, in place.
 *
 * @param {number[]} received Data followed by parity, degree-descending.
 * @param {number} eccLen
 * @param {import('./galois-field.js').GaloisField} field
 * @param {number} [base]
 * @param {number[]} [erasures] Known damaged indexes, counted from wire order.
 * @returns {number} Number of symbols corrected.
 * @throws {ChecksumError} If the damage exceeds the correction capacity.
 */
export declare function rsDecode(received: number[], eccLen: number, field: import('./galois-field.js').GaloisField, base?: number, erasures?: number[]): number;
