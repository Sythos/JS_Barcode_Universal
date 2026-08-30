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
/** MaxiCode encoder for ISO/IEC 16023 modes 2 through 5. @module maxicode/encoder */
import { BitMatrix } from '../core/bit-matrix.js';
import { EncodeError } from '../core/errors.js';
import { GF64 } from '../core/galois-field.js';
import { rsEncode } from '../core/reed-solomon.js';
import { MAXICODE_CODEWORDS, MAXICODE_DATA_MODULES, MAXICODE_GRID, MAXICODE_HEIGHT, MAXICODE_ORIENTATION_DARK, MAXICODE_WIDTH, maxicodeFinderValue, } from './tables.js';
/** @typedef {'A'|'B'|'C'|'D'|'E'} MaxiCodeSet */
/**
 * @typedef {object} MaxiCodePrimary
 * @property {string} postalCode Mode 2 numeric postal code, or Mode 3 text.
 * @property {number} countryCode ISO numeric country code 0..999.
 * @property {number} serviceClass Three-digit service class 0..999.
 */
/**
 * @typedef {object} MaxiCodeEncodeOptions
 * @property {2|3|4|5} [mode] MaxiCode mode. Default 4.
 * @property {MaxiCodePrimary} [primary] Required for modes 2 and 3.
 * @property {'latin1'} [charset] Accepted for API clarity; ISO-8859-1 only.
 */
/**
 * A matrix returned by the encoder carries non-enumerable-free metadata used
 * by the focused reader tests and by applications that want the mode.
 * @typedef {import('../core/bit-matrix.js').BitMatrix & {maxicode?: object}} MaxiCodeMatrix
 */
