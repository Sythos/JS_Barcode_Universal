/*!
 * Sythos Barcode Suite
 *
 * MIT License
 *
 * Copyright (c) 2026 Sythos
 * SPDX-FileCopyrightText: 2026 Sythos (https://www.sythos.net)
 * SPDX-License-Identifier: MIT
 *
 * Original work. No code from any other barcode implementation.
 */
/**
 * Han Xin Code structural tables and geometry.
 *
 * This module deliberately starts with the compact, alignment-free part of
 * ISO/IEC 20830: versions 1 through 3.  Keeping the function pattern mask in
 * one place makes the encoder, decoder and detector agree about every payload
 * cell and prevents accidental data placement over structural information.
 *
 * @module hanxin/tables
 */
import { BitMatrix } from '../core/bit-matrix.js';
import { GF16, GaloisField } from '../core/galois-field.js';
import { rsDecode, rsEncode } from '../core/reed-solomon.js';
import { FormatError } from '../core/errors.js';
export const HANXIN_MIN_VERSION = 1;
export const HANXIN_MAX_VERSION = 3;
export const HANXIN_VERSIONS = [1, 2, 3];
export const HANXIN_ECC_LEVELS = ['L1', 'L2', 'L3', 'L4'];
/** Han Xin's data field is GF(2^8) with x^8+x^6+x^5+x+1. */
export const GF256_HANXIN = new GaloisField({
    size: 256,
    primitive: 0x163,
    name: 'GF(256)/HanXin',
});
/** Total codewords, including error correction, for versions 1 through 3. */
export const HANXIN_TOTAL_CODEWORDS = [25, 37, 50];
/** Data modules, including the five zero remainder modules in each compact version. */
export const HANXIN_DATA_MODULES = [205, 301, 405];
/** Unused tail modules after the complete codeword stream. */
export const HANXIN_REMAINDER_BITS = [5, 5, 5];
/**
 * One Reed--Solomon batch is `(blockCount, dataCodewords, eccCodewords)`.
 * The compact versions use one block at every error-correction level.
 */
