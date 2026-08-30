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

export declare const TELEPEN_START_VALUE = 95;
export declare const TELEPEN_STOP_VALUE = 122;
export declare const TELEPEN_MAX_LENGTH = 500;

/** Return the original Telepen run-width pattern for one seven-bit value. */
export declare function telepenPattern(value: number): string;

/** Encode Telepen Alpha or Telepen Numeric when `numeric` is true. */
export declare function encodeTelepen(value: string, options?: {
    numeric?: boolean;
    mode?: 'ascii' | 'numeric';
    telepenMode?: 'ascii' | 'numeric';
}): import('../core/bit-matrix.js').BitMatrix;

/** Encode a strict even-length Telepen Numeric payload. */
export declare function encodeTelepenNumeric(value: string): import('../core/bit-matrix.js').BitMatrix;

/** Decode a binarized Telepen scanline. */
export declare function decodeTelepen(row: Uint8Array, options?: {
    numeric?: boolean;
    mode?: 'ascii' | 'numeric';
    telepenMode?: 'ascii' | 'numeric';
}): {
    format: 'telepen' | 'telepennumeric';
    text: string;
    mode: 'ascii' | 'numeric';
} | null;

/** Decode Telepen Numeric explicitly. */
export declare function decodeTelepenNumeric(row: Uint8Array): {
    format: 'telepennumeric';
    text: string;
    mode: 'numeric';
} | null;
