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
export const ECC_LEVELS = ['L', 'M', 'Q', 'H'];
/**
 * Two-bit level indicator used in the format information.
 * Note this is *not* the L/M/Q/H ordering — the spec assigns them out of order.
 */
export const ECC_LEVEL_BITS = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };
/** Inverse of {@link ECC_LEVEL_BITS}, indexed by the 2-bit value. */
export const ECC_LEVEL_BY_BITS = ['M', 'L', 'H', 'Q'];
export const MIN_VERSION = 1;
export const MAX_VERSION = 40;
/** Version at and above which an 18-bit version information block is carried. */
export const VERSION_INFO_MIN = 7;
/** Mode indicator nibbles. */
export const MODE = {
    TERMINATOR: 0x0,
    NUMERIC: 0x1,
    ALPHANUMERIC: 0x2,
    STRUCTURED_APPEND: 0x3,
    BYTE: 0x4,
    FNC1_FIRST: 0x5,
    ECI: 0x7,
    KANJI: 0x8,
    FNC1_SECOND: 0x9,
};
/**
 * Character count indicator width, in bits, by mode and version band.
 *
 * The bands are versions 1-9, 10-26 and 27-40. They are the reason segment
 * selection and version selection are mutually dependent: widening the count
 * field can push a payload over a version boundary, which widens it again.
 */
const COUNT_BITS = {
    [MODE.NUMERIC]: [10, 12, 14],
    [MODE.ALPHANUMERIC]: [9, 11, 13],
    [MODE.BYTE]: [8, 16, 16],
    [MODE.KANJI]: [8, 10, 12],
};
/**
 * @param {number} version 1-40
 * @returns {number} Modules per side.
 */
export function versionSize(version) {
    return 17 + 4 * version;
}
/**
 * Bits in the character count indicator.
 *
 * @param {number} mode One of {@link MODE}.
 * @param {number} version
 * @returns {number}
 */
export function countBits(mode, version) {
    const widths = COUNT_BITS[mode];
    if (!widths)
        return 0;
    if (version <= 9)
        return widths[0];
    if (version <= 26)
        return widths[1];
    return widths[2];
}
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
export function alignmentCoordinates(version) {
    if (version < 2)
        return [];
    const size = versionSize(version);
    const count = Math.floor(version / 7) + 2;
    const last = size - 7;
    // Spacing is rounded up to an even number of modules so every centre lands on
    // the same parity as the timing pattern, which is what keeps the patterns
    // aligned with the module grid rather than straddling it.
    const step = Math.ceil((size - 13) / (2 * count - 2)) * 2;
    const coords = [6];
    // Walk backwards from the final centre so the slack lands in the first gap.
    for (let i = count - 1; i >= 1; i--)
        coords.push(last - (count - 1 - i) * step);
    coords.sort((a, b) => a - b);
    return coords;
}
/**
 * Centres of the alignment patterns actually drawn, as [x, y] pairs.
 *
 * The three combinations that would sit on top of a finder pattern are omitted.
 *
 * @param {number} version
 * @returns {Array<[number, number]>}
 */
