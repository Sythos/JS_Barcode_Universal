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
 * Aztec encoder: high-level bits, bit stuffing, Reed-Solomon and matrix layout.
 *
 * `tables.js` is intentionally the source of geometry and field selection.
 * Its `aztecLayer(layers, compact)` entries must expose `totalBits`,
 * `totalCodewords`, `baseMatrixSize` and `symbolSize`; `fieldForLayers()` must
 * return the matching binary field.  All Aztec Reed-Solomon generators start
 * at alpha^1, hence the explicit base `1` in both data and mode messages.
 *
 * @module aztec/encoder
 */
import { BitWriter } from '../core/bit-buffer.js';
import { BitMatrix } from '../core/bit-matrix.js';
import { EncodeError } from '../core/errors.js';
import { rsEncode } from '../core/reed-solomon.js';
import { encodeHighLevel } from './high-level.js';
import { AZTEC_COMPACT_LAYERS, AZTEC_FULL_LAYERS, aztecLayer, eccCodewordsFor, fieldForLayers, fieldForWordSize, wordSizeForLayers } from './tables.js';
/** @param {BitWriter} bits @param {number} at @returns {boolean} */
function bitAt(bits, at) {
    return at >= 0 && at < bits.length && ((bits.bytes[at >>> 3] >>> (7 - (at & 7))) & 1) !== 0;
}
/** @param {BitWriter} bits @param {number} from @param {number} count @returns {number} */
function readBits(bits, from, count) {
    let value = 0;
    for (let i = 0; i < count; i++)
        value = (value << 1) | (bitAt(bits, from + i) ? 1 : 0);
    return value;
}
/**
 * Prevent all-zero and all-one codewords except their final bit.  The final
 * bit is intentionally re-consumed after a stuffed word; it is the mechanism
 * that makes the transform injective and reversible.
 *
 * @param {BitWriter} bits @param {number} wordSize @returns {BitWriter}
 */
export function stuffBits(bits, wordSize) {
    const out = new BitWriter();
    const reserved = (1 << wordSize) - 2;
    for (let at = 0; at < bits.length; at += wordSize) {
        const word = readBits(bits, at, wordSize);
        if ((word & reserved) === reserved) {
            out.put(word & reserved, wordSize);
            at--;
        }
        else if ((word & reserved) === 0) {
            out.put(word | 1, wordSize);
            at--;
        }
        else {
            out.put(word, wordSize);
        }
    }
    return out;
}
/**
 * Add systematic Aztec Reed-Solomon parity and the leading alignment bits.
 * @param {BitWriter} data @param {number} totalBits @param {number} wordSize
 * @param {import('../core/galois-field.js').GaloisField} field
 * @returns {{bits: BitWriter, dataWords: number, eccWords: number}}
 */
export function addCheckWords(data, totalBits, wordSize, field) {
    const totalWords = Math.floor(totalBits / wordSize);
    const dataWords = Math.ceil(data.length / wordSize);
    if (dataWords > totalWords)
        throw new EncodeError('Aztec: data codewords exceed layer capacity');
    const eccWords = totalWords - dataWords;
    const words = new Array(dataWords);
    for (let i = 0; i < dataWords; i++)
        words[i] = readBits(data, i * wordSize, wordSize);
    const ecc = rsEncode(words, eccWords, field, 1);
    const out = new BitWriter();
    out.put(0, totalBits % wordSize);
    for (const word of words)
        out.put(word, wordSize);
    for (const word of ecc)
        out.put(word, wordSize);
    return { bits: out, dataWords, eccWords };
}
/** @param {number} layers @param {number} dataWords @param {boolean} compact @returns {BitWriter} */
export function modeMessage(layers, dataWords, compact) {
    const raw = new BitWriter();
    if (compact) {
        raw.put(layers - 1, 2);
        raw.put(dataWords - 1, 6);
        return addCheckWords(raw, 28, 4, fieldForWordSize(4)).bits;
    }
    raw.put(layers - 1, 5);
    raw.put(dataWords - 1, 11);
    return addCheckWords(raw, 40, 4, fieldForWordSize(4)).bits;
}
/** @param {BitMatrix} matrix @param {number} center @param {number} size */
function drawBullsEye(matrix, center, size) {
    for (let ring = 0; ring < size; ring += 2) {
        for (let p = center - ring; p <= center + ring; p++) {
            matrix.set(p, center - ring);
            matrix.set(p, center + ring);
            matrix.set(center - ring, p);
            matrix.set(center + ring, p);
        }
    }
    matrix.set(center - size, center - size);
    matrix.set(center - size + 1, center - size);
    matrix.set(center - size, center - size + 1);
    matrix.set(center + size, center - size);
    matrix.set(center + size, center - size + 1);
    matrix.set(center + size, center + size - 1);
}
/** @param {BitMatrix} matrix @param {BitWriter} message @param {boolean} compact @param {number} center */
function drawModeMessage(matrix, message, compact, center) {
    if (compact) {
        for (let i = 0; i < 7; i++) {
            const offset = center - 3 + i;
            if (bitAt(message, i))
                matrix.set(offset, center - 5);
            if (bitAt(message, i + 7))
                matrix.set(center + 5, offset);
            if (bitAt(message, 20 - i))
                matrix.set(offset, center + 5);
            if (bitAt(message, 27 - i))
                matrix.set(center - 5, offset);
        }
    }
    else {
        for (let i = 0; i < 10; i++) {
            const offset = center - 5 + i + Math.floor(i / 5);
            if (bitAt(message, i))
                matrix.set(offset, center - 7);
            if (bitAt(message, i + 10))
                matrix.set(center + 7, offset);
            if (bitAt(message, 29 - i))
                matrix.set(offset, center + 7);
            if (bitAt(message, 39 - i))
                matrix.set(center - 7, offset);
        }
    }
}
/**
 * Lay low-level bits in the four-sided, inward Aztec spiral.
 * @param {BitWriter} bits @param {{layers:number,compact:boolean,baseMatrixSize:number,symbolSize:number}} symbol
 * @returns {BitMatrix}
 */
