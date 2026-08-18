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
import { ChecksumError } from '../core/errors.js';
export type DecodeResult = {
    /**
     * Decoded payload.
     */
    text: string;
    /**
     * Raw bytes of the byte-mode segments; empty when
     * the payload used no byte segments.
     */
    bytes: Uint8Array;
    /**
     * 1-40.
     */
    version: number;
    /**
     * 'L' | 'M' | 'Q' | 'H'.
     */
    ecc: string;
    /**
     * 0-7.
     */
    mask: number;
    /**
     * Symbols repaired by Reed-Solomon.
     */
    corrections: number;
};
/**
 * @typedef {object} DecodeResult
 * @property {string} text Decoded payload.
 * @property {Uint8Array} bytes Raw bytes of the byte-mode segments; empty when
 *   the payload used no byte segments.
 * @property {number} version 1-40.
 * @property {string} ecc 'L' | 'M' | 'Q' | 'H'.
 * @property {number} mask 0-7.
 * @property {number} corrections Symbols repaired by Reed-Solomon.
 */
/**
 * Decode a sampled QR Code symbol.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix Square, exactly the
 *   symbol, no quiet zone. Set bit = dark module.
 * @returns {DecodeResult}
 * @throws {FormatError} If the geometry or content is malformed.
 * @throws {ChecksumError} If error correction cannot repair the symbol.
 */
export declare function decodeQR(matrix: import('../core/bit-matrix.js').BitMatrix): DecodeResult;
export { ChecksumError };
