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
/** Original dependency-free DotCode encoder. @module dotcode/encoder */
import { BitMatrix } from '../core/bit-matrix.js';
import { EncodeError } from '../core/errors.js';
import { rsEncode } from '../core/reed-solomon.js';
import { DOTCODE_CODEWORD_COUNT, DOTCODE_FIELD_SIZE, DOTCODE_MAX_DIMENSION, DOTCODE_MASK_STEPS, DOTCODE_MIN_DIMENSION, GF113_DOTCODE, dotCodeActivePositions, dotCodeCodewordCapacity, dotCodeCornerOrder, dotCodeDataCapacity, dotCodeIsCorner, dotCodeIsDataPosition, dotCodePattern, } from './tables.js';
function bytesFor(value, encoding) {
    if (value instanceof Uint8Array)
        return new Uint8Array(value);
    if (Array.isArray(value)) {
        if (value.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
            throw new EncodeError('DotCode: byte input must contain integers from 0 to 255');
        }
        return Uint8Array.from(value);
    }
    if (typeof value !== 'string' || value.length === 0) {
        throw new EncodeError('DotCode: value must be a non-empty string or byte array');
    }
    if (encoding === 'utf8')
        return new TextEncoder().encode(value);
    const bytes = new Uint8Array(value.length);
    for (let index = 0; index < value.length; index++) {
        const code = value.charCodeAt(index);
        if (code > 255)
            throw new EncodeError(`DotCode: character U+${code.toString(16).padStart(4, '0')} does not fit ${encoding}`);
        bytes[index] = code;
    }
    return bytes;
}
function digit(byte) { return byte >= 48 && byte <= 57; }
function hasDigitPair(bytes, index) {
    return index + 1 < bytes.length && digit(bytes[index]) && digit(bytes[index + 1]);
}
function appendUpperShift(out, byte) {
    if (byte < 128 || byte > 255)
        throw new EncodeError('DotCode: upper-shift byte must be in 128..255');
    if (byte < 160)
        out.push(110, byte - 64);
    else
        out.push(111, byte - 160);
}
function appendCodeSetA(out, byte) {
    if (byte > 95)
        throw new EncodeError('DotCode: byte is not directly encodable in Code Set A');
    out.push(byte < 32 ? byte + 64 : byte - 32);
}
function appendCodeSetB(out, byte) {
    if (byte >= 32 && byte <= 127)
        out.push(byte - 32);
    else if (byte === 9)
        out.push(97);
    else if (byte === 28)
        out.push(98);
    else if (byte === 29)
        out.push(99);
    else if (byte === 30)
        out.push(100);
    else if (byte === 13)
        out.push(96);
    else
        throw new EncodeError('DotCode: byte is not directly encodable in Code Set B');
}
/** Convert five base-259 bytes into six base-103 codewords (or a short tail). */
function appendBinaryGroup(out, bytes, start, count) {
    let value = 0;
    for (let index = 0; index < count; index++)
        value = value * 259 + bytes[start + index];
    const words = new Array(count + 1).fill(0);
    for (let index = words.length - 1; index >= 0; index--) {
        words[index] = value % 103;
        value = Math.floor(value / 103);
    }
    if (value !== 0)
        throw new EncodeError('DotCode: binary radix conversion overflow');
    out.push(...words);
}
/**
 * Encode the supported Code Set A/B/C subset and the complete binary-latch
 * byte path. The result is deliberately deterministic and never depends on a
 * third-party encoder.
 */
