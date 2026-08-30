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
/** MaxiCode decoder for ISO/IEC 16023 modes 2 through 5. @module maxicode/decoder */
import { BitMatrix } from '../core/bit-matrix.js';
import { FormatError } from '../core/errors.js';
import { GF64 } from '../core/galois-field.js';
import { rsDecode } from '../core/reed-solomon.js';
import { MAXICODE_CODEWORDS, MAXICODE_GRID, MAXICODE_HEIGHT, MAXICODE_ORIENTATION_DARK, MAXICODE_WIDTH, maxicodeFinderValue, } from './tables.js';
import { codeSetACharacter, codeSetBCharacter, codeSetCCharacter, codeSetDCharacter, codeSetECharacter, } from './encoder.js';
/** @param {BitMatrix} matrix @returns {BitMatrix} */
function rotate180(matrix) {
    const out = new BitMatrix(matrix.width, matrix.height);
    for (let y = 0; y < matrix.height; y++)
        for (let x = 0; x < matrix.width; x++) {
            if (matrix.get(x, y))
                out.set(matrix.width - 1 - x, matrix.height - 1 - y);
        }
    return out;
}
/** @param {BitMatrix} matrix @returns {BitMatrix} */
function invert(matrix) {
    const out = matrix.clone();
    for (let y = 0; y < out.height; y++)
        for (let x = 0; x < out.width; x++)
            out.flip(x, y);
    return out;
}
/** Check the finder and orientation markers without trusting payload bits. */
export function maxicodeStructureMatches(matrix) {
    if (matrix.width !== MAXICODE_WIDTH || matrix.height !== MAXICODE_HEIGHT)
        return false;
    for (let y = 0; y < MAXICODE_HEIGHT; y++)
        for (let x = 0; x < MAXICODE_WIDTH; x++) {
            const finder = maxicodeFinderValue(x, y);
            // A few orientation modules intentionally overlap the outer finder ring.
            // They are fixed dark modules in the standard and therefore take
            // precedence over the ring predicate at those coordinates.
            const orientationDark = MAXICODE_ORIENTATION_DARK.some(([ox, oy]) => ox === x && oy === y);
            if (finder !== null && !orientationDark && matrix.get(x, y) !== finder)
                return false;
        }
    for (const [x, y] of MAXICODE_ORIENTATION_DARK)
        if (!matrix.get(x, y))
            return false;
    // The two fixed upper-right cells are deliberately dark in every symbol.
    return matrix.get(28, 0) && matrix.get(29, 0);
}
/** @param {BitMatrix} matrix @returns {number[]} */
export function readMaxiCodeCodewords(matrix) {
    if (matrix.width !== MAXICODE_WIDTH || matrix.height !== MAXICODE_HEIGHT) {
        throw new FormatError(`MaxiCode: expected a ${MAXICODE_WIDTH}x${MAXICODE_HEIGHT} module matrix`);
    }
    const codewords = new Array(MAXICODE_CODEWORDS).fill(0);
    for (let y = 0; y < MAXICODE_HEIGHT; y++)
        for (let x = 0; x < MAXICODE_WIDTH; x++) {
            const sequence = MAXICODE_GRID[y * MAXICODE_WIDTH + x];
            if (sequence === 0)
                continue;
            const wire = sequence + 5;
            const codeword = Math.floor(wire / 6) - 1;
            const bit = 5 - (wire % 6);
            if (matrix.get(x, y))
                codewords[codeword] |= 1 << bit;
        }
    return codewords;
}
/** @param {number[]} codewords @param {number} length @returns {{data:number[],corrections:number}} */
function correctSecondary(codewords, length) {
    const eccLength = codewords.length - length;
    const data = codewords.slice(0, length);
    const even = [];
    const odd = [];
    for (let i = 0; i < length; i++)
        (i % 2 === 0 ? even : odd).push(data[i]);
    const evenParity = [];
    const oddParity = [];
    for (let i = 0; i < eccLength / 2; i++) {
        evenParity.push(codewords[length + i * 2]);
        oddParity.push(codewords[length + i * 2 + 1]);
    }
    const evenReceived = even.concat(evenParity);
    const oddReceived = odd.concat(oddParity);
    const corrections = rsDecode(evenReceived, eccLength / 2, GF64, 1) +
        rsDecode(oddReceived, eccLength / 2, GF64, 1);
    for (let i = 0; i < length; i++)
        data[i] = i % 2 === 0 ? evenReceived[i / 2] : oddReceived[(i - 1) / 2];
    return { data, corrections };
}
/** @param {number[]} words @returns {{text:string,bytes:Uint8Array}} */
export function decodeMaxiCodeText(words) {
    /** @type {string[]} */
    const chars = [];
    let set = 'A';
    let i = 0;
    let padding = false;
    while (i < words.length) {
        const value = words[i++];
        if (!Number.isInteger(value) || value < 0 || value > 63)
            throw new FormatError('MaxiCode: codeword is outside the six-bit range');
        if (value === 33) {
            padding = true;
            for (let j = i; j < words.length; j++)
                if (words[j] !== 33)
                    throw new FormatError('MaxiCode: data appears after a pad codeword');
            break;
        }
        if (padding)
            throw new FormatError('MaxiCode: non-padding data follows a pad codeword');
        if (value === 63) {
            set = set === 'A' ? 'B' : 'A';
            continue;
        }
        if (value === 59) {
            if (i >= words.length)
                throw new FormatError('MaxiCode: truncated shift sequence');
            const shifted = words[i++];
            const character = set === 'A' ? codeSetBCharacter(shifted) : codeSetACharacter(shifted);
            if (character === null)
                throw new FormatError('MaxiCode: shift targets an invalid codeword');
            chars.push(String.fromCharCode(character));
            continue;
        }
        if (value >= 60 && value <= 62) {
            if (i >= words.length)
                throw new FormatError('MaxiCode: truncated shift sequence');
            const shifted = words[i++];
            const character = value === 60 ? codeSetCCharacter(shifted) :
                value === 61 ? codeSetDCharacter(shifted) : codeSetECharacter(shifted);
            if (character === null)
                throw new FormatError('MaxiCode: shift targets an invalid codeword');
            chars.push(String.fromCharCode(character));
            continue;
        }
        if (value === 31) {
            if (i + 5 > words.length)
                throw new FormatError('MaxiCode: truncated numeric shift');
            let compact = 0;
            for (let j = 0; j < 5; j++)
                compact = compact * 64 + words[i++];
            if (compact > 999999999)
                throw new FormatError('MaxiCode: numeric shift value exceeds nine digits');
            chars.push(String(compact).padStart(9, '0'));
            continue;
        }
        if (value === 27)
            throw new FormatError('MaxiCode: ECI sequences are not enabled in this build');
        const character = set === 'A' ? codeSetACharacter(value) : codeSetBCharacter(value);
        if (character === null)
            throw new FormatError(`MaxiCode: codeword ${value} is not assigned in Code Set ${set}`);
        chars.push(String.fromCharCode(character));
    }
    const text = chars.join('');
    return { text, bytes: Uint8Array.from(chars.map((character) => character.charCodeAt(0))) };
}
/** @param {number[]} primary @param {2|3} mode */
function decodePrimary(primary, mode) {
    const countryCode = ((primary[6] >>> 4) & 0x03) | (primary[7] << 2) | ((primary[8] & 0x03) << 8);
    const serviceClass = ((primary[8] >>> 2) & 0x0f) | (primary[9] << 4);
    if (mode === 2) {
        const length = ((primary[5] >>> 4) & 0x03) | ((primary[6] & 0x0f) << 2);
        let postal = ((primary[0] >>> 4) & 0x03) |
            (primary[1] << 2) |
            (primary[2] << 8) |
            (primary[3] << 14) |
            (primary[4] << 20) |
            ((primary[5] & 0x0f) << 26);
        postal = String(postal).padStart(length, '0');
        return { postalCode: postal, countryCode, serviceClass };
    }
    const values = [
        ((primary[5] >>> 4) & 0x03) | ((primary[6] & 0x0f) << 2),
        ((primary[4] >>> 4) & 0x03) | ((primary[5] & 0x0f) << 2),
        ((primary[3] >>> 4) & 0x03) | ((primary[4] & 0x0f) << 2),
        ((primary[2] >>> 4) & 0x03) | ((primary[3] & 0x0f) << 2),
        ((primary[1] >>> 4) & 0x03) | ((primary[2] & 0x0f) << 2),
        ((primary[0] >>> 4) & 0x03) | ((primary[1] & 0x0f) << 2),
    ];
    const postal = values.map((value) => {
        const cp = codeSetACharacter(value);
        if (cp === null)
            throw new FormatError('MaxiCode Mode 3: primary postal code contains an invalid value');
        return String.fromCharCode(cp);
    }).join('').trimEnd();
    return { postalCode: postal, countryCode, serviceClass };
}
/**
 * Decode an upright MaxiCode matrix. The reader accepts the canonical matrix
 * and its 180-degree turn; arbitrary perspective belongs to the detector.
 *
 * @param {BitMatrix} matrix
 * @param {{inverted?: boolean|'auto',rotation?:0|180|'auto'}} [options]
 * @returns {object}
 */
