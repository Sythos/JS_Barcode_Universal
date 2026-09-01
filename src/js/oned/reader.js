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
 * Linear barcode reading.
 *
 * A linear symbol carries no vertical information, so reading one is a 1D
 * signal problem: take a horizontal slice, measure the run lengths of dark and
 * light, and match those against the symbology's patterns.
 *
 * Two consequences shape everything here:
 *
 *  - **Scan many rows, not one.** Any single row can be crossed by a fold, a
 *    glare highlight or a printing void. Rows are sampled across the height and
 *    the first that decodes cleanly wins.
 *  - **Match ratios, not absolute widths.** The scale is unknown and varies
 *    across the image under perspective, so patterns are compared after
 *    normalising by total width. This is what makes a symbol readable at any
 *    size without being told the module width.
 *
 * @module oned/reader
 */
import { NotFoundError } from '../core/errors.js';
import { EAN_L, EAN_G, EAN_R, EAN13_PARITY, UPCE_PARITY, CODE39, CODE39_CHECK_SET, CODE93, CODE93_VALUES, CODE128, CODE128_START_A, CODE128_START_B, CODE128_START_C, CODE128_STOP, CODE128_FNC1, CODE128_CODE_A, CODE128_CODE_B, CODE128_CODE_C, CODE128_SHIFT, ITF, CODABAR, CODABAR_START_STOP, CODE11, CODE11_START_STOP, } from './patterns.js';
import { ean13CheckDigit, upceToUpcaBody, decodeCode32Payload, decodePZNPayload, } from './writers.js';
import { EAN2_PARITY, EAN5_PARITY, ean5Checksum, } from './addons.js';
import { decodeDataBar14Scanline } from '../databar/decoder.js';
import { decodeTelepen } from './telepen.js';
import { CODE25_VARIANTS, CODE25_MAX_DIGITS, code25CheckDigit, } from './code25.js';
import { decodePostal } from './postal.js';
import { FIM_PATTERNS } from './fim.js';
/* ------------------------------------------------------------------ *
 * Pattern matching primitives
 * ------------------------------------------------------------------ */
/**
 * Compare measured run lengths against an ideal pattern, scale-independently.
 *
 * Returns a normalised mismatch score, or Infinity when any single element is
 * further out of proportion than `maxIndividual` allows. Rejecting on the
 * worst element as well as the total is what stops a run of noise whose widths
 * happen to average out from being accepted as a character.
 *
 * @param {number[]} counters Measured widths, in pixels.
 * @param {number[]} pattern Ideal widths, in modules.
 * @param {number} maxIndividual Tolerance per element, as a fraction of a module.
 * @returns {number}
 */
export function patternVariance(counters, pattern, maxIndividual) {
    const n = counters.length;
    if (n !== pattern.length)
        return Infinity;
    let total = 0;
    let patternTotal = 0;
    for (let i = 0; i < n; i++) {
        total += counters[i];
        patternTotal += pattern[i];
    }
    if (total < patternTotal)
        return Infinity; // fewer pixels than modules
    const unit = total / patternTotal;
    const maxVariance = unit * maxIndividual;
    let variance = 0;
    for (let i = 0; i < n; i++) {
        const expected = pattern[i] * unit;
        const delta = Math.abs(counters[i] - expected);
        if (delta > maxVariance)
            return Infinity;
        variance += delta;
    }
    return variance / total;
}
/**
 * Measure alternating run lengths starting at `start`.
 *
 * @param {Uint8Array} row One byte per pixel, 1 = dark.
 * @param {number} start
 * @param {number[]} counters Filled in place; its length sets how many runs to read.
 * @returns {boolean} False if the row ended before the runs were filled.
 */
export function recordPattern(row, start, counters) {
    counters.fill(0);
    const end = row.length;
    if (start >= end)
        return false;
    let isDark = row[start] === 1;
    let index = 0;
    let i = start;
    while (i < end) {
        if ((row[i] === 1) === isDark) {
            counters[index]++;
        }
        else {
            index++;
            if (index === counters.length)
                break;
            counters[index] = 1;
            isDark = !isDark;
        }
        i++;
    }
    // The final run may legitimately reach the edge of the image.
    return index === counters.length || (index === counters.length - 1 && i === end);
}
/**
 * Classify run lengths into narrow and wide, for the n/w symbologies.
 *
 * The wide:narrow ratio is not fixed by these formats — it is anywhere from
 * 2:1 to 3:1 and varies with the printer — so the split has to be discovered
 * from the data. Candidate thresholds are tried from the smallest counter
 * upward until exactly the expected number of wide elements falls out.
 *
 * @param {number[]} counters
 * @param {number} expectedWide How many elements must be wide.
 * @returns {number} Bit pattern, MSB = first element wide; -1 if undecidable.
 */
export function toNarrowWidePattern(counters, expectedWide) {
    const n = counters.length;
    let maxNarrow = 0;
    for (;;) {
        let nextNarrow = Infinity;
        for (let i = 0; i < n; i++) {
            if (counters[i] > maxNarrow && counters[i] < nextNarrow)
                nextNarrow = counters[i];
        }
        if (nextNarrow === Infinity)
            return -1;
        maxNarrow = nextNarrow;
        let wideCount = 0;
        let pattern = 0;
        let wideTotal = 0;
        let narrowTotal = 0;
        for (let i = 0; i < n; i++) {
            if (counters[i] > maxNarrow) {
                pattern |= 1 << (n - 1 - i);
                wideCount++;
                wideTotal += counters[i];
            }
            else {
                narrowTotal += counters[i];
            }
        }
        if (wideCount === expectedWide) {
            // Sanity: a wide element should be clearly wider than a narrow one.
            const narrowCount = n - wideCount;
            if (narrowCount === 0)
                return -1;
            const avgWide = wideTotal / wideCount;
            const avgNarrow = narrowTotal / narrowCount;
            if (avgWide < avgNarrow * 1.4)
                return -1;
            return pattern;
        }
        if (wideCount < expectedWide)
            return -1;
    }
}
/** Convert an 'n'/'w' pattern string to the same bit encoding. */
function nwToBits(pattern) {
    let bits = 0;
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] === 'w')
            bits |= 1 << (pattern.length - 1 - i);
    }
    return bits;
}
/** Convert a digit-width pattern string to a numeric array. */
function widthsToArray(pattern) {
    return [...pattern].map(Number);
}
/** Convert a module string ('0'/'1') to run lengths. */
function modulesToRuns(modules) {
    const runs = [];
    let current = modules[0];
    let count = 0;
    for (const ch of modules) {
        if (ch === current)
            count++;
        else {
            runs.push(count);
            current = ch;
            count = 1;
        }
    }
    runs.push(count);
    return runs;
}
/* ------------------------------------------------------------------ *
 * Precomputed lookup structures
 * ------------------------------------------------------------------ */
const EAN_L_RUNS = EAN_L.map(modulesToRuns);
const EAN_G_RUNS = EAN_G.map(modulesToRuns);
const EAN_R_RUNS = EAN_R.map(modulesToRuns);
const CODE128_RUNS = CODE128.map(widthsToArray);
const CODE93_RUNS = Object.fromEntries(Object.entries(CODE93).map(([k, v]) => [k, widthsToArray(v)]));
const CODE39_BITS = Object.fromEntries(Object.entries(CODE39).map(([k, v]) => [nwToBits(v), k]));
const CODABAR_BITS = Object.fromEntries(Object.entries(CODABAR).map(([k, v]) => [nwToBits(v), k]));
const ITF_BITS = Object.fromEntries(ITF.map((v, i) => [nwToBits(v), i]));
const CODE11_BITS = Object.fromEntries(Object.entries(CODE11).flatMap(([ch, value]) => {
    const bits = nwToBits(value);
    return [[`${bits}:1`, ch], [`${bits}:2`, ch]];
}));
const CODE11_START_BITS = nwToBits(CODE11_START_STOP);
const CODE11_CHARSET = '0123456789-';
/**
 * Shortest ITF payload treated as a real read.
 *
 * ITF is always an even number of digits and real-world payloads are at least
 * six (ITF-6, ITF-14 and the GS1 variants). Accepting two digits meant any
 * pair of matching runs inside an unrelated symbol read as a valid ITF.
 */
