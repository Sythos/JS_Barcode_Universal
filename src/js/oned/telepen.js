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
 * Telepen Alpha and Telepen Numeric.
 *
 * Telepen does not assign an arbitrary glyph table to each character. It emits
 * the seven-bit ASCII value with an even parity bit, least-significant bit
 * first, and maps the resulting bit stream to narrow/wide bar-space pairs.
 * Keeping that mapping algorithmic makes the implementation auditable and
 * avoids shipping a copied third-party pattern table.
 *
 * @module oned/telepen
 */
import { BitMatrix } from '../core/bit-matrix.js';
import { EncodeError } from '../core/errors.js';
export const TELEPEN_START_VALUE = 0x5f;
export const TELEPEN_STOP_VALUE = 0x7a;
export const TELEPEN_MAX_LENGTH = 500;
/** @param {number} value @returns {string} Run widths for one 16-module glyph. */
export function telepenPattern(value) {
    if (!Number.isInteger(value) || value < 0 || value > 127) {
        throw new RangeError(`Telepen character value must be in 0..127, got ${value}`);
    }
    // Telepen carries seven-bit ASCII plus an even parity bit in the eighth
    // position. The stream is transmitted least-significant bit first.
    const bits = new Array(8).fill(0);
    let ones = 0;
    for (let bit = 0; bit < 7; bit++) {
        bits[bit] = (value >>> bit) & 1;
        ones += bits[bit];
    }
    bits[7] = ones & 1;
    // The four legal bar/space pairs encode the bit stream without changing the
    // fixed 16-module character width:
    //   1    -> narrow bar, narrow space (11)
    //   00   -> wide bar, narrow space   (31)
    //   010  -> wide bar, wide space     (33)
    //   01/10 edges -> narrow bar, wide space (13)
    let widths = '';
    let index = 0;
    while (index < bits.length) {
        if (bits[index] === 1) {
            widths += '11';
            index++;
            continue;
        }
        let end = index + 1;
        while (end < bits.length && bits[end] === 1)
            end++;
        if (end === index + 1) {
            widths += '31';
            index += 2;
        }
        else if (end === index + 2) {
            widths += '33';
            index += 3;
        }
        else if (end < bits.length) {
            // A block 0 1* 0 longer than 010 has 01 and 10 edges. Any
            // one-bits between those edges remain single-bit pairs.
            widths += '13';
            widths += '11'.repeat(Math.max(0, end - index - 3));
            widths += '13';
            index = end + 1;
        }
        else {
            // A final 0 1* block has no trailing zero. The final light element is
            // implied by the following character or quiet zone.
            widths += '13';
            widths += '11'.repeat(Math.max(0, end - index - 2));
            index = end;
        }
    }
    return widths;
}
/** @param {string} widths @returns {number} */
function widthTotal(widths) {
    let total = 0;
    for (const width of widths)
        total += Number(width);
    return total;
}
/** @param {string} widths @returns {BitMatrix} */
function widthsToMatrix(widths) {
    const matrix = new BitMatrix(widthTotal(widths), 1);
    let dark = true;
    let x = 0;
    for (const width of widths) {
        const count = Number(width);
        if (dark)
            matrix.setRegion(x, 0, count, 1);
        x += count;
        dark = !dark;
    }
    return matrix;
}
/** @param {string} value @returns {number} */
function telepenChecksum(value) {
    let sum = 0;
    for (const character of value)
        sum = (sum + character.charCodeAt(0)) % 127;
    return (127 - sum) % 127;
}
/** @param {string} value @returns {number[]} */
function numericGlyphs(value) {
    if (value.length % 2 !== 0) {
        throw new EncodeError('Telepen Numeric: payload must contain an even number of characters');
    }
    const glyphs = [];
    for (let index = 0; index < value.length; index += 2) {
        const first = value[index];
        const second = value[index + 1];
        if (!/[0-9]/.test(first) || !/[0-9X]/.test(second)) {
            throw new EncodeError('Telepen Numeric: pairs must contain digits, with X allowed only in the second position');
        }
        const firstDigit = Number(first);
        glyphs.push(second === 'X'
            ? firstDigit + 17
            : firstDigit * 10 + Number(second) + 27);
    }
    return glyphs;
}
/**
 * Encode Telepen Alpha (full seven-bit ASCII) or Telepen Numeric.
 *
 * @param {string} value
 * @param {object} [options]
 * @param {boolean} [options.numeric] Use two-digit numeric compaction.
 * @returns {BitMatrix}
 */