/** @param {number} cp @returns {number|null} Code Set A symbol value. */
export function codeSetAValue(cp) {
    if (cp === 28 || cp === 29 || cp === 30)
        return cp;
    if (cp === 32)
        return 32;
    if (cp >= 34 && cp <= 58)
        return cp;
    if (cp >= 48 && cp <= 57)
        return cp;
    if (cp >= 65 && cp <= 90)
        return cp - 64;
    return null;
}
/** @param {number} cp @returns {number|null} Code Set B symbol value. */
export function codeSetBValue(cp) {
    if (cp === 96)
        return 0;
    if (cp >= 97 && cp <= 122)
        return cp - 96;
    if (cp === 28 || cp === 29 || cp === 30)
        return cp;
    const values = {
        32: 47, 33: 53, 44: 48, 46: 49, 47: 50, 58: 51,
        59: 37, 60: 38, 61: 39, 62: 40, 63: 41, 64: 52,
        91: 42, 92: 43, 93: 44, 94: 45, 95: 46,
        123: 32, 124: 54, 125: 34, 126: 35, 127: 36,
    };
    return Object.prototype.hasOwnProperty.call(values, cp) ? values[cp] : null;
}
/** @param {number} value @returns {number|null} Code Set A value to ASCII. */
export function codeSetACharacter(value) {
    if (value >= 1 && value <= 26)
        return value + 64;
    if (value === 28 || value === 29 || value === 30 || value === 32)
        return value;
    if (value >= 34 && value <= 58)
        return value;
    if (value >= 48 && value <= 57)
        return value;
    return null;
}
/** @param {number} value @returns {number|null} Code Set B value to ASCII. */
export function codeSetBCharacter(value) {
    if (value === 0)
        return 96;
    if (value >= 1 && value <= 26)
        return value + 96;
    const chars = new Map([
        [32, 123], [34, 125], [35, 126], [36, 127], [37, 59], [38, 60],
        [39, 61], [40, 62], [41, 63], [42, 91], [43, 92], [44, 93],
        [45, 94], [46, 95], [47, 32], [48, 44], [49, 46], [50, 47],
        [51, 58], [52, 64], [53, 33], [54, 124],
    ]);
    return chars.get(value) ?? null;
}
/** @param {number} cp @returns {number|null} Code Set C symbol value. */
export function codeSetCValue(cp) {
    if (cp >= 192 && cp <= 218)
        return cp - 192;
    if (cp >= 219 && cp <= 223)
        return cp - 187;
    const values = {
        128: 48, 129: 49, 130: 50, 131: 51, 132: 52, 133: 53, 134: 54, 135: 55, 136: 56, 137: 57,
        170: 37, 172: 38, 177: 39, 178: 40, 179: 41, 181: 42, 185: 43, 186: 44, 188: 45, 189: 46, 190: 47,
    };
    return Object.prototype.hasOwnProperty.call(values, cp) ? values[cp] : null;
}
/** @param {number} cp @returns {number|null} Code Set D symbol value. */
export function codeSetDValue(cp) {
    if (cp >= 224 && cp <= 250)
        return cp - 224;
    if (cp >= 251 && cp <= 255)
        return cp - 219;
    const values = {
        138: 47, 139: 48, 140: 49, 141: 50, 142: 51, 143: 52, 144: 53, 145: 54, 146: 55, 147: 56, 148: 57,
        161: 37, 168: 38, 171: 39, 175: 40, 176: 41, 180: 42, 183: 43, 184: 44, 187: 45, 191: 46,
    };
    return Object.prototype.hasOwnProperty.call(values, cp) ? values[cp] : null;
}
/** @param {number} cp @returns {number|null} Code Set E symbol value. */
export function codeSetEValue(cp) {
    if (cp >= 0 && cp <= 26)
        return cp;
    if (cp === 27)
        return 30;
    if (cp >= 28 && cp <= 30)
        return cp + 4;
    if (cp === 31)
        return 35;
    if (cp === 32)
        return 59;
    if (cp >= 149 && cp <= 158)
        return cp - 101;
    const values = {
        159: 36, 160: 37, 162: 38, 163: 39, 164: 40, 165: 41, 166: 42, 167: 43,
        169: 44, 173: 45, 174: 46, 182: 47,
    };
    return Object.prototype.hasOwnProperty.call(values, cp) ? values[cp] : null;
}
/** @param {number} value @returns {number|null} Code Set C value to ISO-8859-1. */
export function codeSetCCharacter(value) {
    if (value >= 0 && value <= 26)
        return value + 192;
    if (value >= 32 && value <= 36)
        return value + 187;
    const chars = new Map([
        [37, 170], [38, 172], [39, 177], [40, 178], [41, 179], [42, 181], [43, 185], [44, 186], [45, 188], [46, 189], [47, 190],
        [48, 128], [49, 129], [50, 130], [51, 131], [52, 132], [53, 133], [54, 134], [55, 135], [56, 136], [57, 137],
    ]);
    return chars.get(value) ?? null;
}
/** @param {number} value @returns {number|null} Code Set D value to ISO-8859-1. */
export function codeSetDCharacter(value) {
    if (value >= 0 && value <= 26)
        return value + 224;
    if (value >= 32 && value <= 36)
        return value + 219;
    const chars = new Map([
        [37, 161], [38, 168], [39, 171], [40, 175], [41, 176], [42, 180], [43, 183], [44, 184], [45, 187], [46, 191],
        [47, 138], [48, 139], [49, 140], [50, 141], [51, 142], [52, 143], [53, 144], [54, 145], [55, 146], [56, 147], [57, 148],
    ]);
    return chars.get(value) ?? null;
}
/** @param {number} value @returns {number|null} Code Set E value to ISO-8859-1. */
export function codeSetECharacter(value) {
    if (value >= 0 && value <= 26)
        return value;
    if (value === 30)
        return 27;
    if (value >= 32 && value <= 34)
        return value - 4;
    if (value === 35)
        return 31;
    if (value === 36)
        return 159;
    if (value === 37)
        return 160;
    if (value >= 38 && value <= 43)
        return value + 124;
    if (value === 44)
        return 169;
    if (value === 45)
        return 173;
    if (value === 46)
        return 174;
    if (value === 47)
        return 182;
    if (value >= 48 && value <= 57)
        return value + 101;
    if (value === 59)
        return 32;
    return null;
}
/** @param {number} cp @returns {{set:'C'|'D'|'E', value:number}|null} */
function extendedCodeSetValue(cp) {
    const c = codeSetCValue(cp);
    if (c !== null)
        return { set: 'C', value: c };
    const d = codeSetDValue(cp);
    if (d !== null)
        return { set: 'D', value: d };
    const e = codeSetEValue(cp);
    return e === null ? null : { set: 'E', value: e };
}
/** @param {string|Uint8Array|number[]} value @returns {number[]} Latin-1 bytes. */
function inputBytes(value) {
    if (value instanceof Uint8Array)
        return Array.from(value);
    if (Array.isArray(value)) {
        if (value.some((v) => !Number.isInteger(v) || v < 0 || v > 255)) {
            throw new EncodeError('MaxiCode: numeric byte input must contain values from 0 to 255');
        }
        return value.slice();
    }
    if (typeof value !== 'string')
        throw new EncodeError('MaxiCode: value must be text or bytes');
    const bytes = [];
    for (const character of value) {
        const cp = character.codePointAt(0);
        if (cp === undefined || cp > 255) {
            throw new EncodeError('MaxiCode: text must be representable in ISO-8859-1');
        }
        bytes.push(cp);
    }
    return bytes;
}
/** Convert source bytes to MaxiCode codewords using explicit A/B latches. */
export function encodeMaxiCodeText(value) {
    const bytes = inputBytes(value);
    const out = [];
    /** @type {MaxiCodeSet} */
    let current = 'A';
    for (const cp of bytes) {
        const a = codeSetAValue(cp);
        const b = codeSetBValue(cp);
        if (current === 'A') {
            if (a !== null) {
                out.push(a);
            }
            else if (b !== null) {
                // Latch B is deterministic and keeps the stream easy to audit. A
                // following A character emits Latch A, so no implicit state leaks.
                out.push(63, b);
                current = 'B';
            }
            else {
                const extended = extendedCodeSetValue(cp);
                if (extended === null)
                    throw new EncodeError(`MaxiCode: character U+${cp.toString(16).padStart(4, '0')} is not encodable`);
                out.push(extended.set === 'C' ? 60 : extended.set === 'D' ? 61 : 62, extended.value);
            }
        }
        else if (b !== null) {
            out.push(b);
        }
        else if (a !== null) {
            out.push(63, a);
            current = 'A';
        }
        else {
            const extended = extendedCodeSetValue(cp);
            if (extended === null)
                throw new EncodeError(`MaxiCode: character U+${cp.toString(16).padStart(4, '0')} is not encodable`);
            out.push(extended.set === 'C' ? 60 : extended.set === 'D' ? 61 : 62, extended.value);
        }
    }
    return out;
}
/** @param {string} postal @param {number} country @param {number} service */
function mode2Primary(postal, country, service) {
    if (!/^\d{1,9}$/.test(postal))
        throw new EncodeError('MaxiCode Mode 2: postalCode must contain 1 to 9 digits');
    const numericPostal = Number(postal);
    return [
        ((numericPostal & 0x03) << 4) | 2,
        (numericPostal & 0xfc) >> 2,
        (numericPostal & 0x3f00) >> 8,
        (numericPostal & 0xfc000) >> 14,
        (numericPostal & 0x3f00000) >> 20,
        ((numericPostal & 0x3c000000) >> 26) | ((postal.length & 0x3) << 4),
        ((postal.length & 0x3c) >> 2) | ((country & 0x3) << 4),
        (country & 0xfc) >> 2,
        ((country & 0x300) >> 8) | ((service & 0xf) << 2),
        (service & 0x3f0) >> 4,
    ].map((word) => word & 0x3f);
}
/** @param {string} postal @param {number} country @param {number} service */
function mode3Primary(postal, country, service) {
    if (typeof postal !== 'string' || postal.length < 1 || postal.length > 6) {
        throw new EncodeError('MaxiCode Mode 3: postalCode must contain 1 to 6 Code Set A characters');
    }
    const values = postal.toUpperCase().padEnd(6, ' ').split('').map((c) => codeSetAValue(c.charCodeAt(0)));
    if (values.some((value) => value === null))
        throw new EncodeError('MaxiCode Mode 3: postalCode contains an unsupported character');
    const v = /** @type {number[]} */ (values);
    return [
        ((v[5] & 0x03) << 4) | 3,
        ((v[4] & 0x03) << 4) | ((v[5] & 0x3c) >> 2),
        ((v[3] & 0x03) << 4) | ((v[4] & 0x3c) >> 2),
        ((v[2] & 0x03) << 4) | ((v[3] & 0x3c) >> 2),
        ((v[1] & 0x03) << 4) | ((v[2] & 0x3c) >> 2),
        ((v[0] & 0x03) << 4) | ((v[1] & 0x3c) >> 2),
        ((v[0] & 0x3c) >> 2) | ((country & 0x3) << 4),
        (country & 0xfc) >> 2,
        ((country & 0x300) >> 8) | ((service & 0xf) << 2),
        (service & 0x3f0) >> 4,
    ].map((word) => word & 0x3f);
}
/** @param {MaxiCodeEncodeOptions} options @returns {2|3|4|5} */
function normalizeMode(options) {
    const mode = options.mode ?? 4;
    if (!Number.isInteger(mode) || mode < 2 || mode > 5) {
        throw new EncodeError('MaxiCode: mode must be 2, 3, 4 or 5');
    }
    return /** @type {2|3|4|5} */ (mode);
}
/** @param {MaxiCodeEncodeOptions} options @param {2|3|4|5} mode @param {number[]} [payload] */
function primaryCodewords(options, mode, payload = []) {
    if (mode === 4 || mode === 5) {
        const primary = [mode, ...payload.slice(0, 9)];
        while (primary.length < 10)
            primary.push(33);
        return primary;
    }
    const primary = options.primary;
    if (!primary || typeof primary.postalCode !== 'string') {
        throw new EncodeError(`MaxiCode Mode ${mode}: primary { postalCode, countryCode, serviceClass } is required`);
    }
    const country = primary.countryCode;
    const service = primary.serviceClass;
    if (!Number.isInteger(country) || country < 0 || country > 999 ||
        !Number.isInteger(service) || service < 0 || service > 999) {
        throw new EncodeError('MaxiCode: countryCode and serviceClass must be integers from 0 to 999');
    }
    return mode === 2
        ? mode2Primary(primary.postalCode, country, service)
        : mode3Primary(primary.postalCode, country, service);
}
/** @param {number[]} data @param {number} eccLength @returns {number[]} */
function secondaryErrorCorrection(data, eccLength) {
    const halfData = data.length / 2;
    const even = [];
    const odd = [];
    for (let i = 0; i < data.length; i++)
        (i % 2 === 0 ? even : odd).push(data[i]);
    if (even.length !== halfData || odd.length !== halfData)
        throw new EncodeError('MaxiCode: secondary data must have an even length');
    const evenParity = rsEncode(even, eccLength / 2, GF64, 1);
    const oddParity = rsEncode(odd, eccLength / 2, GF64, 1);
    const parity = [];
    for (let i = 0; i < evenParity.length; i++) {
        parity.push(evenParity[i], oddParity[i]);
    }
    return parity;
}
/** @param {number[]} codewords @returns {BitMatrix} */
export function placeMaxiCodeCodewords(codewords) {
    if (!Array.isArray(codewords) || codewords.length !== MAXICODE_CODEWORDS ||
        codewords.some((word) => !Number.isInteger(word) || word < 0 || word > 63)) {
        throw new EncodeError('MaxiCode: internal codeword stream must contain 144 six-bit values');
    }
    const matrix = new BitMatrix(MAXICODE_WIDTH, MAXICODE_HEIGHT);
    for (let y = 0; y < MAXICODE_HEIGHT; y++) {
        for (let x = 0; x < MAXICODE_WIDTH; x++) {
            const sequence = MAXICODE_GRID[y * MAXICODE_WIDTH + x];
            if (sequence === 0)
                continue;
            const wire = sequence + 5;
            const codeword = Math.floor(wire / 6) - 1;
            const bit = 5 - (wire % 6);
            matrix.setValue(x, y, ((codewords[codeword] >>> bit) & 1) !== 0);
        }
    }
    // Finder: the standard's hexagonal bull's-eye is sampled as concentric
    // rings by the square-module interchange representation used by this SDK.
    for (let y = 0; y < MAXICODE_HEIGHT; y++)
        for (let x = 0; x < MAXICODE_WIDTH; x++) {
            const value = maxicodeFinderValue(x, y);
            if (value !== null)
                matrix.setValue(x, y, value);
        }
    for (const [x, y] of MAXICODE_ORIENTATION_DARK)
        matrix.set(x, y);
    return matrix;
}
/**
 * Encode a MaxiCode symbol. Modes 2 and 3 carry a structured primary message;
 * modes 4 and 5 encode an unstructured secondary text message.
 *
 * @param {string|Uint8Array|number[]} value
 * @param {MaxiCodeEncodeOptions} [options]
 * @returns {MaxiCodeMatrix}
 */