const MIN_ITF_DIGITS = 6;
const START_END_PATTERN = [1, 1, 1];
const MIDDLE_PATTERN = [1, 1, 1, 1, 1];
const UPCE_END_PATTERN = [1, 1, 1, 1, 1, 1];
/* ------------------------------------------------------------------ *
 * EAN / UPC
 * ------------------------------------------------------------------ */
/**
 * Decode one EAN/UPC digit, reporting which parity set matched.
 *
 * @param {Uint8Array} row
 * @param {number} start
 * @param {boolean} rightHand True to match only the R set.
 * @returns {{digit: number, even: boolean, end: number} | null}
 */
function decodeEANDigit(row, start, rightHand) {
    const counters = [0, 0, 0, 0];
    if (!recordPattern(row, start, counters))
        return null;
    const width = counters[0] + counters[1] + counters[2] + counters[3];
    let best = null;
    let bestVariance = 0.48; // reject anything worse than this
    const consider = (runs, digit, even) => {
        const v = patternVariance(counters, runs, 0.7);
        if (v < bestVariance) {
            bestVariance = v;
            best = { digit, even, end: start + width };
        }
    };
    for (let d = 0; d < 10; d++) {
        if (rightHand) {
            consider(EAN_R_RUNS[d], d, false);
        }
        else {
            consider(EAN_L_RUNS[d], d, false);
            consider(EAN_G_RUNS[d], d, true);
        }
    }
    return best;
}
/**
 * @param {Uint8Array} row
 * @returns {{format: string, text: string} | null}
 */
function decodeEANFamily(row) {
    const guard = findGuard(row, 0, START_END_PATTERN, false);
    if (!guard)
        return null;
    let offset = guard.end;
    const digits = [];
    let parityBits = 0;
    // Six left-hand digits, recording parity as we go.
    for (let i = 0; i < 6; i++) {
        const d = decodeEANDigit(row, offset, false);
        if (!d)
            return null;
        digits.push(d.digit);
        if (d.even)
            parityBits |= 1 << (5 - i);
        offset = d.end;
    }
    // EAN-8 has no even-parity digits and a middle guard at a different offset;
    // try the 13-digit reading first, then fall back.
    const middle = matchAt(row, offset, MIDDLE_PATTERN);
    if (middle) {
        offset = middle.end;
        for (let i = 0; i < 6; i++) {
            const d = decodeEANDigit(row, offset, true);
            if (!d)
                return null;
            digits.push(d.digit);
            offset = d.end;
        }
        const trailing = matchAt(row, offset, START_END_PATTERN);
        if (!trailing)
            return null;
        const parityStr = [];
        for (let i = 0; i < 6; i++)
            parityStr.push((parityBits >> (5 - i)) & 1 ? 'G' : 'L');
        const first = EAN13_PARITY.indexOf(parityStr.join(''));
        if (first < 0)
            return null;
        const text = String(first) + digits.join('');
        if (Number(text[12]) !== ean13CheckDigit(text.slice(0, 12)))
            return null;
        // A leading zero means this was printed as UPC-A.
        const result = first === 0
            ? { format: 'upca', text: text.slice(1) }
            : { format: 'ean13', text };
        return attachEANAddon(result, row, trailing.end);
    }
    return null;
}
/**
 * EAN-8: four left digits, middle guard, four right digits.
 *
 * @param {Uint8Array} row
 * @returns {{format: string, text: string} | null}
 */
function decodeEAN8(row) {
    const guard = findGuard(row, 0, START_END_PATTERN, false);
    if (!guard)
        return null;
    let offset = guard.end;
    const digits = [];
    for (let i = 0; i < 4; i++) {
        const d = decodeEANDigit(row, offset, false);
        if (!d || d.even)
            return null; // EAN-8 left digits are all odd parity
        digits.push(d.digit);
        offset = d.end;
    }
    const middle = matchAt(row, offset, MIDDLE_PATTERN);
    if (!middle)
        return null;
    offset = middle.end;
    for (let i = 0; i < 4; i++) {
        const d = decodeEANDigit(row, offset, true);
        if (!d)
            return null;
        digits.push(d.digit);
        offset = d.end;
    }
    const trailing = matchAt(row, offset, START_END_PATTERN);
    if (!trailing)
        return null;
    const text = digits.join('');
    if (Number(text[7]) !== ean13CheckDigit(text.slice(0, 7)))
        return null;
    return attachEANAddon({ format: 'ean8', text }, row, trailing.end);
}
/**
 * UPC-E: six digits, parity-encoded, terminated by a six-element guard.
 *
 * @param {Uint8Array} row
 * @returns {{format: string, text: string} | null}
 */
function decodeUPCE(row) {
    const guard = findGuard(row, 0, START_END_PATTERN, false);
    if (!guard)
        return null;
    let offset = guard.end;
    const digits = [];
    let parityBits = 0;
    for (let i = 0; i < 6; i++) {
        const d = decodeEANDigit(row, offset, false);
        if (!d)
            return null;
        digits.push(d.digit);
        if (d.even)
            parityBits |= 1 << (5 - i);
        offset = d.end;
    }
    // Six digits and then the end guard, in that order and nothing between. The
    // EAN readers above match their trailing guard; this one used to stop at the
    // last digit, which let it report a symbol it had never seen the end of.
    const trailing = matchAt(row, offset, UPCE_END_PATTERN);
    if (!trailing)
        return null;
    const parityStr = [];
    for (let i = 0; i < 6; i++)
        parityStr.push((parityBits >> (5 - i)) & 1 ? 'E' : 'O');
    const check = UPCE_PARITY.indexOf(parityStr.join(''));
    if (check < 0)
        return null;
    // The parity pattern carries the check digit and nothing else, so on its own
    // it says nothing about the six digits it was read alongside: any run whose
    // parities happen to spell one of the ten patterns would be accepted. What
    // ties the two together is the check digit itself — expand the body to the
    // UPC-A it stands for and confirm the digits produce the check digit the
    // parity claimed. Six digits scraped out of a neighbouring symbol pass the
    // parity test one time in ten and this one almost never.
    const body = digits.join('');
    if (ean13CheckDigit(upceToUpcaBody(0, body)) !== check)
        return null;
    return attachEANAddon({ format: 'upce', text: '0' + body + String(check) }, row, trailing.end);
}
/* ------------------------------------------------------------------ *
 * Guard finding
 * ------------------------------------------------------------------ */
/**
 * Scan forward for the first place a pattern matches, starting on a dark run.
 *
 * @param {Uint8Array} row
 * @param {number} from
 * @param {number[]} pattern
 * @param {boolean} startsLight
 * @returns {{start: number, end: number} | null}
 */
function findGuard(row, from, pattern, startsLight) {
    const counters = new Array(pattern.length).fill(0);
    const width = row.length;
    let index = 0;
    let isDark = !startsLight;
    let i = from;
    // Skip any leading run of the wrong colour.
    while (i < width && (row[i] === 1) !== isDark)
        i++;
    let patternStart = i;
    counters.fill(0);
    while (i < width) {
        if ((row[i] === 1) === isDark) {
            counters[index]++;
        }
        else {
            if (index === pattern.length - 1) {
                if (patternVariance(counters, pattern, 0.7) < 0.5) {
                    return { start: patternStart, end: i };
                }
                // Slide the window forward by two runs and keep looking.
                patternStart += counters[0] + counters[1];
                for (let k = 2; k < pattern.length; k++)
                    counters[k - 2] = counters[k];
                counters[pattern.length - 2] = 0;
                counters[pattern.length - 1] = 0;
                index--;
            }
            else {
                index++;
            }
            counters[index] = 1;
            isDark = !isDark;
        }
        i++;
    }
    return null;
}
/**
 * Match a pattern at an exact position.
 *
 * @param {Uint8Array} row
 * @param {number} start
 * @param {number[]} pattern
 * @returns {{end: number} | null}
 */
function matchAt(row, start, pattern) {
    const counters = new Array(pattern.length).fill(0);
    if (!recordPattern(row, start, counters))
        return null;
    if (patternVariance(counters, pattern, 0.7) >= 0.5)
        return null;
    let width = 0;
    for (const c of counters)
        width += c;
    return { end: start + width };
}
/* ------------------------------------------------------------------ *
 * EAN supplements
 * ------------------------------------------------------------------ */
