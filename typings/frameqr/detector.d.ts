/*!
 * Sythos Barcode Suite
 *
 * MIT License
 *
 * Copyright (c) 2026 Sythos
 * SPDX-FileCopyrightText: 2026 Sythos (https://www.sythos.net)
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
import type { BitMatrix } from '../core/bit-matrix.js';
export type Point = {
    x: number;
    y: number;
};
export type FrameQRDetection = {
    /**
     * Outer corners in reading order.
     */
    corners: Point[];
    /**
     * QR modules per side.
     */
    dimension: number;
    /**
     * QR Model 2 version.
     */
    version: number;
    /**
     * Estimated pixels per module.
     */
    moduleSize: number;
    /**
     * Clockwise in-plane orientation in degrees.
     */
    rotation: number;
    /**
     * Rectified profile matrix.
     */
    matrix: BitMatrix;
    /**
     * Normalized canvas specification.
     */
    canvas: object;
    /**
     * Profile identifier.
     */
    profile: string;
    /**
     * Always false for this implementation.
     */
    certified: false;
};
/**
 * Detect FrameQR Code symbols in a binarized raster.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} binaryImage Set bit = dark.
 * @param {object} [options]
 * @param {object} [options.canvas] Explicit canvas metadata for non-default
 *   shapes/size. Without it, the profile's canonical centered square is used.
 * @param {boolean} [options.voting=false] Use majority sampling per module.
 * @returns {FrameQRDetection[]} Best candidate first; empty when no verified
 *   profile signature is found.
 */
export declare function detectFrameQR(binaryImage: import('../core/bit-matrix.js').BitMatrix, options?: {
    canvas?: object;
    voting?: boolean;
}): FrameQRDetection[];
/**
 * Detect and decode all verified Canvas QR symbols in one call.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} binaryImage
 * @param {object} [options]
 * @returns {Array<object>}
 */
export declare function detectAndDecodeFrameQR(binaryImage: import('../core/bit-matrix.js').BitMatrix, options?: object): Array<object>;
