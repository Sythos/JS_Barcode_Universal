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
/** Clean-raster DotCode detector. @module dotcode/detector */
import { BitMatrix } from '../core/bit-matrix.js';
import type { DotCodeDecodeResult, DotCodeRotation } from './decoder.js';
export interface DotCodeDetectOptions {
    /** Restrict the search to one known integer module size. */
    moduleSize?: number;
    /** Maximum scale searched when moduleSize is not supplied. */
    maxModuleSize?: number;
    /** Candidate source orientations. Defaults to all quarter turns. */
    rotations?: readonly DotCodeRotation[];
    /** Search normal, inverted, or both polarities. */
    inverted?: boolean | 'auto';
}
export interface DotCodePoint {
    readonly x: number;
    readonly y: number;
}
export interface DotCodeDetection extends DotCodeDecodeResult {
    readonly matrix: BitMatrix;
    readonly corners: readonly [DotCodePoint, DotCodePoint, DotCodePoint, DotCodePoint];
    readonly moduleSize: number;
}
/**
 * Detect clean, axis-aligned DotCode rasters at integer module scale.
 *
 * DotCode has no finder pattern. This detector therefore treats geometry and
 * the strict decoder as one gate: a bounding-box hypothesis is returned only
 * after checkerboard structure, legal patterns, padding, and Reed-Solomon all
 * pass. It intentionally does not claim perspective or arbitrary-angle camera
 * support; callers should rectify those images before invoking this API.
 */
export declare function detectDotCode(binaryImage: BitMatrix, options?: DotCodeDetectOptions): DotCodeDetection[];
/** Return the first strictly decoded DotCode result, or an empty array. */
export declare function detectAndDecodeDotCode(binaryImage: BitMatrix, options?: DotCodeDetectOptions): DotCodeDetection[];