/**
 * Decode a supplement immediately following a validated EAN/UPC symbol.
 * The caller supplies the end of the parent trailing guard, so a supplement
 * can never be accepted as an unrelated standalone linear symbol.
 *
 * @param {Uint8Array} row
 * @param {number} baseEnd
 * @param {2|5} digitCount
 * @returns {{format:'ean2'|'ean5', text:string, parity:string, checksum?:number, end:number}|null}
 */
function decodeEANSupplementRow(row, baseEnd, digitCount) {
    const guard = findGuard(row, baseEnd, [1, 1, 2], false);
    if (!guard || guard.start - baseEnd < 4)
        return null;
    let offset = guard.end;
    let text = '';
    let parity = '';
    for (let i = 0; i < digitCount; i++) {
        const digit = decodeEANDigit(row, offset, false);
        if (!digit)
            return null;
        text += String(digit.digit);
        parity += digit.even ? 'B' : 'A';
        offset = digit.end;
        if (i + 1 < digitCount) {
            const separator = matchAt(row, offset, [1, 1]);
            if (!separator)
                return null;
            offset = separator.end;
        }
    }
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
 * Attach the longest valid supplement to a base result. EAN-5 is attempted
 * first so its prefix cannot be reported as a shorter EAN-2 symbol.
 *
 * @param {object} base
 * @param {Uint8Array} row
 * @param {number} baseEnd
 * @returns {object}
 */
function attachEANAddon(base, row, baseEnd) {
    const addon = decodeEANSupplementRow(row, baseEnd, 5)
        ?? decodeEANSupplementRow(row, baseEnd, 2);
    if (!addon)
        return base;
    const { end, ...publicAddon } = addon;
    void end;
    return { ...base, addon: publicAddon };
}
/* ------------------------------------------------------------------ *
 * Code 11 and MSI/Plessey
 * ------------------------------------------------------------------ */
/** @param {number[]} counters @returns {number} */
function counterTotal(counters) {
    return counters.reduce((sum, value) => sum + value, 0);
}
/**
 * Apply the Code 11 C/K checksum grammar used by the writer.
 *
 * @param {string} encoded
 * @param {boolean|undefined} requested
 * @returns {string|null}
 */
function finalizeCode11(encoded, requested) {
    const weighted = (text, maxWeight) => {
        let sum = 0;
        for (let i = 0; i < text.length; i++) {
            const weight = ((text.length - 1 - i) % maxWeight) + 1;
            sum += weight * CODE11_CHARSET.indexOf(text[i]);
        }
        return sum;
    };
    const validC = (text) => {
        if (text.length < 2)
            return null;
        const body = text.slice(0, -1);
        const expected = CODE11_CHARSET[weighted(body, 10) % 11];
        return text[text.length - 1] === expected ? body : null;
    };
    const validCK = (text) => {
        if (text.length < 12)
            return null;
        const body = text.slice(0, -2);
        const c = text[text.length - 2];
        const k = text[text.length - 1];
        const expectedC = CODE11_CHARSET[weighted(body, 10) % 11];
        if (c !== expectedC)
            return null;
        const expectedK = CODE11_CHARSET[weighted(body + c, 9) % 11];
        return k === expectedK ? body : null;
    };
    if (requested === false)
        return encoded;
    if (requested === true) {
        const checked = encoded.length >= 12 ? validCK(encoded) : validC(encoded);
        return checked;
    }
    // With no explicit option, strip checks only when the complete grammar is
    // unambiguous; otherwise preserve the literal payload.
    return validCK(encoded) ?? validC(encoded) ?? encoded;
}
/**
 * Decode Code 11 from one binarized scanline.
 *
 * @param {Uint8Array} row
 * @param {object} [options]
 * @param {boolean} [options.checkDigit]
 * @returns {{format:'code11', text:string}|null}
 */
export function decodeCode11(row, options = {}) {
    const counters = new Array(5).fill(0);
    let start = null;
    for (let i = 0; i < row.length; i++) {
        if (row[i] !== 1 || (i > 0 && row[i - 1] === 1))
            continue;
        if (!recordPattern(row, i, counters))
            continue;
        if (toNarrowWidePattern(counters, 2) === CODE11_START_BITS) {
            start = { position: i, end: i + counterTotal(counters), scale: counterTotal(counters) / 9 };
            break;
        }
    }
    if (!start)
        return null;
    let offset = start.end;
    while (offset < row.length && row[offset] === 0)
        offset++;
    let encoded = '';
    for (let count = 0; count < 160 && offset < row.length; count++) {
        if (!recordPattern(row, offset, counters))
            return null;
        const width = counterTotal(counters);
        const stop = toNarrowWidePattern(counters, 2);
        if (stop === CODE11_START_BITS) {
            if (encoded.length === 0)
                return null;
            const stopEnd = offset + width;
            let nextDark = stopEnd;
            while (nextDark < row.length && row[nextDark] === 0)
                nextDark++;
            if (nextDark !== row.length && nextDark - stopEnd < Math.max(3, Math.ceil(start.scale * 3))) {
                return null;
            }
            const text = finalizeCode11(encoded, options.checkDigit);
            return text == null ? null : { format: 'code11', text };
        }
        let character = null;
        for (const expectedWide of [1, 2]) {
            const bits = toNarrowWidePattern(counters, expectedWide);
            if (bits < 0)
                continue;
            const candidate = CODE11_BITS[`${bits}:${expectedWide}`];
            if (candidate !== undefined) {
                character = candidate;
                break;
            }
        }
        if (character == null)
            return null;
        encoded += character;
        if (encoded.length > 128)
            return null;
        offset += width;
        while (offset < row.length && row[offset] === 0)
            offset++;
    }
    return null;
}
/** @param {string} encoded @param {boolean|undefined} requested */
function finalizeMSI(encoded, requested) {
    if (requested !== true)
        return encoded;
    if (encoded.length < 2)
        return null;
    const body = encoded.slice(0, -1);
    let odd = '';
    for (let i = body.length - 1; i >= 0; i -= 2)
        odd = body[i] + odd;
    const doubled = String(Number(odd) * 2);
    let sum = 0;
    for (const ch of doubled)
        sum += Number(ch);
    for (let i = body.length - 2; i >= 0; i -= 2)
        sum += Number(body[i]);
    const expected = String((10 - (sum % 10)) % 10);
    return encoded.endsWith(expected) ? body : null;
}
/**
 * Decode MSI/Plessey from one binarized scanline.
 *
 * @param {Uint8Array} row
 * @param {object} [options]
 * @param {boolean} [options.checkDigit]
 * @returns {{format:'msi', text:string}|null}
 */
export function decodeMSI(row, options = {}) {
    const start = findGuard(row, 0, [2, 1], false);
    if (!start)
        return null;
    const scale = (start.end - start.start) / 3;
    if (!(scale >= 1))
        return null;
    let offset = start.end;
    let encoded = '';
    const bitPatterns = [
        { pattern: [1, 2], bit: '0' },
        { pattern: [2, 1], bit: '1' },
    ];
    for (let digitIndex = 0; digitIndex < 80; digitIndex++) {
        const stop = matchAt(row, offset, [1, 2, 1]);
        if (stop && encoded.length > 0) {
            let nextDark = stop.end;
            while (nextDark < row.length && row[nextDark] === 0)
                nextDark++;
            if (nextDark === row.length ||
                nextDark - stop.end >= Math.max(3, Math.ceil(scale * 3))) {
                if (encoded.length < 6 && !(options.formats && options.formats.includes('msi'))) {
                    return null;
                }
                const text = finalizeMSI(encoded, options.checkDigit);
                return text == null ? null : { format: 'msi', text };
            }
        }
        let nibble = '';
        for (let bitIndex = 0; bitIndex < 4; bitIndex++) {
            let matched = null;
            for (const candidate of bitPatterns) {
                const found = matchAt(row, offset, candidate.pattern);
                if (found) {
                    matched = { ...candidate, end: found.end };
                    break;
                }
            }
            if (!matched)
                return null;
            nibble += matched.bit;
            offset = matched.end;
        }
        const digit = Number.parseInt(nibble, 2);
        if (digit > 9)
            return null;
        encoded += String(digit);
    }
    return null;
}
/* ------------------------------------------------------------------ *
 * Code 128
 * ------------------------------------------------------------------ */
/**
 * @param {Uint8Array} row
 * @returns {{format: string, text: string} | null}
 */
function decodeCode128(row) {
    // Locate whichever start symbol appears first.
    let start = null;
    for (const startCode of [CODE128_START_A, CODE128_START_B, CODE128_START_C]) {
        const found = findGuard(row, 0, CODE128_RUNS[startCode], false);
        if (found && (!start || found.start < start.found.start)) {
            start = { code: startCode, found };
        }
    }
    if (!start)
        return null;
    // Read every symbol up to the stop pattern first, and only then interpret
    // them. The symbol immediately before the stop is the checksum, and it is
    // indistinguishable from data while scanning — interpreting as we go would
    // append it to the text (a Code C checksum of 70 arrives as the digits
    // "70"). Collecting first makes dropping it exact rather than a guess.
    const values = [];
    let offset = start.found.end;
    const counters = new Array(6).fill(0);
    const stopCounters = new Array(7).fill(0);
    for (;;) {
        // The stop pattern has seven elements, so it must be tried before the
        // six-element symbol set or its first six would match something.
        if (recordPattern(row, offset, stopCounters) &&
            patternVariance(stopCounters, CODE128_RUNS[CODE128_STOP], 0.7) < 0.38) {
            break;
        }
        if (!recordPattern(row, offset, counters))
            return null;
        let best = -1;
        let bestVariance = 0.4;
        for (let c = 0; c < CODE128_RUNS.length - 1; c++) {
            const v = patternVariance(counters, CODE128_RUNS[c], 0.7);
            if (v < bestVariance) {
                bestVariance = v;
                best = c;
            }
        }
        if (best < 0)
            return null;
        let width = 0;
        for (const c of counters)
            width += c;
        offset += width;
        values.push(best);
        if (values.length > 256)
            return null; // runaway scan
    }
    // Start symbol, data, checksum, stop. Anything shorter is not a symbol.
    if (values.length < 2)
        return null;
    const checksum = values[values.length - 1];
    const dataValues = values.slice(0, -1);
    // Verify the checksum rather than trusting the scan. Without this a run of
    // noise that happens to match valid patterns decodes to plausible garbage,
    // which is far worse than reporting nothing.
    let sum = start.code;
    for (let i = 0; i < dataValues.length; i++)
        sum += dataValues[i] * (i + 1);
    if (sum % 103 !== checksum)
        return null;
    let mode = start.code === CODE128_START_A ? 'A'
        : start.code === CODE128_START_B ? 'B' : 'C';
    let shifted = null;
    let text = '';
    const fnc1AtStart = dataValues[0] === CODE128_FNC1;
    const fnc1Positions = [];
    for (let dataIndex = 0; dataIndex < dataValues.length; dataIndex++) {
        const value = dataValues[dataIndex];
        const active = shifted || mode;
        shifted = null;
        if (value === CODE128_CODE_A && mode !== 'A') {
            mode = 'A';
            continue;
        }
        if (value === CODE128_CODE_B && mode !== 'B') {
            mode = 'B';
            continue;
        }
        if (value === CODE128_CODE_C) {
            mode = 'C';
            continue;
        }
        if (value === CODE128_SHIFT) {
            shifted = mode === 'A' ? 'B' : 'A';
            continue;
        }
        if (value === CODE128_FNC1) {
            if (dataIndex > 0) {
                fnc1Positions.push(text.length);
                text += '\x1d';
            }
            continue;
        }
        if (value >= 96 && value <= 102) {
            continue;
        } // other function characters
        if (active === 'C') {
            text += String(value).padStart(2, '0');
        }
        else if (active === 'A') {
            text += value < 64 ? String.fromCharCode(value + 32) : String.fromCharCode(value - 64);
        }
        else {
            text += String.fromCharCode(value + 32);
        }
    }
    if (text.length === 0)
        return null;
    if (fnc1AtStart) {
        return {
            format: 'gs1128',
            text,
            gs1: true,
            symbologyIdentifier: ']C1',
            fnc1AtStart: true,
            fnc1Positions,
        };
    }
    return { format: 'code128', text };
}
/* ------------------------------------------------------------------ *
 * Code 39
 * ------------------------------------------------------------------ */
/**
 * @param {Uint8Array} row
 * @param {object} options
 * @returns {{format: string, text: string} | null}
 */
function decodeCode39(row, options = {}) {
    const counters = new Array(9).fill(0);
    let offset = 0;
    // Find the '*' start character.
    const startBits = nwToBits(CODE39['*']);
    let found = false;
    while (offset < row.length) {
        while (offset < row.length && row[offset] !== 1)
            offset++;
        if (offset >= row.length)
            break;
        if (recordPattern(row, offset, counters)) {
            if (toNarrowWidePattern(counters, 3) === startBits) {
                found = true;
                break;
            }
        }
        // Advance past this dark run and the following light run.
        while (offset < row.length && row[offset] === 1)
            offset++;
        while (offset < row.length && row[offset] === 0)
            offset++;
    }
    if (!found)
        return null;
    let width = 0;
    for (const c of counters)
        width += c;
    offset += width;
    let text = '';
    for (;;) {
        // Skip the inter-character gap.
        while (offset < row.length && row[offset] === 0)
            offset++;
        if (offset >= row.length)
            return null;
        if (!recordPattern(row, offset, counters))
            return null;
        const bits = toNarrowWidePattern(counters, 3);
        const ch = CODE39_BITS[bits];
        if (ch === undefined)
            return null;
        let w = 0;
        for (const c of counters)
            w += c;
        offset += w;
        if (ch === '*')
            break;
        text += ch;
        if (text.length > 80)
            return null;
    }
    if (text.length === 0)
        return null;
    if (options.checkDigit) {
        const expected = text[text.length - 1];
        const body = text.slice(0, -1);
        let sum = 0;
        for (const ch of body)
            sum += CODE39_CHECK_SET.indexOf(ch);
        if (CODE39_CHECK_SET[sum % 43] !== expected)
            return null;
        text = body;
    }
    return { format: 'code39', text };
}
/** Decode Italian Code 32 after validating its Code 39/base-32 payload. */
export function decodeCode32(row) {
    const base = decodeCode39(row);
    if (!base)
        return null;
    const parsed = decodeCode32Payload(base.text);
    return parsed
        ? { format: 'code32', text: parsed.text, checkDigit: true }
        : null;
}
/** Decode PZN-7 or PZN-8 after validating its Code 39 payload/check digit. */
export function decodePZN(row) {
    const base = decodeCode39(row);
    if (!base)
        return null;
    const parsed = decodePZNPayload(base.text);
    return parsed
        ? {
            format: 'pzn',
            text: parsed.text,
            pznVariant: parsed.variant,
            checkDigit: true,
        }
        : null;
}
/* ------------------------------------------------------------------ *
 * Code 93
 * ------------------------------------------------------------------ */
/**
 * @param {Uint8Array} row
 * @returns {{format: string, text: string} | null}
 */
function decodeCode93(row) {
    const startRuns = widthsToArray('111141');
    const start = findGuard(row, 0, startRuns, false);
    if (!start)
        return null;
    let offset = start.end;
    const counters = new Array(6).fill(0);
    const values = [];
    for (;;) {
        if (!recordPattern(row, offset, counters))
            return null;
        let best = -1;
        let bestVariance = 0.38;
        for (let v = 0; v < CODE93_VALUES.length; v++) {
            const runs = CODE93_RUNS[CODE93_VALUES[v]];
            const variance = patternVariance(counters, runs, 0.7);
            if (variance < bestVariance) {
                bestVariance = variance;
                best = v;
            }
        }
        const stopVariance = patternVariance(counters, startRuns, 0.7);
        if (stopVariance < bestVariance)
            break;
        if (best < 0)
            return null;
        values.push(best);
        let w = 0;
        for (const c of counters)
            w += c;
        offset += w;
        if (values.length > 90)
            return null;
    }
    if (values.length < 3)
        return null;
    // Verify both check characters before trusting anything.
    const weighted = (data, maxWeight) => {
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            const weight = ((data.length - 1 - i) % maxWeight) + 1;
            sum += weight * data[i];
        }
        return sum % 47;
    };
    const k = values.pop();
    const c = values.pop();
    if (weighted(values, 20) !== c)
        return null;
    if (weighted([...values, c], 15) !== k)
        return null;
    let text = '';
    for (const v of values) {
        const key = CODE93_VALUES[v];
        if (key.length > 1)
            return null; // shift characters not expanded here
        text += key;
    }
    return { format: 'code93', text };
}
/* ------------------------------------------------------------------ *
 * ITF
 * ------------------------------------------------------------------ */
