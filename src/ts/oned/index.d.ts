/*!
 * Sythos Barcode Suite
 *
 * MIT License
 *
 * Copyright (c) 2026 Sythos
 * SPDX-FileCopyrightText: 2026 Sythos (https://www.sythos.net)
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
 * Linear symbologies.
 *
 * @module oned
 */
export { encodeEAN13, encodeEAN8, encodeUPCA, encodeUPCE, encodeISBN, encodeCode39, encodeCode93, encodeCode128, encodeITF, encodeITF14, encodeCodabar, encodeCode11, encodeMSI, encodePharmacode, code32CheckDigit, encodeCode32, decodeCode32Payload, encodePZN, decodePZNPayload, ean13CheckDigit, } from './writers.js';
export { CODE25_DIGIT_PATTERNS, CODE25_VARIANTS, CODE25_MAX_DIGITS, code25CheckDigit, encodeCode25, encodeStandard2of5, encodeIndustrial2of5, encodeIATA2of5, } from './code25.js';
export type { Code25Variant } from './code25.js';
export { EAN2_PARITY, EAN5_PARITY, EAN2_WIDTH, EAN5_WIDTH, EAN_ADDON_START, EAN_ADDON_SEPARATOR, ean2Parity, ean5Checksum, ean5CheckDigit, ean5Parity, encodeEAN2, encodeEAN5, encodeEANAddon, encodeEANAddOn, decodeEAN2, decodeEAN5, decodeEANAddon, decodeEANAddOn, composeEANAddon, encodeEAN13WithAddon, encodeEAN8WithAddon, encodeUPCAWithAddon, encodeUPCEWithAddon, } from './addons.js';
export { decodeOneD, decodeOneDStrict, decodeCode32, decodePZN, decodeCode25, decodeStandard2of5, decodeIndustrial2of5, decodeIATA2of5, decodeCode11, decodeMSI, patternVariance, recordPattern, toNarrowWidePattern, } from './reader.js';
export { TELEPEN_START_VALUE, TELEPEN_STOP_VALUE, TELEPEN_MAX_LENGTH, telepenPattern, encodeTelepen, encodeTelepenNumeric, decodeTelepen, decodeTelepenNumeric, } from './telepen.js';
export { POSTAL_FORMATS, POSTAL_ALIASES, STATE_PROFILES, encodePostnet, encodePlanet, encodeRM4SCC, encodeKIX, encodeAustraliaPost, encodeJapanPost, encodeIMB, decodePostal, } from './postal.js';
export type { PostalFormat, PostalOptions, PostalDecodeResult } from './postal.js';
export { validateTables } from './patterns.js';
/**
 * Writers by format id, for the top-level `encode()` dispatcher.
 *
 * `readable` marks the formats this suite can also decode. Writing is a table
 * lookup and easy to support broadly; reading needs a detector per symbology,
 * so the two lists legitimately differ and the API says so rather than
 * failing at runtime.
 *
 * @type {Record<string, {encode: Function, readable: boolean, label: string, role?: string}>}
 */
export declare const ONED_FORMATS: Record<string, {
    encode: Function;
    readable: boolean;
    label: string;
    role?: string;
}>;
