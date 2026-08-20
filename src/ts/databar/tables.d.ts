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
/** The four GTIN-only layouts sharing the DataBar-14 compaction rules. */
export declare const DATABAR14_VARIANTS: Readonly<{
    omnidirectional: Readonly<{
        id: "omnidirectional";
        rows: 1;
        modules: 96;
        checksumModulus: 79;
        pointOfSale: true;
    }>;
    truncated: Readonly<{
        id: "truncated";
        rows: 1;
        modules: 96;
        checksumModulus: 79;
        pointOfSale: false;
    }>;
    stacked: Readonly<{
        id: "stacked";
        rows: 2;
        modules: 50;
        checksumModulus: 79;
        pointOfSale: false;
    }>;
    'stacked-omnidirectional': Readonly<{
        id: "stacked-omnidirectional";
        rows: 2;
        modules: 50;
        checksumModulus: 79;
        pointOfSale: true;
    }>;
}>;
/** GS1 DataBar Limited is a distinct two-character symbology. */
export declare const DATABAR_LIMITED_VARIANT: Readonly<{
    id: "limited";
    rows: 1;
    checksumModulus: 89;
    pointOfSale: false;
    permittedIndicatorDigits: readonly number[];
}>;
/** (16,4) outside character groups, ISO/IEC 24724:2011 Table 1. */
export declare const DATABAR14_OUTSIDE_GROUPS: readonly Readonly<{
    first: any;
    last: any;
    gsum: any;
    oddModules: any;
    evenModules: any;
    oddWidest: any;
    evenWidest: any;
    oddTotal: any;
    evenTotal: any;
}>[];
/** (15,4) inside character groups, ISO/IEC 24724:2011 Table 2. */
export declare const DATABAR14_INSIDE_GROUPS: readonly Readonly<{
    first: any;
    last: any;
    gsum: any;
    oddModules: any;
    evenModules: any;
    oddWidest: any;
    evenWidest: any;
    oddTotal: any;
    evenTotal: any;
}>[];
/** Number of values carried by an inside (15,4) character. */
export declare const DATABAR14_INSIDE_RADIX = 1597;
/** Number of values carried by one outside/inside character pair. */
export declare const DATABAR14_PAIR_RADIX = 4537077;
/** Stand-alone and composite DataBar-14 payload domain, including linkage. */
export declare const DATABAR14_SYMBOL_LIMIT = 20000000000000n;
/** GS1 DataBar Limited divides its 13 data digits into two character values. */
export declare const DATABAR_LIMITED_PAIR_RADIX = 2013571;
/** Offset that switches a DataBar Limited value from stand-alone to composite. */
export declare const DATABAR_LIMITED_LINKAGE_OFFSET = 2015133531096n;
/** DataBar Limited carries GTIN values whose first digit is zero or one. */
export declare const DATABAR_LIMITED_DATA_LIMIT = 2000000000000n;
/** Locate the value group that an outside or inside character belongs to. */
export declare function dataBar14GroupFor(value: any, kind: any): Readonly<{
    first: any;
    last: any;
    gsum: any;
    oddModules: any;
    evenModules: any;
    oddWidest: any;
    evenWidest: any;
    oddTotal: any;
    evenTotal: any;
}>;
/** Check the independently represented table identities. */
export declare function validateDataBarTables(): string[];