const EC_BATCHES = [
    [[1, 21, 4], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
    [[1, 17, 8], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
    [[1, 13, 12], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
    [[1, 9, 16], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
    [[1, 31, 6], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
    [[1, 25, 12], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
    [[1, 19, 18], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
    [[1, 15, 22], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
    [[1, 42, 8], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
    [[1, 34, 16], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
    [[1, 26, 24], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
    [[1, 20, 30], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
];
/** @returns {number} Side length in modules. */
export function hanXinSize(version) {
    if (!Number.isInteger(version) || version < HANXIN_MIN_VERSION || version > HANXIN_MAX_VERSION) {
        throw new FormatError(`Han Xin: supported versions are 1-3, got ${version}`);
    }
    return 21 + version * 2;
}
/** @returns {HanXinVersion} */
export function normalizeHanXinVersion(value) {
    const version = typeof value === 'string' ? Number(value.replace(/^V/i, '')) : Number(value);
    if (!Number.isInteger(version) || version < HANXIN_MIN_VERSION || version > HANXIN_MAX_VERSION) {
        throw new FormatError(`Han Xin: supported versions are 1-3, got ${String(value)}`);
    }
    return version;
}
/** @returns {HanXinEccLevel} */
export function normalizeHanXinEcc(value) {
    if (value == null)
        return 'L1';
    if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 4) {
        return HANXIN_ECC_LEVELS[value - 1];
    }
    const text = String(value).toUpperCase();
    if (HANXIN_ECC_LEVELS.includes(text))
        return text;
    throw new FormatError(`Han Xin: error correction must be L1, L2, L3 or L4, got ${String(value)}`);
}
/** @returns {number} Index of an error-correction level. */
export function hanXinEccIndex(level) {
    return HANXIN_ECC_LEVELS.indexOf(level);
}
/** @returns {{blockCount:number,dataCodewords:number,eccCodewords:number}} */
export function hanXinEcLayout(version, level) {
    const entry = EC_BATCHES[(version - 1) * 4 + hanXinEccIndex(level)][0];
    return { blockCount: entry[0], dataCodewords: entry[1], eccCodewords: entry[2] };
}
/** @returns {number} Data codewords for a version and EC level. */
export function hanXinDataCodewords(version, level) {
    return hanXinEcLayout(version, level).dataCodewords;
}
/** Four orientation-specific 7x7 finder patterns, packed MSB first. */
export const HANXIN_FINDER_TOP_LEFT = [0x7f, 0x40, 0x5f, 0x50, 0x57, 0x57, 0x57];
export const HANXIN_FINDER_SIDE = [0x7f, 0x01, 0x7d, 0x05, 0x75, 0x75, 0x75];
export const HANXIN_FINDER_BOTTOM_RIGHT = [0x75, 0x75, 0x75, 0x05, 0x7d, 0x01, 0x7f];
function index(size, x, y) {
    return y * size + x;
}
function reserve(mask, matrix, x, y, dark) {
    if (x < 0 || y < 0 || x >= matrix.width || y >= matrix.height)
        return;
    mask[index(matrix.width, x, y)] = 1;
    matrix.setValue(x, y, dark);
}
function placeFinder(mask, matrix, offsetX, offsetY, rows) {
    for (let y = 0; y < 7; y++)
        for (let x = 0; x < 7; x++) {
            reserve(mask, matrix, offsetX + x, offsetY + y, (rows[y] & (0x40 >> x)) !== 0);
        }
}
/** Return the function modules and their fixed darkness for a version. */
export function createHanXinFunctionGrid(version) {
    const size = hanXinSize(version);
    const matrix = new BitMatrix(size, size);
    const reserved = new Uint8Array(size * size);
    placeFinder(reserved, matrix, 0, 0, HANXIN_FINDER_TOP_LEFT);
    placeFinder(reserved, matrix, size - 7, 0, HANXIN_FINDER_SIDE);
    placeFinder(reserved, matrix, 0, size - 7, HANXIN_FINDER_SIDE);
    placeFinder(reserved, matrix, size - 7, size - 7, HANXIN_FINDER_BOTTOM_RIGHT);
    // The one-module light separators belong to the function region.
    for (let i = 0; i < 8; i++) {
        reserve(reserved, matrix, i, 7, false);
        reserve(reserved, matrix, 7, i, false);
        reserve(reserved, matrix, size - i - 1, 7, false);
        reserve(reserved, matrix, 7, size - i - 1, false);
        reserve(reserved, matrix, size - 8, i, false);
        reserve(reserved, matrix, i, size - 8, false);
        reserve(reserved, matrix, size - 8, size - i - 1, false);
        reserve(reserved, matrix, size - i - 1, size - 8, false);
    }
    // Two redundant copies of the 34-bit structural information are carried
    // around the finder patterns. The four 9-module strips below reserve all
    // positions; shared corners make the wire order 9+8+9+8 modules per copy.
    for (let i = 0; i < 9; i++) {
        reserve(reserved, matrix, i, 8, false);
        reserve(reserved, matrix, 8, i, false);
        reserve(reserved, matrix, size - i - 1, 8, false);
        reserve(reserved, matrix, 8, size - i - 1, false);
        reserve(reserved, matrix, size - 9, i, false);
        reserve(reserved, matrix, i, size - 9, false);
        reserve(reserved, matrix, size - 9, size - i - 1, false);
        reserve(reserved, matrix, size - i - 1, size - 9, false);
    }
    return { matrix, reserved };
}
/** Return payload positions in the normative row-major order. */
export function hanXinDataCoordinates(version) {
    const { reserved } = createHanXinFunctionGrid(version);
    const size = hanXinSize(version);
    const result = [];
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            if (reserved[index(size, x, y)] === 0)
                result.push([x, y]);
        }
    return result;
}
/** Whether a data module is inverted by one of Han Xin's four masks. */
export function hanXinMaskFlip(mask, x, y) {
    if (!Number.isInteger(mask) || mask < 0 || mask > 3)
        return false;
    const i = y + 1;
    const j = x + 1;
    // The first public mask is the constant-zero (no inversion) mask.  The
    // remaining three masks are the parity expressions from the format
    // definition, represented here with zero-based API values 1-3.
    if (mask === 0)
        return false;
    if (mask === 1)
        return ((i + j) & 1) === 0;
    if (mask === 2)
        return ((((i + j) % 3) + (j % 3)) & 1) === 0;
    if (j === 0 || i === 0)
        return false;
    return (((i % j) + (j % i) + (i % 3) + (j % 3)) & 1) === 0;
}
/** Build the 34 structural bits protected by the GF(16) short RS block. */
export function hanXinFunctionInfoBits(version, level, mask) {
    if (!Number.isInteger(mask) || mask < 0 || mask > 3)
        throw new FormatError('Han Xin: mask must be an integer from 0 to 3');
    const value = ((version + 20) << 4) | (hanXinEccIndex(level) << 2) | mask;
    const data = [(value >>> 8) & 0x0f, (value >>> 4) & 0x0f, value & 0x0f];
    const ecc = rsEncode(data, 4, GF16, 1);
    const bits = [];
    for (const symbol of data.concat(ecc))
        for (let bit = 3; bit >= 0; bit--)
            bits.push(((symbol >>> bit) & 1) !== 0);
    // The six non-codeword bits are part of the fixed Han Xin function
    // information pattern, not arbitrary padding.
    for (const bit of [false, true, false, true, false, true])
        bits.push(bit);
    if (bits.length !== 34)
        throw new FormatError('Han Xin: invalid function information length');
    return bits;
}
/** Place both redundant structural-information copies in the fixed strips. */
export function placeHanXinFunctionInfo(matrix, version, level, mask) {
    const size = hanXinSize(version);
    const bits = hanXinFunctionInfoBits(version, level, mask);
    // The four strips contain 9 + 8 + 9 + 8 modules.  The corner cells where
    // two strips meet are shared; they must not consume the preceding bit a
    // second time.
    for (let i = 0; i < 9; i++) {
        matrix.setValue(i, 8, bits[i]);
        matrix.setValue(size - 1 - i, size - 9, bits[i]);
    }
    for (let i = 0; i < 8; i++) {
        matrix.setValue(8, 7 - i, bits[9 + i]);
        matrix.setValue(size - 9, size - 8 + i, bits[9 + i]);
    }
    for (let i = 0; i < 9; i++) {
        matrix.setValue(size - 9, i, bits[i + 17]);
        matrix.setValue(8, size - 1 - i, bits[i + 17]);
    }
    for (let i = 0; i < 8; i++) {
        matrix.setValue(size - 8 + i, 8, bits[26 + i]);
        matrix.setValue(7 - i, size - 9, bits[26 + i]);
    }
}
function readInfoCopy(matrix, version) {
    const size = hanXinSize(version);
    const bits = [];
    for (let i = 0; i < 9; i++)
        bits.push(matrix.get(i, 8));
    for (let i = 0; i < 8; i++)
        bits.push(matrix.get(8, 7 - i));
    for (let i = 0; i < 9; i++)
        bits.push(matrix.get(size - 9, i));
    for (let i = 0; i < 8; i++)
        bits.push(matrix.get(size - 8 + i, 8));
    return bits;
}
/** Decode a structural information copy, correcting up to two nibble errors. */
export function decodeHanXinFunctionInfo(matrix, version) {
    const copies = [readInfoCopy(matrix, version)];
    const size = hanXinSize(version);
    const second = new BitMatrix(size, size);
    // The second copy is read directly in its wire order.  Keeping this helper
    // local avoids exposing an orientation-specific representation publicly.
    for (let i = 0; i < 9; i++) {
        second.setValue(i, 8, matrix.get(size - 1 - i, size - 9));
    }
    for (let i = 0; i < 8; i++) {
        second.setValue(8, 7 - i, matrix.get(size - 9, size - 8 + i));
    }
    for (let i = 0; i < 9; i++) {
        second.setValue(size - 9, i, matrix.get(8, size - 1 - i));
    }
    for (let i = 0; i < 8; i++) {
        second.setValue(size - 8 + i, 8, matrix.get(7 - i, size - 9));
    }
    copies.push(readInfoCopy(second, version));
    let best = null;
    for (const bits of copies) {
        const fixedTail = [false, true, false, true, false, true];
        if (bits.length !== 34 || fixedTail.some((bit, index) => bits[28 + index] !== bit))
            continue;
        const symbols = [];
        for (let i = 0; i < 7; i++) {
            let symbol = 0;
            for (let bit = 0; bit < 4; bit++)
                symbol = (symbol << 1) | (bits[i * 4 + bit] ? 1 : 0);
            symbols.push(symbol);
        }
        try {
            const corrections = rsDecode(symbols, 4, GF16, 1);
            if (!best || corrections < best.corrections)
                best = { value: symbols, corrections };
        }
        catch {
            // Try the redundant copy before rejecting the symbol.
        }
    }
    if (!best)
        throw new FormatError('Han Xin: structural information is unreadable');
    const value = (best.value[0] << 8) | (best.value[1] << 4) | best.value[2];
    const encodedVersion = (value >>> 4) - 20;
    const levelIndex = (value >>> 2) & 3;
    const mask = value & 3;
    if (encodedVersion !== version)
        throw new FormatError('Han Xin: structural version disagrees with matrix dimensions');
    return {
        version,
        level: HANXIN_ECC_LEVELS[levelIndex],
        mask,
        corrections: best.corrections,
    };
}
/** Verify all fixed modules and count the payload cells. */
export function validateHanXinTables() {
    const errors = [];
    for (const version of HANXIN_VERSIONS) {
        const size = hanXinSize(version);
        const cells = hanXinDataCoordinates(version).length;
        if (cells !== HANXIN_DATA_MODULES[version - 1]) {
            errors.push(`Version ${version}: ${cells} data modules, expected ${HANXIN_DATA_MODULES[version - 1]}`);
        }
        for (const level of HANXIN_ECC_LEVELS) {
            const layout = hanXinEcLayout(version, level);
            if (layout.dataCodewords + layout.eccCodewords !== HANXIN_TOTAL_CODEWORDS[version - 1]) {
                errors.push(`Version ${version} ${level}: invalid RS block total`);
            }
        }
        if (size !== 21 + version * 2)
            errors.push(`Version ${version}: invalid dimension`);
    }
    return errors;
}