export function encodeTelepen(value, options = {}) {
    const text = String(value);
    const numeric = options.numeric === true || options.mode === 'numeric' || options.telepenMode === 'numeric';
    if (text.length > TELEPEN_MAX_LENGTH) {
        throw new EncodeError(`Telepen: payload is limited to ${TELEPEN_MAX_LENGTH} characters`);
    }
    const glyphs = [TELEPEN_START_VALUE];
    if (numeric) {
        const compacted = numericGlyphs(text);
        glyphs.push(...compacted);
        const checksumValue = compacted.reduce((sum, glyph) => (sum + glyph) % 127, 0);
        glyphs.push((127 - checksumValue) % 127);
    }
    else {
        for (const character of text) {
            const code = character.charCodeAt(0);
            if (code > 127) {
                throw new EncodeError(`Telepen: character U+${code.toString(16).toUpperCase()} is outside ASCII`);
            }
            glyphs.push(code);
        }
        glyphs.push(telepenChecksum(text));
    }
    glyphs.push(TELEPEN_STOP_VALUE);
    return widthsToMatrix(glyphs.map(telepenPattern).join(''));
}
/** Encode Telepen Numeric explicitly. @param {string} value @returns {BitMatrix} */
export function encodeTelepenNumeric(value) {
    return encodeTelepen(value, { numeric: true });
}
const TELEPEN_RUNS = Array.from({ length: 128 }, (_, value) => telepenPattern(value).split('').map(Number));
const START_RUNS = TELEPEN_RUNS[TELEPEN_START_VALUE];
const STOP_RUNS = TELEPEN_RUNS[TELEPEN_STOP_VALUE];
/** @param {Uint8Array} row @param {number} start @param {number} count */
function measureRuns(row, start, count) {
    if (start < 0 || start >= row.length || row[start] !== 1)
        return null;
    const counters = new Array(count).fill(0);
    let run = 0;
    let dark = true;
    let index = start;
    while (index < row.length) {
        const pixelDark = row[index] === 1;
        if (pixelDark === dark) {
            counters[run]++;
            index++;
            continue;
        }
        run++;
        if (run === count)
            break;
        dark = !dark;
        counters[run] = 1;
        index++;
    }
    if (run < count - 1 || counters[count - 1] === 0)
        return null;
    return { counters, end: index };
}
/** @param {number[]} counters @param {number[]} expected @param {number} [ignoredTail] */
function runVariance(counters, expected, ignoredTail = 0) {
    const total = counters.reduce((sum, width) => sum + width, 0);
    const expectedTotal = expected.reduce((sum, width) => sum + width, 0);
    const compared = expected.length - ignoredTail;
    const comparedTotal = expected
        .slice(0, compared)
        .reduce((sum, width) => sum + width, 0);
    const measuredCompared = counters
        .slice(0, compared)
        .reduce((sum, width) => sum + width, 0);
    if (total <= 0 || expectedTotal <= 0 || measuredCompared <= 0)
        return Infinity;
    // For normal glyphs all sixteen modules participate. Stop's final light
    // run includes the quiet zone, so its first eleven runs establish scale.
    const unit = ignoredTail > 0 ? measuredCompared / comparedTotal : total / expectedTotal;
    const limit = unit * 0.85;
    let variance = 0;
    for (let index = 0; index < compared; index++) {
        const delta = Math.abs(counters[index] - expected[index] * unit);
        if (delta > limit)
            return Infinity;
        variance += delta;
    }
    return variance / Math.max(1, measuredCompared);
}
/** @param {Uint8Array} row @param {number} start @param {number[]} expected */
function matchGlyph(row, start, expected) {
    const measured = measureRuns(row, start, expected.length);
    if (!measured)
        return null;
    const score = runVariance(measured.counters, expected);
    if (!Number.isFinite(score) || measured.end >= row.length)
        return null;
    return { score, end: measured.end };
}
/** @param {Uint8Array} row @param {number} start */
function matchStop(row, start) {
    const measured = measureRuns(row, start, STOP_RUNS.length);
    if (!measured)
        return null;
    const score = runVariance(measured.counters, STOP_RUNS, 1);
    if (!Number.isFinite(score))
        return null;
    for (let index = measured.end; index < row.length; index++) {
        if (row[index] === 1)
            return { score, end: measured.end, terminal: false };
    }
    return { score, end: measured.end, terminal: true };
}
/** @param {Uint8Array} row @param {number} start @param {number[]} expected */
function findStart(row, start, expected) {
    for (let index = Math.max(0, start); index < row.length; index++) {
        if (row[index] !== 1 || (index > 0 && row[index - 1] === 1))
            continue;
        const measured = measureRuns(row, index, expected.length);
        if (!measured)
            continue;
        const score = runVariance(measured.counters, expected);
        if (Number.isFinite(score) && measured.end < row.length) {
            return { end: measured.end, score };
        }
    }
    return null;
}
/** @param {number[]} glyphs @returns {boolean} */
function validChecksum(glyphs) {
    if (glyphs.length < 1)
        return false;
    const checksum = glyphs[glyphs.length - 1];
    const payload = glyphs.slice(0, -1);
    const sum = payload.reduce((total, value) => (total + value) % 127, 0);
    return checksum === (127 - sum) % 127;
}
/** @param {number[]} glyphs @returns {string|null} */
function decodeNumericGlyphs(glyphs) {
    let text = '';
    for (const glyph of glyphs) {
        if (glyph >= 17 && glyph <= 26) {
            text += `${glyph - 17}X`;
        }
        else if (glyph >= 27 && glyph <= 126) {
            text += String(glyph - 27).padStart(2, '0');
        }
        else {
            return null;
        }
    }
    return text;
}
/**
 * Decode a Telepen scanline. The row must be binarized (1 = dark).
 *
 * @param {Uint8Array} row
 * @param {object} [options]
 * @param {boolean} [options.numeric] Decode two-digit numeric glyphs.
 * @returns {{format:'telepen'|'telepennumeric', text:string, mode:'ascii'|'numeric'}|null}
 */
