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
/** Numeric version identifiers used by the encoder selection loop. */
export declare const MICROQR_VERSIONS: readonly number[];
export declare const MICROQR_VERSION_NAMES: readonly string[];
export declare const MICROQR_ECC_LEVELS: readonly string[];
export declare const MICROQR_FORMAT_MASK = 17477;
export declare const MICROQR_FORMAT_GENERATOR = 1335;
/** The eight legal Micro QR version/error-correction combinations. */
export declare const MICROQR_SYMBOLS: readonly Readonly<{
    version: any;
    ecc: any;
    symbolNumber: any;
    size: number;
    totalCodewords: any;
    dataCodewords: any;
    dataBits: any;
    eccCodewords: any;
    blockCount: 1;
    shortDataCodewordBits: number;
    remainderBits: 0;
}>[];
/** @param {string|number} version @returns {number} */
export declare function microQrVersionSize(version: string | number): number;
/** Resolve the format symbol number for a legal version/ECC pair. */
export declare function microQrSymbolNumber(version: any, ecc: any): any;
/** Resolve the immutable single-block layout for a legal version/ECC pair. */
export declare function microQrBlockLayout(version: any, ecc: any): Readonly<{
    version: any;
    ecc: any;
    symbolNumber: any;
    size: number;
    totalCodewords: any;
    dataCodewords: any;
    dataBits: any;
    eccCodewords: any;
    blockCount: 1;
    shortDataCodewordBits: number;
    remainderBits: 0;
}>;
/** @returns {number} Usable message bits, including mode/count overhead. */
export declare function microQrDataCapacityBits(version: any, ecc: any): number;
/**
 * Encode the five format data bits with BCH(15,5), then apply the Micro QR
 * format mask. `symbolNumber` occupies the high three data bits and `mask`
 * the low two.
 */
export declare function microQrFormatInfo(symbolNumber: any, mask: any, maybeMask: any): number;
/** Decode/correct a 15-bit format word. Returns null beyond three errors. */
export declare function microQrDecodeFormatInfo(bits: any): {
    version: any;
    ecc: any;
    symbolNumber: any;
    mask: number;
    correctedBits: number;
    bits: number;
} | null;
/**
 * Format modules in bit-number order, least significant bit first. Bits 0..7
 * run down column 8; bits 8..14 continue right-to-left along row 8.
 * Position (8,8) is shared by the two arms and appears once.
 */
export declare function microQrFormatInfoPositions(sizeOrVersion: any): number[][];
/**
 * Fixed dark function modules before format information is written. Light
 * separator and light timing modules remain unset; use
 * {@link microQrReservedModules} to distinguish them from payload modules.
 */
export declare function microQrFunctionModules(version: any): any;
/** Shared immutable-in-use map of finder, separator, timing and format modules. */
export declare function microQrReservedModules(version: any): any;
/** Number of modules carrying data or error-correction bits. */
export declare function microQrFreeModuleCount(version: any): number;
/** Payload module coordinates as interleaved x,y pairs, MSB-first stream order. */
export declare function microQrDataModuleOrder(version: any): any;
/** The four Micro QR data-mask predicates. */
export declare function microQrMaskBit(mask: any, x: any, y: any): boolean;
/** Return all internal table/geometry invariant failures. */
export declare function validateMicroQrTables(): string[];