/**
 * @param {Uint8Array} row
 * @returns {{format: string, text: string} | null}
 */
function decodeITF(row) {
    const start = findGuard(row, 0, [1, 1, 1, 1], false);
    if (!start)
        return null;
    const startScale = (start.end - start.start) / 4;
    let offset = start.end;
    const digits = [];
    const barCounters = new Array(5).fill(0);
    const spaceCounters = new Array(5).fill(0);
    const pair = new Array(10).fill(0);
    for (;;) {
        if (!recordPattern(row, offset, pair))
            break;
        // De-interleave: even indices are bars, odd are spaces.
        for (let k = 0; k < 5; k++) {
            barCounters[k] = pair[k * 2];
            spaceCounters[k] = pair[k * 2 + 1];
        }
        const barBits = toNarrowWidePattern(barCounters, 2);
        const spaceBits = toNarrowWidePattern(spaceCounters, 2);
        const a = ITF_BITS[barBits];
        const b = ITF_BITS[spaceBits];
        if (a === undefined || b === undefined)
            break;
        digits.push(a, b);
        let w = 0;
        for (const c of pair)
            w += c;
        offset += w;
        if (digits.length > 40)
            break;
    }
    // ITF carries no mandatory checksum, so structure is the only defence
    // against a false positive — and without these two checks there is none.
    //
    // The loop above stops as soon as a pair fails to match, which happens both
    // at the genuine end of a symbol and in the middle of unrelated bars. Two
    // digits scraped out of a Code 39 or UPC-A symbol matched the digit patterns
    // often enough to be reported as a real ITF read, so `decode()` returned a
    // phantom result alongside the true one.
    if (digits.length < MIN_ITF_DIGITS)
        return null;
    // Require the run to end on the actual stop pattern: wide bar, narrow space,
    // narrow bar. A fragment that merely ran out of matching pairs has no stop
    // pattern after it and is rejected here.
    const stop = new Array(3).fill(0);
    if (!recordPattern(row, offset, stop))
        return null;
    if (toNarrowWidePattern(stop, 1) !== 0b100)
        return null;
    const stopEnd = offset + counterTotal(stop);
    let nextDark = stopEnd;
    while (nextDark < row.length && row[nextDark] === 0)
        nextDark++;
    if (nextDark !== row.length && nextDark - stopEnd < Math.max(3, Math.ceil(startScale * 3)))
        return null;
    return { format: 'itf', text: digits.join('') };
}
/**
 * ITF-6: the JIS X 0502 add-on for ITF-14/ITF-16. Same symbology as ITF,
 * constrained to exactly six digits with a mandatory, validated modulo-10
 * check digit — the base ITF decoder carries no checksum, so this is the
 * only thing distinguishing a genuine ITF-6 read from an ordinary six-digit
 * ITF fragment.
 *
 * @param {Uint8Array} row
 * @returns {{format:'itf6',text:string}|null}
 */
