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
 * Canada Post PostBar (CPC four-state bar code), profiles C10, D22 and G12.
 *
 * PostBar is a four-state height-coded bar alphabet (Tracker/Ascender/
 * Descender/full-Height, "T"/"A"/"D"/"H" below) carrying Reed-Solomon-
 * protected data. Every table, field layout and the RS parameters below were
 * read directly off the page images of US Patent 5,602,382A (Canada Post
 * Corporation, granted 11 Feb 1997) — not off any automated text/OCR
 * extraction of that PDF, which was found to garble the two-column tables
 * (both this project's own `pdftotext -layout` and an earlier web fetch
 * produced internally inconsistent results; the actual scanned pages are
 * completely legible). See `licenses/postbar.license`.
 *
 * The Table 1/Table 2 symbol tables, the field layouts, and the encode logic
 * were verified end to end against the patent's own fully worked PostBar.C10
 * example (DCI=Z, postal code K1S 5B6, machine ID DHAH): this module
 * reproduces the patent's stated 16-symbol codeword
 * `18 29 12 5 14 27 52 54 4 6 8 33 9 6 20 41` and bar sequence exactly (see
 * `test/postbar.test.js`), which is strong evidence the tables and bit
 * mapping were transcribed correctly, not merely self-consistent.
 *
 * Reed-Solomon runs over GF(64) with primitive polynomial X^6+X+1 — exactly
 * this SDK's existing `core/galois-field.js` `GF64` constant, reused as-is
 * rather than reimplemented, together with the existing generic
 * `core/reed-solomon.js` encoder/decoder.
 *
 * @module oned/postbar
 */
