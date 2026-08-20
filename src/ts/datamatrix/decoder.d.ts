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
 * Data Matrix ECC 200 decoder for an already sampled symbol.
 *
 * The detector owns locating, perspective correction and orientation. This
 * module starts with the complete, upright symbol including its finder borders.
 * The table entry is deliberately read through a small normalizer so table data
 * remains declarative: it needs total rows/columns, one data-region's rows and
 * columns, data/ECC codeword counts, and either a block count or data block
 * lengths. The standard 144x144 uneven data blocks are supported.
 *
 * @module datamatrix/decoder
 */
import { ChecksumError } from '../core/errors.js';
export type DecodeResult = {
    text: string;
    bytes: Uint8Array;
    correctedErrors: number;
    symbol: object;
};
/**
 * Decode an upright, sampled Data Matrix ECC 200 symbol.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix Full symbol, no quiet zone.
 * @returns {{text: string, bytes: Uint8Array, correctedErrors: number, symbol: object}}
 */
export declare function decodeDataMatrix(matrix: import('../core/bit-matrix.js').BitMatrix): DecodeResult;
export { ChecksumError };
