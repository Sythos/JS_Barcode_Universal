/*!
 * Sythos Barcode Suite
 *
 * MIT License
 *
 * Copyright (c) 2026 Sythos
 * SPDX-FileCopyrightText: 2026 Sythos (https://www.sythos.net)
 * SPDX-License-Identifier: MIT
 *
 * Original work. No code from any other barcode implementation.
 */
import { BitWriter } from '../core/bit-buffer.js';
import { EncodeError } from '../core/errors.js';
import { rsEncode } from '../core/reed-solomon.js';
import { GF256_HANXIN, HANXIN_VERSIONS, createHanXinFunctionGrid, hanXinDataCoordinates, hanXinDataCodewords, hanXinEcLayout, hanXinMaskFlip, hanXinSize, normalizeHanXinEcc, normalizeHanXinVersion, placeHanXinFunctionInfo, } from './tables.js';
function inputBytes(value) {
    if (value instanceof Uint8Array) {
        if (value.length === 0)
            throw new EncodeError('Han Xin: payload must not be empty');
        return { bytes: new Uint8Array(value), text: null };
    }
    if (Array.isArray(value)) {
        if (value.length === 0 || value.length > 8191 || value.some((item) => !Number.isInteger(item) || item < 0 || item > 255)) {
            throw new EncodeError('Han Xin: byte arrays must contain at most 8191 values from 0 to 255');
        }
        return { bytes: Uint8Array.from(value), text: null };
    }
    if (typeof value !== 'string')
        throw new EncodeError('Han Xin: value must be text or bytes');
    if (!value.length)
        throw new EncodeError('Han Xin: payload must not be empty');
    return { bytes: new TextEncoder().encode(value), text: value };
}
function text1Value(codePoint) {
    if (codePoint >= 0x30 && codePoint <= 0x39)
        return codePoint - 0x30;
    if (codePoint >= 0x41 && codePoint <= 0x5a)
        return codePoint - 0x41 + 10;
    if (codePoint >= 0x61 && codePoint <= 0x7a)
        return codePoint - 0x61 + 36;
    return null;
}
function text2Value(codePoint) {
    if (codePoint >= 0 && codePoint <= 0x1b)
        return codePoint;
    if (codePoint >= 0x20 && codePoint <= 0x2f)
        return codePoint - 0x20 + 28;
    if (codePoint >= 0x3a && codePoint <= 0x40)
        return codePoint - 0x3a + 44;
    if (codePoint >= 0x5b && codePoint <= 0x60)
        return codePoint - 0x5b + 51;
    if (codePoint >= 0x7b && codePoint <= 0x7f)
        return codePoint - 0x7b + 57;
    return null;
}
function textValue(codePoint, mode) {
    return mode === 1 ? text1Value(codePoint) : text2Value(codePoint);
}
function selectMode(text, requested) {
    const mode = requested == null ? 'auto' : String(requested).toLowerCase();
    if (!['auto', 'numeric', 'text', 'byte'].includes(mode)) {
        throw new EncodeError(`Han Xin: unsupported payload mode ${String(requested)}`);
    }
    if (text == null) {
        if (mode === 'numeric' || mode === 'text')
            throw new EncodeError('Han Xin: numeric and text modes require a string input');
        return 'byte';
    }
    const points = Array.from(text);
    const numeric = /^\d+$/.test(text);
    const textCompatible = points.every((point) => {
        const cp = point.codePointAt(0);
        return cp <= 0x7f && (text1Value(cp) !== null || text2Value(cp) !== null);
    });
    if (mode === 'numeric' && !numeric)
        throw new EncodeError('Han Xin: numeric mode accepts digits only');
    if (mode === 'text' && !textCompatible)
        throw new EncodeError('Han Xin: text mode accepts supported ASCII characters only');
    if (mode === 'auto')
        return numeric ? 'numeric' : textCompatible ? 'text' : 'byte';
    return mode;
}
function encodeNumeric(text, writer) {
    let finalCount = 0;
    for (let offset = 0; offset < text.length; offset += 3) {
        finalCount = Math.min(3, text.length - offset);
        writer.put(Number(text.slice(offset, offset + finalCount)), 10);
    }
    writer.put(1020 + finalCount, 10);
}
function encodeText(text, writer) {
    let submode = 1;
    for (const point of Array.from(text)) {
        const cp = point.codePointAt(0);
        let value = textValue(cp, submode);
        if (value === null) {
            submode = submode === 1 ? 2 : 1;
            writer.put(62, 6);
            value = textValue(cp, submode);
        }
        if (value === null)
            throw new EncodeError(`Han Xin: character U+${cp.toString(16).padStart(4, '0')} is not encodable in text mode`);
        writer.put(value, 6);
    }
    writer.put(63, 6);
}
function encodeByte(bytes, writer) {
    if (bytes.length > 8191)
        throw new EncodeError('Han Xin: byte mode supports at most 8191 bytes');
    writer.put(3, 4);
    writer.put(bytes.length, 13);
    writer.putBytes(bytes);
}
function payloadBits(value, mode) {
    const source = inputBytes(value);
    const writer = new BitWriter();
    if (mode === 'numeric') {
        writer.put(1, 4);
        encodeNumeric(source.text, writer);
    }
    else if (mode === 'text') {
        writer.put(2, 4);
        encodeText(source.text, writer);
    }
    else {
        encodeByte(source.bytes, writer);
    }
    return writer;
}
function picketFence(codewords) {
    const output = [];
    for (let column = 0; column < 13; column++) {
        for (let i = column; i < codewords.length; i += 13)
            output.push(codewords[i]);
    }
    return output;
}
function placePayload(matrix, version, codewords, mask) {
    const coordinates = hanXinDataCoordinates(version);
    const bits = picketFence(codewords);
    const totalBits = bits.length * 8;
    for (let i = 0; i < coordinates.length; i++) {
        const [x, y] = coordinates[i];
        // Compact versions have five remainder modules after the final complete
        // codeword.  They carry zero before masking and are checked by the reader.
        let dark = i < totalBits && ((bits[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
        if (hanXinMaskFlip(mask, x, y))
            dark = !dark;
        matrix.setValue(x, y, dark);
    }
}
function maskPenalty(matrix, version, level, mask) {
    const candidate = matrix.clone();
    for (const [x, y] of hanXinDataCoordinates(version)) {
        if (hanXinMaskFlip(mask, x, y))
            candidate.flip(x, y);
    }
    placeHanXinFunctionInfo(candidate, version, level, mask);
    let penalty = 0;
    const runPenalty = (values) => {
        let current = values[0];
        let run = 1;
        for (let i = 1; i <= values.length; i++) {
            if (i < values.length && values[i] === current)
                run++;
            else {
                if (run >= 3)
                    penalty += run * 4;
                current = values[i];
                run = 1;
            }
        }
    };
    for (let y = 0; y < candidate.height; y++) {
        const row = [];
        for (let x = 0; x < candidate.width; x++)
            row.push(candidate.get(x, y));
        runPenalty(row);
    }
    for (let x = 0; x < candidate.width; x++) {
        const column = [];
        for (let y = 0; y < candidate.height; y++)
            column.push(candidate.get(x, y));
        runPenalty(column);
    }
    return penalty;
}
function chooseMask(base, version, level, requested) {
    if (requested !== undefined) {
        if (!Number.isInteger(requested) || requested < 0 || requested > 3)
            throw new EncodeError('Han Xin: mask must be an integer from 0 to 3');
        return requested;
    }
    let best = 0;
    let score = Number.POSITIVE_INFINITY;
    for (let mask = 0; mask < 4; mask++) {
        const candidate = base.clone();
        // The score is intentionally simple and stable.  Every candidate is still
        // validated by the strict reader, so no mask choice can affect integrity.
        const value = maskPenalty(candidate, version, level, mask);
        if (value < score) {
            score = value;
            best = mask;
        }
    }
    return best;
}
function encodeVersion(writer, version, level, requestedMask) {
    const dataCodewords = hanXinDataCodewords(version, level);
    const layout = hanXinEcLayout(version, level);
    const capacity = dataCodewords * 8;
    if (writer.length > capacity)
        throw new EncodeError(`Han Xin: payload needs ${writer.length} bits but ${capacity} are available`);
    const data = new Uint8Array(dataCodewords);
    const encoded = writer.toBytes();
    data.set(encoded.subarray(0, data.length));
    const parity = rsEncode(Array.from(data), layout.eccCodewords, GF256_HANXIN, 1);
    const full = Array.from(data).concat(parity);
    const { matrix } = createHanXinFunctionGrid(version);
    placePayload(matrix, version, full, 0);
    const mask = chooseMask(matrix, version, level, requestedMask);
    placePayload(matrix, version, full, mask);
    placeHanXinFunctionInfo(matrix, version, level, mask);
    return matrix;
}
/** Encode a string or byte array as a Han Xin Code module matrix. */
export function encodeHanXin(value, options = {}) {
    const source = inputBytes(value);
    const mode = selectMode(source.text, options.mode);
    const writer = payloadBits(value, mode);
    const level = normalizeHanXinEcc(options.ecc);
    const wantedVersion = options.version == null ? null : normalizeHanXinVersion(options.version);
    const requestedMask = options.mask == null ? undefined : Number(options.mask);
    if (requestedMask !== undefined &&
        (!Number.isInteger(requestedMask) || requestedMask < 0 || requestedMask > 3)) {
        throw new EncodeError('Han Xin: mask must be an integer from 0 to 3');
    }
    for (const version of HANXIN_VERSIONS) {
        if (wantedVersion !== null && version !== wantedVersion)
            continue;
        try {
            return encodeVersion(writer, version, level, requestedMask);
        }
        catch (error) {
            if (!(error instanceof EncodeError))
                throw error;
        }
    }
    const target = wantedVersion == null ? 'versions 1-3' : `version ${wantedVersion}`;
    throw new EncodeError(`Han Xin: payload does not fit ${target} at error correction ${level}`);
}
/** Encode explicitly in byte mode; useful when the input contains arbitrary data. */
export function encodeHanXinBytes(bytes, options = {}) {
    return encodeHanXin(bytes, { ...options, mode: 'byte' });
}
/** Expose the implemented geometric side length for callers building rasters. */
export function hanXinDimension(version) {
    return hanXinSize(Number(version));
}