function encodeDataCodewords(bytes, gs1, forceBinary) {
    if (!bytes.length)
        throw new EncodeError('DotCode: payload must not be empty');
    const words = [];
    let mode = 'C';
    let position = 0;
    let usedBinary = forceBinary;
    // A leading numeric pair would be interpreted as GS1 by readers. FNC1 is
    // the standard disambiguator for an ordinary numeric message.
    if (!gs1 && hasDigitPair(bytes, 0))
        words.push(107);
    if (forceBinary) {
        words.push(112);
        usedBinary = true;
        for (; position < bytes.length; position += 5)
            appendBinaryGroup(words, bytes, position, Math.min(5, bytes.length - position));
        return { words, encoding: 'binary' };
    }
    while (position < bytes.length) {
        const byte = bytes[position];
        if (mode === 'X') {
            for (; position < bytes.length; position += 5)
                appendBinaryGroup(words, bytes, position, Math.min(5, bytes.length - position));
            break;
        }
        if (gs1 && byte === 29) {
            words.push(107);
            position++;
            continue;
        }
        if (mode === 'C') {
            if (hasDigitPair(bytes, position)) {
                words.push((bytes[position] - 48) * 10 + bytes[position + 1] - 48);
                position += 2;
            }
            else if (byte >= 128) {
                if (bytes.length - position >= 5) {
                    words.push(112);
                    mode = 'X';
                    usedBinary = true;
                }
                else {
                    appendUpperShift(words, byte);
                    position++;
                }
            }
            else if (byte < 32) {
                words.push(101);
                mode = 'A';
            }
            else {
                words.push(106);
                mode = 'B';
            }
            continue;
        }
        if (mode === 'A') {
            if (hasDigitPair(bytes, position)) {
                words.push(106);
                mode = 'C';
                continue;
            }
            if (byte >= 128) {
                if (bytes.length - position >= 5) {
                    words.push(112);
                    mode = 'X';
                    usedBinary = true;
                }
                else {
                    appendUpperShift(words, byte);
                    position++;
                }
            }
            else if (byte <= 95) {
                appendCodeSetA(words, byte);
                position++;
            }
            else {
                words.push(102);
                mode = 'B';
            }
            continue;
        }
        // Code Set B.
        if (hasDigitPair(bytes, position)) {
            words.push(106);
            mode = 'C';
            continue;
        }
        if (byte >= 128) {
            if (bytes.length - position >= 5) {
                words.push(112);
                mode = 'X';
                usedBinary = true;
            }
            else {
                appendUpperShift(words, byte);
                position++;
            }
        }
        else if ((byte >= 32 && byte <= 127) || byte === 9 || byte === 28 || byte === 29 || byte === 30) {
            appendCodeSetB(words, byte);
            position++;
        }
        else {
            words.push(102);
            mode = 'A';
        }
    }
    // Binary mode only occurs as the final payload segment above, but RS/data
    // padding follows it. Terminate explicitly so the padding is not bytes.
    if (usedBinary && mode === 'X')
        words.push(109);
    return { words, encoding: usedBinary ? 'binary' : 'latin1' };
}
function codewordEccLength(dataLength) { return 3 + Math.floor(dataLength / 2); }
function maxDataLength(codewordCapacity) {
    return dotCodeDataCapacity(codewordCapacity);
}
function validateDimension(name, value) {
    if (value === undefined)
        return undefined;
    if (!Number.isInteger(value) || value < DOTCODE_MIN_DIMENSION || value > DOTCODE_MAX_DIMENSION) {
        throw new EncodeError(`DotCode: ${name} must be an integer in ${DOTCODE_MIN_DIMENSION}..${DOTCODE_MAX_DIMENSION}`);
    }
    return value;
}
function chooseDimensions(dataLength, options) {
    const requestedWidth = validateDimension('width', options.width ?? options.columns);
    const requestedHeight = validateDimension('height', options.height ?? options.rows);
    if (options.aspectRatio !== undefined && (!Number.isFinite(options.aspectRatio) || options.aspectRatio <= 0)) {
        throw new EncodeError('DotCode: aspectRatio must be a finite positive number');
    }
    if (requestedWidth !== undefined && requestedHeight !== undefined && ((requestedWidth + requestedHeight) & 1) === 0) {
        throw new EncodeError('DotCode: width plus height must be odd');
    }
    const fits = (width, height) => {
        if (((width + height) & 1) === 0)
            return null;
        const slots = dotCodeCodewordCapacity(width, height);
        const capacity = maxDataLength(slots);
        if (capacity < dataLength)
            return null;
        return { width, height, dataLength: capacity };
    };
    if (requestedWidth !== undefined || requestedHeight !== undefined) {
        if (requestedWidth !== undefined && requestedHeight !== undefined) {
            const result = fits(requestedWidth, requestedHeight);
            if (!result)
                throw new EncodeError('DotCode: payload does not fit the requested dimensions');
            return result;
        }
        const fixed = requestedWidth ?? requestedHeight;
        let best = null;
        for (let varying = DOTCODE_MIN_DIMENSION; varying <= DOTCODE_MAX_DIMENSION; varying++) {
            const width = requestedWidth === undefined ? varying : fixed;
            const height = requestedWidth === undefined ? fixed : varying;
            const candidate = fits(width, height);
            if (candidate) {
                best = candidate;
                break;
            }
        }
        if (!best)
            throw new EncodeError('DotCode: payload does not fit the requested fixed dimension');
        return best;
    }
    const aspect = options.aspectRatio ?? 1.5;
    let best = null;
    for (let height = DOTCODE_MIN_DIMENSION; height <= DOTCODE_MAX_DIMENSION; height++) {
        for (let width = DOTCODE_MIN_DIMENSION; width <= DOTCODE_MAX_DIMENSION; width++) {
            const candidate = fits(width, height);
            if (!candidate)
                continue;
            const area = width * height;
            const score = area * 100 + Math.abs(width / height - aspect) * 10 + (candidate.dataLength - dataLength);
            if (!best || score < best.score)
                best = { ...candidate, score };
        }
    }
    if (!best)
        throw new EncodeError('DotCode: payload exceeds the safe 200 by 200 implementation limit');
    return best;
}
function rsProtected(data, mask) {
    const step = DOTCODE_MASK_STEPS[mask];
    const protectedData = [mask, ...data.map((value, index) => (value + step * index) % DOTCODE_FIELD_SIZE)];
    const eccLength = codewordEccLength(data.length);
    const total = protectedData.length + eccLength;
    // DotCode interleaves Reed-Solomon blocks by residue class.  A block is
    // selected with `start + index * blockCount`, and its parity follows that
    // block's data in the same residue class.  Keeping the mask at wire index
    // zero is important: it participates in the first RS block just like the
    // public symbology procedure specifies.
    const blockCount = Math.ceil(total / (DOTCODE_FIELD_SIZE - 1));
    const wire = new Array(total).fill(0);
    for (let block = 0; block < blockCount; block++) {
        const blockData = Math.ceil((protectedData.length - block) / blockCount);
        const blockTotal = Math.ceil((total - block) / blockCount);
        const blockEcc = blockTotal - blockData;
        const values = [];
        for (let index = 0; index < blockData; index++)
            values.push(protectedData[block + index * blockCount]);
        const parity = rsEncode(values, blockEcc, GF113_DOTCODE, 1);
        for (let index = 0; index < blockData; index++)
            wire[block + index * blockCount] = values[index];
        for (let index = 0; index < blockEcc; index++)
            wire[block + blockData * blockCount + index * blockCount] = parity[index];
    }
    return wire;
}
function streamFor(width, height, codewords) {
    const mask = codewords[0];
    const bits = [(mask & 2) !== 0, (mask & 1) !== 0];
    for (let index = 1; index < codewords.length; index++) {
        const pattern = dotCodePattern(codewords[index]);
        for (let bit = 8; bit >= 0; bit--)
            bits.push(((pattern >>> bit) & 1) !== 0);
    }
    const active = dotCodeActivePositions(width, height);
    if (bits.length > active)
        throw new EncodeError('DotCode: codeword stream exceeds matrix capacity');
    while (bits.length < active)
        bits.push(true);
    return bits;
}
function fold(width, height, stream) {
    const matrix = new BitMatrix(width, height);
    let position = 0;
    if (height & 1) {
        for (let row = 0; row < height; row++)
            for (let column = 0; column < width; column++) {
                if (!dotCodeIsDataPosition(column, row))
                    continue;
                if (dotCodeIsCorner(column, row, width, height))
                    continue;
                const targetY = height - row - 1;
                matrix.setValue(column, targetY, stream[position++]);
            }
    }
    else {
        for (let column = 0; column < width; column++)
            for (let row = 0; row < height; row++) {
                if (!dotCodeIsDataPosition(column, row))
                    continue;
                if (dotCodeIsCorner(column, row, width, height))
                    continue;
                matrix.setValue(column, row, stream[position++]);
            }
    }
    for (const [column, row] of dotCodeCornerOrder(width, height))
        matrix.setValue(column, row, stream[position++]);
    if (position !== stream.length)
        throw new EncodeError('DotCode: fold did not consume the complete dot stream');
    return matrix;
}
function maskScore(matrix) {
    let score = 0;
    for (let row = 0; row < matrix.height; row++) {
        let count = 0;
        for (let column = row & 1; column < matrix.width; column += 2)
            if (matrix.get(column, row))
                count++;
        if (count)
            score += 2 + Math.min(count, 10);
    }
    for (let column = 0; column < matrix.width; column++) {
        let count = 0;
        for (let row = column & 1; row < matrix.height; row += 2)
            if (matrix.get(column, row))
                count++;
        if (count)
            score += 2 + Math.min(count, 10);
    }
    for (let row = 0; row < matrix.height; row++)
        for (let column = row & 1; column < matrix.width; column += 2) {
            if (!matrix.get(column, row) &&
                !matrix.get(column - 1, row - 1) && !matrix.get(column + 1, row - 1) &&
                !matrix.get(column - 1, row + 1) && !matrix.get(column + 1, row + 1))
                score -= 1;
        }
    return score;
}
function validateMask(value) {
    if (value === undefined)
        return undefined;
    if (!Number.isInteger(value) || value < 0 || value > 3) {
        throw new EncodeError('DotCode: mask must be an integer in 0..3');
    }
    return value;
}
function matrixForData(data, options, encoding, gs1) {
    if (!data.length)
        throw new EncodeError('DotCode: payload must not be empty');
    if (data.some((value) => !Number.isInteger(value) || value < 0 || value >= DOTCODE_CODEWORD_COUNT)) {
        throw new EncodeError(`DotCode: data codewords must be integers in 0..${DOTCODE_CODEWORD_COUNT - 1}`);
    }
    const dimensions = chooseDimensions(data.length, options);
    while (data.length < dimensions.dataLength)
        data.push(106);
    const eccLength = codewordEccLength(data.length);
    const selected = validateMask(options.mask);
    let bestMask = selected ?? 0;
    let bestMatrix = null;
    if (selected === undefined) {
        let bestScore = Number.NEGATIVE_INFINITY;
        for (let mask = 0; mask < 4; mask++) {
            const matrix = fold(dimensions.width, dimensions.height, streamFor(dimensions.width, dimensions.height, rsProtected(data, mask)));
            const score = maskScore(matrix);
            if (score >= bestScore) {
                bestScore = score;
                bestMask = mask;
                bestMatrix = matrix;
            }
        }
    }
    const matrix = (bestMatrix ?? fold(dimensions.width, dimensions.height, streamFor(dimensions.width, dimensions.height, rsProtected(data, bestMask))));
    matrix.dotcode = {
        format: 'dotcode', width: dimensions.width, height: dimensions.height,
        mask: bestMask, dataCodewords: data.length, errorCodewords: eccLength,
        modulePositions: dotCodeActivePositions(dimensions.width, dimensions.height),
        gs1, encoding,
    };
    return matrix;
}
/** Encode a string or byte payload into a DotCode module matrix. */
export function encodeDotCode(value, options = {}) {
    const requestedEncoding = options.encoding ?? (value instanceof Uint8Array || Array.isArray(value) ? 'binary' : 'utf8');
    const bytes = bytesFor(value, requestedEncoding);
    if (!bytes.length)
        throw new EncodeError('DotCode: payload must not be empty');
    const encoded = encodeDataCodewords(bytes, options.gs1 === true, requestedEncoding === 'binary');
    return matrixForData(encoded.words, options, encoded.encoding, options.gs1 === true);
}
/** Encode an explicit set of unmasked data codewords for conformance fixtures. */
export function encodeDotCodeCodewords(codewords, options = {}) {
    if (!Array.isArray(codewords) && !(codewords instanceof Uint8Array))
        throw new EncodeError('DotCode: codewords must be an array');
    const data = Array.from(codewords);
    if (!data.length || data.some((value) => !Number.isInteger(value) || value < 0 || value >= DOTCODE_CODEWORD_COUNT)) {
        throw new EncodeError(`DotCode: codewords must be integers in 0..${DOTCODE_CODEWORD_COUNT - 1}`);
    }
    return matrixForData(data, options, 'binary', options.gs1 === true);
}
