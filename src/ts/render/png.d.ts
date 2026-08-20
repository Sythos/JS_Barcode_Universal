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
 * Wrap data in stored (type 00) deflate blocks with a zlib header.
 *
 * A stored block's length field is sixteen bits, so each block caps at 65535
 * bytes and longer data must be split. BFINAL is set on the last block only —
 * getting that wrong yields a stream that decodes correctly for any small
 * image and truncates on the first large one.
 *
 * @param {Uint8Array} data
 * @returns {Uint8Array}
 */
export declare function deflateStored(data: Uint8Array): Uint8Array;
/**
 * Render to a PNG file.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 * @param {import('./options.js').RenderOptions} [options]
 * @returns {Promise<Uint8Array>}
 */
export declare function toPNG(matrix: import('../core/bit-matrix.js').BitMatrix, options?: import('./options.js').RenderOptions): Promise<Uint8Array>;
/**
 * Render to a data URI usable as an `<img>` src or a download href.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 * @param {import('./options.js').RenderOptions} [options]
 * @returns {Promise<string>}
 */
export declare function toPNGDataURI(matrix: import('../core/bit-matrix.js').BitMatrix, options?: import('./options.js').RenderOptions): Promise<string>;
