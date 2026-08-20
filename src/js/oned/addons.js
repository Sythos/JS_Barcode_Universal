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
 * UPC/EAN two- and five-digit supplements.
 *
 * Supplements are small symbols printed to the right of an EAN/UPC symbol.
 * They use the ordinary EAN odd/even digit patterns, a 1011 start guard and
 * 01 separators between digits. EAN-2 selects its parity from the numeric
 * value modulo four. EAN-5 derives a checksum from the five digits and uses
 * that value to select one of ten parity rows.
 *
 * This module intentionally keeps supplements separate from the base EAN/UPC
 * writers. `composeEANAddon` and the `*WithAddon` helpers are opt-in; existing
 * EAN/UPC APIs continue to return their original one-row matrices unchanged.
 *
 * @module oned/addons
 */
import { BitMatrix } from '../core/bit-matrix.js';
import { EncodeError, FormatError } from '../core/errors.js';
import { EAN_L, EAN_G, } from './patterns.js';
import { encodeEAN13, encodeEAN8, encodeUPCA, encodeUPCE, } from './writers.js';
/** EAN-2 parity rows, indexed by the two-digit value modulo four. */
export const EAN2_PARITY = Object.freeze([
    'AA', 'AB', 'BA', 'BB',
]);
/** EAN-5 parity rows, indexed by the supplemental checksum. */
export const EAN5_PARITY = Object.freeze([
    'BBAAA', 'BABAA', 'BAABA', 'BAAAB', 'ABBAA',
    'AABBA', 'AAABB', 'ABABA', 'ABAAB', 'AABAB',
]);
/** Start guard used by both UPC/EAN supplemental symbols. */
export const EAN_ADDON_START = '1011';
/** Separator inserted between adjacent supplemental digits. */
export const EAN_ADDON_SEPARATOR = '01';
export const EAN2_WIDTH = EAN_ADDON_START.length + 2 * 7 + EAN_ADDON_SEPARATOR.length;
export const EAN5_WIDTH = EAN_ADDON_START.length + 5 * 7 + EAN_ADDON_SEPARATOR.length * 4;
/**
 * @param {unknown} value
 * @param {number} length
 * @param {string} format
 * @returns {string}
 */
function normalizeDigits(value, length, format) {
    const digits = String(value);
    if (!new RegExp(`^[0-9]{${length}}$`).test(digits)) {
        throw new EncodeError(`${format}: payload must contain exactly ${length} digits`);
    }
    return digits;
}
/**
 * EAN-5 supplemental checksum.
 *
 * The first, third and fifth digits carry weight three; the second and fourth
 * carry weight nine. The checksum is not printed as a sixth digit: it selects
 * the odd/even parity row for the five encoded digits.
 *
 * @param {string|number} value Five digits.
 * @returns {number} Checksum value, 0-9.
 */
export function ean5Checksum(value) {
    const digits = normalizeDigits(value, 5, 'EAN-5');
    const weighted = 3 * (Number(digits[0]) + Number(digits[2]) + Number(digits[4])) +
        9 * (Number(digits[1]) + Number(digits[3]));
    return weighted % 10;
}
/** Alias for callers that use the EAN family check-digit terminology. */
export const ean5CheckDigit = ean5Checksum;
/**
 * Resolve the EAN-2 parity row for a payload.
 *
 * @param {string|number} value Two digits.
 * @returns {string} Two-character A/B parity row.
 */
export function ean2Parity(value) {
    const digits = normalizeDigits(value, 2, 'EAN-2');
    return EAN2_PARITY[Number(digits) % 4];
}
/**
 * Resolve the EAN-5 parity row for a payload.
 *
 * @param {string|number} value Five digits.
 * @returns {string} Five-character A/B parity row.
 */
export function ean5Parity(value) {
    return EAN5_PARITY[ean5Checksum(value)];
}
/**
 * Expand an A/B parity row into EAN digit patterns.
 *
 * @param {string} digits
 * @param {string} parity
 * @returns {string}
 */
function encodeDigitPatterns(digits, parity) {
    let modules = EAN_ADDON_START;
    for (let i = 0; i < digits.length; i++) {
        if (i > 0)
            modules += EAN_ADDON_SEPARATOR;
        const table = parity[i] === 'A' ? EAN_L : EAN_G;
        modules += table[Number(digits[i])];
    }
    return modules;
}
/**
 * Turn a module string into a one-row matrix and attach immutable source
 * metadata for composition/rendering callers.
 *
 * @param {string} modules
 * @param {{format: string, text: string, parity: string, checksum?: number}} metadata
 * @returns {BitMatrix}
 */
