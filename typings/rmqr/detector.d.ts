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
import { BitMatrix } from '../core/bit-matrix.js';
/** Detect an axis-aligned, clean rMQR raster and return the exact module matrix. */
export declare function detectRMQR(image: any, options?: {}): {
    matrix: BitMatrix;
    result: {
        text: string;
        bytes: Uint8Array<ArrayBuffer>;
        version: number;
        name: `R${number}x${number}`;
        ecc: string;
        mask: number;
        corrections: number;
    };
    rotation: number;
    corners: {
        x: any;
        y: any;
        width: any;
        height: any;
    };
    scale?: undefined;
} | {
    matrix: BitMatrix;
    result: {
        text: string;
        bytes: Uint8Array<ArrayBuffer>;
        version: number;
        name: `R${number}x${number}`;
        ecc: string;
        mask: number;
        corrections: number;
    };
    rotation: number;
    scale: number;
    corners: {
        x: any;
        y: any;
        width: any;
        height: any;
    };
};
/** Detect and decode a raster in one call. */
export declare function detectAndDecodeRMQR(image: any, options?: {}): {
    text: string;
    bytes: Uint8Array<ArrayBuffer>;
    version: number;
    name: `R${number}x${number}`;
    ecc: string;
    mask: number;
    corrections: number;
};