export function encodeMaxiCode(value, options = {}) {
    const mode = normalizeMode(options);
    const data = encodeMaxiCodeText(value);
    const secondaryLength = mode === 5 ? 68 : 84;
    const secondaryEccLength = mode === 5 ? 56 : 40;
    const primaryDataLength = mode === 4 || mode === 5 ? 9 : 0;
    if (data.length > primaryDataLength + secondaryLength) {
        throw new EncodeError(`MaxiCode Mode ${mode}: payload needs ${data.length} codewords, maximum is ` +
            `${primaryDataLength + secondaryLength}`);
    }
    const primary = primaryCodewords(options, mode, data);
    const secondary = data.slice(primaryDataLength);
    while (secondary.length < secondaryLength)
        secondary.push(33);
    const primaryParity = rsEncode(primary, 10, GF64, 1);
    const codewords = primary.concat(primaryParity, secondary, secondaryErrorCorrection(secondary, secondaryEccLength));
    if (codewords.length !== MAXICODE_CODEWORDS)
        throw new EncodeError('MaxiCode: internal codeword length mismatch');
    const matrix = /** @type {MaxiCodeMatrix} */ (placeMaxiCodeCodewords(codewords));
    matrix.maxicode = {
        mode,
        codewords: codewords.slice(),
        dataCodewords: secondary.slice(),
        dataModules: MAXICODE_DATA_MODULES,
        moduleShape: 'hexagonal',
        width: MAXICODE_WIDTH,
        height: MAXICODE_HEIGHT,
    };
    return matrix;
}
export { mode2Primary, mode3Primary, primaryCodewords };