export function decodeTelepen(row, options = {}) {
    const numeric = options.numeric === true || options.mode === 'numeric' || options.telepenMode === 'numeric';
    const start = findStart(row, 0, START_RUNS);
    if (!start)
        return null;
    const glyphs = [];
    let offset = start.end;
    for (let count = 0; count <= TELEPEN_MAX_LENGTH + 1; count++) {
        const stop = matchStop(row, offset);
        if (stop?.terminal) {
            if (!validChecksum(glyphs))
                return null;
            glyphs.pop();
            if (numeric) {
                const text = decodeNumericGlyphs(glyphs);
                return text === null ? null : { format: 'telepennumeric', text, mode: 'numeric' };
            }
            return {
                format: 'telepen',
                text: glyphs.map((value) => String.fromCharCode(value)).join(''),
                mode: 'ascii',
            };
        }
        const candidates = [];
        for (let value = 0; value < TELEPEN_RUNS.length; value++) {
            const match = matchGlyph(row, offset, TELEPEN_RUNS[value]);
            if (match)
                candidates.push({ value, ...match });
        }
        if (candidates.length === 0)
            return null;
        candidates.sort((a, b) => a.score - b.score);
        const best = candidates[0];
        const second = candidates[1];
        // A close tie is an ambiguous optical measurement. Returning nothing is
        // safer than guessing a character that merely has a similar run profile.
        if (second && second.score - best.score < 0.035)
            return null;
        glyphs.push(best.value);
        offset = best.end;
    }
    return null;
}
/** Decode Telepen Numeric explicitly. @param {Uint8Array} row */
export function decodeTelepenNumeric(row) {
    return decodeTelepen(row, { numeric: true });
}
