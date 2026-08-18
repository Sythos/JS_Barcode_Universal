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
 * SPDX-FileCopyrightText: 2026 Sythos (https://www.sythos.net)
 * SPDX-License-Identifier: MIT
 *
 * Original work. No code from any other barcode implementation.
 */
/** PDF417 start pattern, in module widths. */
export declare const COMPACT_PDF417_START = "81111113";
/** Binary module representation of the start pattern. */
export declare const COMPACT_PDF417_START_BITS = "11111111010101000";
/** Compact PDF417's reduced stop is one dark module. */
export declare const COMPACT_PDF417_STOP_MODULES = 1;
/** Minimum/maximum number of rows and data columns. */
export declare const COMPACT_PDF417_LIMITS: Readonly<{
    minRows: 3;
    maxRows: 90;
    minColumns: 1;
    maxColumns: 30;
    maxCodewords: 928;
}>;
/**
 * Return the printed width in modules for a compact symbol.
 *
 * 17 start + 17 left indicator + 17 per codeword column + 1 reduced stop.
 * @param {number} columns
 */
export declare function compactPdf417Width(columns: number): number;
/**
 * Validate a compact matrix geometry and return its dimensions.
 *
 * @param {number} width
 * @param {number} height
 * @param {number} rowHeight
 */
export declare function compactPdf417Geometry(width: number, height: number, rowHeight?: number): {
    rows: number;
    columns: number;
    rowHeight: number;
    width: number;
    height: number;
};
/**
 * Validate encoder dimensions before codeword packing.
 * @param {object} options
 */
export declare function validateCompactPdf417Options(options?: object): any;
/**
 * The row indicator values used by ordinary PDF417 are retained unchanged.
 * Compact symbols omit only the right indicator, so the left indicator still
 * carries the row group, row count, error-correction level and column count.
 */
export declare function compactPdf417Indicators(row: any, rows: any, columns: any, level: any): number;
/**
 * Return all standard ECC levels which agree with the observed left
 * indicators. This is kept as a table helper so decoder and tests share the
 * same compact-layout rule.
 */
export declare function compactPdf417MatchingLevels(leftIndicators: any, rows: any, columns: any): number[];
/** Validate representative layout invariants. */
export declare function validateCompactPdf417Tables(): string[];
