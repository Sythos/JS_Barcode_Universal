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
 * Axis-aligned MicroPDF417 raster detection.
 *
 * A MicroPDF417 symbol has a fixed module width for each column count and a
 * dark leading and trailing module in every row.  Consequently the bounding
 * rectangle of dark pixels identifies the complete symbol even when a light
 * quiet zone surrounds it.  Its width determines the integer raster scale;
 * the existing direct-module decoder then verifies every row-address pattern
 * and selects the exact variant.  This is intentionally narrower than the
 * PDF417 photo detector: it handles clean binarized rasters only, not skew or
 * projective camera images.
 *
 * @module micropdf417/detector
 */
import { BitMatrix } from '../core/bit-matrix.js';
import { decodeMicroPDF417 } from './decoder.js';
export type Point = {
    x: number;
    y: number;
};
/**
 * Detect and decode one clean, binarized MicroPDF417 raster.
 *
 * Integer upscaling and quiet zones are accepted. The image is retried at all
 * quarter-turns, but arbitrary angles and perspective require caller-side
 * rectification before this function is used. `rotation` reports the clockwise
 * orientation of the supplied input relative to a normally oriented symbol;
 * it is not the inverse correction applied internally while searching.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} binaryImage Set bit = dark.
 * @param {object} [options] Passed to {@link decodeMicroPDF417}.
 * @returns {(ReturnType<typeof decodeMicroPDF417> & {matrix: BitMatrix, corners: Point[], moduleSize: number, rotation: number}) | null}
 */
export declare function detectMicroPDF417(binaryImage: import('../core/bit-matrix.js').BitMatrix, options?: object): (ReturnType<typeof decodeMicroPDF417> & {
    matrix: BitMatrix;
    corners: Point[];
    moduleSize: number;
    rotation: number;
}) | null;
/** Alias kept symmetric with the other 2D readers. */
export declare function detectAndDecodeMicroPDF417(binaryImage: any, options?: {}): ({
    text: string;
    bytes: Uint8Array<ArrayBuffer>;
    segments: {
        mode: string;
        text: string;
        bytes: Uint8Array<ArrayBuffer>;
        eci: number;
        latch: any;
        codewordStart: number;
        codewordEnd: number;
    }[];
    codewords: number[];
    rows: any;
    columns: any;
    variant: any;
    eccCodewords: any;
    rowHeight: number;
    corrections: number;
} & {
    matrix: BitMatrix;
    corners: Point[];
    moduleSize: number;
    rotation: number;
}) | null;
