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
/** All 34 predefined MicroPDF417 symbol variants, in format-table order. */
export declare const MICROPDF417_VARIANTS: readonly Readonly<{
    id: any;
    columns: any;
    rows: any;
    totalCodewords: number;
    dataCodewords: number;
    eccCodewords: any;
    rapStart: any;
    rapRotation: any;
}>[];
/** @param {number} value @param {number} offset @returns {number} */
export declare function microPdf417NextRap(value: number, offset?: number): number;
/** @param {number} id @returns {Readonly<typeof MICROPDF417_VARIANTS[number]>} */
export declare function microPdf417VariantByNumber(id: number): Readonly<typeof MICROPDF417_VARIANTS[number]>;
/**
 * Return the smallest data-region candidate that fits `codewords`.
 * Ties are resolved by width, then height, so selection is deterministic.
 */
export declare function microPdf417VariantForCapacity(codewords: any): Readonly<{
    id: any;
    columns: any;
    rows: any;
    totalCodewords: number;
    dataCodewords: number;
    eccCodewords: any;
    rapStart: any;
    rapRotation: any;
}>;
/** Return the six bar/space run widths for a numbered side or center RAP. */
export declare function microPdf417RapSequence(number: any, kind?: string): string;
/**
 * Resolve all row-address data for a zero-based row within a variant.
 * @returns {{left: number, center: number|null, right: number, cluster: 0|3|6}}
 */
export declare function microPdf417RowAddress(entry: any, row: any): {
    left: number;
    center: number | null;
    right: number;
    cluster: 0 | 3 | 6;
};
/** Return any table-invariant failures; an empty result means the table is coherent. */
export declare function validateMicroPdf417Tables(): string[];