function toAddonMatrix(modules, metadata) {
    const matrix = new BitMatrix(modules.length, 1);
    for (let x = 0; x < modules.length; x++) {
        if (modules[x] === '1')
            matrix.set(x, 0);
    }
    matrix.eanAddon = Object.freeze({ ...metadata });
    return matrix;
}
/**
 * Encode an EAN-2 supplement.
 *
 * @param {string|number} value Exactly two decimal digits.
 * @returns {BitMatrix} A 20-module, one-row supplement.
 */
export function encodeEAN2(value) {
    const digits = normalizeDigits(value, 2, 'EAN-2');
    const parity = ean2Parity(digits);
    const matrix = toAddonMatrix(encodeDigitPatterns(digits, parity), {
        format: 'ean2',
        text: digits,
        parity,
    });
    if (matrix.width !== EAN2_WIDTH) {
        throw new EncodeError(`EAN-2: internal width is ${matrix.width}, expected ${EAN2_WIDTH}`);
    }
    return matrix;
}
/**
 * Encode an EAN-5 supplement.
 *
 * @param {string|number} value Exactly five decimal digits.
 * @returns {BitMatrix} A 47-module, one-row supplement.
 */
export function encodeEAN5(value) {
    const digits = normalizeDigits(value, 5, 'EAN-5');
    const checksum = ean5Checksum(digits);
    const parity = EAN5_PARITY[checksum];
    const matrix = toAddonMatrix(encodeDigitPatterns(digits, parity), {
        format: 'ean5',
        text: digits,
        parity,
        checksum,
    });
    if (matrix.width !== EAN5_WIDTH) {
        throw new EncodeError(`EAN-5: internal width is ${matrix.width}, expected ${EAN5_WIDTH}`);
    }
    return matrix;
}
/**
 * Encode either supported supplement length.
 *
 * @param {string|number} value Two or five decimal digits.
 * @returns {BitMatrix}
 */
export function encodeEANAddon(value) {
    const digits = String(value);
    if (digits.length === 2)
        return encodeEAN2(digits);
    if (digits.length === 5)
        return encodeEAN5(digits);
    throw new EncodeError('EAN add-on: payload must contain exactly two or five digits');
}
/** Alias using the spelling used by some EAN documentation. */
export const encodeEANAddOn = encodeEANAddon;
/**
 * @param {BitMatrix} matrix
 * @param {number} offset
 * @param {string} pattern
 * @returns {boolean}
 */
function matches(matrix, offset, pattern) {
    if (offset < 0 || offset + pattern.length > matrix.width)
        return false;
    for (let i = 0; i < pattern.length; i++) {
        if ((matrix.get(offset + i, 0) ? '1' : '0') !== pattern[i])
            return false;
    }
    return true;
}
/**
 * @param {BitMatrix} matrix
 * @param {number} start
 * @param {2|5} digitCount
 * @returns {{format:string,text:string,parity:string,checksum?:number,end:number}|null}
 */
function decodeAt(matrix, start, digitCount) {
    const width = digitCount === 2 ? EAN2_WIDTH : EAN5_WIDTH;
    if (!matches(matrix, start, EAN_ADDON_START))
        return null;
    if (start > 0 && matrix.get(start - 1, 0))
        return null;
    let offset = start + EAN_ADDON_START.length;
    let text = '';
    let parity = '';
    for (let i = 0; i < digitCount; i++) {
        let found = null;
        for (let digit = 0; digit < 10; digit++) {
            for (const [letter, table] of [['A', EAN_L], ['B', EAN_G]]) {
                if (matches(matrix, offset, table[digit]) &&
                    (!found || found.letter !== letter || found.digit !== digit)) {
                    if (found)
                        return null;
                    found = { digit, letter };
                }
            }
        }
        if (!found)
            return null;
        text += String(found.digit);
        parity += found.letter;
        offset += 7;
        if (i < digitCount - 1) {
            if (!matches(matrix, offset, EAN_ADDON_SEPARATOR))
                return null;
            offset += EAN_ADDON_SEPARATOR.length;
        }
    }
    if (offset - start !== width)
        return null;
    if (digitCount === 2) {
        if (EAN2_PARITY[Number(text) % 4] !== parity)
            return null;
        return { format: 'ean2', text, parity, end: offset };
    }
    const checksum = ean5Checksum(text);
    if (EAN5_PARITY[checksum] !== parity)
        return null;
    return { format: 'ean5', text, parity, checksum, end: offset };
}
/**
 * Validate and decode an EAN-2 supplement. A leading quiet zone is accepted;
 * the decoder searches the row for a valid start guard so a composed base
 * EAN/UPC matrix can be passed directly as well.
 *
 * @param {BitMatrix} matrix One-row, module-aligned supplement or composition.
 * @returns {{format:'ean2',text:string,parity:string}}
 * @throws {FormatError} When no valid supplement is found.
 */