function decodeITF6(row) {
    const result = decodeITF(row);
    if (!result || result.text.length !== 6)
        return null;
    if (ean13CheckDigit(result.text.slice(0, 5)) !== Number(result.text[5]))
        return null;
    return { format: 'itf6', text: result.text };
}
/* ------------------------------------------------------------------ *
 * Code 25 family
 * ------------------------------------------------------------------ */
/** Convert a Code 25 width description into the measured module widths. */
function code25Widths(pattern, ratio) {
    return [...pattern].map((width) => Number(width) > 1 ? ratio : 1);
}
const CODE25_RATIO_CANDIDATES = [2, 3, 4, 5, 6, 7, 8];
// A 2:1 ratio makes the Data Logic digit table's reversed reading collide
// with a different valid full-length reading; the writer already refuses to
// produce it (see code25.ts), and the reader excludes it here too so a
// foreign 2:1 Data Logic image is not treated as unambiguous.
const CODE25_DATALOGIC_RATIO_CANDIDATES = [3, 4, 5, 6, 7, 8];
/**
 * Match a Code 25 guard or digit at an exact offset. The writer permits a
 * configurable wide-bar ratio, so a small bounded set of ratios is considered
 * while matching rather than assuming one printer's dimensions.
 *
 * @param {Uint8Array} row
 * @param {number} start
 * @param {string} pattern
 * @param {number|undefined} preferredRatio
 * @param {number} [threshold] Maximum accepted variance score.
 * @param {readonly number[]} [ratioCandidates] Ratios to try when `preferredRatio` is not set.
 * @returns {{end:number, score:number, ratio:number}|null}
 */
function matchCode25(row, start, pattern, preferredRatio, threshold = 0.38, ratioCandidates = CODE25_RATIO_CANDIDATES) {
    const counters = new Array(pattern.length).fill(0);
    if (!recordPattern(row, start, counters))
        return null;
    const candidates = preferredRatio
        ? [preferredRatio]
        : ratioCandidates;
    let best = null;
    for (const ratio of candidates) {
        const score = patternVariance(counters, code25Widths(pattern, ratio), 0.75);
        if (!Number.isFinite(score))
            continue;
        if (!best || score < best.score)
            best = { score, ratio };
    }
    if (!best || best.score >= threshold)
        return null;
    return {
        end: start + counters.reduce((sum, width) => sum + width, 0),
        score: best.score,
        ratio: best.ratio,
    };
}
/**
 * Find a Code 25 start guard in a scanline.
 *
 * The Data Logic digit grammar is shorter and less distinctive than the
 * discrete Industrial table (three bar/space pairs instead of five), so its
 * generic, ratio-less "1111" guard can accidentally score well against a
 * fragment of the symbol's own data. `preferLeftmost` returns the first
 * accepted match instead of the best-scoring one across the whole row,
 * which is the correct guard in a clean, quiet-zone-delimited symbol.
 */
function findCode25Start(row, startPattern, preferLeftmost = false, threshold = 0.38) {
    let best = null;
    for (let offset = 0; offset < row.length; offset++) {
        if (row[offset] !== 1 || (offset > 0 && row[offset - 1] === 1))
            continue;
        const found = matchCode25(row, offset, startPattern, undefined, threshold);
        if (!found)
            continue;
        if (preferLeftmost)
            return { start: offset, ...found };
        if (!best || found.score < best.score) {
            best = { start: offset, ...found };
        }
    }
    return best;
}
/**
 * Decode a Code 25/Industrial 2 of 5/IATA 2 of 5 scanline.
 *
 * Standard 2 of 5 and Industrial 2 of 5 intentionally share the canonical
 * industrial frame in this SDK; the public variant labels remain explicit so
 * callers can select the terminology used by their data source.
 *
 * @param {Uint8Array} row
 * @param {'standard'|'industrial'|'iata'|'datalogic'|'matrix'} variant
 * @param {object} options
 * @returns {{format:'industrial2of5'|'iata2of5'|'datalogic2of5'|'matrix2of5',text:string,checkDigit:boolean}|null}
 */