import { BitMatrix } from '../core/bit-matrix.js';
import { ChecksumError, EncodeError, FormatError } from '../core/errors.js';
import { GF64 } from '../core/galois-field.js';
import { rsDecode, rsEncode } from '../core/reed-solomon.js';
// --- Table 1: 'A' (alphabetic, 3 bars) and 'N' (numeric, 2 bars) characters.
// Used only for the postal-code field, per the patent's own note that no A/N
// characters appear anywhere else.
const TABLE1_A = {
    A: 'HHD', B: 'HAH', C: 'HAA', D: 'HAD', E: 'HDH', F: 'HDA', G: 'HDD', H: 'HHA',
    I: 'AHA', J: 'AHD', K: 'AAH', L: 'AAA', M: 'HHH', N: 'ADH', O: 'ADA', P: 'ADD',
    Q: 'DHH', R: 'DHA', S: 'DHD', T: 'DAH', U: 'DAA', V: 'DAD', W: 'DDH', X: 'DDA',
    Y: 'DDD', Z: 'AHH',
};
const TABLE1_N = {
    0: 'HH', 1: 'HA', 2: 'HD', 3: 'AH', 4: 'AA', 5: 'AD', 6: 'DH', 7: 'DA', 8: 'DD', 9: 'TH',
};
// --- Table 2: 'Z' (alphanumeric, 3 bars) characters -- space, A-Z, 0-9.
const TABLE2_Z = {
    ' ': 'HHT',
    A: 'HHH', B: 'HHA', C: 'HHD', D: 'HAH', E: 'HAA', F: 'HAD', G: 'HDH', H: 'HDA',
    I: 'HDD', J: 'AHH', K: 'AHA', L: 'AHD', M: 'AAH', N: 'AAA', O: 'AAD', P: 'ADH',
    Q: 'ADA', R: 'ADD', S: 'DHH', T: 'DHA', U: 'DHD', V: 'DAH', W: 'DAA', X: 'DAD',
    Y: 'DDH', Z: 'DDA',
    0: 'DDD', 1: 'THH', 2: 'THA', 3: 'THD', 4: 'TAH', 5: 'TAA', 6: 'TAD', 7: 'TDH', 8: 'TDA', 9: 'TDD',
};
function reverseTable(table) {
    const reversed = new Map();
    for (const [symbol, bars] of Object.entries(table))
        reversed.set(bars, symbol);
    return reversed;
}
const TABLE1_A_REV = reverseTable(TABLE1_A);
const TABLE1_N_REV = reverseTable(TABLE1_N);
const TABLE2_Z_REV = reverseTable(TABLE2_Z);
// --- Bar values: "The bar values (Vn) are assigned as follows: H=0; A=1;
// D=2; T=3" -- and, equivalently as 2 bits per bar, "H=00, A=01, D=10, T=11",
// used to pack three bars into one 6-bit GF(64) element.
const BAR_VALUE = { H: 0, A: 1, D: 2, T: 3 };
const VALUE_BAR = ['H', 'A', 'D', 'T'];
// Row geometry for an 8-row-tall symbol, following this SDK's existing
// postal-family rendering convention (see oned/postal.ts's STATE_PROFILES):
// Tracker is centred, Ascender extends up, Descender extends down, H is full
// height. Keyed by the patent's own bar letters, not a numeric index, so the
// mapping cannot be silently transposed.
const BAR_ROWS = {
    T: [3, 5], A: [0, 5], D: [3, 8], H: [0, 8],
};
function barsToInt(bars) {
    let value = 0;
    for (const bar of bars)
        value = (value << 2) | BAR_VALUE[bar];
    return value;
}
function intToBars(value, barCount) {
    let bars = '';
    for (let shift = (barCount - 1) * 2; shift >= 0; shift -= 2) {
        bars += VALUE_BAR[(value >> shift) & 3];
    }
    return bars;
}
const PROFILES = {
    postbarc10: {
        id: 'postbarc10',
        dci: 'Z',
        fields: [{ name: 'postalCode', pattern: 'ANANAN' }],
        hasMachineId: true,
        rsCheckSymbols: 10,
    },
    postbard22: {
        id: 'postbard22',
        dci: 'C',
        fields: [
            { name: 'postalCode', pattern: 'ANANAN' },
            { name: 'addressLocator', pattern: 'ZZZZ' },
            { name: 'customerInfo', pattern: 'Z'.repeat(11) },
        ],
        hasMachineId: false,
        rsCheckSymbols: 4,
    },
    postbarg12: {
        id: 'postbarg12',
        dci: '1',
        fields: [
            { name: 'countryCode', pattern: 'NNN' },
            { name: 'postalCode', pattern: 'Z'.repeat(8) },
        ],
        hasMachineId: false,
        rsCheckSymbols: 4,
    },
};
function lookupChar(type, ch, label) {
    const table = type === 'A' ? TABLE1_A : type === 'N' ? TABLE1_N : TABLE2_Z;
    const bars = table[ch];
    if (bars === undefined)
        throw new EncodeError(`PostBar ${label}: '${ch}' is not a valid ${type}-character`);
    return bars;
}
function reverseLookup(type, bars, label) {
    const table = type === 'A' ? TABLE1_A_REV : type === 'N' ? TABLE1_N_REV : TABLE2_Z_REV;
    const ch = table.get(bars);
    if (ch === undefined)
        throw new FormatError(`PostBar ${label}: bar pattern '${bars}' is not a valid ${type}-character`);
    return ch;
}
function fieldBars(field, value) {
    const text = String(value ?? '');
    if (text.length !== field.pattern.length) {
        throw new EncodeError(`PostBar ${field.name} must be exactly ${field.pattern.length} characters, got ${text.length}`);
    }
    let bars = '';
    for (let i = 0; i < field.pattern.length; i++) {
        bars += lookupChar(field.pattern[i], text[i].toUpperCase(), field.name);
    }
    return bars;
}
function parseFieldBars(field, bars, offset) {
    let value = '';
    let cursor = offset;
    for (const type of field.pattern) {
        const width = type === 'N' ? 2 : 3;
        value += reverseLookup(type, bars.slice(cursor, cursor + width), field.name);
        cursor += width;
    }
    return { value, next: cursor };
}
function barsToMatrix(bars) {
    const matrix = new BitMatrix(bars.length * 2 - 1, 8);
    for (let i = 0; i < bars.length; i++) {
        const [top, bottom] = BAR_ROWS[bars[i]];
        const x = i * 2;
        for (let y = top; y < bottom; y++)
            matrix.set(x, y);
    }
    return matrix;
}
function encodeProfile(profile, fields) {
    let dataBars = TABLE2_Z[profile.dci];
    for (const field of profile.fields)
        dataBars += fieldBars(field, fields[field.name]);
    if (dataBars.length % 3 !== 0) {
        throw new EncodeError(`PostBar ${profile.id}: internal field layout is not symbol-aligned`);
    }
    const messageSymbols = [];
    for (let i = 0; i < dataBars.length; i += 3)
        messageSymbols.push(barsToInt(dataBars.slice(i, i + 3)));
    const parity = rsEncode(messageSymbols, profile.rsCheckSymbols, GF64, 1);
    let bars = 'AT' + dataBars + parity.map((symbol) => intToBars(symbol, 3)).join('');
    if (profile.hasMachineId) {
        const machineId = String(fields.machineId ?? '');
        if (!/^[0-3]{4}$/.test(machineId)) {
            throw new EncodeError('PostBar machineId must be exactly 4 quaternary digits (0-3)');
        }
        bars += [...machineId].map((digit) => VALUE_BAR[Number(digit)]).join('');
    }
    bars += 'AT';
    return barsToMatrix(bars);
}
/** Encode PostBar.C10 (CPC-internal, 56 bars). `postalCode` is 6 characters (ANANAN, e.g. "K1S5B6"); `machineId` is 4 quaternary digits ("0"-"3"). */
export function encodePostBarC10(fields) {
    return encodeProfile(PROFILES.postbarc10, {
        postalCode: String(fields?.postalCode ?? '').replace(/\s+/g, ''),
        machineId: fields?.machineId,
    });
}
/** Encode PostBar.D22 (customer-applied domestic, 79 bars). `postalCode` is 6 characters (ANANAN); `addressLocator` is 4 alphanumeric/space characters; `customerInfo` is 11. */
export function encodePostBarD22(fields) {
    return encodeProfile(PROFILES.postbard22, {
        postalCode: String(fields?.postalCode ?? '').replace(/\s+/g, ''),
        addressLocator: fields?.addressLocator,
        customerInfo: fields?.customerInfo,
    });
}
/** Encode PostBar.G12 (international, 49 bars). `countryCode` is 3 digits; `postalCode` is 8 alphanumeric/space characters (no A/N grammar for this profile). */
export function encodePostBarG12(fields) {
    return encodeProfile(PROFILES.postbarg12, {
        countryCode: fields?.countryCode,
        postalCode: fields?.postalCode,
    });
}
function decodeProfile(profile, bars) {
    const expectedLength = 2 + profile.rsCheckSymbols * 3
        + profile.fields.reduce((sum, field) => sum + fieldBarLength(field), 3)
        + (profile.hasMachineId ? 4 : 0) + 2;
    if (bars.length !== expectedLength)
        return null;
    if (bars.slice(0, 2) !== 'AT' || bars.slice(-2) !== 'AT')
        return null;
    const machineIdBars = profile.hasMachineId ? bars.slice(-6, -2) : '';
    const codedEnd = bars.length - 2 - (profile.hasMachineId ? 4 : 0);
    const coded = bars.slice(2, codedEnd);
    if (coded.length % 3 !== 0)
        return null;
    const symbols = [];
    for (let i = 0; i < coded.length; i += 3)
        symbols.push(barsToInt(coded.slice(i, i + 3)));
    let corrections;
    try {
        corrections = rsDecode(symbols, profile.rsCheckSymbols, GF64, 1, []);
    }
    catch (error) {
        if (error instanceof ChecksumError)
            return null;
        throw error;
    }
    const messageSymbols = symbols.slice(0, symbols.length - profile.rsCheckSymbols);
    const messageBars = messageSymbols.map((symbol) => intToBars(symbol, 3)).join('');
    let dci;
    try {
        dci = reverseLookup('Z', messageBars.slice(0, 3), 'DCI');
    }
    catch {
        return null;
    }
    if (dci !== profile.dci)
        return null;
    const result = { format: profile.id, corrections };
    let cursor = 3;
    for (const field of profile.fields) {
        const parsed = parseFieldBars(field, messageBars, cursor);
        result[field.name] = parsed.value;
        cursor = parsed.next;
    }
    if (profile.hasMachineId) {
        result.machineId = [...machineIdBars].map((bar) => BAR_VALUE[bar]).join('');
    }
    return result;
}
function fieldBarLength(field) {
    let length = 0;
    for (const type of field.pattern)
        length += type === 'N' ? 2 : 3;
    return length;
}
function matrixToBars(image) {
    if (image.width < 3 || image.height < 4 || image.width > 20000 || image.height > 20000)
        return null;
    const columns = [];
    for (let x = 0; x < image.width; x++) {
        let dark = false;
        for (let y = 0; y < image.height; y++)
            if (image.get(x, y)) {
                dark = true;
                break;
            }
        if (dark)
            columns.push(x);
    }
    if (columns.length === 0)
        return null;
    const runs = [];
    let start = columns[0];
    let previous = start;
    for (let i = 1; i < columns.length; i++) {
        const x = columns[i];
        if (x !== previous + 1) {
            runs.push({ start, end: previous + 1 });
            start = x;
        }
        previous = x;
    }
    runs.push({ start, end: previous + 1 });
    let minY = image.height;
    let maxY = 0;
    const boundsList = [];
    for (const run of runs) {
        let top = image.height;
        let bottom = 0;
        for (let x = run.start; x < run.end; x++) {
            for (let y = 0; y < image.height; y++) {
                if (!image.get(x, y))
                    continue;
                if (y < top)
                    top = y;
                if (y + 1 > bottom)
                    bottom = y + 1;
            }
        }
        if (top === image.height)
            return null;
        minY = Math.min(minY, top);
        maxY = Math.max(maxY, bottom);
        boundsList.push({ top, bottom });
    }
    if (maxY <= minY)
        return null;
    const centre = (minY + maxY) / 2;
    const verticalUnit = (maxY - minY) / 8;
    let bars = '';
    for (const { top, bottom } of boundsList) {
        let best = null;
        let bestScore = Infinity;
        for (const letter of Object.keys(BAR_ROWS)) {
            const [rowTop, rowBottom] = BAR_ROWS[letter];
            const expectedTop = centre + (rowTop - 4) * verticalUnit;
            const expectedBottom = centre + (rowBottom - 4) * verticalUnit;
            const score = Math.abs(top - expectedTop) + Math.abs(bottom - expectedBottom);
            if (score < bestScore) {
                bestScore = score;
                best = letter;
            }
        }
        if (best === null || bestScore > Math.max(verticalUnit * 2.4, 1.5))
            return null;
        bars += best;
    }
    const widths = runs.map((run) => run.end - run.start).sort((a, b) => a - b);
    const runWidth = widths[widths.length >> 1];
    return { bars, runWidth, left: runs[0].start, right: runs[runs.length - 1].end, imageWidth: image.width };
}
/** Decode a PostBar raster, trying every known profile. Returns [] if none match. */
export function decodePostBar(image, options = {}) {
    const scanned = matrixToBars(image);
    if (!scanned)
        return [];
    if (options.profile === 'camera') {
        const leftQuiet = scanned.left >= scanned.runWidth * 2;
        const rightQuiet = scanned.imageWidth - scanned.right >= scanned.runWidth * 2;
        if (!leftQuiet || !rightQuiet)
            return [];
    }
    const results = [];
    for (const profile of Object.values(PROFILES)) {
        const result = decodeProfile(profile, scanned.bars);
        if (result)
            results.push(result);
    }
    return results;
}