export function alignmentCentres(version) {
    const coords = alignmentCoordinates(version);
    if (coords.length === 0)
        return [];
    const size = versionSize(version);
    const lo = 6;
    const hi = size - 7;
    const out = [];
    for (let i = 0; i < coords.length; i++) {
        for (let j = 0; j < coords.length; j++) {
            const x = coords[j];
            const y = coords[i];
            // Skip the three finder corners.
            if (x === lo && y === lo)
                continue;
            if (x === lo && y === hi)
                continue;
            if (x === hi && y === lo)
                continue;
            out.push([x, y]);
        }
    }
    return out;
}
const reservedCache = new Map();
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
export function reservedModules(version) {
    const cached = reservedCache.get(version);
    if (cached)
        return cached;
    const size = versionSize(version);
    const m = new BitMatrix(size, size);
    // Finder patterns with their separators: an 8x8 reserved block at each of
    // three corners (7x7 pattern plus a one-module light border on the inner
    // sides, which the corner blocks absorb).
    m.setRegion(0, 0, 8, 8);
    m.setRegion(size - 8, 0, 8, 8);
    m.setRegion(0, size - 8, 8, 8);
    // Timing patterns, spanning the gap between the separators.
    for (let i = 8; i < size - 8; i++) {
        m.set(i, 6);
        m.set(6, i);
    }
    // Alignment patterns, 5x5 each.
    const centres = alignmentCentres(version);
    for (let i = 0; i < centres.length; i++) {
        m.setRegion(centres[i][0] - 2, centres[i][1] - 2, 5, 5);
    }
    // Format information: two copies plus the dark module. The copies partly
    // fall inside the 8x8 finder blocks already reserved; setting them again is
    // harmless and keeps the intent explicit.
    const [copyA, copyB] = formatInfoPositions(size);
    for (let i = 0; i < 15; i++) {
        m.set(copyA[i][0], copyA[i][1]);
        m.set(copyB[i][0], copyB[i][1]);
    }
    m.set(8, size - 8); // dark module
    // Version information, two 6x3 blocks.
    if (version >= VERSION_INFO_MIN) {
        m.setRegion(size - 11, 0, 3, 6);
        m.setRegion(0, size - 11, 6, 3);
    }
    reservedCache.set(version, m);
    return m;
}
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
export function formatInfoPositions(size) {
    /** @type {Array<[number, number]>} */
    const a = [];
    /** @type {Array<[number, number]>} */
    const b = [];
    for (let i = 0; i < 15; i++) {
        // Copy A wraps the top-left finder: down column 8, then left along row 8,
        // stepping over the two timing modules.
        if (i < 6)
            a.push([8, i]);
        else if (i === 6)
            a.push([8, 7]);
        else if (i === 7)
            a.push([8, 8]);
        else if (i === 8)
            a.push([7, 8]);
        else
            a.push([14 - i, 8]);
        // Copy B is split: the low bits run right-to-left along row 8 beside the
        // top-right finder, the high bits run bottom-up beside the bottom-left one.
        if (i < 8)
            b.push([size - 1 - i, 8]);
        else
            b.push([8, size - 15 + i]);
    }
    return [a, b];
}
/**
 * Modules available to data and error correction, counted off the grid.
 *
 * @param {number} version
 * @returns {number}
 */
export function freeModuleCount(version) {
    const reserved = reservedModules(version);
    const size = versionSize(version);
    let free = 0;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (!reserved.get(x, y))
                free++;
        }
    }
    return free;
}
/**
 * Total codewords (data + error correction) a version holds.
 *
 * Geometric, not tabulated — this is the reference the ECC table is checked
 * against.
 *
 * @param {number} version
 * @returns {number}
 */
export function geometricTotalCodewords(version) {
    return Math.floor(freeModuleCount(version) / 8);
}
/**
 * Bits left over after the last whole codeword, written as zeroes.
 *
 * @param {number} version
 * @returns {number} 0, 3, 4 or 7.
 */
