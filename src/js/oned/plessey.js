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
/**
 * Plessey Code (the original 1971 Plessey Company symbology, distinct from
 * its later Modified Plessey/MSI descendant already implemented in this
 * SDK as `msi`).
 *
 * Each of the sixteen hexadecimal values (0-9, A-F) is a reversed-BCD
 * nibble: bit 0 first, each bit drawn as a narrow-bar/wide-space pair for 0
 * or a wide-bar/narrow-space pair for 1. A mandatory two-character
 * hexadecimal check is appended, computed as an 8-bit CRC over the data
 * bits (generator polynomial x^8+x^7+x^6+x^5+x^3+1) — the check nibbles are
 * themselves ordinary reversed-BCD characters, so encoding them reuses the
 * same digit table rather than needing a separate code path. The width
 * descriptions below are expressed as module counts rather than copied
 * implementation tables and are checked by the focused test suite.
 *
 * @module oned/plessey
 */
import { BitMatrix } from '../core/bit-matrix.js';
import { EncodeError } from '../core/errors.js';
/**
 * The sixteen reversed-BCD digit patterns (hex 0-F), each four bit-pairs
 * (narrow-then-wide for 0, wide-then-narrow for 1), least-significant bit
 * first.
 */
export const PLESSEY_DIGIT_PATTERNS = [
    '13131313', '31131313', '13311313', '31311313',
    '13133113', '31133113', '13313113', '31313113',
    '13131331', '31131331', '13311331', '31311331',
    '13133131', '31133131', '13313131', '31313131',
];
/** Forward start guard: bits 1,1,0,1 as narrow/wide bar-space pairs. */
export const PLESSEY_START = '31311331';
/** Stop guard: the reverse start code plus a full-pitch termination bar. */
export const PLESSEY_STOP = '331311313';
/** CRC-8 generator polynomial bits (x^8+x^7+x^6+x^5+x^3+1), MSB first. */
export const PLESSEY_CRC_POLYNOMIAL = [1, 1, 1, 1, 0, 1, 0, 0, 1];
const MAX_PLESSEY_DIGITS = 200;
function parseHexDigits(value) {
    const text = String(value).toUpperCase();
    if (!/^[0-9A-F]+$/u.test(text)) {
        throw new EncodeError(`Plessey: payload must be hex digits (0-9, A-F), got "${value}"`);
    }
    if (text.length === 0 || text.length > MAX_PLESSEY_DIGITS) {
        throw new EncodeError(`Plessey: payload length must be in 1..${MAX_PLESSEY_DIGITS}`);
    }
    return [...text].map((ch) => parseInt(ch, 16));
}
/**
 * Compute the two-nibble Plessey CRC check for a sequence of hex digit
 * values, via bitwise polynomial division over the reversed-BCD bit stream
 * (least-significant bit of each digit first).
 *
 * @param {number[]} digits Hex values 0-15.
 * @returns {[number, number]} The low then high check nibble (0-15 each).
 */
export function plesseyCheckDigits(digits) {
    const bits = [];
    for (const value of digits) {
        for (let b = 0; b < 4; b++)
            bits.push((value >> b) & 1);
    }
    const poly = PLESSEY_CRC_POLYNOMIAL;
    const buffer = bits.concat(new Array(poly.length - 1).fill(0));
    for (let i = 0; i < bits.length; i++) {
        if (buffer[i]) {
            for (let j = 0; j < poly.length; j++)
                buffer[i + j] ^= poly[j];
        }
    }
    let checkBits = 0;
    for (let i = 0; i < 8; i++)
        checkBits |= buffer[bits.length + i] << i;
    return [checkBits & 0xF, (checkBits >> 4) & 0xF];
}
function expandWidths(widths) {
    let modules = '';
    for (let i = 0; i < widths.length; i++) {
        const count = widths[i] === '3' ? 3 : 1;
        modules += (i % 2 === 0 ? '1' : '0').repeat(count);
    }
    return modules;
}
function toMatrix(modules) {
    const matrix = new BitMatrix(modules.length, 1);
    for (let x = 0; x < modules.length; x++) {
        if (modules[x] === '1')
            matrix.set(x, 0);
    }
    return matrix;
}
/**
 * Encode Plessey Code. The two-character hexadecimal CRC check is always
 * computed and appended — it is mandatory in this symbology, unlike the
 * optional check digits used elsewhere in the Code 25/MSI families.
 *
 * @param {string} value Hexadecimal payload (0-9, A-F), case-insensitive.
 * @returns {BitMatrix}
 */
export function encodePlessey(value) {
    const digits = parseHexDigits(value);
    const [c1, c2] = plesseyCheckDigits(digits);
    let modules = expandWidths(PLESSEY_START);
    for (const digit of [...digits, c1, c2])
        modules += expandWidths(PLESSEY_DIGIT_PATTERNS[digit]);
    modules += expandWidths(PLESSEY_STOP);
    return toMatrix(modules);
}
/** Internal limit used by the scanline reader and its safety checks. */
export const PLESSEY_MAX_DIGITS = MAX_PLESSEY_DIGITS;
