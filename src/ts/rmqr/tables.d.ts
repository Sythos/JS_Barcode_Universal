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
import { BitMatrix } from '../core/bit-matrix.js';
/** The 32 rMQR dimensions in ISO/IEC 23941 order (width, height). */
export declare const RMQR_SIZES: readonly number[][];
/** @param {number} version */
export declare function versionInfo(version: number): Readonly<{
    version: number;
    width: number;
    height: number;
    name: `R${number}x${number}`;
    indicator: number;
    remainderBits: number;
    totalCodewords: number;
    countBits(mode: any): any;
    blockLayout: (ecc: any) => {
        blocks: {
            total: number;
            data: number;
            ecc: number;
        }[];
        totalCodewords: number;
        totalDataCodewords: number;
        eccCodewords: number;
    };
}>;
/** @param {number} width @param {number} height */
export declare function versionForSize(width: number, height: number): Readonly<{
    version: number;
    width: number;
    height: number;
    name: `R${number}x${number}`;
    indicator: number;
    remainderBits: number;
    totalCodewords: number;
    countBits(mode: any): any;
    blockLayout: (ecc: any) => {
        blocks: {
            total: number;
            data: number;
            ecc: number;
        }[];
        totalCodewords: number;
        totalDataCodewords: number;
        eccCodewords: number;
    };
}> | null;
/** @param {number} version */
export declare function alignmentCoordinates(version: number): any;
/** Unmasked 18-bit format sequence: 5-bit version indicator plus ECC bit. */
export declare function formatBits(version: any, ecc: any): number;
export declare const FORMAT_MASK_FINDER = 129714;
export declare const FORMAT_MASK_SUB = 133755;
/** rMQR has one fixed mask: floor(y/2)+floor(x/3) even. */
export declare function maskBit(x: any, y: any): boolean;
/** Function modules; set bits are non-data cells. */
export declare function functionModules(version: any): BitMatrix;
/** Data coordinates in the standard right-to-left two-column traversal. */
export declare function dataModuleOrder(version: any): number[][];
export declare function dataBitCapacity(version: any, ecc: any): number;
export declare function validateTables(): string[];
