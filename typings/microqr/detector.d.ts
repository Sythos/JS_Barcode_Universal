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
 * Micro QR detection in binarized rasters.
 *
 * A Micro QR symbol has one 7x7 finder in its top-left corner. That alone is
 * not enough to distinguish it from one corner of a normal QR Code, so every
 * candidate is also required to have the Micro QR timing arms and a format
 * word which the decoder accepts. The decoder is deliberately the final
 * geometric arbiter; BCH and Reed--Solomon verification make accidental
 * acceptance of ordinary square artwork very unlikely.
 *
 * Finder geometry supplies two local axes. Timing arms refine their lengths,
 * while a small fourth-corner search lets projective sampling absorb mild
 * perspective despite the format having no remote alignment pattern.
 *
 * @module microqr/detector
 */
import { BitMatrix } from '../core/bit-matrix.js';
export type Point = {
    x: number;
    y: number;
};
export type Detection = {
    /**
     * Outer corners in reading order.
     */
    corners: Point[];
    /**
     * Side length in modules.
     */
    dimension: number;
    version: 'M1' | 'M2' | 'M3' | 'M4';
    /**
     * Estimated pixels per module at the finder.
     */
    moduleSize: number;
    /**
     * Clockwise orientation of the source raster.
     */
    rotation: number;
    /**
     * Whether the detected symbol used inverted polarity.
     */
    inverted: boolean;
    /**
     * Rectified, normally polarised module matrix.
     */
    matrix: BitMatrix;
};
/**
 * Find Micro QR symbols in a binarized raster.
 *
 * The search accepts arbitrary in-plane angles, including all quarter-turns.
 * Non-integer scale is supported through centre sampling. Mild projective
 * distortion is handled by searching the unconstrained fourth corner.
 *
 * @param {BitMatrix} binaryImage Set bit = dark.
 * @returns {Detection[]} Best candidate first; empty when no symbol is found.
 */
export declare function detectMicroQR(binaryImage: BitMatrix): Detection[];
/**
 * Detect and decode all Micro QR symbols in a binarized raster.
 *
 * @param {BitMatrix} binaryImage
 * @returns {Array<object>}
 */
export declare function detectAndDecodeMicroQR(binaryImage: BitMatrix): Array<object>;