export function remainderBits(version) {
    return freeModuleCount(version) % 8;
}
const orderCache = new Map();
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
export function dataModuleOrder(version) {
    const cached = orderCache.get(version);
    if (cached)
        return cached;
    const size = versionSize(version);
    const reserved = reservedModules(version);
    const out = new Int32Array(freeModuleCount(version) * 2);
    let n = 0;
    let upward = true;
    for (let col = size - 1; col > 0; col -= 2) {
        // Column 6 is the vertical timing pattern. Stepping over it shifts the
        // whole remaining schedule left by one, so the loop variable itself has to
        // move — adjusting only the current pair would visit column 4 twice and
        // column 0 never, which is self-consistent between encoder and decoder and
        // therefore invisible to a round-trip test.
        if (col === 6)
            col--;
        for (let i = 0; i < size; i++) {
            const y = upward ? size - 1 - i : i;
            for (let c = 0; c < 2; c++) {
                const x = col - c;
                if (reserved.get(x, y))
                    continue;
                out[n++] = x;
                out[n++] = y;
            }
        }
        upward = !upward;
    }
    orderCache.set(version, out);
    return out;
}
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
export function maskBit(mask, x, y) {
    switch (mask) {
        case 0: return ((y + x) & 1) === 0;
        case 1: return (y & 1) === 0;
        case 2: return x % 3 === 0;
        case 3: return (y + x) % 3 === 0;
        case 4: return (((y >> 1) + Math.floor(x / 3)) & 1) === 0;
        case 5: return ((y * x) & 1) + ((y * x) % 3) === 0;
        case 6: return ((((y * x) & 1) + ((y * x) % 3)) & 1) === 0;
        case 7: return ((((y + x) & 1) + ((y * x) % 3)) & 1) === 0;
        default:
            throw new RangeError(`QR: mask must be 0-7, got ${mask}`);
    }
}
/**
 * Error correction parameters, indexed `[version - 1]` then by level.
 *
 * Each entry is `[eccCodewordsPerBlock, blockCount, totalDataCodewords]`.
 *
 * The third number is redundant with the first two given the geometric
 * capacity, and that is the entire point: it turns a silent typo into a loud
 * failure. See the module note.
 *
 * @type {Array<{L: number[], M: number[], Q: number[], H: number[]}>}
 */
