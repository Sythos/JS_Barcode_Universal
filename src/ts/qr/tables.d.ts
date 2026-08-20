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
 * QR Code structural tables.
 *
 * The design principle here is that as little as possible is *recalled* and as
 * much as possible is *derived*, because a barcode table is the one place where
 * a single mistyped digit produces a symbol that looks perfect and scans as
 * garbage — or, worse, scans correctly for the payload you tested and fails for
 * the payload your user sends.
 *
 * So:
 *
 *   - Symbol size, function-pattern layout and total codeword capacity are
 *     computed from geometry. Nothing is tabulated that the module grid already
 *     knows.
 *   - Alignment centres come from the spec's spacing rule, not a 40-row table.
 *   - The group-1 / group-2 block split is arithmetic, not data.
 *
 * That leaves exactly three recalled numbers per (version, level): the error
 * correction codewords per block, the block count, and the total data codeword
 * count. Those three are deliberately redundant — they must satisfy
 *
 *     blocks * eccPerBlock + totalDataCodewords === geometricTotalCodewords(v)
 *
 * for all 160 combinations, where the right-hand side is counted off the module
 * grid. Any single typo on either side breaks the identity. {@link validateTables}
 * enforces it, and the test suite asserts it returns no problems.
 *
 * @module qr/tables
 */
import { BitMatrix } from '../core/bit-matrix.js';
/** Error correction levels, weakest to strongest. */
export declare const ECC_LEVELS: string[];
/**
 * Two-bit level indicator used in the format information.
 * Note this is *not* the L/M/Q/H ordering — the spec assigns them out of order.
 */
export declare const ECC_LEVEL_BITS: {
    L: number;
    M: number;
    Q: number;
    H: number;
};
/** Inverse of {@link ECC_LEVEL_BITS}, indexed by the 2-bit value. */
export declare const ECC_LEVEL_BY_BITS: string[];
export declare const MIN_VERSION = 1;
export declare const MAX_VERSION = 40;
/** Version at and above which an 18-bit version information block is carried. */
export declare const VERSION_INFO_MIN = 7;
/** Mode indicator nibbles. */
export declare const MODE: {
    TERMINATOR: number;
    NUMERIC: number;
    ALPHANUMERIC: number;
    STRUCTURED_APPEND: number;
    BYTE: number;
    FNC1_FIRST: number;
    ECI: number;
    KANJI: number;
    FNC1_SECOND: number;
};
/**
 * @param {number} version 1-40
 * @returns {number} Modules per side.
 */
export declare function versionSize(version: number): number;
/**
 * Bits in the character count indicator.
 *
 * @param {number} mode One of {@link MODE}.
 * @param {number} version
 * @returns {number}
 */
export declare function countBits(mode: number, version: number): number;
/**
 * Centre coordinates of the alignment patterns for a version.
 *
 * The spec's rule: the first centre is always 6 and the last is always
 * `size - 7`; the count grows by one every seven versions; and the centres are
 * evenly spaced with the *first* gap absorbing the rounding slack. Expressing
 * that as arithmetic rather than a 40-row table means there is no table to
 * mistype, and {@link validateTables} can then assert the shape of the result.
 *
 * @param {number} version
 * @returns {number[]} Ascending centres. Empty for version 1.
 */
export declare function alignmentCoordinates(version: number): number[];
/**
 * Centres of the alignment patterns actually drawn, as [x, y] pairs.
 *
 * The three combinations that would sit on top of a finder pattern are omitted.
 *
 * @param {number} version
 * @returns {Array<[number, number]>}
 */
export declare function alignmentCentres(version: number): Array<[number, number]>;
/**
 * Map of modules that carry function patterns rather than payload.
 *
 * A set bit means "reserved": finder, separator, timing, alignment, format
 * information, the dark module, and the version information blocks. This is the
 * single source of truth used by the encoder to skip modules while laying out
 * the bitstream, by the decoder to read them back in the same order, and by
 * {@link geometricTotalCodewords} to count what is left.
 *
 * Deriving capacity this way rather than by hand arithmetic is what makes the
 * awkward cases free: an alignment pattern that overlaps the timing pattern is
 * counted once because it is the same set of modules, not because anyone
 * remembered to subtract five.
 *
 * @param {number} version
 * @returns {BitMatrix} Shared, cached — treat as immutable.
 */
