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
 * Data Matrix ECC 200 decoder for an already sampled symbol.
 *
 * The detector owns locating, perspective correction and orientation. This
 * module starts with the complete, upright symbol including its finder borders.
 * The table entry is deliberately read through a small normalizer so table data
 * remains declarative: it needs total rows/columns, one data-region's rows and
 * columns, data/ECC codeword counts, and either a block count or data block
 * lengths. The standard 144x144 uneven data blocks are supported.
 *
 * @module datamatrix/decoder
 */
import { ChecksumError, FormatError } from '../core/errors.js';
import { GF256_DM } from '../core/galois-field.js';
import { rsDecode } from '../core/reed-solomon.js';
import { SYMBOLS } from './tables.js';
const CW_PAD = 129;
const CW_BASE256 = 231;
/** @param {object} entry @param {...string} names @returns {number | undefined} */
function numberField(entry, ...names) {
    for (const name of names)
        if (Number.isInteger(entry[name]))
            return entry[name];
    return undefined;
}
/** Normalize the public table entry into the decoder's geometry contract. */
function layoutFor(width, height) {
    const entry = SYMBOLS.find((s) => numberField(s, 'columns', 'cols', 'matrixColumns', 'width') === width &&
        numberField(s, 'rows', 'matrixRows', 'height') === height);
    if (!entry)
        throw new FormatError(`Data Matrix: ${width}x${height} is not an ECC 200 symbol size`);
    const regionRows = numberField(entry, 'dataRegionRows', 'regionRows') ??
        (numberField(entry, 'regionHeight') ? numberField(entry, 'regionHeight') - 2 : undefined);
    const regionCols = numberField(entry, 'dataRegionColumns', 'dataRegionCols', 'regionColumns') ??
        (numberField(entry, 'regionWidth') ? numberField(entry, 'regionWidth') - 2 : undefined);
    const dataCount = numberField(entry, 'dataCodewords', 'dataCapacity');
    const eccCount = numberField(entry, 'errorCodewords', 'eccCodewords');
    const blockCount = numberField(entry, 'interleavedBlocks', 'interleavedBlockCount', 'blockCount', 'rsBlocks') || 1;
    if (!regionRows || !regionCols || dataCount === undefined || eccCount === undefined ||
        height % (regionRows + 2) || width % (regionCols + 2) || eccCount % blockCount) {
        throw new FormatError(`Data Matrix: invalid table layout for ${width}x${height}`);
    }
    const rows = height / (regionRows + 2);
    const cols = width / (regionCols + 2);
    const blockData = Array.isArray(entry.blockDataCodewords) ? entry.blockDataCodewords.slice() :
        Array.isArray(entry.dataCodewordsPerBlock) ? entry.dataCodewordsPerBlock.slice() : null;
    let dataLengths;
    if (blockData) {
        dataLengths = blockData;
    }
    else {
        // The sole uneven ECC 200 distribution is 144x144: its first eight of ten
        // blocks contain one extra data codeword. This derives it instead of hiding
        // a magic size check in the deinterleaver.
        const short = Math.floor(dataCount / blockCount);
        dataLengths = new Array(blockCount).fill(short);
        for (let i = 0; i < dataCount % blockCount; i++)
            dataLengths[i]++;
    }
    if (dataLengths.length !== blockCount || dataLengths.reduce((a, b) => a + b, 0) !== dataCount) {
        throw new FormatError(`Data Matrix: inconsistent block layout for ${width}x${height}`);
    }
    return { entry, regionRows, regionCols, regionRowCount: rows, regionColCount: cols,
        dataRows: rows * regionRows, dataCols: cols * regionCols, dataCount, eccCount,
        blockCount, eccPerBlock: eccCount / blockCount, dataLengths };
}
/** Remove the L/finders from every data region, retaining only placement modules. */
function extractDataModules(matrix, layout) {
    const data = new Uint8Array(layout.dataRows * layout.dataCols);
    for (let regionY = 0; regionY < layout.regionRowCount; regionY++) {
        for (let regionX = 0; regionX < layout.regionColCount; regionX++) {
            const sourceX = regionX * (layout.regionCols + 2) + 1;
            const sourceY = regionY * (layout.regionRows + 2) + 1;
            for (let y = 0; y < layout.regionRows; y++) {
                const targetY = regionY * layout.regionRows + y;
                for (let x = 0; x < layout.regionCols; x++) {
                    data[targetY * layout.dataCols + regionX * layout.regionCols + x] =
                        matrix.get(sourceX + x, sourceY + y) ? 1 : 0;
                }
            }
        }
    }
    return data;
}
/** Read placement codewords using the ECC 200 Utah sweep (the inverse writer path). */
function readPlacement(modules, rows, cols, count) {
    const seen = new Uint8Array(rows * cols);
    const out = new Uint8Array(count);
    const get = (row, col) => modules[row * cols + col] !== 0;
    const module = (row, col) => {
        if (row < 0) {
            row += rows;
            col += 4 - ((rows + 4) % 8);
        }
        if (col < 0) {
            col += cols;
            row += 4 - ((cols + 4) % 8);
        }
        if (row < 0 || row >= rows || col < 0 || col >= cols) {
            throw new FormatError('Data Matrix: placement coordinate escaped data region');
        }
        seen[row * cols + col] = 1;
        return get(row, col) ? 1 : 0;
    };
    const bits = (coords) => coords.reduce((value, p) => (value << 1) | module(p[0], p[1]), 0);
    const utah = (row, col) => bits([[row - 2, col - 2], [row - 2, col - 1], [row - 1, col - 2], [row - 1, col - 1],
        [row - 1, col], [row, col - 2], [row, col - 1], [row, col]]);
    const corner1 = () => bits([[rows - 1, 0], [rows - 1, 1], [rows - 1, 2], [0, cols - 2], [0, cols - 1], [1, cols - 1], [2, cols - 1], [3, cols - 1]]);
    const corner2 = () => bits([[rows - 3, 0], [rows - 2, 0], [rows - 1, 0], [0, cols - 4], [0, cols - 3], [0, cols - 2], [0, cols - 1], [1, cols - 1]]);
    const corner3 = () => bits([[rows - 3, 0], [rows - 2, 0], [rows - 1, 0], [0, cols - 2], [0, cols - 1], [1, cols - 1], [2, cols - 1], [3, cols - 1]]);
    const corner4 = () => bits([[rows - 1, 0], [rows - 1, cols - 1], [0, cols - 3], [0, cols - 2], [0, cols - 1], [1, cols - 3], [1, cols - 2], [1, cols - 1]]);
    let row = 4, col = 0, n = 0;
    const put = (value) => { if (n < count)
        out[n++] = value; };
    do {
        if (row === rows && col === 0)
            put(corner1());
        if (row === rows - 2 && col === 0 && cols % 4 !== 0)
            put(corner2());
        if (row === rows - 2 && col === 0 && cols % 8 === 4)
            put(corner3());
        if (row === rows + 4 && col === 2 && cols % 8 === 0)
            put(corner4());
        do {
            if (row < rows && col >= 0 && !seen[row * cols + col])
                put(utah(row, col));
            row -= 2;
            col += 2;
        } while (row >= 0 && col < cols);
        row += 1;
        col += 3;
        do {
            if (row >= 0 && col < cols && !seen[row * cols + col])
                put(utah(row, col));
            row += 2;
            col -= 2;
        } while (row < rows && col >= 0);
        row += 3;
        col += 1;
    } while (row < rows || col < cols);
    if (n !== count)
        throw new FormatError(`Data Matrix: placement yielded ${n}, expected ${count} codewords`);
    return out;
}
/** Restore RS blocks, correct them, then concatenate their data portions. */
function deinterleaveAndCorrect(codewords, layout) {
    if (codewords.length !== layout.dataCount + layout.eccCount)
        throw new FormatError('Data Matrix: codeword count mismatch');
    const blocks = layout.dataLengths.map((len) => new Uint8Array(len + layout.eccPerBlock));
    // Data codewords arrive in their original stream order. ECC 200 deals that
    // stream round-robin across the RS blocks, so the inverse is determined by
    // the wire index rather than by splitting it into consecutive block-sized
    // chunks. For 144x144, indices 1550..1557 naturally land in the eight long
    // blocks while the two short blocks remain at 155 data codewords.
    for (let i = 0; i < layout.dataCount; i++) {
        blocks[i % layout.blockCount][Math.floor(i / layout.blockCount)] = codewords[i];
    }
    // Parity normally begins with block zero. The uneven 144x144 layout rotates
    // the parity wire order to begin with its first short block; derive the same
    // mapping from the declarative lengths instead of keying it to dimensions.
    const longest = Math.max(...layout.dataLengths);
    const firstShort = layout.dataLengths.findIndex((length) => length < longest);
    const rotation = firstShort < 0 ? 0 : firstShort;
    let at = layout.dataCount;
    for (let i = 0; i < layout.eccPerBlock; i++) {
        for (let slot = 0; slot < layout.blockCount; slot++) {
            const block = (slot + rotation) % layout.blockCount;
            blocks[block][layout.dataLengths[block] + i] = codewords[at++];
        }
    }
    let corrections = 0;
    const data = new Uint8Array(layout.dataCount);
    for (let b = 0; b < blocks.length; b++) {
        corrections += rsDecode(blocks[b], layout.eccPerBlock, GF256_DM, 1);
    }
    // Rebuild the original high-level codeword stream after correction. Keeping
    // this in wire-index order is essential: concatenating block data passes
    // single-block round trips but scrambles every multi-block payload.
    for (let i = 0; i < layout.dataCount; i++) {
        data[i] = blocks[i % layout.blockCount][Math.floor(i / layout.blockCount)];
    }
    return { data, corrections };
}
function unrandomize(value, position) {
    const pseudo = ((149 * position) % 255) + 1;
    return value - pseudo >= 0 ? value - pseudo : value - pseudo + 256;
}
/** Decode ASCII plus Base 256, preserving semantic bytes alongside text. */
function parseData(data) {
    let text = '';
    const bytes = [];
    let upperShift = false;
    let gs1 = false;
    for (let i = 0; i < data.length;) {
        const cw = data[i++];
        if (cw === CW_PAD)
            break;
        if (cw <= 128) {
            const value = cw - 1 + (upperShift ? 128 : 0);
            upperShift = false;
            text += String.fromCharCode(value);
            bytes.push(value);
            continue;
        }
        if (cw <= 229) {
            const pair = cw - 130;
            const digits = String(pair).padStart(2, '0');
            text += digits;
            bytes.push(digits.charCodeAt(0), digits.charCodeAt(1));
            continue;
        }
        if (cw === 232) {
            if (i === 1)
                gs1 = true;
            else {
                text += '\x1d';
                bytes.push(29);
            }
            continue;
        }
        if (cw === 235) {
            upperShift = true;
            continue;
        }
        if (cw === CW_BASE256) {
            if (i >= data.length)
                throw new FormatError('Data Matrix: Base 256 length is missing');
            let length = unrandomize(data[i], i + 1);
            i++;
            if (length === 0)
                length = data.length - i;
            else if (length >= 250) {
                if (i >= data.length)
                    throw new FormatError('Data Matrix: Base 256 extended length is missing');
                length = 250 * (length - 249) + unrandomize(data[i], i + 1);
                i++;
            }
            if (i + length > data.length)
                throw new FormatError('Data Matrix: Base 256 segment exceeds data capacity');
            const segment = new Uint8Array(length);
            for (let n = 0; n < length; n++, i++)
                segment[n] = unrandomize(data[i], i + 1);
            bytes.push(...segment);
            for (let n = 0; n < segment.length; n++)
                text += String.fromCharCode(segment[n]);
            continue;
        }
        throw new FormatError(`Data Matrix: unsupported encoding codeword ${cw}`);
    }
    return { text, bytes: Uint8Array.from(bytes), gs1 };
}
/**
 * Decode an upright, sampled Data Matrix ECC 200 symbol.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix Full symbol, no quiet zone.
 * @returns {{text: string, bytes: Uint8Array, correctedErrors: number, symbol: object}}
 */
export function decodeDataMatrix(matrix) {
    if (!matrix || !Number.isInteger(matrix.width) || !Number.isInteger(matrix.height))
        throw new FormatError('Data Matrix: no matrix supplied');
    const layout = layoutFor(matrix.width, matrix.height);
    const placement = readPlacement(extractDataModules(matrix, layout), layout.dataRows, layout.dataCols, layout.dataCount + layout.eccCount);
    const { data, corrections } = deinterleaveAndCorrect(placement, layout);
    const result = parseData(data);
    return { ...result, corrections, correctedErrors: corrections, symbol: layout.entry };
}
export { ChecksumError };
