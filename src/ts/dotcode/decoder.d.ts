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
/** Strict DotCode matrix decoder. @module dotcode/decoder */
import { BitMatrix } from '../core/bit-matrix.js';
import { ChecksumError, FormatError } from '../core/errors.js';
export type DotCodeRotation = 0 | 90 | 180 | 270;
export type DotCodePolarity = boolean | 'auto';
export interface DotCodeDecodeOptions {
    /** Try all quarter turns by default. */
    rotation?: DotCodeRotation | 'auto';
    /** Try normal and inverted polarity by default. */
    inverted?: DotCodePolarity;
}
export interface DotCodeDecodeResult {
    readonly format: 'dotcode';
    readonly text: string;
    readonly bytes: Uint8Array;
    readonly width: number;
    readonly height: number;
    readonly mask: 0 | 1 | 2 | 3;
    readonly dataCodewords: number;
    readonly errorCodewords: number;
    readonly corrections: number;
    readonly gs1: boolean;
    readonly encoding: 'utf8' | 'latin1';
    readonly rotation: DotCodeRotation;
    readonly inverted: boolean;
}
/** Decode a sampled DotCode matrix, trying quarter turns and polarity. */
export declare function decodeDotCode(matrix: BitMatrix, options?: DotCodeDecodeOptions): DotCodeDecodeResult;
export { ChecksumError, FormatError };
