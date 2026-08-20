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
import { EncodeError } from '../core/errors.js';
import { compactPdf417 } from './compaction.js';
import { pdf417ErrorCorrection, pdf417EccLength } from './error-correction.js';
import { pdf417PatternForCodeword } from './tables.js';
const START = '81111113';
const STOP = '711311121';
function append(matrix, y, x, sequence, height) {
    let dark = true;
    for (const digit of sequence) {
        const width = digit.charCodeAt(0) - 48;
        if (dark)
            matrix.setRegion(x, y, width, height);
        x += width;
        dark = !dark;
    }
    return x;
}
function patternSequence(pattern) { return pattern.toString(2).padStart(17, '0').replace(/0+|1+/g, (run) => String(run.length)); }
function indicators(row, rows, cols, level) {
    const group = Math.floor(row / 3), y = Math.floor((rows - 1) / 3), z = level * 3 + (rows - 1) % 3, v = cols - 1;
    if (row % 3 === 0)
        return [30 * group + y, 30 * group + v];
    if (row % 3 === 1)
        return [30 * group + z, 30 * group + y];
    return [30 * group + v, 30 * group + z];
}
function dimensions(needed, level, options) {
    for (const [name, value, min, max] of [['rows', options.rows, 3, 90], ['columns', options.columns, 1, 30]]) {
        if (value !== undefined && (!Number.isInteger(value) || value < min || value > max))
            throw new EncodeError(`PDF417: ${name} must be an integer in ${min}..${max}`);
    }
    if (options.aspectRatio !== undefined && (!Number.isFinite(options.aspectRatio) || options.aspectRatio <= 0))
        throw new EncodeError('PDF417: aspectRatio must be positive');
    const ecc = pdf417EccLength(level);
    let best = null;
    for (let rows = options.rows ?? 3; rows <= (options.rows ?? 90); rows++)
        for (let cols = options.columns ?? 1; cols <= (options.columns ?? 30); cols++) {
            if (rows < 3 || rows * cols > 928 || rows * cols - ecc < needed)
                continue;
            const ratio = (69 + cols * 17) / (rows * (options.rowHeight ?? 3));
            const score = (rows * cols - ecc - needed) * 10 + Math.abs(ratio - (options.aspectRatio ?? 3));
            if (!best || score < best.score)
                best = { rows, cols, score };
        }
    if (!best)
        throw new EncodeError('PDF417: payload does not fit the requested dimensions and error correction level');
    return best;
}
export function encodePDF417(value, options = {}) {
    const level = options.eccLevel ?? 2, rowHeight = options.rowHeight ?? 3;
    if (!Number.isInteger(rowHeight) || rowHeight < 3)
        throw new EncodeError('PDF417: rowHeight must be an integer of at least 3');
    const payload = compactPdf417(value, { compaction: options.compaction });
    const { rows, cols } = dimensions(payload.length + 1, level, { ...options, rowHeight });
    const eccLength = pdf417EccLength(level), dataLength = rows * cols - eccLength;
    const data = [dataLength, ...payload];
    while (data.length < dataLength)
        data.push(900);
    const codewords = data.concat(pdf417ErrorCorrection(data, level));
    const matrix = new BitMatrix(69 + cols * 17, rows * rowHeight);
    for (let row = 0; row < rows; row++) {
        const y = row * rowHeight, cluster = (row % 3) * 3, [left, right] = indicators(row, rows, cols, level);
        let x = append(matrix, y, 0, START, rowHeight);
        x = append(matrix, y, x, patternSequence(pdf417PatternForCodeword(left, cluster)), rowHeight);
        for (let col = 0; col < cols; col++)
            x = append(matrix, y, x, patternSequence(pdf417PatternForCodeword(codewords[row * cols + col], cluster)), rowHeight);
        x = append(matrix, y, x, patternSequence(pdf417PatternForCodeword(right, cluster)), rowHeight);
        append(matrix, y, x, STOP, rowHeight);
    }
    matrix.pdf417 = { rows, columns: cols, eccLevel: level, rowHeight, codewords };
    return matrix;
}
