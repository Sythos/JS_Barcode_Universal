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
/** Original dependency-free DotCode encoder. @module dotcode/encoder */
import { BitMatrix } from '../core/bit-matrix.js';
export type DotCodeInput = string | Uint8Array | number[];
export type DotCodeEncoding = 'utf8' | 'latin1' | 'binary';
export type DotCodeMask = 0 | 1 | 2 | 3;
export interface DotCodeEncodeOptions {
    /** Exact logical width. Must be paired with height, or used with auto height. */
    width?: number;
    /** Exact logical height. Must be paired with width, or used with auto width. */
    height?: number;
    /** Aliases for width and height used by other matrix format APIs. */
    columns?: number;
    rows?: number;
    /** 0..3. The default chooses the least pathological of the four masks. */
    mask?: DotCodeMask;
    /** Interpret ASCII 29 as FNC1 and preserve GS1 semantics. */
    gs1?: boolean;
    /** String input encoding. UTF-8 is the default; byte arrays are unchanged. */
    encoding?: DotCodeEncoding;
    /** Target width/height ratio for automatic sizing. Defaults to 1.5. */
    aspectRatio?: number;
}
export interface DotCodeMetadata {
    readonly format: 'dotcode';
    readonly width: number;
    readonly height: number;
    readonly mask: DotCodeMask;
    readonly dataCodewords: number;
    readonly errorCodewords: number;
    readonly modulePositions: number;
    readonly gs1: boolean;
    readonly encoding: DotCodeEncoding;
}
export type DotCodeMatrix = BitMatrix & {
    dotcode?: DotCodeMetadata;
};
/** Encode a string or byte payload into a DotCode module matrix. */
export declare function encodeDotCode(value: DotCodeInput, options?: DotCodeEncodeOptions): DotCodeMatrix;
/** Encode an explicit set of unmasked data codewords for conformance fixtures. */
export declare function encodeDotCodeCodewords(codewords: readonly number[], options?: DotCodeEncodeOptions): DotCodeMatrix;
