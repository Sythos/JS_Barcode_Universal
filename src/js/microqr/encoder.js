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
import { BitMatrix } from '../core/bit-matrix.js';
import { BitWriter } from '../core/bit-buffer.js';
import { EncodeError } from '../core/errors.js';
import { GF256_QR } from '../core/galois-field.js';
import { rsEncode } from '../core/reed-solomon.js';
import { MICROQR_VERSIONS, microQrBlockLayout, microQrDataModuleOrder, microQrFormatInfo, microQrFormatInfoPositions, microQrMaskBit, microQrSymbolNumber, microQrVersionSize, } from './tables.js';
export const MICROQR_ALPHANUMERIC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const MODE = { numeric: 0, alphanumeric: 1, byte: 2, kanji: 3 };
const MODE_MIN_VERSION = { numeric: 1, alphanumeric: 2, byte: 3, kanji: 3 };
const COUNT_BITS = {
    numeric: [0, 3, 4, 5, 6], alphanumeric: [0, 0, 3, 4, 5],
    byte: [0, 0, 0, 4, 5], kanji: [0, 0, 0, 3, 4],
};
function parseVersion(value) {
    if (value == null)
        return null;
    const match = /^M?([1-4])$/i.exec(String(value));
    if (!match)
        throw new EncodeError(`Micro QR: version must be M1-M4, got ${value}`);
    return Number(match[1]);
}
function versionNumber(version) {
    return typeof version === 'number' ? version : Number(String(version).slice(1));
}
function latin1Bytes(text) {
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
        const cp = text.charCodeAt(i);
        if (cp > 0xff)
            throw new EncodeError('Micro QR: byte mode supports ISO-8859-1 only (ECI is unavailable)');
        bytes[i] = cp;
    }
    return bytes;
}
let sjisReverseMap;
function sjisToThirteenBits(sjis) {
    const trail = sjis & 0xff;
    if (trail < 0x40 || trail === 0x7f || trail > 0xfc)
        return -1;
    let adjusted;
    if (sjis >= 0x8140 && sjis <= 0x9ffc)
        adjusted = sjis - 0x8140;
    else if (sjis >= 0xe040 && sjis <= 0xebbf)
        adjusted = sjis - 0xc140;
    else
        return -1;
    const packed = (adjusted >>> 8) * 0xc0 + (adjusted & 0xff);
    return packed <= 0x1fff ? packed : -1;
}
function getSjisReverseMap() {
    if (sjisReverseMap !== undefined)
        return sjisReverseMap;
    let decoder;
    try {
        decoder = new TextDecoder('shift_jis', { fatal: true });
        if (decoder.decode(new Uint8Array([0x82, 0xa0])) !== 'あ')
            return (sjisReverseMap = null);
    }
    catch {
        return (sjisReverseMap = null);
    }
    const result = new Map();
    const bytes = new Uint8Array(2);
    for (const [start, end] of [[0x8140, 0x9ffc], [0xe040, 0xebbf]]) {
        for (let value = start; value <= end; value++) {
            if (sjisToThirteenBits(value) < 0)
                continue;
            bytes[0] = value >>> 8;
            bytes[1] = value & 0xff;
            let character;
            try {
                character = decoder.decode(bytes);
            }
            catch {
                continue;
            }
            if (Array.from(character).length === 1 && !result.has(character))
                result.set(character, value);
        }
    }
    sjisReverseMap = result;
    return result;
}
function kanjiValues(text) {
    const reverse = getSjisReverseMap();
    if (!reverse)
        return null;
    const values = [];
    for (const character of text) {
        const sjis = reverse.get(character);
        if (sjis == null)
            return null;
        values.push(sjisToThirteenBits(sjis));
    }
    return values;
}
function chooseMode(text, forced) {
    const mode = forced == null ? (/^\d+$/.test(text) ? 'numeric' :
        [...text].every((ch) => MICROQR_ALPHANUMERIC.includes(ch)) ? 'alphanumeric' :
            kanjiValues(text) ? 'kanji' : 'byte') :
        String(forced).toLowerCase();
    if (!(mode in MODE))
        throw new EncodeError(`Micro QR: unsupported mode "${forced}"`);
    if (mode === 'numeric' && !/^\d+$/.test(text))
        throw new EncodeError('Micro QR: numeric mode accepts digits only');
    if (mode === 'alphanumeric' && ![...text].every((ch) => MICROQR_ALPHANUMERIC.includes(ch))) {
        throw new EncodeError('Micro QR: alphanumeric mode contains an unsupported character');
    }
    if (mode === 'kanji' && !kanjiValues(text)) {
        throw new EncodeError('Micro QR: kanji mode requires characters representable in the QR Shift_JIS ranges');
    }
    return mode;
}
function encodePayload(text, mode) {
    const w = new BitWriter();
    if (mode === 'numeric') {
        for (let i = 0; i < text.length; i += 3) {
            const n = Math.min(3, text.length - i);
            w.put(Number(text.slice(i, i + n)), n === 3 ? 10 : n === 2 ? 7 : 4);
        }
    }
    else if (mode === 'alphanumeric') {
        let i = 0;
        for (; i + 1 < text.length; i += 2) {
            w.put(MICROQR_ALPHANUMERIC.indexOf(text[i]) * 45 + MICROQR_ALPHANUMERIC.indexOf(text[i + 1]), 11);
        }
        if (i < text.length)
            w.put(MICROQR_ALPHANUMERIC.indexOf(text[i]), 6);
    }
    else if (mode === 'byte') {
        w.putBytes(latin1Bytes(text));
    }
    else {
        for (const value of kanjiValues(text))
            w.put(value, 13);
    }
    return w;
}
function getBit(writer, index) {
    return ((writer.bytes[index >>> 3] >>> (7 - (index & 7))) & 1) === 1;
}
function writeData(text, mode, version, layout) {
    const numericVersion = versionNumber(version);
    const payload = encodePayload(text, mode);
    const writer = new BitWriter();
    if (numericVersion > 1)
        writer.put(MODE[mode], numericVersion - 1);
    const count = mode === 'byte' ? latin1Bytes(text).length : [...text].length;
    const countWidth = COUNT_BITS[mode][numericVersion];
    if (countWidth === 0 || count >= 2 ** countWidth)
        return null;
    writer.put(count, countWidth);
    for (let i = 0; i < payload.length; i++)
        writer.putBit(getBit(payload, i));
    if (writer.length > layout.dataBits)
        return null;
    for (let i = 0, n = Math.min(2 * numericVersion + 1, layout.dataBits - writer.length); i < n; i++)
        writer.putBit(false);
    if (numericVersion !== 1 && numericVersion !== 3) {
        while ((writer.length & 7) && writer.length < layout.dataBits)
            writer.putBit(false);
    }
    if (numericVersion === 1 || numericVersion === 3) {
        while (writer.length < layout.dataBits)
            writer.putBit(false);
        return writer;
    }
    let pad = 0;
    while (writer.length + 8 <= layout.dataBits)
        writer.put(pad++ & 1 ? 0x11 : 0xec, 8);
    while (writer.length < layout.dataBits)
        writer.putBit(false);
    return writer;
}
function finalMessage(dataWriter, layout) {
    const bytes = Array.from(dataWriter.toBytes());
    if (layout.shortDataCodewordBits === 4)
        bytes[bytes.length - 1] &= 0xf0;
    const ecc = rsEncode(bytes, layout.eccCodewords, GF256_QR, 0);
    const out = [];
    const full = layout.shortDataCodewordBits === 4 ? bytes.length - 1 : bytes.length;
    for (let i = 0; i < full; i++)
        for (let b = 7; b >= 0; b--)
            out.push((bytes[i] >>> b) & 1);
    if (layout.shortDataCodewordBits === 4)
        for (let b = 7; b >= 4; b--)
            out.push((bytes[bytes.length - 1] >>> b) & 1);
    for (const value of ecc)
        for (let b = 7; b >= 0; b--)
            out.push((value >>> b) & 1);
    return out;
}
function drawFunctions(matrix) {
    const size = matrix.width;
    for (let y = 0; y < 7; y++)
        for (let x = 0; x < 7; x++) {
            const ring = x === 0 || x === 6 || y === 0 || y === 6;
            const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
            matrix.setValue(x, y, ring || core);
        }
    for (let i = 0; i < 8; i++) {
        matrix.unset(7, i);
        matrix.unset(i, 7);
    }
    for (let i = 8; i < size; i++)
        if ((i & 1) === 0) {
            matrix.set(i, 0);
            matrix.set(0, i);
        }
}
function microMaskScore(matrix) {
    let right = 0, bottom = 0;
    for (let i = 1; i < matrix.width; i++) {
        if (matrix.get(matrix.width - 1, i))
            right++;
        if (matrix.get(i, matrix.height - 1))
            bottom++;
    }
    return Math.min(right, bottom) * 16 + Math.max(right, bottom);
}
function buildMatrix(version, ecc, mask, bits) {
    const matrix = new BitMatrix(microQrVersionSize(version));
    drawFunctions(matrix);
    const order = microQrDataModuleOrder(version);
    for (let i = 0; i < bits.length; i++) {
        const x = order[i * 2], y = order[i * 2 + 1];
        matrix.setValue(x, y, (bits[i] === 1) !== microQrMaskBit(mask, x, y));
    }
    const format = microQrFormatInfo(microQrSymbolNumber(version, ecc), mask);
    const positions = microQrFormatInfoPositions(matrix.width);
    for (let i = 0; i < 15; i++)
        matrix.setValue(positions[i][0], positions[i][1], ((format >>> i) & 1) === 1);
    return matrix;
}
export function encodeMicroQR(text, options = {}) {
    text = String(text);
    if (!text)
        throw new EncodeError('Micro QR: payload must not be empty');
    if (options.eci != null || options.gs1 === true)
        throw new EncodeError('Micro QR: ECI and GS1/FNC1 are unavailable');
    const mode = chooseMode(text, options.mode);
    const wantedVersion = parseVersion(options.version);
    const wantedEcc = options.ecc == null ? null : String(options.ecc).toUpperCase();
    if (wantedEcc === 'H')
        throw new EncodeError('Micro QR: error correction level H is unavailable');
    if (options.mask != null && (!Number.isInteger(options.mask) || options.mask < 0 || options.mask > 3)) {
        throw new EncodeError(`Micro QR: mask must be an integer 0-3, got ${options.mask}`);
    }
    let selected;
    for (const version of MICROQR_VERSIONS) {
        if (wantedVersion != null && version !== wantedVersion)
            continue;
        const numericVersion = versionNumber(version);
        if (numericVersion < MODE_MIN_VERSION[mode])
            continue;
        const levels = numericVersion === 1 ? ['DETECT'] : numericVersion < 4 ? ['L', 'M'] : ['L', 'M', 'Q'];
        for (const ecc of levels) {
            if (wantedEcc != null && ecc !== wantedEcc)
                continue;
            const layout = microQrBlockLayout(version, ecc);
            const data = writeData(text, mode, version, layout);
            if (data) {
                selected = { version, ecc, layout, data };
                break;
            }
        }
        if (selected)
            break;
    }
    if (!selected)
        throw new EncodeError('Micro QR: payload does not fit the requested version/error level');
    const bits = finalMessage(selected.data, selected.layout);
    if (options.mask != null)
        return buildMatrix(selected.version, selected.ecc, options.mask, bits);
    let best, score = -1;
    for (let mask = 0; mask < 4; mask++) {
        const candidate = buildMatrix(selected.version, selected.ecc, mask, bits);
        const candidateScore = microMaskScore(candidate);
        if (candidateScore > score) {
            score = candidateScore;
            best = candidate;
        }
    }
    return best;
}
