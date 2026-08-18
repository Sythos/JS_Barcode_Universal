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
 * Pattern tables for the linear symbologies.
 *
 * Every table here is a published fact about a symbology, expressed in this
 * project's own notation and validated by structural invariants rather than
 * trusted. `validateTables()` at the bottom asserts the properties each
 * symbology guarantees — module counts, wide-element counts, uniqueness — and
 * the test suite runs it. A transcription slip that breaks an invariant fails
 * the build; the invariants are chosen so that most single-character slips do.
 *
 * Two notations appear:
 *
 *   width strings  "212222"  — element widths in modules, bar first, then
 *                              alternating space/bar. Used by Code 128, 93,
 *                              Codabar, ITF, Code 39, Code 11.
 *   module strings "0001101" — one character per module, 1 = dark. Used by
 *                              EAN/UPC, where every element is a whole number
 *                              of modules out of a fixed 7.
 *
 * @module oned/patterns
 */
/** Odd-parity ("L") digit patterns, 7 modules each. */
export declare const EAN_L: string[];
/** Even-parity ("G") patterns: the R pattern reversed. */
export declare const EAN_G: string[];
/** Right-hand ("R") patterns: the L pattern complemented. */
export declare const EAN_R: string[];
/**
 * Which parity set each of the six left-hand EAN-13 digits uses, indexed by
 * the first digit. This is how the thirteenth digit is carried without a
 * thirteenth symbol position.
 */
export declare const EAN13_PARITY: string[];
/** UPC-E parity patterns, indexed by check digit. Used when the number system is 0. */
export declare const UPCE_PARITY: string[];
export declare const EAN_START_END = "101";
export declare const EAN_MIDDLE = "01010";
export declare const UPCE_END = "010101";
/**
 * Code 39 is "three of nine": nine elements per character, of which exactly
 * three are wide. `n` and `w` below are narrow and wide; elements alternate
 * bar, space, bar, ... starting and ending with a bar.
 */
export declare const CODE39: {
    '0': string;
    '1': string;
    '2': string;
    '3': string;
    '4': string;
    '5': string;
    '6': string;
    '7': string;
    '8': string;
    '9': string;
    A: string;
    B: string;
    C: string;
    D: string;
    E: string;
    F: string;
    G: string;
    H: string;
    I: string;
    J: string;
    K: string;
    L: string;
    M: string;
    N: string;
    O: string;
    P: string;
    Q: string;
    R: string;
    S: string;
    T: string;
    U: string;
    V: string;
    W: string;
    X: string;
    Y: string;
    Z: string;
    '-': string;
    '.': string;
    ' ': string;
    $: string;
    '/': string;
    '+': string;
    '%': string;
    '*': string;
};
/** Character set for the optional modulo-43 check digit; '*' is excluded. */
export declare const CODE39_CHECK_SET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%";
/** Two-character escapes giving Code 39 the full ASCII range. */
export declare const CODE39_EXTENDED: any[];
/** Nine modules per character across six elements. */
export declare const CODE93: {
    '0': string;
    '1': string;
    '2': string;
    '3': string;
    '4': string;
    '5': string;
    '6': string;
    '7': string;
    '8': string;
    '9': string;
    A: string;
    B: string;
    C: string;
    D: string;
    E: string;
    F: string;
    G: string;
    H: string;
    I: string;
    J: string;
    K: string;
    L: string;
    M: string;
    N: string;
    O: string;
    P: string;
    Q: string;
    R: string;
    S: string;
    T: string;
    U: string;
    V: string;
    W: string;
    X: string;
    Y: string;
    Z: string;
    '-': string;
    '.': string;
    ' ': string;
    $: string;
    '/': string;
    '+': string;
    '%': string;
    S$: string;
    'S%': string;
    'S/': string;
    'S+': string;
};
/**
 * Symbol values 0..46 in order, as keys into {@link CODE93}. An array rather
 * than a string, because the four shift characters have multi-character keys.
 */
export declare const CODE93_VALUES: string[];
export declare const CODE93_START_STOP = "111141";
/**
 * All 107 symbol patterns. Eleven modules each across six elements; the stop
 * pattern is the sole exception at thirteen modules across seven.
 *
 * The eleven-module invariant is checked below and catches the overwhelming
 * majority of transcription slips, since almost any single-digit change to a
 * pattern breaks the sum.
 */
export declare const CODE128: string[];
export declare const CODE128_START_A = 103;
export declare const CODE128_START_B = 104;
export declare const CODE128_START_C = 105;
export declare const CODE128_STOP = 106;
export declare const CODE128_FNC1 = 102;
export declare const CODE128_FNC2 = 97;
export declare const CODE128_FNC3 = 96;
export declare const CODE128_FNC4_A = 101;
export declare const CODE128_FNC4_B = 100;
export declare const CODE128_SHIFT = 98;
export declare const CODE128_CODE_A = 101;
export declare const CODE128_CODE_B = 100;
export declare const CODE128_CODE_C = 99;
/** Five elements per digit, exactly two of them wide. */
export declare const ITF: string[];
/** Seven elements per character. */
export declare const CODABAR: {
    '0': string;
    '1': string;
    '2': string;
    '3': string;
    '4': string;
    '5': string;
    '6': string;
    '7': string;
    '8': string;
    '9': string;
    '-': string;
    $: string;
    ':': string;
    '/': string;
    '.': string;
    '+': string;
    A: string;
    B: string;
    C: string;
    D: string;
};
export declare const CODABAR_START_STOP = "ABCD";
/** Five elements per character, one or two of them wide. */
export declare const CODE11: {
    '0': string;
    '1': string;
    '2': string;
    '3': string;
    '4': string;
    '5': string;
    '6': string;
    '7': string;
    '8': string;
    '9': string;
    '-': string;
};
export declare const CODE11_START_STOP = "nnwwn";
/** Each bit of a digit becomes a bar pair: 1 is wide-then-narrow, 0 the reverse. */
export declare const MSI_BIT: {
    0: string;
    1: string;
};
export declare const MSI_START = "110";
export declare const MSI_STOP = "1001";
/**
 * Assert every invariant these tables are supposed to satisfy.
 *
 * This is the first of the correctness mechanisms described in NOTICE.md:
 * the tables are redundant with the symbology rules, so the rules can check
 * the tables. Called from the test suite; cheap enough to call anywhere.
 *
 * @returns {string[]} Problems found; empty means all invariants hold.
 */
export declare function validateTables(): string[];