export function decodeMaxiCode(matrix, options = {}) {
    if (!matrix || matrix.width !== MAXICODE_WIDTH || matrix.height !== MAXICODE_HEIGHT) {
        throw new FormatError(`MaxiCode: expected a ${MAXICODE_WIDTH}x${MAXICODE_HEIGHT} module matrix`);
    }
    const rotations = options.rotation === 180 ? [180] : options.rotation === 0 ? [0] : [0, 180];
    const invertedModes = options.inverted === true ? [true] : options.inverted === false ? [false] : [false, true];
    let lastError = null;
    for (const rotation of rotations) {
        const oriented = rotation === 180 ? rotate180(matrix) : matrix;
        for (const inverted of invertedModes) {
            const candidate = inverted ? invert(oriented) : oriented;
            if (!maxicodeStructureMatches(candidate))
                continue;
            try {
                const codewords = readMaxiCodeCodewords(candidate);
                const primaryReceived = codewords.slice(0, 20);
                const primaryCorrections = rsDecode(primaryReceived, 10, GF64, 1);
                const primary = primaryReceived.slice(0, 10);
                const mode = primary[0] & 0x0f;
                if (mode < 2 || mode > 5)
                    throw new FormatError(`MaxiCode: unsupported mode ${mode}`);
                const secondaryLength = mode === 5 ? 68 : 84;
                const secondaryWords = codewords.slice(20, 20 + secondaryLength + (mode === 5 ? 56 : 40));
                const secondary = correctSecondary(secondaryWords, secondaryLength);
                // Modes 4 and 5 place the first nine secondary codewords in the
                // primary message (after the mode indicator).  Padding in that
                // prefix must be removed before joining the corrected secondary part.
                const primaryPayload = (mode === 4 || mode === 5) ? primary.slice(1) : [];
                while (primaryPayload.length && primaryPayload[primaryPayload.length - 1] === 33)
                    primaryPayload.pop();
                const payload = decodeMaxiCodeText(primaryPayload.concat(secondary.data));
                const result = {
                    format: 'maxicode',
                    text: payload.text,
                    bytes: payload.bytes,
                    mode,
                    corrections: primaryCorrections + secondary.corrections,
                    rows: MAXICODE_HEIGHT,
                    columns: MAXICODE_WIDTH,
                    inverted,
                    rotation,
                };
                if (mode === 2 || mode === 3)
                    result.primary = decodePrimary(primary, mode);
                return result;
            }
            catch (error) {
                lastError = error;
            }
        }
    }
    if (lastError)
        throw new FormatError(`MaxiCode: Reed-Solomon or payload validation failed: ${lastError.message}`);
    throw new FormatError('MaxiCode: finder or orientation structure is invalid');
}
