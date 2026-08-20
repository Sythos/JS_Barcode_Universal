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
/** EAN-2 parity rows, indexed by the two-digit value modulo four. */
export declare const EAN2_PARITY: readonly string[];
/** EAN-5 parity rows, indexed by the supplemental checksum. */
export declare const EAN5_PARITY: readonly string[];
/** Start guard used by both UPC/EAN supplemental symbols. */
export declare const EAN_ADDON_START = "1011";
/** Separator inserted between adjacent supplemental digits. */
export declare const EAN_ADDON_SEPARATOR = "01";
export declare const EAN2_WIDTH: number;
export declare const EAN5_WIDTH: number;
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
export declare function ean5Checksum(value: string | number): number;
/** Alias for callers that use the EAN family check-digit terminology. */
export declare const ean5CheckDigit: typeof ean5Checksum;
/**
 * Resolve the EAN-2 parity row for a payload.
 *
 * @param {string|number} value Two digits.
 * @returns {string} Two-character A/B parity row.
 */
export declare function ean2Parity(value: string | number): string;
/**
 * Resolve the EAN-5 parity row for a payload.
 *
 * @param {string|number} value Five digits.
 * @returns {string} Five-character A/B parity row.
 */
export declare function ean5Parity(value: string | number): string;
/**
 * Encode an EAN-2 supplement.
 *
 * @param {string|number} value Exactly two decimal digits.
 * @returns {BitMatrix} A 20-module, one-row supplement.
 */
export declare function encodeEAN2(value: string | number): BitMatrix;
/**
 * Encode an EAN-5 supplement.
 *
 * @param {string|number} value Exactly five decimal digits.
 * @returns {BitMatrix} A 47-module, one-row supplement.
 */
export declare function encodeEAN5(value: string | number): BitMatrix;
/**
 * Encode either supported supplement length.
 *
 * @param {string|number} value Two or five decimal digits.
 * @returns {BitMatrix}
 */
export declare function encodeEANAddon(value: string | number): BitMatrix;
/** Alias using the spelling used by some EAN documentation. */
export declare const encodeEANAddOn: typeof encodeEANAddon;
/**
 * Validate and decode an EAN-2 supplement. A leading quiet zone is accepted;
 * the decoder searches the row for a valid start guard so a composed base
 * EAN/UPC matrix can be passed directly as well.
 *
 * @param {BitMatrix} matrix One-row, module-aligned supplement or composition.
 * @returns {{format:'ean2',text:string,parity:string}}
 * @throws {FormatError} When no valid supplement is found.
 */
export declare function decodeEAN2(matrix: BitMatrix): {
    format: 'ean2';
    text: string;
    parity: string;
};
/**
 * Validate and decode an EAN-5 supplement.
 *
 * @param {BitMatrix} matrix One-row, module-aligned supplement or composition.
 * @returns {{format:'ean5',text:string,parity:string,checksum:number}}
 * @throws {FormatError} When no valid supplement is found.
 */
export declare function decodeEAN5(matrix: BitMatrix): {
    format: 'ean5';
    text: string;
    parity: string;
    checksum: number;
};
/**
 * Decode either supported supplement length.
 *
 * @param {BitMatrix} matrix One-row, module-aligned supplement or composition.
 * @returns {{format:'ean2'|'ean5',text:string,parity:string,checksum?:number}}
 * @throws {FormatError} When neither supplement grammar matches.
 */
export declare function decodeEANAddon(matrix: BitMatrix): {
    format: 'ean2' | 'ean5';
    text: string;
    parity: string;
    checksum?: number;
};
/** Alias using the spelling used by some EAN documentation. */
export declare const decodeEANAddOn: typeof decodeEANAddon;
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
export declare function composeEANAddon(base: BitMatrix, addon: BitMatrix | string | number, options?: {
    gap?: number;
}): BitMatrix;
/**
 * Compose an EAN-13 symbol with an EAN-2 or EAN-5 supplement.
 *
 * @param {string} value Base EAN-13 payload.
 * @param {string|number} addon Two or five supplemental digits.
 * @param {{gap?:number}} [options]
 * @returns {BitMatrix}
 */
export declare function encodeEAN13WithAddon(value: string, addon: string | number, options?: {
    gap?: number;
}): BitMatrix;
/** @see encodeEAN13WithAddon */
export declare function encodeEAN8WithAddon(value: any, addon: any, options?: {}): BitMatrix;
/** @see encodeEAN13WithAddon */
export declare function encodeUPCAWithAddon(value: any, addon: any, options?: {}): BitMatrix;
/** @see encodeEAN13WithAddon */
export declare function encodeUPCEWithAddon(value: any, addon: any, options?: {}): BitMatrix;
