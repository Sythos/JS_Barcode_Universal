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
declare function dimensions(needed: any, level: any, options: any, rowHeight: any): {
    rows: any;
    columns: any;
    score: number;
};
/**
 * Encode Compact PDF417.
 *
 * High-level Text/Byte/Numeric compaction is intentionally delegated to the
 * existing PDF417 compaction implementation. `compact` here describes only
 * the physical truncated layout: right row indicators are omitted and the
 * stop pattern is reduced to one dark module.
 *
 * @param {string|Uint8Array|number[]} value
 * @param {object} [options]
 * @returns {import('../core/bit-matrix.js').BitMatrix}
 */
export declare function encodeCompactPDF417(value: string | Uint8Array | number[], options?: object): import('../core/bit-matrix.js').BitMatrix;
export { dimensions as compactPdf417Dimensions };
