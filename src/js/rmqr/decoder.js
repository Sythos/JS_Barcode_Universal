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
import { BitReader } from '../core/bit-buffer.js';
import { ChecksumError, FormatError } from '../core/errors.js';
import { GF256_QR } from '../core/galois-field.js';
import { rsDecode } from '../core/reed-solomon.js';
import { FORMAT_MASK_FINDER, FORMAT_MASK_SUB, dataModuleOrder, maskBit, versionForSize, formatBits, } from './tables.js';
import { ALPHANUMERIC_CHARS, MODE } from './encoder.js';
function hamming(a, b) { let v = a ^ b, n = 0; while (v) {
    v &= v - 1;
    n++;
} return n; }
function readFormat(matrix, v) {
    let a = 0;
    for (let n = 0; n < 18; n++)
        if (matrix.get(8 + Math.floor(n / 5), 1 + (n % 5)))
            a |= 1 << n;
    let b = 0;
    for (let n = 0; n < 15; n++)
        if (matrix.get(v.width - 8 + Math.floor(n / 5), v.height - 6 + (n % 5)))
            b |= 1 << n;
    for (let n = 15; n < 18; n++)
        if (matrix.get(v.width - 5 + (n - 15), v.height - 6))
            b |= 1 << n;
    const candidates = [];
    for (let version = 1; version <= 32; version++)
        for (const ecc of ['M', 'H']) {
            candidates.push({ version, ecc, finder: formatBits(version, ecc) ^ FORMAT_MASK_FINDER, sub: formatBits(version, ecc) ^ FORMAT_MASK_SUB });
        }
    let best = null;
    for (const c of candidates)
        for (const [value, expected] of [[a, c.finder], [b, c.sub]]) {
            const distance = hamming(value, expected);
            if (!best || distance < best.distance)
                best = { ...c, distance };
        }
    if (!best || best.distance > 3)
        throw new FormatError('rMQR: format information is unreadable');
    return best;
}
function readCodewords(matrix, v, mask, total) {
    const order = dataModuleOrder(v.version);
    const out = new Uint8Array(total);
    let bit = 0;
    for (const [x, y] of order) {
        if (bit >= total * 8)
            break;
        let on = matrix.get(x, y);
        if (maskBit(x, y))
            on = !on;
        if (on)
            out[bit >>> 3] |= 0x80 >>> (bit & 7);
        bit++;
    }
    return out;
}
function deinterleave(codewords, v, ecc) {
    const blocks = v.blockLayout(ecc).blocks;
    const arrays = blocks.map((b) => new Array(b.total).fill(0));
    let offset = 0;
    const maxData = Math.max(...blocks.map((b) => b.data));
    for (let i = 0; i < maxData; i++)
        for (let b = 0; b < blocks.length; b++)
            if (i < blocks[b].data)
                arrays[b][i] = codewords[offset++];
    const maxEcc = Math.max(...blocks.map((b) => b.ecc));
    for (let i = 0; i < maxEcc; i++)
        for (let b = 0; b < blocks.length; b++)
            if (i < blocks[b].ecc)
                arrays[b][blocks[b].data + i] = codewords[offset++];
    const data = [];
    let corrections = 0;
    for (let b = 0; b < arrays.length; b++) {
        corrections += rsDecode(arrays[b], blocks[b].ecc, GF256_QR, 0);
        data.push(...arrays[b].slice(0, blocks[b].data));
    }
    return { data: Uint8Array.from(data), corrections };
}
function decodeBytes(bytes, eci) {
    try {
        return new TextDecoder(eci === 26 ? 'utf-8' : 'iso-8859-1', { fatal: false }).decode(bytes);
    }
    catch {
        return String.fromCharCode(...bytes);
    }
}
function parseSegments(data, v) {
    const reader = new BitReader(data);
    let text = '';
    const raw = [];
    let eci = 3;
    let mode;
    while (reader.available() >= 3) {
        const peek = (() => { const save = { byteOffset: reader.byteOffset, bitOffset: reader.bitOffset }; const n = reader.read(3); reader.byteOffset = save.byteOffset; reader.bitOffset = save.bitOffset; return n; })();
        if (peek === 0)
            break;
        mode = reader.read(3);
        if (mode === MODE.ECI) {
            const first = reader.read(8);
            let value;
            if (!(first & 0x80))
                value = first;
            else if ((first & 0xc0) === 0x80)
                value = ((first & 0x3f) << 8) | reader.read(8);
            else if ((first & 0xe0) === 0xc0)
                value = ((first & 0x1f) << 16) | reader.read(16);
            else
                throw new FormatError('rMQR: invalid ECI');
            eci = value;
            continue;
        }
        const kind = mode === MODE.NUMERIC ? 'numeric' : mode === MODE.ALPHANUMERIC ? 'alphanumeric' : mode === MODE.BYTE ? 'byte' : mode === MODE.KANJI ? 'kanji' : null;
        if (!kind)
            throw new FormatError(`rMQR: unsupported mode ${mode}`);
        const count = reader.read(v.countBits(kind));
        if (kind === 'numeric') {
            let remaining = count;
            while (remaining >= 3) {
                const n = reader.read(10).toString().padStart(3, '0');
                text += n;
                remaining -= 3;
            }
            if (remaining === 2)
                text += reader.read(7).toString().padStart(2, '0');
            else if (remaining === 1)
                text += reader.read(4).toString();
        }
        else if (kind === 'alphanumeric') {
            let remaining = count;
            while (remaining >= 2) {
                const n = reader.read(11);
                text += ALPHANUMERIC_CHARS[Math.floor(n / 45)] + ALPHANUMERIC_CHARS[n % 45];
                remaining -= 2;
            }
            if (remaining)
                text += ALPHANUMERIC_CHARS[reader.read(6)];
        }
        else if (kind === 'byte') {
            const b = new Uint8Array(count);
            for (let i = 0; i < count; i++) {
                b[i] = reader.read(8);
                raw.push(b[i]);
            }
            text += decodeBytes(b, eci);
        }
        else {
            const bytes = new Uint8Array(count * 2);
            for (let i = 0; i < count; i++) {
                const n = reader.read(13);
                const v2 = n;
                const high = Math.floor(v2 / 0xc0);
                const low = v2 % 0xc0;
                const sjis = high < 0x1f ? 0x8140 + (high << 8) + low : 0xc140 + (high << 8) + low;
                bytes[i * 2] = sjis >> 8;
                bytes[i * 2 + 1] = sjis & 255;
            }
            try {
                text += new TextDecoder('shift_jis').decode(bytes);
            }
            catch {
                text += String.fromCharCode(...bytes);
            }
        }
    }
    return { text, bytes: Uint8Array.from(raw) };
}
/** Decode an exact rMQR module matrix (without quiet zone). */
export function decodeRMQR(matrix) {
    if (!matrix || !matrix.width || !matrix.height)
        throw new FormatError('rMQR: no matrix supplied');
    const v = versionForSize(matrix.width, matrix.height);
    if (!v)
        throw new FormatError(`rMQR: unsupported symbol size ${matrix.width}x${matrix.height}`);
    const info = readFormat(matrix, v);
    if (info.version !== v.version)
        throw new FormatError('rMQR: format/version mismatch');
    const codewords = readCodewords(matrix, v, 4, v.totalCodewords);
    const corrected = deinterleave(codewords, v, info.ecc);
    const parsed = parseSegments(corrected.data, v);
    return { ...parsed, version: v.version, name: v.name, ecc: info.ecc, mask: 4, corrections: corrected.corrections };
}
export { ChecksumError };
