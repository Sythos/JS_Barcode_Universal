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
export declare const DOTCODE_MIN_DIMENSION = 5;
export declare const DOTCODE_MAX_DIMENSION = 200;
export declare const DOTCODE_FIELD_SIZE = 113;
export declare const DOTCODE_CODEWORD_COUNT = 113;
export declare const DOTCODE_MIN_ECC = 3;
export declare const DOTCODE_MASK_STEPS: readonly number[];
/** GF(113), with the primitive root required by the DotCode RS procedure. */
export declare const GF113_DOTCODE: GaloisField;
/**
 * DotCode Annex C's 113 legal 5-of-9 patterns.
 *
 * This is format data, not executable code copied from an implementation.
 * Keeping it in the authoritative TypeScript source makes the JS runtime and
 * its declarations reproducible without a package-time generator.
 */
export declare const DOTCODE_PATTERNS: readonly number[];
/** Return the nine-dot pattern assigned to a codeword. */
export declare function dotCodePattern(codeword: number): number;
/** Return a codeword for a nine-dot pattern, or -1 when it is not assigned. */
export declare function dotCodeCodeword(pattern: number): number;
/** Number of active alternating positions in a W by H symbol. */
export declare function dotCodeActivePositions(width: number, height: number): number;
/** Number of complete nine-bit codewords available after the mask bits. */
export declare function dotCodeCodewordCapacity(width: number, height: number): number;
/** DotCode uses alternating positions; the six corner positions carry tail bits. */
export declare function dotCodeIsDataPosition(column: number, row: number): boolean;
/** Return true for one of the six corner positions used by the folded stream. */
export declare function dotCodeIsCorner(column: number, row: number, width: number, height: number): boolean;
/** Return the six corner coordinates in wire order for a canonical matrix. */
export declare function dotCodeCornerOrder(width: number, height: number): readonly [number, number][];
/** Largest data-codeword count that fits the supplied nine-bit capacity. */
export declare function dotCodeDataCapacity(codewordCapacity: number): number;
/** Check public structural constants and pattern invariants. */
export declare function validateDotCodeTables(): string[];