const ECC_TABLE = [
    /*  1 */ { L: [7, 1, 19], M: [10, 1, 16], Q: [13, 1, 13], H: [17, 1, 9] },
    /*  2 */ { L: [10, 1, 34], M: [16, 1, 28], Q: [22, 1, 22], H: [28, 1, 16] },
    /*  3 */ { L: [15, 1, 55], M: [26, 1, 44], Q: [18, 2, 34], H: [22, 2, 26] },
    /*  4 */ { L: [20, 1, 80], M: [18, 2, 64], Q: [26, 2, 48], H: [16, 4, 36] },
    /*  5 */ { L: [26, 1, 108], M: [24, 2, 86], Q: [18, 4, 62], H: [22, 4, 46] },
    /*  6 */ { L: [18, 2, 136], M: [16, 4, 108], Q: [24, 4, 76], H: [28, 4, 60] },
    /*  7 */ { L: [20, 2, 156], M: [18, 4, 124], Q: [18, 6, 88], H: [26, 5, 66] },
    /*  8 */ { L: [24, 2, 194], M: [22, 4, 154], Q: [22, 6, 110], H: [26, 6, 86] },
    /*  9 */ { L: [30, 2, 232], M: [22, 5, 182], Q: [20, 8, 132], H: [24, 8, 100] },
    /* 10 */ { L: [18, 4, 274], M: [26, 5, 216], Q: [24, 8, 154], H: [28, 8, 122] },
    /* 11 */ { L: [20, 4, 324], M: [30, 5, 254], Q: [28, 8, 180], H: [24, 11, 140] },
    /* 12 */ { L: [24, 4, 370], M: [22, 8, 290], Q: [26, 10, 206], H: [28, 11, 158] },
    /* 13 */ { L: [26, 4, 428], M: [22, 9, 334], Q: [24, 12, 244], H: [22, 16, 180] },
    /* 14 */ { L: [30, 4, 461], M: [24, 9, 365], Q: [20, 16, 261], H: [24, 16, 197] },
    /* 15 */ { L: [22, 6, 523], M: [24, 10, 415], Q: [30, 12, 295], H: [24, 18, 223] },
    /* 16 */ { L: [24, 6, 589], M: [28, 10, 453], Q: [24, 17, 325], H: [30, 16, 253] },
    /* 17 */ { L: [28, 6, 647], M: [28, 11, 507], Q: [28, 16, 367], H: [28, 19, 283] },
    /* 18 */ { L: [30, 6, 721], M: [26, 13, 563], Q: [28, 18, 397], H: [28, 21, 313] },
    /* 19 */ { L: [28, 7, 795], M: [26, 14, 627], Q: [26, 21, 445], H: [26, 25, 341] },
    /* 20 */ { L: [28, 8, 861], M: [26, 16, 669], Q: [30, 20, 485], H: [28, 25, 385] },
    /* 21 */ { L: [28, 8, 932], M: [26, 17, 714], Q: [28, 23, 512], H: [30, 25, 406] },
    /* 22 */ { L: [28, 9, 1006], M: [28, 17, 782], Q: [30, 23, 568], H: [24, 34, 442] },
    /* 23 */ { L: [30, 9, 1094], M: [28, 18, 860], Q: [30, 25, 614], H: [30, 30, 464] },
    /* 24 */ { L: [30, 10, 1174], M: [28, 20, 914], Q: [30, 27, 664], H: [30, 32, 514] },
    /* 25 */ { L: [26, 12, 1276], M: [28, 21, 1000], Q: [30, 29, 718], H: [30, 35, 538] },
    /* 26 */ { L: [28, 12, 1370], M: [28, 23, 1062], Q: [28, 34, 754], H: [30, 37, 596] },
    /* 27 */ { L: [30, 12, 1468], M: [28, 25, 1128], Q: [30, 34, 808], H: [30, 40, 628] },
    /* 28 */ { L: [30, 13, 1531], M: [28, 26, 1193], Q: [30, 35, 871], H: [30, 42, 661] },
    /* 29 */ { L: [30, 14, 1631], M: [28, 28, 1267], Q: [30, 38, 911], H: [30, 45, 701] },
    /* 30 */ { L: [30, 15, 1735], M: [28, 29, 1373], Q: [30, 40, 985], H: [30, 48, 745] },
    /* 31 */ { L: [30, 16, 1843], M: [28, 31, 1455], Q: [30, 43, 1033], H: [30, 51, 793] },
    /* 32 */ { L: [30, 17, 1955], M: [28, 33, 1541], Q: [30, 45, 1115], H: [30, 54, 845] },
    /* 33 */ { L: [30, 18, 2071], M: [28, 35, 1631], Q: [30, 48, 1171], H: [30, 57, 901] },
    /* 34 */ { L: [30, 19, 2191], M: [28, 37, 1725], Q: [30, 51, 1231], H: [30, 60, 961] },
    /* 35 */ { L: [30, 19, 2306], M: [28, 38, 1812], Q: [30, 53, 1286], H: [30, 63, 986] },
    /* 36 */ { L: [30, 20, 2434], M: [28, 40, 1914], Q: [30, 56, 1354], H: [30, 66, 1054] },
    /* 37 */ { L: [30, 21, 2566], M: [28, 43, 1992], Q: [30, 59, 1426], H: [30, 70, 1096] },
    /* 38 */ { L: [30, 22, 2702], M: [28, 45, 2102], Q: [30, 62, 1502], H: [30, 74, 1142] },
    /* 39 */ { L: [30, 24, 2812], M: [28, 47, 2216], Q: [30, 65, 1582], H: [30, 77, 1222] },
    /* 40 */ { L: [30, 25, 2956], M: [28, 49, 2334], Q: [30, 68, 1666], H: [30, 81, 1276] },
];
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
export function blockLayout(version, ecc) {
    if (version < MIN_VERSION || version > MAX_VERSION || (version | 0) !== version) {
        throw new RangeError(`QR: version must be an integer 1-40, got ${version}`);
    }
    const entry = ECC_TABLE[version - 1][ecc];
    if (!entry)
        throw new RangeError(`QR: unknown error correction level "${ecc}"`);
    const eccPerBlock = entry[0];
    const blockCount = entry[1];
    const totalDataCodewords = entry[2];
    const base = Math.floor(totalDataCodewords / blockCount);
    const extra = totalDataCodewords % blockCount;
    return {
        version,
        ecc,
        totalCodewords: totalDataCodewords + eccPerBlock * blockCount,
        totalDataCodewords,
        eccPerBlock,
        blockCount,
        group1Blocks: blockCount - extra,
        group1DataCount: base,
        group2Blocks: extra,
        group2DataCount: base + 1,
        remainderBits: remainderBits(version),
    };
}
/**
 * Data capacity in codewords.
 *
 * @param {number} version
 * @param {string} ecc
 * @returns {number}
 */
