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
 * Data Matrix ECC 200 symbol parameters.
 *
 * Width and height include finder borders. `regionWidth` and `regionHeight`
 * describe the usable modules inside one data region. The last three columns
 * make the Reed-Solomon block split explicit instead of hiding the 144x144
 * exception in encoder control flow.
 *
 * @module datamatrix/tables
 */
function symbol(width, height, dataRegionWidth, dataRegionHeight, dataCodewords, errorCodewords, dataBlockLengths) {
    const blockCount = dataBlockLengths.length;
    return Object.freeze({
        width, height, rows: height, columns: width,
        // Region dimensions include their one-module finder border on each side;
        // dataRegion* expose the inner placement lattice explicitly.
        regionWidth: dataRegionWidth + 2, regionHeight: dataRegionHeight + 2,
        dataRegionWidth, dataRegionHeight,
        dataRegionRows: dataRegionHeight, dataRegionColumns: dataRegionWidth,
        dataCodewords, errorCodewords, blockCount,
        eccPerBlock: errorCodewords / blockCount,
        dataBlockLengths: Object.freeze(dataBlockLengths),
    });
}
/** Classic ISO/IEC 16022 ECC 200 symbols; DMRE is deliberately excluded. */
export const DATAMATRIX_SYMBOLS = Object.freeze([
    symbol(10, 10, 8, 8, 3, 5, [3]),
    symbol(12, 12, 10, 10, 5, 7, [5]),
    symbol(14, 14, 12, 12, 8, 10, [8]),
    symbol(16, 16, 14, 14, 12, 12, [12]),
    symbol(18, 18, 16, 16, 18, 14, [18]),
    symbol(20, 20, 18, 18, 22, 18, [22]),
    symbol(22, 22, 20, 20, 30, 20, [30]),
    symbol(24, 24, 22, 22, 36, 24, [36]),
    symbol(26, 26, 24, 24, 44, 28, [44]),
    symbol(32, 32, 14, 14, 62, 36, [62]),
    symbol(36, 36, 16, 16, 86, 42, [86]),
    symbol(40, 40, 18, 18, 114, 48, [114]),
    symbol(44, 44, 20, 20, 144, 56, [144]),
    symbol(48, 48, 22, 22, 174, 68, [174]),
    symbol(52, 52, 24, 24, 204, 84, [102, 102]),
    symbol(64, 64, 14, 14, 280, 112, [140, 140]),
    symbol(72, 72, 16, 16, 368, 144, [92, 92, 92, 92]),
    symbol(80, 80, 18, 18, 456, 192, [114, 114, 114, 114]),
    symbol(88, 88, 20, 20, 576, 224, [144, 144, 144, 144]),
    symbol(96, 96, 22, 22, 696, 272, [174, 174, 174, 174]),
    symbol(104, 104, 24, 24, 816, 336, [136, 136, 136, 136, 136, 136]),
    symbol(120, 120, 18, 18, 1050, 408, [175, 175, 175, 175, 175, 175]),
    symbol(132, 132, 20, 20, 1304, 496, [163, 163, 163, 163, 163, 163, 163, 163]),
    symbol(144, 144, 22, 22, 1558, 620, [156, 156, 156, 156, 156, 156, 156, 156, 155, 155]),
    symbol(18, 8, 16, 6, 5, 7, [5]),
    symbol(32, 8, 14, 6, 10, 11, [10]),
    symbol(26, 12, 24, 10, 16, 14, [16]),
    symbol(36, 12, 16, 10, 22, 18, [22]),
    symbol(36, 16, 16, 14, 32, 24, [32]),
    symbol(48, 16, 22, 14, 49, 28, [49]),
]);
/** Compatibility alias. */
export const SYMBOLS = DATAMATRIX_SYMBOLS;
/** Return the smallest permitted symbol that holds `count` data codewords. */
export function symbolForDataCodewords(count, shape = 'any') {
    for (const s of DATAMATRIX_SYMBOLS) {
        const rectangular = s.width !== s.height;
        if ((shape === 'square' && rectangular) || (shape === 'rectangular' && !rectangular))
            continue;
        if (count <= s.dataCodewords)
            return s;
    }
    throw new RangeError(`Data Matrix: ${count} data codewords do not fit an ECC 200 ${shape} symbol`);
}
/** Check redundant geometry and block identities in the static table. */
export function validateDataMatrixTables() {
    const issues = [];
    for (const s of DATAMATRIX_SYMBOLS) {
        const regionsX = s.width / s.regionWidth;
        const regionsY = s.height / s.regionHeight;
        if (!Number.isInteger(regionsX) || !Number.isInteger(regionsY))
            issues.push(`${s.width}x${s.height}: non-integral regions`);
        const modules = regionsX * regionsY * s.dataRegionWidth * s.dataRegionHeight;
        // Annex F reserves four terminal modules on a few lattice dimensions.
        // They are set to dark after codeword placement and do not carry data.
        const unused = modules - (s.dataCodewords + s.errorCodewords) * 8;
        if (unused !== 0 && unused !== 4)
            issues.push(`${s.width}x${s.height}: geometry/codeword mismatch`);
        if (s.dataBlockLengths.reduce((a, b) => a + b, 0) !== s.dataCodewords)
            issues.push(`${s.width}x${s.height}: data block mismatch`);
        if (s.eccPerBlock * s.blockCount !== s.errorCodewords)
            issues.push(`${s.width}x${s.height}: ecc block mismatch`);
    }
    return issues;
}
/** Compatibility alias. */
export const validateTables = validateDataMatrixTables;
