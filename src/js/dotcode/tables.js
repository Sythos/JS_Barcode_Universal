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
 * DotCode structural constants and the public 5-of-9 symbol assignment.
 *
 * The pattern assignment is a normative symbology table. It is recorded as
 * compact hexadecimal values so the runtime does not need a third-party table
 * or a generated dependency. Bit 8 is the first dot in the nine-dot pattern.
 * Every entry contains exactly five dark dots.
 *
 * @module dotcode/tables
 */
import { GaloisField } from '../core/galois-field.js';
export const DOTCODE_MIN_DIMENSION = 5;
export const DOTCODE_MAX_DIMENSION = 200;
export const DOTCODE_FIELD_SIZE = 113;
export const DOTCODE_CODEWORD_COUNT = 113;
export const DOTCODE_MIN_ECC = 3;
export const DOTCODE_MASK_STEPS = Object.freeze([0, 3, 7, 17]);
/** GF(113), with the primitive root required by the DotCode RS procedure. */
export const GF113_DOTCODE = new GaloisField({
    size: DOTCODE_FIELD_SIZE,
    prime: true,
    generator: 3,
    name: 'GF(113)/DotCode',
});
/**
 * DotCode Annex C's 113 legal 5-of-9 patterns.
 *
 * This is format data, not executable code copied from an implementation.
 * Keeping it in the authoritative TypeScript source makes the JS runtime and
 * its declarations reproducible without a package-time generator.
 */
export const DOTCODE_PATTERNS = Object.freeze([
    0x155, 0x0ab, 0x0ad, 0x0b5, 0x0d5, 0x156, 0x15a, 0x16a, 0x1aa, 0x0ae,
    0x0b6, 0x0ba, 0x0d6, 0x0da, 0x0ea, 0x12b, 0x12d, 0x135, 0x14b, 0x14d,
    0x153, 0x159, 0x165, 0x169, 0x195, 0x1a5, 0x1a9, 0x057, 0x05b, 0x05d,
    0x06b, 0x06d, 0x075, 0x097, 0x09b, 0x09d, 0x0a7, 0x0b3, 0x0b9, 0x0cb,
    0x0cd, 0x0d3, 0x0d9, 0x0e5, 0x0e9, 0x12e, 0x136, 0x13a, 0x14e, 0x15c,
    0x166, 0x16c, 0x172, 0x174, 0x196, 0x19a, 0x1a6, 0x1ac, 0x1b2, 0x1b4,
    0x1ca, 0x1d2, 0x1d4, 0x05e, 0x06e, 0x076, 0x07a, 0x09e, 0x0bc, 0x0ce,
    0x0dc, 0x0e6, 0x0ec, 0x0f2, 0x0f4, 0x117, 0x11b, 0x11d, 0x127, 0x133,
    0x139, 0x147, 0x163, 0x171, 0x18b, 0x18d, 0x193, 0x199, 0x1a3, 0x1b1,
    0x1c5, 0x1c9, 0x1d1, 0x02f, 0x037, 0x03b, 0x03d, 0x04f, 0x067, 0x073,
    0x079, 0x08f, 0x0c7, 0x0e3, 0x0f1, 0x11e, 0x13c, 0x178, 0x18e, 0x19c,
    0x1b8, 0x1c6, 0x1cc,
]);
const PATTERN_TO_CODEWORD = new Map(DOTCODE_PATTERNS.map((pattern, value) => [pattern, value]));
/** Return the nine-dot pattern assigned to a codeword. */
export function dotCodePattern(codeword) {
    if (!Number.isInteger(codeword) || codeword < 0 || codeword >= DOTCODE_CODEWORD_COUNT) {
        throw new RangeError(`DotCode: codeword must be an integer in 0..${DOTCODE_CODEWORD_COUNT - 1}`);
    }
    return DOTCODE_PATTERNS[codeword];
}
/** Return a codeword for a nine-dot pattern, or -1 when it is not assigned. */
export function dotCodeCodeword(pattern) {
    return PATTERN_TO_CODEWORD.get(pattern) ?? -1;
}
/** Number of active alternating positions in a W by H symbol. */
export function dotCodeActivePositions(width, height) {
    return Math.floor((width * height) / 2);
}
/** Number of complete nine-bit codewords available after the mask bits. */
export function dotCodeCodewordCapacity(width, height) {
    return Math.floor((dotCodeActivePositions(width, height) - 2) / 9);
}
/** DotCode uses alternating positions; the six corner positions carry tail bits. */
export function dotCodeIsDataPosition(column, row) {
    return ((column + row) & 1) === 0;
}
/** Return true for one of the six corner positions used by the folded stream. */
export function dotCodeIsCorner(column, row, width, height) {
    if (column === 0 && row === 0)
        return true;
    if (height & 1) {
        if ((column === width - 2 && row === 0) || (column === width - 1 && row === 1))
            return true;
        if (column === 0 && row === height - 1)
            return true;
    }
    else {
        if (column === width - 1 && row === 0)
            return true;
        if ((column === 0 && row === height - 2) || (column === 1 && row === height - 1))
            return true;
    }
    return (column === width - 2 && row === height - 1) ||
        (column === width - 1 && row === height - 2);
}
/** Return the six corner coordinates in wire order for a canonical matrix. */
export function dotCodeCornerOrder(width, height) {
    if (height & 1) {
        return [
            [width - 2, 0],
            [width - 2, height - 1],
            [width - 1, 1],
            [width - 1, height - 2],
            [0, 0],
            [0, height - 1],
        ];
    }
    return [
        [width - 1, height - 2],
        [0, height - 2],
        [width - 2, height - 1],
        [1, height - 1],
        [width - 1, 0],
        [0, 0],
    ];
}
/** Largest data-codeword count that fits the supplied nine-bit capacity. */
export function dotCodeDataCapacity(codewordCapacity) {
    if (!Number.isInteger(codewordCapacity) || codewordCapacity < DOTCODE_MIN_ECC + 1)
        return 0;
    let best = 0;
    for (let data = 1; data <= codewordCapacity; data++) {
        const ecc = DOTCODE_MIN_ECC + Math.floor(data / 2);
        if (data + ecc <= codewordCapacity)
            best = data;
    }
    return best;
}
/** Check public structural constants and pattern invariants. */
export function validateDotCodeTables() {
    const errors = [];
    if (DOTCODE_PATTERNS.length !== DOTCODE_CODEWORD_COUNT) {
        errors.push(`pattern count ${DOTCODE_PATTERNS.length} is not ${DOTCODE_CODEWORD_COUNT}`);
    }
    const seen = new Set();
    for (let value = 0; value < DOTCODE_PATTERNS.length; value++) {
        const pattern = DOTCODE_PATTERNS[value];
        if (seen.has(pattern))
            errors.push(`pattern 0x${pattern.toString(16)} is duplicated`);
        seen.add(pattern);
        if (pattern < 0 || pattern > 0x1ff || pattern.toString(2).split('1').length - 1 !== 5) {
            errors.push(`pattern ${value} is not a 5-of-9 value`);
        }
    }
    return errors;
}
