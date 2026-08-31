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
 * Linear symbologies.
 *
 * @module oned
 */
export { encodeEAN13, encodeEAN8, encodeUPCA, encodeUPCE, encodeISBN, encodeCode39, encodeCode93, encodeCode128, encodeITF, encodeITF14, encodeCodabar, encodeCode11, encodeMSI, encodePharmacode, encodeCode32, encodePZN, code32CheckDigit, decodeCode32Payload, decodePZNPayload, ean13CheckDigit, } from './writers.js';
export { CODE25_DIGIT_PATTERNS, CODE25_VARIANTS, CODE25_MAX_DIGITS, code25CheckDigit, encodeCode25, encodeStandard2of5, encodeIndustrial2of5, encodeIATA2of5, } from './code25.js';
export { TELEPEN_START_VALUE, TELEPEN_STOP_VALUE, TELEPEN_MAX_LENGTH, telepenPattern, encodeTelepen, encodeTelepenNumeric, decodeTelepen, decodeTelepenNumeric, } from './telepen.js';
export { EAN2_PARITY, EAN5_PARITY, EAN2_WIDTH, EAN5_WIDTH, EAN_ADDON_START, EAN_ADDON_SEPARATOR, ean2Parity, ean5Checksum, ean5CheckDigit, ean5Parity, encodeEAN2, encodeEAN5, encodeEANAddon, encodeEANAddOn, decodeEAN2, decodeEAN5, decodeEANAddon, decodeEANAddOn, composeEANAddon, encodeEAN13WithAddon, encodeEAN8WithAddon, encodeUPCAWithAddon, encodeUPCEWithAddon, } from './addons.js';
export { decodeOneD, decodeOneDStrict, decodeCode32, decodePZN, decodeCode25, decodeStandard2of5, decodeIndustrial2of5, decodeIATA2of5, decodeCode11, decodeMSI, patternVariance, recordPattern, toNarrowWidePattern, } from './reader.js';
export { POSTAL_FORMATS, POSTAL_ALIASES, STATE_PROFILES, encodePostnet, encodePlanet, encodeRM4SCC, encodeKIX, encodeAustraliaPost, encodeJapanPost, encodeIMB, decodePostal, } from './postal.js';
export { validateTables } from './patterns.js';
import { encodeEAN13, encodeEAN8, encodeUPCA, encodeUPCE, encodeISBN, encodeCode39, encodeCode93, encodeCode128, encodeITF, encodeITF14, encodeCodabar, encodeCode11, encodeMSI, encodePharmacode, encodeCode32, encodePZN, } from './writers.js';
import { encodeEAN2, encodeEAN5 } from './addons.js';
import { encodeTelepen } from './telepen.js';
import { encodeIndustrial2of5, encodeIATA2of5 } from './code25.js';
import { encodePostnet, encodePlanet, encodeRM4SCC, encodeKIX, encodeAustraliaPost, encodeJapanPost, encodeIMB, } from './postal.js';
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
export const ONED_FORMATS = {
    ean13: { encode: encodeEAN13, readable: true, label: 'EAN-13' },
    ean8: { encode: encodeEAN8, readable: true, label: 'EAN-8' },
    upca: { encode: encodeUPCA, readable: true, label: 'UPC-A' },
    isbn: { encode: encodeISBN, readable: true, label: 'ISBN (Bookland EAN-13)' },
    upce: { encode: encodeUPCE, readable: true, label: 'UPC-E' },
    code128: { encode: encodeCode128, readable: true, label: 'Code 128' },
    gs1128: {
        encode: (v, o) => encodeCode128(v, { ...o, gs1: true }),
        readable: true,
        label: 'GS1-128',
    },
    code39: { encode: encodeCode39, readable: true, label: 'Code 39' },
    code93: { encode: encodeCode93, readable: true, label: 'Code 93' },
    itf: { encode: encodeITF, readable: true, label: 'ITF (Interleaved 2 of 5)' },
    itf14: { encode: encodeITF14, readable: true, label: 'ITF-14' },
    industrial2of5: { encode: encodeIndustrial2of5, readable: true, label: 'Industrial 2 of 5' },
    iata2of5: { encode: encodeIATA2of5, readable: true, label: 'IATA 2 of 5' },
    codabar: { encode: encodeCodabar, readable: true, label: 'Codabar' },
    code11: { encode: encodeCode11, readable: true, label: 'Code 11' },
    msi: { encode: encodeMSI, readable: true, label: 'MSI Plessey' },
    code32: { encode: encodeCode32, readable: true, label: 'Code 32 (Italian Pharmacode)' },
    pzn: { encode: encodePZN, readable: true, label: 'PZN (Pharmazentralnummer)' },
    telepen: { encode: encodeTelepen, readable: true, label: 'Telepen' },
    pharmacode: { encode: encodePharmacode, readable: false, label: 'Pharmacode' },
    // Supplements are reported as readable capabilities, but the image reader
    // only accepts them when attached to a validated EAN/UPC parent symbol.
    ean2: { encode: encodeEAN2, readable: true, role: 'supplement', label: 'EAN-2 supplement' },
    ean5: { encode: encodeEAN5, readable: true, role: 'supplement', label: 'EAN-5 supplement' },
    postnet: { encode: encodePostnet, readable: true, label: 'USPS POSTNET' },
    planet: { encode: encodePlanet, readable: true, label: 'USPS PLANET' },
    rm4scc: { encode: encodeRM4SCC, readable: true, label: 'Royal Mail 4-State (RM4SCC)' },
    kix: { encode: encodeKIX, readable: true, label: 'KIX postal code' },
    auspost: { encode: encodeAustraliaPost, readable: true, label: 'Australia Post 4-State' },
    japanpost: { encode: encodeJapanPost, readable: true, label: 'Japan Post 4-State' },
    imb: { encode: encodeIMB, readable: true, label: 'USPS Intelligent Mail (IMb)' },
};
