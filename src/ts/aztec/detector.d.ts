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
export type Point = {
    x: number;
    y: number;
};
export type Detection = {
    corners: Point[];
    dimension: number;
    compact: boolean;
    moduleSize: number;
    matrix: import('../core/bit-matrix.js').BitMatrix;
};
/**
 * Find an Aztec symbol in a binarized image.
 *
 * The returned matrix is in the orientation accepted by the Aztec decoder.
 * A valid mode message is required before a geometric candidate is returned,
 * making false positives from decorative concentric squares very unlikely.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} binaryImage Set bit = dark.
 * @returns {Detection | null}
 */
export declare function detectAztec(binaryImage: import('../core/bit-matrix.js').BitMatrix): Detection | null;
/**
 * Detect then decode an Aztec symbol. Detection failure is a normal result for
 * images without an Aztec code, therefore invalid candidates return null.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} binaryImage
 * @returns {(import("./decoder.js").DecodeResult & {corners: Point[]}) | null}
 */
export declare function detectAndDecodeAztec(binaryImage: import('../core/bit-matrix.js').BitMatrix): (import("./decoder.js").DecodeResult & {
    corners: Point[];
}) | null;
