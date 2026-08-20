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
/** Growable MSB-first bit writer. */
export declare class BitWriter {
    /** @type {number[]} Packed bytes; the last one may be partially filled. */
    bytes: number[];
    bitLength: number;
    constructor();
    /** @returns {number} Bits written so far. */
    get length(): number;
    /**
     * Append the low `count` bits of `value`, most significant first.
     *
     * @param {number} value
     * @param {number} count
     */
    put(value: number, count: number): void;
    /** @param {boolean} bit */
    putBit(bit: boolean): void;
    /** @param {ArrayLike<number>} data */
    putBytes(data: ArrayLike<number>): void;
    /** Pad with zero bits until the length is a multiple of 8. */
    padToByte(): void;
    /**
     * @returns {Uint8Array} Byte view; trailing bits of the final byte are zero.
     */
    toBytes(): Uint8Array;
    /** @returns {string} Debug view, e.g. "0100 0011 0101". */
    toString(): string;
}
/** MSB-first bit reader over a byte array. */
export declare class BitReader {
    bytes: ArrayLike<number>;
    byteOffset: number;
    bitOffset: number;
    /** @param {ArrayLike<number>} bytes */
    constructor(bytes: ArrayLike<number>);
    /** @returns {number} Bits not yet consumed. */
    available(): number;
    /**
     * Read `count` bits (1..32) as an unsigned integer, most significant first.
     *
     * @param {number} count
     * @returns {number}
     * @throws {FormatError} If the stream is exhausted.
     */
    read(count: number): number;
    /** @returns {boolean} */
    readBit(): boolean;
}
