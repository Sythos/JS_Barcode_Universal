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
 * EXPERIMENTAL. JAB Code byte-mode data encoding: a shift-to-byte-mode
 * code, a self-describing length prefix, then the raw bytes.
 *
 * The real format supports 7 text-compaction modes with a dynamic-
 * programming optimal-mode-sequence analyzer; this project encodes
 * everything in byte mode only (the reference's own comment notes byte
 * mode can always encode any input) -- a deliberate, documented scope
 * reduction, not a fidelity gap in the byte-mode path itself, which is bit-
 * exact against the reference's `encodeData`/`decodeData` byte-mode branch.
 *
 * Scope limit: a single byte-mode segment tops out at 8207 bytes (the
 * reference chains additional shift+prefix segments beyond that via its
 * mode-switching wrapper, which this module does not implement -- no real
 * single JAB Code master symbol reaches anywhere near that many net
 * capacity bytes, so the limit is not reachable in practice here).
 *
 * @module jabcode/byte-mode
 */
const SHIFT_UPPER_TO_BYTE = 124; // mode_switch[Upper][shift-to-Byte], 7 bits
const SHIFT_UPPER_TO_BYTE_BITS = 7;
const MAX_SINGLE_SEGMENT_BYTES = 8207; // 2^13 + 15, see module doc
function pushBits(bits, value, length) {
    for (let i = length - 1; i >= 0; i--)
        bits.push((value >>> i) & 1);
}
function readBits(bits, offset, length) {
    let value = 0;
    for (let i = 0; i < length; i++)
        value = (value << 1) | bits[offset + i];
    return value >>> 0;
}
/** Encodes `payload` as one JAB Code byte-mode segment (shift code + length prefix + raw bytes). */
export function encodeByteMode(payload) {
    if (payload.length > MAX_SINGLE_SEGMENT_BYTES) {
        throw new Error(`jabcode byte-mode: payload of ${payload.length} bytes exceeds the ${MAX_SINGLE_SEGMENT_BYTES}-byte single-segment limit (see module doc)`);
    }
    const bits = [];
    pushBits(bits, SHIFT_UPPER_TO_BYTE, SHIFT_UPPER_TO_BYTE_BITS);
    if (payload.length <= 15) {
        pushBits(bits, payload.length, 4);
    }
    else {
        pushBits(bits, 0, 4);
        pushBits(bits, payload.length - 16, 13);
    }
    for (const byte of payload)
        pushBits(bits, byte, 8);
    return Uint8Array.from(bits);
}
/** Decodes one JAB Code byte-mode segment back to its payload bytes; ignores any trailing padding. */
export function decodeByteMode(bits) {
    let offset = 0;
    if (bits.length < SHIFT_UPPER_TO_BYTE_BITS + 4) {
        throw new Error('jabcode byte-mode: not enough bits to decode the shift code and length prefix');
    }
    offset += SHIFT_UPPER_TO_BYTE_BITS; // shift-to-byte code, not re-verified: this module never emits anything else
    let length = readBits(bits, offset, 4);
    offset += 4;
    if (length === 0) {
        if (bits.length < offset + 13) {
            throw new Error('jabcode byte-mode: not enough bits to decode the extended length');
        }
        length = readBits(bits, offset, 13) + 16;
        offset += 13;
    }
    if (bits.length < offset + length * 8) {
        throw new Error('jabcode byte-mode: not enough bits to decode the declared payload length');
    }
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        out[i] = readBits(bits, offset, 8);
        offset += 8;
    }
    return out;
}
