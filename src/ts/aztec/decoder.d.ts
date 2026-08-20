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
 * Decode an Aztec high-level bit stream to its exact byte payload.
 *
 * Text tables contribute their ISO-8859-1 byte values; Binary Shift appends
 * raw bytes. ECI markers are consumed but intentionally not emitted: callers
 * receive the transported byte payload and may select their own charset.
 *
 * @param {boolean[]} bits
 * @returns {Uint8Array}
 */
export declare function decodeHighLevelBits(bits: boolean[]): Uint8Array;
export type DecodeResult = {
    text: string;
    bytes: Uint8Array;
    compact: boolean;
    layers: number;
    corrections: number;
    eccPercent: number;
};
/**
 * Decode a square Aztec symbol with one bit per module and no quiet zone.
 * The matrix must already be oriented with the mode message at the top.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 * @returns {{text: string, bytes: Uint8Array, compact: boolean, layers: number, corrections: number, eccPercent: number}}
 */
export declare function decodeAztec(matrix: import('../core/bit-matrix.js').BitMatrix): DecodeResult;