export declare function reservedModules(version: number): BitMatrix;
/**
 * Module positions of the two format information copies.
 *
 * Index `i` in each array is bit `i` of the 15-bit format value, bit 0 being
 * the least significant.
 *
 * CAVEAT WORTH READING: the *direction* of this numbering is the one thing in
 * this file that a round-trip test cannot falsify. Encoder and decoder share
 * these tables, so a mirrored layout would pass every test in the suite and
 * fail only against a real scanner. The layout below is the standard one; both
 * sides deliberately consume this single definition so there is no second place
 * for the convention to drift.
 *
 * @param {number} size Modules per side.
 * @returns {[Array<[number, number]>, Array<[number, number]>]} [copyA, copyB]
 */
export declare function formatInfoPositions(size: number): [Array<[number, number]>, Array<[number, number]>];
/**
 * Modules available to data and error correction, counted off the grid.
 *
 * @param {number} version
 * @returns {number}
 */
export declare function freeModuleCount(version: number): number;
/**
 * Total codewords (data + error correction) a version holds.
 *
 * Geometric, not tabulated — this is the reference the ECC table is checked
 * against.
 *
 * @param {number} version
 * @returns {number}
 */
export declare function geometricTotalCodewords(version: number): number;
/**
 * Bits left over after the last whole codeword, written as zeroes.
 *
 * @param {number} version
 * @returns {number} 0, 3, 4 or 7.
 */
export declare function remainderBits(version: number): number;
/**
 * Module positions in bitstream order, as interleaved x, y pairs.
 *
 * The layout walks two-module-wide columns from the bottom-right corner
 * leftward, alternating upward and downward, right module of the pair before
 * the left, skipping the vertical timing column and every reserved module.
 *
 * Encoder and decoder both consume this one function. That is not tidiness: a
 * placement order that disagrees between the two would still round-trip
 * perfectly within this library while producing symbols no scanner can read.
 * There is only one order because there is only one implementation of it.
 *
 * @param {number} version
 * @returns {Int32Array} Shared, cached — treat as immutable. Length is
 *   `2 * freeModuleCount(version)`.
 */
export declare function dataModuleOrder(version: number): Int32Array;
/**
 * The eight data mask predicates.
 *
 * A true result means the module at (x, y) is inverted. Masks apply to payload
 * modules only; function patterns are laid down after masking and are never
 * touched.
 *
 * @param {number} mask 0-7
 * @param {number} x Column.
 * @param {number} y Row.
 * @returns {boolean}
 */
export declare function maskBit(mask: number, x: number, y: number): boolean;
export type BlockLayout = {
    version: number;
    ecc: string;
    /**
     * Data + error correction.
     */
    totalCodewords: number;
    totalDataCodewords: number;
    eccPerBlock: number;
    blockCount: number;
    /**
     * Blocks holding the smaller data count.
     */
    group1Blocks: number;
    group1DataCount: number;
    /**
     * Blocks holding one extra data codeword.
     */
    group2Blocks: number;
    group2DataCount: number;
    remainderBits: number;
};
/**
 * @typedef {object} BlockLayout
 * @property {number} version
 * @property {string} ecc
 * @property {number} totalCodewords    Data + error correction.
 * @property {number} totalDataCodewords
 * @property {number} eccPerBlock
 * @property {number} blockCount
 * @property {number} group1Blocks      Blocks holding the smaller data count.
 * @property {number} group1DataCount
 * @property {number} group2Blocks      Blocks holding one extra data codeword.
 * @property {number} group2DataCount
 * @property {number} remainderBits
 */
/**
 * Block structure for a (version, level).
 *
 * The group split is derived: the spec distributes the remainder of
 * `data / blocks` one codeword at a time into the *trailing* blocks, so the
 * short blocks come first. That is arithmetic, and tabulating it would only
 * create somewhere else for a typo to hide.
 *
 * @param {number} version
 * @param {string} ecc 'L' | 'M' | 'Q' | 'H'
 * @returns {BlockLayout}
 */
export declare function blockLayout(version: number, ecc: string): BlockLayout;
/**
 * Data capacity in codewords.
 *
 * @param {number} version
 * @param {string} ecc
 * @returns {number}
 */
export declare function dataCodewords(version: number, ecc: string): number;
/**
 * Data capacity in bits.
 *
 * @param {number} version
 * @param {string} ecc
 * @returns {number}
 */
export declare function dataBitCapacity(version: number, ecc: string): number;
/**
 * Self-check every table in this file.
 *
 * The load-bearing assertion is the capacity identity across all 160
 * (version, level) combinations, but a pair of compensating typos could in
 * principle slip past it, so the surrounding checks each constrain a different
 * axis: monotonicity, the closed set of ECC block sizes, the field size limit,
 * and the shape of the alignment coordinate sequence.
 *
 * @returns {string[]} Human-readable problems; empty means everything holds.
 */
export declare function validateTables(): string[];
