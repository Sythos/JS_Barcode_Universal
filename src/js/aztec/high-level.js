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
import { EncodeError } from '../core/errors.js';

/** Aztec high-level table identifiers, exposed for decoder/API symmetry. */
export const HIGH_LEVEL_MODE = Object.freeze({
  UPPER: 0,
  LOWER: 1,
  DIGIT: 2,
  MIXED: 3,
  PUNCT: 4,
});

/** Maximum number of bytes represented by one B/S escape. */
export const MAX_BINARY_SHIFT = 2078;

/**
 * Convert accepted public input to its encoded octets.
 *
 * @param {string|ArrayBuffer|ArrayBufferView} value
 * @param {'utf-8'} [charset]
 * @returns {Uint8Array}
 */
export function aztecBytes(value, charset = 'utf-8') {
  if (charset !== 'utf-8') throw new EncodeError(`Aztec: unsupported charset "${charset}"`);
  if (typeof value === 'string') return new TextEncoder().encode(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new EncodeError('Aztec: value must be a string, ArrayBuffer, or byte view');
}

/** @param {number} byte @returns {number} UPPER-table value, or -1. */
function upperValue(byte) {
  if (byte === 0x20) return 1;
  if (byte >= 0x41 && byte <= 0x5a) return byte - 0x41 + 2;
  return -1;
}

/** Aztec's latch table, packed as `(bitCount << 16) | bits`. */
const LATCH = Object.freeze([
  [0, 327708, 327710, 327709, 656318],
  [590318, 0, 327710, 327709, 656318],
  [262158, 590300, 0, 590301, 932798],
  [327709, 327708, 656322, 0, 327710],
  [327711, 656380, 656382, 656381, 0],
]);

/** @param {number} byte @returns {number} */
function lowerValue(byte) {
  if (byte === 0x20) return 1;
  if (byte >= 0x61 && byte <= 0x7a) return byte - 0x61 + 2;
  return -1;
}

/** @param {number} byte @returns {number} */
function digitValue(byte) {
  if (byte === 0x20) return 1;
  if (byte >= 0x30 && byte <= 0x39) return byte - 0x30 + 2;
  if (byte === 0x2c) return 12;
  if (byte === 0x2e) return 13;
  return -1;
}

const PUNCT = new Map([
  [0x0d, 1], [0x21, 6], [0x22, 7], [0x23, 8], [0x24, 9], [0x25, 10],
  [0x26, 11], [0x27, 12], [0x28, 13], [0x29, 14], [0x2a, 15], [0x2b, 16],
  [0x2c, 17], [0x2d, 18], [0x2e, 19], [0x2f, 20], [0x3a, 21], [0x3b, 22],
  [0x3c, 23], [0x3d, 24], [0x3e, 25], [0x3f, 26], [0x5b, 27], [0x5d, 28],
  [0x7b, 29], [0x7d, 30],
]);

/** @param {number} byte @param {number} mode @returns {number} */
function textValue(byte, mode) {
  switch (mode) {
    case HIGH_LEVEL_MODE.UPPER: return upperValue(byte);
    case HIGH_LEVEL_MODE.LOWER: return lowerValue(byte);
    case HIGH_LEVEL_MODE.DIGIT: return digitValue(byte);
    case HIGH_LEVEL_MODE.PUNCT: return PUNCT.get(byte) ?? -1;
    default: return -1;
  }
}

/** @param {BitWriter} writer @param {number} from @param {number} to */
function latch(writer, from, to) {
  if (from === to) return;
  const packed = LATCH[from][to];
  writer.put(packed & 0xffff, packed >>> 16);
}

/** @param {number} mode @returns {number} */
function characterWidth(mode) {
  return mode === HIGH_LEVEL_MODE.DIGIT ? 4 : 5;
}

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
export function writeBinaryShift(writer, bytes, start, length) {
  let at = start;
  let left = length;
  while (left > 0) {
    const count = Math.min(left, MAX_BINARY_SHIFT);
    writer.put(31, 5); // UPPER B/S
    if (count <= 31) writer.put(count, 5);
    else {
      writer.put(0, 5);
      writer.put(count - 31, 11);
    }
    for (let i = 0; i < count; i++) writer.put(bytes[at + i], 8);
    at += count;
    left -= count;
  }
}

/**
 * Build a valid Aztec high-level bitstream.
 *
 * @param {string|ArrayBuffer|ArrayBufferView} value
 * @param {{charset?: 'utf-8'}} [options]
 * @returns {BitWriter}
 */
export function encodeHighLevel(value, options = {}) {
  const bytes = aztecBytes(value, options.charset ?? 'utf-8');
  const writer = new BitWriter();
  let mode = HIGH_LEVEL_MODE.UPPER;

  for (let at = 0; at < bytes.length;) {
    let bestMode = -1;
    let bestValue = -1;
    let bestCost = Number.POSITIVE_INFINITY;
    for (const candidate of [HIGH_LEVEL_MODE.UPPER, HIGH_LEVEL_MODE.LOWER, HIGH_LEVEL_MODE.DIGIT, HIGH_LEVEL_MODE.PUNCT]) {
      const value = textValue(bytes[at], candidate);
      if (value < 0) continue;
      const latchCost = candidate === mode ? 0 : LATCH[mode][candidate] >>> 16;
      const cost = latchCost + characterWidth(candidate);
      if (cost < bestCost) { bestCost = cost; bestMode = candidate; bestValue = value; }
    }
    if (bestMode >= 0) {
      latch(writer, mode, bestMode);
      writer.put(bestValue, characterWidth(bestMode));
      mode = bestMode;
      at++;
    } else {
      // B/S is defined from UPPER; the latch is retained after the shift.
      latch(writer, mode, HIGH_LEVEL_MODE.UPPER);
      mode = HIGH_LEVEL_MODE.UPPER;
      const start = at;
      while (at < bytes.length && ![HIGH_LEVEL_MODE.UPPER, HIGH_LEVEL_MODE.LOWER, HIGH_LEVEL_MODE.DIGIT, HIGH_LEVEL_MODE.PUNCT].some((m) => textValue(bytes[at], m) >= 0)) at++;
      writeBinaryShift(writer, bytes, start, at - start);
    }
  }
  return writer;
}
