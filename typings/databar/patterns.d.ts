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
 * Unrank one constrained positive composition.
 *
 * The rank is the GS1 DataBar symbol-character value inside its group. This
 * implementation follows the combinatorial definition directly: it counts
 * every remaining admissible suffix rather than storing third-party patterns.
 */
export declare function dataBarWidths(rank: any, modules: any, elements: any, maximumWidth: any, noNarrow: any): any[];
/** Convert one DataBar-14 character value into its eight alternating widths. */
export declare function dataBar14CharacterWidths(value: any, kind: any): any[];
/** Recover a character value from its canonical eight-width representation. */
export declare function dataBar14ValueForWidths(widths: any, kind: any): any;
/** Nine finder patterns, expressed as normative five-element widths. */
export declare const DATABAR14_FINDERS: readonly (readonly number[])[];
/** Weight sequence generated as powers of three modulo 79. */
export declare const DATABAR14_CHECKSUM_WEIGHTS: readonly number[];
