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
/** Calculate the GS1 modulo-10 check digit for a GTIN body. */
export declare function gtinCheckDigit(body: any): string;
/** Return a checked 14-digit GTIN, preserving only its standardized digits. */
export declare function normalizeGTIN(value: any): string;
/** Build a checked GTIN-14 from its thirteen-digit data body. */
export declare function makeGTIN14(body: any): string;
/**
 * Compact a GTIN into the four values shared by Omnidirectional, Truncated,
 * Stacked and Stacked Omnidirectional. The `physicalCharacters` sequence is
 * left-to-right on a linear DataBar-14 row: 1, 2, 4, 3.
 */
export declare function encodeDataBar14GTIN(value: any, options?: {}): Readonly<{
    gtin: string;
    linkage: boolean;
    symbolValue: bigint;
    leftPair: bigint;
    rightPair: bigint;
    logicalCharacters: Readonly<{
        outerLeft: number;
        innerLeft: number;
        outerRight: number;
        innerRight: number;
    }>;
    physicalCharacters: readonly number[];
}>;
/** Reconstruct and validate a GTIN from the four DataBar-14 character values. */
export declare function decodeDataBar14GTIN(values: any): Readonly<{
    linkage: boolean;
    gtin: string;
    leftPair: bigint;
    rightPair: bigint;
}>;
/** Compact a DataBar Limited-eligible GTIN into its two data character values. */
export declare function encodeDataBarLimitedGTIN(value: any, options?: {}): Readonly<{
    gtin: string;
    linkage: boolean;
    symbolValue: bigint;
    left: number;
    right: number;
}>;
/** Reconstruct and validate a GTIN from DataBar Limited data character values. */
export declare function decodeDataBarLimitedGTIN(values: any): Readonly<{
    linkage: boolean;
    gtin: string;
    symbolValue: bigint;
}>;
/** GS1 transmitted form for the GTIN-only DataBar variants. */
export declare function dataBarGtinTransmission(value: any): string;