export function decodeEAN2(matrix) {
    if (!matrix || !Number.isInteger(matrix.width) || matrix.height !== 1) {
        throw new FormatError('EAN-2: expected a one-row module matrix');
    }
    for (let start = 0; start + EAN2_WIDTH <= matrix.width; start++) {
        const result = decodeAt(matrix, start, 2);
        if (result) {
            const { end, ...publicResult } = result;
            void end;
            return publicResult;
        }
    }
    throw new FormatError('EAN-2: start, parity or digit pattern is invalid');
}
/**
 * Validate and decode an EAN-5 supplement.
 *
 * @param {BitMatrix} matrix One-row, module-aligned supplement or composition.
 * @returns {{format:'ean5',text:string,parity:string,checksum:number}}
 * @throws {FormatError} When no valid supplement is found.
 */
export function decodeEAN5(matrix) {
    if (!matrix || !Number.isInteger(matrix.width) || matrix.height !== 1) {
        throw new FormatError('EAN-5: expected a one-row module matrix');
    }
    for (let start = 0; start + EAN5_WIDTH <= matrix.width; start++) {
        const result = decodeAt(matrix, start, 5);
        if (result) {
            const { end, ...publicResult } = result;
            void end;
            return publicResult;
        }
    }
    throw new FormatError('EAN-5: start, parity, checksum or digit pattern is invalid');
}
/**
 * Decode either supported supplement length.
 *
 * @param {BitMatrix} matrix One-row, module-aligned supplement or composition.
 * @returns {{format:'ean2'|'ean5',text:string,parity:string,checksum?:number}}
 * @throws {FormatError} When neither supplement grammar matches.
 */
export function decodeEANAddon(matrix) {
    try {
        return decodeEAN5(matrix);
    }
    catch (fiveError) {
        try {
            return decodeEAN2(matrix);
        }
        catch (twoError) {
            throw new FormatError(`EAN add-on: ${fiveError.message}; ${twoError.message}`);
        }
    }
}
/** Alias using the spelling used by some EAN documentation. */
export const decodeEANAddOn = decodeEANAddon;
/**
 * Join a base EAN/UPC matrix and a supplement with the standard quiet gap.
 *
 * The helper does not alter either input. By default it inserts nine light
 * modules, the conventional separation between the base symbol and an add-on.
 * The result carries the supplement metadata under `eanAddon` for renderers or
 * callers that need to label the composed symbol.
 *
 * @param {BitMatrix} base Base EAN/UPC matrix.
 * @param {BitMatrix|string|number} addon Add-on matrix or two/five digits.
 * @param {{gap?:number}} [options]
 * @returns {BitMatrix}
 */
export function composeEANAddon(base, addon, options = {}) {
    if (!base || !Number.isInteger(base.width) || base.height !== 1) {
        throw new TypeError('EAN add-on: base must be a one-row module matrix');
    }
    const addonMatrix = typeof addon === 'string' || typeof addon === 'number'
        ? encodeEANAddon(addon)
        : addon;
    if (!addonMatrix || !Number.isInteger(addonMatrix.width) || addonMatrix.height !== 1) {
        throw new TypeError('EAN add-on: supplement must be a one-row module matrix or digits');
    }
    const gap = options.gap === undefined ? 9 : Number(options.gap);
    if (!Number.isInteger(gap) || gap < 1) {
        throw new EncodeError(`EAN add-on: gap must be a positive integer, got ${options.gap}`);
    }
    const result = new BitMatrix(base.width + gap + addonMatrix.width, 1);
    for (let x = 0; x < base.width; x++)
        if (base.get(x, 0))
            result.set(x, 0);
    for (let x = 0; x < addonMatrix.width; x++) {
        if (addonMatrix.get(x, 0))
            result.set(base.width + gap + x, 0);
    }
    if (addonMatrix.eanAddon)
        result.eanAddon = { ...addonMatrix.eanAddon, gap };
    return result;
}
/**
 * Compose an EAN-13 symbol with an EAN-2 or EAN-5 supplement.
 *
 * @param {string} value Base EAN-13 payload.
 * @param {string|number} addon Two or five supplemental digits.
 * @param {{gap?:number}} [options]
 * @returns {BitMatrix}
 */
export function encodeEAN13WithAddon(value, addon, options = {}) {
    return composeEANAddon(encodeEAN13(value), addon, options);
}
/** @see encodeEAN13WithAddon */
export function encodeEAN8WithAddon(value, addon, options = {}) {
    return composeEANAddon(encodeEAN8(value), addon, options);
}
/** @see encodeEAN13WithAddon */
export function encodeUPCAWithAddon(value, addon, options = {}) {
    return composeEANAddon(encodeUPCA(value), addon, options);
}
/** @see encodeEAN13WithAddon */
export function encodeUPCEWithAddon(value, addon, options = {}) {
    return composeEANAddon(encodeUPCE(value), addon, options);
}