export function dataCodewords(version, ecc) {
    return ECC_TABLE[version - 1][ecc][2];
}
/**
 * Data capacity in bits.
 *
 * @param {number} version
 * @param {string} ecc
 * @returns {number}
 */
export function dataBitCapacity(version, ecc) {
    return dataCodewords(version, ecc) * 8;
}
/** Error correction codewords per block are drawn from this set and no other. */
const VALID_ECC_PER_BLOCK = [7, 10, 13, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30];
/**
 * Remainder bits by version band, from the spec. Independent of anything the
 * ECC table says, so it validates the *geometry* — chiefly the alignment
 * pattern spacing rule, which is otherwise only checked by its own shape.
 *
 * @param {number} version
 * @returns {number}
 */
function expectedRemainderBits(version) {
    if (version === 1)
        return 0;
    if (version <= 6)
        return 7;
    if (version <= 13)
        return 0;
    if (version <= 20)
        return 3;
    if (version <= 27)
        return 4;
    if (version <= 34)
        return 3;
    return 0;
}
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
export function validateTables() {
    const problems = [];
    for (let version = MIN_VERSION; version <= MAX_VERSION; version++) {
        const size = versionSize(version);
        const total = geometricTotalCodewords(version);
        // --- Geometry ------------------------------------------------------
        const rem = remainderBits(version);
        if (rem !== expectedRemainderBits(version)) {
            problems.push(`v${version}: remainder bits ${rem}, expected ${expectedRemainderBits(version)} ` +
                `(free modules ${freeModuleCount(version)}) — check the alignment spacing rule`);
        }
        // --- Placement order ----------------------------------------------
        // Every free module must be visited exactly once. A placement order that
        // skips one module and visits another twice is still perfectly
        // self-consistent — the encoder writes and the decoder reads the same
        // wrong sequence — so a round-trip test cannot see it. What it does is
        // silently burn error correction budget on every symbol produced. This is
        // the only check that catches it.
        const order = dataModuleOrder(version);
        const free = freeModuleCount(version);
        if (order.length !== free * 2) {
            problems.push(`v${version}: placement order visits ${order.length / 2} modules, expected ${free}`);
        }
        else {
            const seen = new Uint8Array(size * size);
            let duplicates = 0;
            let reservedHits = 0;
            const reserved = reservedModules(version);
            for (let p = 0; p < order.length; p += 2) {
                const x = order[p];
                const y = order[p + 1];
                if (reserved.get(x, y))
                    reservedHits++;
                if (seen[y * size + x]++)
                    duplicates++;
            }
            if (duplicates > 0) {
                problems.push(`v${version}: placement order visits ${duplicates} modules more than once`);
            }
            if (reservedHits > 0) {
                problems.push(`v${version}: placement order includes ${reservedHits} function modules`);
            }
        }
        // --- Alignment coordinates ----------------------------------------
        const coords = alignmentCoordinates(version);
        if (version === 1) {
            if (coords.length !== 0)
                problems.push(`v1: expected no alignment coordinates, got ${coords.length}`);
        }
        else {
            const expectedCount = Math.floor(version / 7) + 2;
            if (coords.length !== expectedCount) {
                problems.push(`v${version}: ${coords.length} alignment coordinates, expected ${expectedCount}`);
            }
            if (coords[0] !== 6) {
                problems.push(`v${version}: first alignment coordinate ${coords[0]}, expected 6`);
            }
            if (coords[coords.length - 1] !== size - 7) {
                problems.push(`v${version}: last alignment coordinate ${coords[coords.length - 1]}, expected ${size - 7}`);
            }
            for (let i = 1; i < coords.length; i++) {
                if (coords[i] <= coords[i - 1]) {
                    problems.push(`v${version}: alignment coordinates not strictly increasing at index ${i}`);
                }
            }
            if (coords.length >= 3) {
                // Every gap after the first must be identical, and the first gap must
                // not exceed it — the slack is absorbed at the start, never the end.
                const step = coords[2] - coords[1];
                for (let i = 3; i < coords.length; i++) {
                    if (coords[i] - coords[i - 1] !== step) {
                        problems.push(`v${version}: alignment gap ${coords[i] - coords[i - 1]} at index ${i}, expected ${step}`);
                    }
                }
                if (coords[1] - coords[0] > step) {
                    problems.push(`v${version}: first alignment gap ${coords[1] - coords[0]} exceeds step ${step}`);
                }
                if (step % 2 !== 0) {
                    problems.push(`v${version}: alignment step ${step} is odd`);
                }
            }
        }
        // --- Error correction table ---------------------------------------
        for (let l = 0; l < ECC_LEVELS.length; l++) {
            const ecc = ECC_LEVELS[l];
            const layout = blockLayout(version, ecc);
            const tag = `v${version}-${ecc}`;
            // THE identity. Everything else is a supporting check.
            if (layout.totalCodewords !== total) {
                problems.push(`${tag}: ${layout.blockCount} blocks x ${layout.eccPerBlock} ECC + ` +
                    `${layout.totalDataCodewords} data = ${layout.totalCodewords} codewords, ` +
                    `but the grid holds ${total}`);
            }
            if (VALID_ECC_PER_BLOCK.indexOf(layout.eccPerBlock) === -1) {
                problems.push(`${tag}: ${layout.eccPerBlock} ECC codewords per block is not a valid value`);
            }
            if (layout.blockCount < 1) {
                problems.push(`${tag}: block count ${layout.blockCount}`);
            }
            if (layout.group1DataCount < 1) {
                problems.push(`${tag}: ${layout.totalDataCodewords} data codewords across ${layout.blockCount} blocks`);
            }
            if (layout.group1Blocks + layout.group2Blocks !== layout.blockCount) {
                problems.push(`${tag}: group split does not sum to the block count`);
            }
            if (layout.group1Blocks * layout.group1DataCount +
                layout.group2Blocks * layout.group2DataCount !== layout.totalDataCodewords) {
                problems.push(`${tag}: group sizes do not sum to the data codeword count`);
            }
            // Reed-Solomon over GF(256) cannot address a codeword longer than 255.
            if (layout.group2DataCount + layout.eccPerBlock > 255) {
                problems.push(`${tag}: block length ${layout.group2DataCount + layout.eccPerBlock} exceeds GF(256)`);
            }
            // Stronger correction must cost capacity, never gain it.
            if (l > 0) {
                const weaker = dataCodewords(version, ECC_LEVELS[l - 1]);
                if (layout.totalDataCodewords >= weaker) {
                    problems.push(`${tag}: ${layout.totalDataCodewords} data codewords is not less than ` +
                        `${ECC_LEVELS[l - 1]}'s ${weaker}`);
                }
            }
            // Capacity must grow with version.
            if (version > MIN_VERSION) {
                const smaller = dataCodewords(version - 1, ecc);
                if (layout.totalDataCodewords <= smaller) {
                    problems.push(`${tag}: ${layout.totalDataCodewords} data codewords is not more than ` +
                        `v${version - 1}-${ecc}'s ${smaller}`);
                }
            }
        }
    }
    return problems;
}
