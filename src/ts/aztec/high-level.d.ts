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
 * Aztec high-level stream writer.
 *
 * The output is deliberately a `BitWriter`, rather than a byte array: Aztec's
 * text controls and binary-shift lengths are not byte aligned.  This module is
 * also the boundary where JavaScript strings become UTF-8.  Passing a byte
 * view bypasses that conversion and preserves every octet unchanged.
 *
 * The initial state mandated by the symbology is UPPER.  The greedy text pass
 * uses UPPER, LOWER, DIGIT and PUNCT tables, selecting the shortest available
 * latch at each byte.  Bytes without a text-table representation are emitted
 * through the standard B/S (binary shift) escape.  B/S is available from
 * UPPER and makes this a complete, lossless representation of UTF-8 payloads.
 *
 * @module aztec/high-level
 */
import { BitWriter } from '../core/bit-buffer.js';
/** Aztec high-level table identifiers, exposed for decoder/API symmetry. */
export declare const HIGH_LEVEL_MODE: Readonly<{
    UPPER: 0;
    LOWER: 1;
    DIGIT: 2;
    MIXED: 3;
    PUNCT: 4;
}>;
/** Maximum number of bytes represented by one B/S escape. */
export declare const MAX_BINARY_SHIFT = 2078;
/**
 * Convert accepted public input to its encoded octets.
 *
 * @param {string|ArrayBuffer|ArrayBufferView} value
 * @param {'utf-8'} [charset]
 * @returns {Uint8Array}
 */
export declare function aztecBytes(value: string | ArrayBuffer | ArrayBufferView, charset?: 'utf-8'): Uint8Array;
/**
 * Write an Aztec binary-shift segment while in UPPER mode.
 *
 * B/S is `11111`; its five-bit length directly covers 1..31 bytes.  A zero
 * length selects the extended eleven-bit form, whose stored value is n - 31.
 * Splitting at 2078 keeps each control representable and makes arbitrarily
 * long byte input well-defined.
 *
 * @param {BitWriter} writer
 * @param {Uint8Array} bytes
 * @param {number} start
 * @param {number} length
 */
export declare function writeBinaryShift(writer: BitWriter, bytes: Uint8Array, start: number, length: number): void;
/**
 * Build a valid Aztec high-level bitstream.
 *
 * @param {string|ArrayBuffer|ArrayBufferView} value
 * @param {{charset?: 'utf-8'}} [options]
 * @returns {BitWriter}
 */
export declare function encodeHighLevel(value: string | ArrayBuffer | ArrayBufferView, options?: {
    charset?: 'utf-8';
}): BitWriter;