function decodeCode25Variant(row, variant, options = {}) {
    const profile = CODE25_VARIANTS[variant];
    const digitPatterns = profile.digitPatterns;
    // The Data Logic digit grammar is shorter and less self-checking than the
    // discrete Industrial table, so its generic "1111" guard needs a tighter
    // acceptance threshold to avoid scoring well against a fragment of the
    // symbol's own data (including when a mirrored retry scans it backwards).
    const threshold = 0.38;
    const isWidthModulated = variant === 'datalogic' || variant === 'matrix';
    const ratioCandidates = isWidthModulated ? CODE25_DATALOGIC_RATIO_CANDIDATES : CODE25_RATIO_CANDIDATES;
    const start = findCode25Start(row, profile.start, variant === 'datalogic', threshold);
    if (!start)
        return null;
    let offset = start.end;
    let digits = '';
    let stop = null;
    // The IATA and Data Logic start guards are all narrow bars and therefore
    // carry no ratio information. Infer the ratio from the first data digit
    // instead of hard-coding the first candidate (which would make a 3:1
    // symbol look like a truncated stop pattern). Matrix 2 of 5's start guard
    // has a genuine wide element, so its ratio is already known.
    let ratio = variant === 'iata' || variant === 'datalogic' ? undefined : start.ratio;
    const counters = new Array(digitPatterns[0].length).fill(0);
    // Data Logic and Matrix 2 of 5 share a short, low-redundancy digit grammar
    // that can make the tail of one digit plus the head of the next
    // coincidentally match the stop pattern exactly. A valid digit reading one
    // position further is always the more trustworthy interpretation there, so
    // check for a digit before accepting a stop rather than the other way round.
    const preferDigitOverStop = isWidthModulated;
    for (let count = 0; count < CODE25_MAX_DIGITS; count++) {
        const matchStop = () => {
            const candidateStop = matchCode25(row, offset, profile.stop, ratio, threshold, ratioCandidates);
            const stopGap = candidateStop
                ? (() => {
                    let nextDark = candidateStop.end;
                    while (nextDark < row.length && row[nextDark] === 0)
                        nextDark++;
                    return nextDark === row.length ? Infinity : nextDark - candidateStop.end;
                })()
                : 0;
            return candidateStop && stopGap >= Math.max(3, Math.ceil((ratio ?? candidateStop.ratio) * 3))
                ? candidateStop
                : null;
        };
        const matchDigit = () => {
            if (!recordPattern(row, offset, counters))
                return null;
            let bestDigit = null;
            for (let digit = 0; digit < digitPatterns.length; digit++) {
                const candidates = ratio ? [ratio] : ratioCandidates;
                for (const candidateRatio of candidates) {
                    const score = patternVariance(counters, code25Widths(digitPatterns[digit], candidateRatio), 0.75);
                    if (!Number.isFinite(score))
                        continue;
                    if (!bestDigit || score < bestDigit.score) {
                        bestDigit = { digit, score, ratio: candidateRatio };
                    }
                }
            }
            return bestDigit && bestDigit.score < threshold ? bestDigit : null;
        };
        if (preferDigitOverStop) {
            const bestDigit = matchDigit();
            if (bestDigit) {
                ratio ?? (ratio = bestDigit.ratio);
                digits += String(bestDigit.digit);
                offset += counters.reduce((sum, width) => sum + width, 0);
                continue;
            }
            const candidateStop = matchStop();
            if (!candidateStop)
                return null;
            stop = candidateStop;
            break;
        }
        const candidateStop = matchStop();
        if (candidateStop) {
            stop = candidateStop;
            break;
        }
        const bestDigit = matchDigit();
        if (!bestDigit)
            return null;
        ratio ?? (ratio = bestDigit.ratio);
        digits += String(bestDigit.digit);
        offset += counters.reduce((sum, width) => sum + width, 0);
    }
    // Data Logic and Matrix 2 of 5's digit grammar is shorter than the
    // discrete Industrial table, so a very short body is not distinctive
    // enough to trust without a check digit (mirrors how other narrow-guard
    // readers in this suite reject very short ambiguous reads). Matrix 2 of 5
    // was found to false-match a fragment of an unrelated Code 128 symbol at
    // one digit during testing; five digits closes that gap the same way it
    // already does for Data Logic.
    const minDigits = isWidthModulated ? 5 : 1;
    if (!stop || digits.length < minDigits)
        return null;
    const stopEnd = stop.end;
    let nextDark = stopEnd;
    while (nextDark < row.length && row[nextDark] === 0)
        nextDark++;
    if (nextDark !== row.length && nextDark - stopEnd < Math.max(3, Math.ceil(start.ratio * 3))) {
        return null;
    }
    let checkDigit = false;
    if (options.checkDigit === true || options.profile === 'camera') {
        if (digits.length < 2)
            return null;
        const body = digits.slice(0, -1);
        if (code25CheckDigit(body) !== Number(digits.at(-1)))
            return null;
        digits = body;
        checkDigit = true;
    }
    return {
        format: profile.id,
        text: digits,
        checkDigit,
    };
}
/** Decode the canonical Standard/Industrial 2 of 5 frame. */
export function decodeIndustrial2of5(row, options = {}) {
    return decodeCode25Variant(row, 'industrial', options);
}
/** Decode IATA 2 of 5 with its shorter guard frame. */
export function decodeIATA2of5(row, options = {}) {
    return decodeCode25Variant(row, 'iata', options);
}
/** Decode Code 2 of 5 Data Logic (also known as China Post). */
export function decodeDataLogic2of5(row, options = {}) {
    return decodeCode25Variant(row, 'datalogic', options);
}
/** Decode Matrix 2 of 5. */
export function decodeMatrix2of5(row, options = {}) {
    return decodeCode25Variant(row, 'matrix', options);
}
/** Decode the canonical Standard 2 of 5 frame. */
export function decodeStandard2of5(row, options = {}) {
    return decodeCode25Variant(row, 'standard', options);
}
/** Decode any Code 25 family frame using the canonical Standard profile. */
export function decodeCode25(row, options = {}) {
    return decodeCode25Variant(row, 'standard', options);
}
/* ------------------------------------------------------------------ *
 * FIM (USPS Facing Identification Mark)
 * ------------------------------------------------------------------ */
/** Run-length representation of each FIM pattern, derived once from FIM_PATTERNS. */
const FIM_RUNS = Object.fromEntries(Object.entries(FIM_PATTERNS).map(([type, bits]) => {
    const runs = [];
    for (const bit of bits) {
        if (runs.length && (runs[runs.length - 1].bit === bit)) {
            runs[runs.length - 1].width++;
        }
        else {
            runs.push({ bit, width: 1 });
        }
    }
    return [type, runs.map((run) => run.width)];
}));
/**
 * Decode a FIM scanline. Every pattern starts and ends with a bar and is a
 * palindrome, so there is no reversed-read ambiguity between the five types;
 * the only risk is a false match against unrelated content, which the
 * leading/trailing quiet-zone check below guards against.
 *
 * @param {Uint8Array} row
 * @returns {{format:'fim',text:'A'|'B'|'C'|'D'|'E'}|null}
 */
export function decodeFIM(row) {
    let best = null;
    for (let offset = 0; offset < row.length; offset++) {
        if (row[offset] !== 1 || (offset > 0 && row[offset - 1] === 1))
            continue;
        for (const [type, runs] of Object.entries(FIM_RUNS)) {
            const counters = new Array(runs.length).fill(0);
            if (!recordPattern(row, offset, counters))
                continue;
            const score = patternVariance(counters, runs, 0.15);
            if (!Number.isFinite(score) || score >= 0.06)
                continue;
            const totalModules = runs.reduce((sum, width) => sum + width, 0);
            const totalPixels = counters.reduce((sum, width) => sum + width, 0);
            const unit = totalPixels / totalModules;
            const end = offset + totalPixels;
            if (!best || score < best.score)
                best = { offset, end, type, score, unit };
        }
    }
    if (!best)
        return null;
    // The unit-scaled requirement alone is easy for noise to satisfy (a tiny
    // self-inferred unit only demands a tiny quiet zone), so an absolute pixel
    // floor is required in addition to it. Real FIM clear zones are generous.
    const quietZone = Math.max(8, Math.ceil(best.unit * 3));
    let before = best.offset;
    let scanned = 0;
    while (before > 0 && row[before - 1] === 0 && scanned < quietZone) {
        before--;
        scanned++;
    }
    if (best.offset > 0 && scanned < quietZone)
        return null;
    let after = best.end;
    scanned = 0;
    while (after < row.length && row[after] === 0 && scanned < quietZone) {
        after++;
        scanned++;
    }
    if (after < row.length && scanned < quietZone)
        return null;
    return { format: 'fim', text: best.type };
}
/* ------------------------------------------------------------------ *
 * Codabar
 * ------------------------------------------------------------------ */
