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
export type Candidate = {
    x: number;
    y: number;
    moduleSize: number;
    hits: number;
};
export type Detection = {
    /**
     * Outer corners of the
     * symbol, ordered top-left, top-right, bottom-right, bottom-left.
     */
    corners: Array<{
        x: number;
        y: number;
    }>;
    /**
     * Modules per side.
     */
    dimension: number;
    version: number;
    /**
     * Estimated pixels per module.
     */
    moduleSize: number;
    alignmentFound: boolean;
};
/**
 * @typedef {object} Detection
 * @property {Array<{x: number, y: number}>} corners Outer corners of the
 *   symbol, ordered top-left, top-right, bottom-right, bottom-left.
 * @property {number} dimension Modules per side.
 * @property {number} version
 * @property {number} moduleSize Estimated pixels per module.
 * @property {boolean} alignmentFound
 */
/**
 * Find QR Code symbols in a binarized image.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} binaryImage Set bit = dark.
 * @returns {Detection[]} Possibly empty; ordered by descending module size, so
 *   the most prominent symbol comes first.
 */
export declare function detectQR(binaryImage: import('../core/bit-matrix.js').BitMatrix): Detection[];
/**
 * Find and decode every QR Code in a binarized image.
 *
 * Each candidate gets up to four attempts: a plain centre sample, a 3x3
 * majority vote for noisy input, and both of those rotated 180 degrees. The
 * rotation retry matters because three finders in a right isoceles triangle
 * look identical to the same three rotated half a turn — the orientation is
 * only settled once the format information reads cleanly, which is to say once
 * the decode succeeds.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} binaryImage
 * @returns {Array<import('./decoder.js').DecodeResult & {corners: Array<{x: number, y: number}>}>}
 *   Empty when nothing decodes; never throws for "no symbol here".
 */
export declare function detectAndDecodeQR(binaryImage: import('../core/bit-matrix.js').BitMatrix): Array<import('./decoder.js').DecodeResult & {
    corners: Array<{
        x: number;
        y: number;
    }>;
}>;
