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
 * Compact (truncated) PDF417 layout.
 *
 * Compact PDF417 is a geometric variant of PDF417, not a new high-level
 * compaction mode. It keeps the same codeword, cluster, row-indicator,
 * Reed–Solomon and Text/Byte/Numeric compaction rules, while omitting each
 * row's right row indicator and replacing the normal stop pattern with a
 * single dark module. The resulting symbol remains distinguishable from the
 * ordinary PDF417 layout by its width and row terminator.
 *
 * @module compactpdf417/tables
 */
import { EncodeError } from '../core/errors.js';
/** PDF417 start pattern, in module widths. */
export const COMPACT_PDF417_START = '81111113';
/** Binary module representation of the start pattern. */
export const COMPACT_PDF417_START_BITS = '11111111010101000';
/** Compact PDF417's reduced stop is one dark module. */
export const COMPACT_PDF417_STOP_MODULES = 1;
/** Minimum/maximum number of rows and data columns. */
export const COMPACT_PDF417_LIMITS = Object.freeze({
    minRows: 3,
    maxRows: 90,
    minColumns: 1,
    maxColumns: 30,
    maxCodewords: 928,
});
/**
 * Return the printed width in modules for a compact symbol.
 *
 * 17 start + 17 left indicator + 17 per codeword column + 1 reduced stop.
 * @param {number} columns
 */
export function compactPdf417Width(columns) {
    if (!Number.isInteger(columns) || columns < 1 || columns > 30) {
        throw new RangeError(`Compact PDF417: columns must be an integer in 1..30, got ${columns}`);
    }
    return 35 + columns * 17;
}
/**
 * Validate a compact matrix geometry and return its dimensions.
 *
 * @param {number} width
 * @param {number} height
 * @param {number} rowHeight
 */
export function compactPdf417Geometry(width, height, rowHeight = 3) {
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
        throw new RangeError('Compact PDF417: matrix dimensions must be integers');
    }
    if (!Number.isInteger(rowHeight) || rowHeight < 1) {
        throw new RangeError('Compact PDF417: rowHeight must be a positive integer');
    }
    if ((width - 35) % 17 !== 0) {
        throw new RangeError(`Compact PDF417: width ${width} does not match the compact layout`);
    }
    const columns = (width - 35) / 17;
    const rows = height / rowHeight;
    if (!Number.isInteger(rows) || rows < 3 || rows > 90) {
        throw new RangeError(`Compact PDF417: rows must be an integer in 3..90, got ${rows}`);
    }
    if (columns < 1 || columns > 30) {
        throw new RangeError(`Compact PDF417: columns must be an integer in 1..30, got ${columns}`);
    }
    return { rows, columns, rowHeight, width, height };
}
/**
 * Validate encoder dimensions before codeword packing.
 * @param {object} options
 */
export function validateCompactPdf417Options(options = {}) {
    const { minRows, maxRows, minColumns, maxColumns } = COMPACT_PDF417_LIMITS;
    const rowHeight = options.rowHeight ?? 3;
    if (!Number.isInteger(rowHeight) || rowHeight < 3) {
        throw new EncodeError('Compact PDF417: rowHeight must be an integer of at least 3');
    }
    for (const [name, value, min, max] of [
        ['rows', options.rows, minRows, maxRows],
        ['columns', options.columns, minColumns, maxColumns],
    ]) {
        if (value !== undefined && (!Number.isInteger(value) || value < min || value > max)) {
            throw new EncodeError(`Compact PDF417: ${name} must be an integer in ${min}..${max}`);
        }
    }
    if (options.aspectRatio !== undefined &&
        (!Number.isFinite(options.aspectRatio) || options.aspectRatio <= 0)) {
        throw new EncodeError('Compact PDF417: aspectRatio must be positive');
    }
    return rowHeight;
}
/**
 * The row indicator values used by ordinary PDF417 are retained unchanged.
 * Compact symbols omit only the right indicator, so the left indicator still
 * carries the row group, row count, error-correction level and column count.
 */
export function compactPdf417Indicators(row, rows, columns, level) {
    const group = Math.floor(row / 3);
    const y = Math.floor((rows - 1) / 3);
    const z = level * 3 + (rows - 1) % 3;
    const v = columns - 1;
    if (row % 3 === 0)
        return 30 * group + y;
    if (row % 3 === 1)
        return 30 * group + z;
    return 30 * group + v;
}
/**
 * Return all standard ECC levels which agree with the observed left
 * indicators. This is kept as a table helper so decoder and tests share the
 * same compact-layout rule.
 */
export function compactPdf417MatchingLevels(leftIndicators, rows, columns) {
    const matches = [];
    for (let level = 0; level <= 8; level++) {
        if (leftIndicators.every((value, row) => value === compactPdf417Indicators(row, rows, columns, level)))
            matches.push(level);
    }
    return matches;
}
/** Validate representative layout invariants. */
export function validateCompactPdf417Tables() {
    const problems = [];
    for (const columns of [1, 2, 3, 10, 30]) {
        const width = compactPdf417Width(columns);
        if (width !== 35 + columns * 17)
            problems.push(`columns ${columns}: width mismatch`);
    }
    for (const rows of [3, 4, 5, 6, 90]) {
        const left = Array.from({ length: rows }, (_, row) => compactPdf417Indicators(row, rows, 3, 2));
        if (compactPdf417MatchingLevels(left, rows, 3).length !== 1) {
            problems.push(`rows ${rows}: row indicators do not identify one ECC level`);
        }
    }
    return problems;
}
