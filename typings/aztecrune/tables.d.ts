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
 * Aztec Rune geometry.
 *
 * Aztec Rune is the 11x11, one-byte member of the Aztec family. Two 4-bit
 * data words and five 4-bit Reed-Solomon check words are XORed with the fixed
 * Aztec Rune mask and written clockwise on the outer data ring. The finder and
 * corner orientation marks are independent of the value.
 *
 * The constants below are derived from the public Aztec Code specification and
 * are kept separate from the general Aztec implementation so a normal Aztec
 * decoder can never accidentally treat an 11x11 Rune as a regular symbol.
 *
 * @module aztecrune/tables
 */
import { BitMatrix } from '../core/bit-matrix.js';
export declare const AZTEC_RUNE_SIZE = 11;
export declare const AZTEC_RUNE_DATA_BITS = 8;
export declare const AZTEC_RUNE_WORD_SIZE = 4;
export declare const AZTEC_RUNE_DATA_CODEWORDS = 2;
export declare const AZTEC_RUNE_ECC_CODEWORDS = 5;
export declare const AZTEC_RUNE_TOTAL_CODEWORDS: number;
export declare const AZTEC_RUNE_MASK = 10;
/**
 * Data-module coordinates in wire order: clockwise, starting at the top.
 * Every side contributes seven modules, for 28 bits in total.
 */
export declare const AZTEC_RUNE_DATA_POSITIONS: readonly (readonly number[])[];
/** @param {number} x @param {number} y @returns {boolean} */
export declare function isAztecRuneDataPosition(x: number, y: number): boolean;
/**
 * Return the value of a structural module. Data positions return `null`.
 * The bull's-eye has five square rings including its one-module centre; its
 * even-radius rings are dark. The four corner groups are the orientation marks
 * described by the Aztec Rune specification.
 *
 * @param {number} x @param {number} y
 * @returns {boolean|null}
 */
export declare function aztecRuneStructuralValue(x: number, y: number): boolean | null;
/** Build only the fixed finder/orientation structure. */
export declare function buildAztecRuneStructure(): BitMatrix;
/** Return the field used by Rune data/check words. */
export declare function aztecRuneField(): import("../core/galois-field.js").GaloisField;
/** Validate the fixed Rune contract and coordinate layout. */
export declare function validateAztecRuneTables(): string[];
