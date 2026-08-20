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
import { FormatError } from '../core/errors.js';
import { decodePdf417CompactionDetailed } from './compaction.js';
import { pdf417CorrectErrors, pdf417EccLength } from './error-correction.js';
import { pdf417CodewordForPattern } from './tables.js';
const START = '11111111010101000';
const STOP = '111111101000101001';
function bits(matrix, y, x, width) { let value = 0; for (let i = 0; i < width; i++)
    value = (value << 1) | (matrix.get(x + i, y) ? 1 : 0); return value; }
function indicators(row, rows, cols, level) { const group = Math.floor(row / 3), y = Math.floor((rows - 1) / 3), z = level * 3 + (rows - 1) % 3, v = cols - 1; return row % 3 === 0 ? [30 * group + y, 30 * group + v] : row % 3 === 1 ? [30 * group + z, 30 * group + y] : [30 * group + v, 30 * group + z]; }
export function decodePDF417(matrix, options = {}) {
    if (!matrix?.width || !matrix?.height || (matrix.width - 69) % 17)
        throw new FormatError('PDF417: invalid matrix dimensions');
    const cols = (matrix.width - 69) / 17, rowHeight = options.rowHeight ?? matrix.pdf417?.rowHeight ?? 3;
    if (!Number.isInteger(rowHeight) || matrix.height % rowHeight)
        throw new FormatError('PDF417: invalid row height');
    const rows = matrix.height / rowHeight;
    if (rows < 3 || rows > 90 || cols < 1 || cols > 30)
        throw new FormatError('PDF417: dimensions outside the standard range');
    const all = [];
    const erasures = [];
    for (let row = 0; row < rows; row++) {
        const y = row * rowHeight, cluster = (row % 3) * 3;
        if (bits(matrix, y, 0, 17).toString(2).padStart(17, '0') !== START || bits(matrix, y, matrix.width - 18, 18).toString(2).padStart(18, '0') !== STOP)
            throw new FormatError('PDF417: missing start or stop pattern');
        const read = (x) => { const result = pdf417CodewordForPattern(bits(matrix, y, x, 17)); if (!result || result.cluster !== cluster)
            throw new FormatError('PDF417: invalid codeword pattern'); return result.codeword; };
        const left = read(17), right = read(34 + cols * 17);
        let matched = false;
        for (let level = 0; level <= 8; level++) {
            const expected = indicators(row, rows, cols, level);
            if (left === expected[0] && right === expected[1]) {
                matched = true;
                break;
            }
        }
        if (!matched)
            throw new FormatError('PDF417: row indicator mismatch');
        for (let col = 0; col < cols; col++) {
            try {
                all.push(read(34 + col * 17));
            }
            catch {
                erasures.push(all.length);
                all.push(0);
            }
        }
    }
    let level = -1;
    for (let candidate = 0; candidate <= 8; candidate++)
        if (all.length > pdf417EccLength(candidate)) {
            level = candidate;
            break;
        }
    // The row indicators determine the level uniquely across the symbol.
    for (let candidate = 0; candidate <= 8; candidate++) {
        let ok = true;
        for (let row = 0; row < rows; row++) {
            const y = row * rowHeight, cluster = (row % 3) * 3, expected = indicators(row, rows, cols, candidate);
            const left = pdf417CodewordForPattern(bits(matrix, y, 17, 17));
            const right = pdf417CodewordForPattern(bits(matrix, y, 34 + cols * 17, 17));
            if (!left || !right || left.cluster !== cluster || right.cluster !== cluster || left.codeword !== expected[0] || right.codeword !== expected[1]) {
                ok = false;
                break;
            }
        }
        if (ok) {
            level = candidate;
            break;
        }
    }
    if (level < 0)
        throw new FormatError('PDF417: could not determine error correction level');
    const corrected = all.slice();
    const corrections = pdf417CorrectErrors(corrected, level, erasures);
    const length = corrected[0];
    if (length < 1 || length > corrected.length - pdf417EccLength(level))
        throw new FormatError('PDF417: invalid symbol length descriptor');
    const payload = corrected.slice(1, length);
    const decoded = decodePdf417CompactionDetailed(payload);
    return { ...decoded, codewords: corrected, rows, columns: cols, eccLevel: level, corrections };
}