/**
 * @param {Uint8Array} row
 * @returns {{format: string, text: string} | null}
 */
function decodeCodabar(row) {
    const counters = new Array(7).fill(0);
    let offset = 0;
    let startChar = null;
    while (offset < row.length) {
        while (offset < row.length && row[offset] !== 1)
            offset++;
        if (offset >= row.length)
            break;
        if (recordPattern(row, offset, counters)) {
            const bits = toNarrowWidePattern(counters, 3) >= 0
                ? toNarrowWidePattern(counters, 3)
                : toNarrowWidePattern(counters, 2);
            const ch = CODABAR_BITS[bits];
            if (ch && CODABAR_START_STOP.includes(ch)) {
                startChar = ch;
                break;
            }
        }
        while (offset < row.length && row[offset] === 1)
            offset++;
        while (offset < row.length && row[offset] === 0)
            offset++;
    }
    if (!startChar)
        return null;
    let w = 0;
    for (const c of counters)
        w += c;
    offset += w;
    let text = '';
    for (;;) {
        while (offset < row.length && row[offset] === 0)
            offset++;
        if (offset >= row.length)
            return null;
        if (!recordPattern(row, offset, counters))
            return null;
        let bits = toNarrowWidePattern(counters, 3);
        let ch = CODABAR_BITS[bits];
        if (ch === undefined) {
            bits = toNarrowWidePattern(counters, 2);
            ch = CODABAR_BITS[bits];
        }
        if (ch === undefined)
            return null;
        let width = 0;
        for (const c of counters)
            width += c;
        offset += width;
        if (CODABAR_START_STOP.includes(ch))
            break;
        text += ch;
        if (text.length > 60)
            return null;
    }
    if (text.length === 0)
        return null;
    return { format: 'codabar', text };
}
/* ------------------------------------------------------------------ *
 * Public entry point
 * ------------------------------------------------------------------ */
/** Decoders in the order they are tried. */
const DECODERS = [
    ['ean13', decodeEANFamily],
    ['upca', decodeEANFamily],
    ['ean8', decodeEAN8],
    ['upce', decodeUPCE],
    ['code128', decodeCode128],
    ['code11', decodeCode11],
    ['msi', decodeMSI],
    ['telepen', decodeTelepen],
    ['telepennumeric', (row, options = {}) => decodeTelepen(row, { ...options, numeric: true })],
    ['gs1databar14', decodeDataBar14Scanline],
    ['code32', decodeCode32],
    ['pzn', decodePZN],
    ['code39', decodeCode39],
    ['code93', decodeCode93],
    ['industrial2of5', decodeIndustrial2of5],
    ['iata2of5', decodeIATA2of5],
    ['datalogic2of5', decodeDataLogic2of5],
    ['matrix2of5', decodeMatrix2of5],
    ['fim', decodeFIM],
    ['itf', decodeITF],
    ['itf6', decodeITF6],
    ['codabar', decodeCodabar],
];
const EAN_PARENT_FORMATS = new Set(['ean13', 'ean8', 'upca', 'upce', 'isbn', 'jan']);
const EAN_SUPPLEMENT_FORMATS = new Set(['ean2', 'ean5']);
/** @param {string} format @returns {boolean} */
function isEANParentFormat(format) {
    return format === 'ean13' || format === 'ean8' || format === 'upca' || format === 'upce';
}
/**
 * An ISBN is printed as a Bookland EAN-13, so its decoded parent remains
 * `ean13` while an ISBN filter accepts only the Bookland prefixes.
 *
 * @param {{format:string, text:string}} result
 * @param {Set<string>} enabled
 * @returns {boolean}
 */
function isRequestedEANParent(result, enabled) {
    if (enabled.has(result.format))
        return true;
    if (result.format !== 'ean13')
        return false;
    if (enabled.has('isbn') && /^97[89]/.test(result.text))
        return true;
    if (enabled.has('jan') && /^(45|49)/.test(result.text))
        return true;
    return false;
}
/** @param {object} result @returns {object} */
function withoutEANAddon(result) {
    const { addon, ...parent } = result;
    void addon;
    return parent;
}
/** @param {Uint8Array} row @returns {{x:number, width:number, quietZone:boolean}|null} */
function cameraRowGeometry(row) {
    let first = 0;
    while (first < row.length && row[first] === 0)
        first++;
    if (first === row.length)
        return null;
    let last = row.length - 1;
    while (last >= 0 && row[last] === 0)
        last--;
    return {
        x: first,
        width: last - first + 1,
        quietZone: first >= 2 && row.length - 1 - last >= 2,
    };
}
/** @param {string} format @param {object} options @returns {boolean|null} */
function checksumStatus(format, options, result = null) {
    if (format === 'ean13' || format === 'ean8' || format === 'upca' || format === 'upce' ||
        format === 'code93' || format === 'code128' || format === 'gs1128' ||
        format === 'gs1databar14')
        return true;
    if (format === 'code11' || format === 'msi' || format === 'code39') {
        return options.profile === 'camera' || options.checkDigit === true ? true : null;
    }
    if (format === 'code32' || format === 'pzn' || format === 'itf6')
        return true;
    if (format === 'industrial2of5' || format === 'iata2of5' || format === 'datalogic2of5'
        || format === 'matrix2of5') {
        return result?.checkDigit === true ? true : null;
    }
    if (format === 'telepen' || format === 'telepennumeric')
        return true;
    if (format === 'postnet' || format === 'planet' || format === 'rm4scc'
        || format === 'auspost' || format === 'japanpost' || format === 'imb')
        return true;
    return null;
}
/** @param {object} result @param {object} geometry @param {Set<number>} rows @param {object} options @returns {object} */
function cameraMetadata(result, geometry, rows, options) {
    const checksum = checksumStatus(result.format, options, result);
    const consistency = Math.min(1, rows.size / 3);
    const confidence = Math.min(1, 0.4 + (geometry.quietZone ? 0.2 : 0) +
        (checksum === true ? 0.2 : 0) + consistency * 0.2);
    return {
        ...result,
        confidence,
        bounds: {
            x: geometry.x,
            y: Math.min(...rows),
            width: geometry.width,
            height: Math.max(...rows) - Math.min(...rows) + 1,
        },
        rotation: options.cameraRotation ?? 0,
        quality: { quietZone: geometry.quietZone, checksum, rows: rows.size, consistency },
    };
}
/**
 * Read every linear symbol found in a binarized image.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} image Binarized; set bit = dark.
 * @param {object} [options]
 * @param {string[]} [options.formats] Restrict to these format ids.
 * @param {number} [options.rows] How many horizontal slices to try.
 * @param {boolean} [options.tryHarder] Also scan reversed rows, for mirrored symbols.
 * @param {'camera'} [options.profile] Require stable, quiet-zone-qualified reads.
 * @param {0|90|180|270} [options.cameraRotation] Orientation already normalized by the caller.
 * @returns {Array<{format: string, text: string, row: number}>}
 */
