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
 * Bit-level writing and reading, MSB-first.
 *
 * Every 2D symbology serialises its payload as a bitstream that does not
 * respect byte boundaries — QR alone mixes 4-bit mode indicators, 10-bit
 * character-count fields and 11-bit alphanumeric pairs. These two classes are
 * the write and read halves of that.
 *
 * @module core/bit-buffer
 */

import { FormatError } from './errors.js';

/** Growable MSB-first bit writer. */
export class BitWriter {
  constructor() {
    /** @type {number[]} Packed bytes; the last one may be partially filled. */
    this.bytes = [];
    this.bitLength = 0;
  }

  /** @returns {number} Bits written so far. */
  get length() {
    return this.bitLength;
  }

  /**
   * Append the low `count` bits of `value`, most significant first.
   *
   * @param {number} value
   * @param {number} count
   */
  put(value, count) {
    for (let i = count - 1; i >= 0; i--) {
      this.putBit(((value >>> i) & 1) === 1);
    }
  }

  /** @param {boolean} bit */
  putBit(bit) {
    const idx = this.bitLength >>> 3;
    if (this.bytes.length <= idx) this.bytes.push(0);
    if (bit) this.bytes[idx] |= 0x80 >>> (this.bitLength & 7);
    this.bitLength++;
  }

  /** @param {ArrayLike<number>} data */
  putBytes(data) {
    for (let i = 0; i < data.length; i++) this.put(data[i], 8);
  }

  /** Pad with zero bits until the length is a multiple of 8. */
  padToByte() {
    while (this.bitLength & 7) this.putBit(false);
  }

  /**
   * @returns {Uint8Array} Byte view; trailing bits of the final byte are zero.
   */
  toBytes() {
    return Uint8Array.from(this.bytes);
  }

  /** @returns {string} Debug view, e.g. "0100 0011 0101". */
  toString() {
    let s = '';
    for (let i = 0; i < this.bitLength; i++) {
      if (i && i % 4 === 0) s += ' ';
      s += (this.bytes[i >>> 3] >>> (7 - (i & 7))) & 1;
    }
    return s;
  }
}

/** MSB-first bit reader over a byte array. */
export class BitReader {
  /** @param {ArrayLike<number>} bytes */
  constructor(bytes) {
    this.bytes = bytes;
    this.byteOffset = 0;
    this.bitOffset = 0;
  }

  /** @returns {number} Bits not yet consumed. */
  available() {
    return 8 * (this.bytes.length - this.byteOffset) - this.bitOffset;
  }

  /**
   * Read `count` bits (1..32) as an unsigned integer, most significant first.
   *
   * @param {number} count
   * @returns {number}
   * @throws {FormatError} If the stream is exhausted.
   */
  read(count) {
    if (count < 1 || count > 32) {
      throw new FormatError(`BitReader: cannot read ${count} bits`);
    }
    if (count > this.available()) {
      throw new FormatError(
        `BitReader: needed ${count} bits, ${this.available()} remain`
      );
    }

    let result = 0;
    let remaining = count;

    // Finish the partially consumed byte first, then take whole bytes.
    if (this.bitOffset > 0) {
      const inCurrent = 8 - this.bitOffset;
      const take = Math.min(remaining, inCurrent);
      const shift = inCurrent - take;
      const mask = (0xff >> this.bitOffset) & ~((1 << shift) - 1);
      result = (this.bytes[this.byteOffset] & mask) >> shift;
      remaining -= take;
      this.bitOffset += take;
      if (this.bitOffset === 8) {
        this.bitOffset = 0;
        this.byteOffset++;
      }
    }

    while (remaining >= 8) {
      result = (result << 8) | (this.bytes[this.byteOffset] & 0xff);
      this.byteOffset++;
      remaining -= 8;
    }

    if (remaining > 0) {
      const shift = 8 - remaining;
      const mask = ~((1 << shift) - 1) & 0xff;
      result = (result << remaining) | ((this.bytes[this.byteOffset] & mask) >> shift);
      this.bitOffset += remaining;
    }

    return result >>> 0;
  }

  /** @returns {boolean} */
  readBit() {
    return this.read(1) === 1;
  }
}