export function buildAztecMatrix(bits, symbol) {
    const { layers, compact, baseMatrixSize, symbolSize } = symbol;
    const matrix = new BitMatrix(symbolSize);
    const alignment = new Int32Array(baseMatrixSize);
    const center = Math.floor(symbolSize / 2);
    if (compact) {
        for (let i = 0; i < baseMatrixSize; i++)
            alignment[i] = i;
    }
    else {
        const originalCenter = Math.floor(baseMatrixSize / 2);
        for (let i = 0; i < originalCenter; i++) {
            const offset = i + Math.floor(i / 15);
            alignment[originalCenter - i - 1] = center - offset - 1;
            alignment[originalCenter + i] = center + offset + 1;
        }
    }
    let bit = 0;
    for (let layer = 0; layer < layers; layer++) {
        const rowSize = (layers - layer) * 4 + (compact ? 9 : 12);
        const low = layer * 2;
        const high = baseMatrixSize - 1 - low;
        for (let j = 0; j < rowSize; j++) {
            const offset = j * 2;
            for (let k = 0; k < 2; k++) {
                if (bitAt(bits, bit + offset + k))
                    matrix.set(alignment[low + k], alignment[low + j]);
                if (bitAt(bits, bit + rowSize * 2 + offset + k))
                    matrix.set(alignment[low + j], alignment[high - k]);
                if (bitAt(bits, bit + rowSize * 4 + offset + k))
                    matrix.set(alignment[high - k], alignment[high - j]);
                if (bitAt(bits, bit + rowSize * 6 + offset + k))
                    matrix.set(alignment[high - j], alignment[low + k]);
            }
        }
        bit += rowSize * 8;
    }
    if (bit !== bits.length)
        throw new EncodeError(`Aztec: layout consumed ${bit} of ${bits.length} bits`);
    const mode = modeMessage(layers, symbol.dataWords, compact);
    drawModeMessage(matrix, mode, compact, center);
    drawBullsEye(matrix, center, compact ? 5 : 7);
    if (!compact) {
        for (let i = 0, offset = 0; i < Math.floor(baseMatrixSize / 2) - 1; i += 15, offset += 16) {
            for (let p = center & 1; p < symbolSize; p += 2) {
                matrix.set(center - offset, p);
                matrix.set(center + offset, p);
                matrix.set(p, center - offset);
                matrix.set(p, center + offset);
            }
        }
    }
    return matrix;
}
/** @param {number | undefined} layers @param {boolean | undefined} compact */
function candidates(layers, compact) {
    if (layers !== undefined) {
        if (!Number.isInteger(layers) || layers < 1 || layers > 32)
            throw new EncodeError('Aztec: layers must be an integer 1..32');
        if (compact === true && layers > 4)
            throw new EncodeError('Aztec: compact symbols support layers 1..4');
        return [aztecLayer(layers, compact === true)];
    }
    if (compact === true)
        return AZTEC_COMPACT_LAYERS;
    if (compact === false)
        return AZTEC_FULL_LAYERS;
    return [...AZTEC_COMPACT_LAYERS, ...AZTEC_FULL_LAYERS];
}
/**
 * Encode a UTF-8 string or bytes into an Aztec Code matrix.
 *
 * @param {string|ArrayBuffer|ArrayBufferView} value
 * @param {{layers?:number,compact?:boolean,eccPercent?:number,charset?:'utf-8'}} [options]
 * @returns {BitMatrix & {format?:string,layers?:number,compact?:boolean,eccPercent?:number,dataCodewords?:number}}
 */
export function encodeAztec(value, options = {}) {
    const eccPercent = options.eccPercent ?? 23;
    if (!Number.isFinite(eccPercent) || eccPercent < 5 || eccPercent > 95) {
        throw new EncodeError('Aztec: eccPercent must be between 5 and 95');
    }
    const high = encodeHighLevel(value, { charset: options.charset ?? 'utf-8' });
    for (const candidate of candidates(options.layers, options.compact)) {
        if (!candidate)
            continue;
        const wordSize = wordSizeForLayers(candidate.layers);
        const stuffed = stuffBits(high, wordSize);
        const dataWords = Math.ceil(stuffed.length / wordSize);
        const eccWords = eccCodewordsFor(dataWords, eccPercent);
        if (dataWords > candidate.maxDataCodewords || dataWords + eccWords > candidate.totalCodewords)
            continue;
        const checked = addCheckWords(stuffed, candidate.totalBits, wordSize, fieldForLayers(candidate.layers));
        // `addCheckWords` uses every remaining word as parity.  This is stronger
        // than the requested percentage, never weaker, and canonical for a chosen
        // layer/data-word combination.
        const symbol = { ...candidate, dataWords: checked.dataWords };
        const matrix = buildAztecMatrix(checked.bits, symbol);
        matrix.format = 'aztec';
        matrix.layers = candidate.layers;
        matrix.compact = candidate.compact;
        matrix.eccPercent = Math.round(checked.eccWords * wordSize * 100 / Math.max(1, stuffed.length));
        matrix.dataCodewords = checked.dataWords;
        return matrix;
    }
    throw new EncodeError('Aztec: payload does not fit the requested layers and error correction');
}