export function decodeOneD(image, options = {}) {
    const { formats = null, rows = 15, tryHarder = true, profile = null } = options;
    const cameraProfile = profile === 'camera';
    const enabled = formats ? new Set(formats) : null;
    const active = DECODERS.filter(([id]) => {
        // Telepen Numeric uses the same guards as Telepen Alpha and is therefore
        // only attempted when the caller explicitly requests the numeric mode.
        // Auto-detecting it as ASCII would turn valid digit pairs into plausible
        // but incorrect control characters.
        if (!enabled)
            return id !== 'telepennumeric';
        if (enabled.has(id))
            return true;
        if (id === 'telepen')
            return enabled.has('telepen-alpha');
        if (id === 'telepennumeric')
            return enabled.has('telepen-numeric');
        if (id === 'code32')
            return enabled.has('italian-pharmacode');
        if (id === 'pzn')
            return enabled.has('pzn7') || enabled.has('pzn8');
        if (id === 'industrial2of5') {
            return enabled.has('code2of5') || enabled.has('standard2of5')
                || enabled.has('standard-2-of-5') || enabled.has('industrial-2-of-5');
        }
        if (id === 'iata2of5')
            return enabled.has('iata-2-of-5');
        if (id === 'datalogic2of5') {
            return enabled.has('data-logic-2-of-5') || enabled.has('chinapost') || enabled.has('china-post');
        }
        if (id === 'matrix2of5')
            return enabled.has('matrix-2-of-5');
        if (id === 'fim')
            return enabled.has('facing-identification-mark');
        if (id === 'ean13' || id === 'ean8' || id === 'upca' || id === 'upce') {
            return enabled.has('ean2') || enabled.has('ean5') ||
                (id === 'ean13' && (enabled.has('isbn') || enabled.has('jan')));
        }
        if (id === 'code128')
            return enabled.has('gs1128');
        if (id === 'gs1databar14')
            return enabled.has('databar') || enabled.has('gs1-databar14');
        return false;
    });
    const results = [];
    const seen = new Set();
    // Postal symbols carry information in the vertical bar state rather than
    // in a horizontal run-width alphabet. Decode that shared path once before
    // the ordinary scanline readers; an explicit non-postal filter yields no
    // postal attempt and therefore cannot broaden a caller's format request.
    const postalResults = decodePostal(image, {
        ...options,
        profile: cameraProfile ? 'camera' : undefined,
        formats: formats ? formats : undefined,
    });
    const postalRow = image.height >> 1;
    for (const result of postalResults) {
        const key = `${result.format}:${result.text}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        results.push({ ...result, row: postalRow });
    }
    if (active.length === 0)
        return results;
    const height = image.height;
    const buffer = new Uint8Array(image.width);
    const cameraCandidates = new Map();
    // Sample rows from the middle outward: symbols are usually centred, and the
    // middle of a linear barcode is the part least likely to be clipped.
    const middle = height >> 1;
    const sampleRows = cameraProfile ? Math.min(height, Math.max(rows, 48)) : rows;
    const step = Math.max(1, Math.round(height / sampleRows));
    for (let attempt = 0; attempt < sampleRows; attempt++) {
        const delta = Math.ceil(attempt / 2) * step * (attempt % 2 === 0 ? 1 : -1);
        const y = middle + delta;
        if (y < 0 || y >= height)
            continue;
        const row = image.getRow(y, buffer);
        for (const pass of tryHarder ? [false, true] : [false]) {
            const scan = pass ? Uint8Array.from(row).reverse() : row;
            for (const [id, decoder] of active) {
                let result = null;
                try {
                    // Code 11 and MSI checks are optional in their base standards, but
                    // a camera frame cannot safely promote their short unchecked forms.
                    const decoderOptions = cameraProfile && (id === 'code11' || id === 'msi'
                        || id === 'industrial2of5' || id === 'iata2of5' || id === 'datalogic2of5' || id === 'matrix2of5')
                        ? { ...options, checkDigit: true }
                        : options;
                    result = decoder(scan, decoderOptions);
                }
                catch {
                    result = null; // a malformed candidate is not an error
                }
                if (!result)
                    continue;
                if (enabled) {
                    if (isEANParentFormat(result.format)) {
                        const baseRequested = [...EAN_PARENT_FORMATS].some((format) => enabled.has(format));
                        const parentRequested = isRequestedEANParent(result, enabled);
                        if (baseRequested && !parentRequested) {
                            continue;
                        }
                        if (!baseRequested) {
                            // A supplement is never an independent barcode. When it is the
                            // only requested format, return its validated EAN/UPC parent.
                            if (!result.addon || !EAN_SUPPLEMENT_FORMATS.has(result.addon.format) ||
                                !enabled.has(result.addon.format))
                                continue;
                        }
                        else if (result.addon && !enabled.has(result.addon.format)) {
                            // Supplements are optional whenever a requested parent exists.
                            result = withoutEANAddon(result);
                        }
                    }
                    else if (result.format === 'gs1128') {
                        if (!enabled.has('gs1128') && !enabled.has('code128'))
                            continue;
                    }
                    else if (result.format === 'gs1databar14') {
                        if (!enabled.has('gs1databar14') && !enabled.has('databar') && !enabled.has('gs1-databar14'))
                            continue;
                    }
                    else if (result.format === 'telepen') {
                        if (!enabled.has('telepen') && !enabled.has('telepen-alpha'))
                            continue;
                    }
                    else if (result.format === 'telepennumeric') {
                        if (!enabled.has('telepennumeric') && !enabled.has('telepen-numeric'))
                            continue;
                    }
                    else if (result.format === 'code32') {
                        if (!enabled.has('code32') && !enabled.has('italian-pharmacode'))
                            continue;
                    }
                    else if (result.format === 'pzn') {
                        if (!enabled.has('pzn') && !enabled.has('pzn7') && !enabled.has('pzn8'))
                            continue;
                        if (enabled.has('pzn7') && result.pznVariant !== 'pzn7')
                            continue;
                        if (enabled.has('pzn8') && result.pznVariant !== 'pzn8')
                            continue;
                    }
                    else if (result.format === 'industrial2of5') {
                        if (!enabled.has('industrial2of5') && !enabled.has('industrial-2-of-5')
                            && !enabled.has('code2of5') && !enabled.has('standard2of5')
                            && !enabled.has('standard-2-of-5'))
                            continue;
                    }
                    else if (result.format === 'iata2of5') {
                        if (!enabled.has('iata2of5') && !enabled.has('iata-2-of-5'))
                            continue;
                    }
                    else if (result.format === 'datalogic2of5') {
                        if (!enabled.has('datalogic2of5') && !enabled.has('data-logic-2-of-5')
                            && !enabled.has('chinapost') && !enabled.has('china-post'))
                            continue;
                    }
                    else if (result.format === 'matrix2of5') {
                        if (!enabled.has('matrix2of5') && !enabled.has('matrix-2-of-5'))
                            continue;
                    }
                    else if (result.format === 'fim') {
                        if (!enabled.has('fim') && !enabled.has('facing-identification-mark'))
                            continue;
                    }
                    else if (!enabled.has(result.format)) {
                        continue;
                    }
                }
                const addonKey = result.addon ? `:${result.addon.format}:${result.addon.text}` : '';
                const key = `${result.format}:${result.text}${addonKey}`;
                if (cameraProfile) {
                    const geometry = cameraRowGeometry(row);
                    // Do not promote partial row fragments from a camera frame.
                    if (!geometry || !geometry.quietZone)
                        continue;
                    const candidate = cameraCandidates.get(key) ?? {
                        result,
                        geometry,
                        rows: new Set(),
                        rotation: ((options.cameraRotation ?? 0) + (pass ? 180 : 0)) % 360,
                    };
                    candidate.rows.add(y);
                    cameraCandidates.set(key, candidate);
                    continue;
                }
                if (seen.has(key))
                    continue;
                seen.add(key);
                results.push({ ...result, row: y });
                void id;
            }
        }
    }
    if (cameraProfile) {
        for (const candidate of cameraCandidates.values()) {
            // A complete symbol must survive at least two nearby scan samples. This
            // rejects isolated run coincidences without imposing a payload length.
            if (candidate.rows.size < 2)
                continue;
            results.push(cameraMetadata(candidate.result, candidate.geometry, candidate.rows, {
                ...options,
                cameraRotation: candidate.rotation,
            }));
        }
    }
    // A valid EAN/UPC parent is substantially more constrained than a generic
    // narrow/wide candidate. Suppress competing interpretations of the same
    // scanline, while retaining symbols detected on other rows.
    const eanRows = new Set(results
        .filter((result) => isEANParentFormat(result.format))
        .map((result) => result.row));
    return eanRows.size === 0
        ? results
        : results.filter((result) => !eanRows.has(result.row) || isEANParentFormat(result.format));
}
/**
 * Convenience wrapper that throws when nothing is found.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} image
 * @param {object} [options]
 * @returns {{format: string, text: string, row: number}}
 */
export function decodeOneDStrict(image, options) {
    const results = decodeOneD(image, options);
    if (results.length === 0)
        throw new NotFoundError('No linear barcode found');
    return results[0];
}
