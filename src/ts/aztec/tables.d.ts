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
/** Reed-Solomon generator base defined for Aztec parameter and data fields. */
export declare const AZTEC_RS_GENERATOR_BASE = 1;
/** Minimum recommended error correction: 23 percent plus three codewords. */
export declare const AZTEC_DEFAULT_ECC_PERCENT = 23;
export declare const AZTEC_MIN_ECC_WORDS = 3;
/** Word size selected solely by the number of layers. */
export declare function wordSizeForLayers(layers: any): 6 | 8 | 10 | 12;
/** Return the field used by Aztec codewords of `wordSize` bits. */
export declare function fieldForWordSize(wordSize: any): import("../core/galois-field.js").GaloisField;
/** Return the data field selected for a symbol with `layers` layers. */
export declare function fieldForLayers(layers: any): import("../core/galois-field.js").GaloisField;
/** Matrix side length, including Full-mode reference grid lines. */
export declare function aztecSymbolSize(layers: any, compact?: boolean): number;
/** Compact Aztec layers 1 through 4, in encoding preference order. */
export declare const AZTEC_COMPACT_LAYERS: readonly Readonly<{
    compact: any;
    layers: any;
    wordSize: 6 | 8 | 10 | 12;
    totalBits: number;
    usableBits: number;
    totalCodewords: number;
    maxDataCodewords: number;
    baseMatrixSize: number;
    symbolSize: number;
    modeMessageDataWords: 2 | 4;
    modeMessageWords: 7 | 10;
    modeMessageBits: 28 | 40;
    rsGeneratorBase: 1;
}>[];
/** Full Aztec layers 1 through 32, in ascending layer order. */
export declare const AZTEC_FULL_LAYERS: readonly Readonly<{
    compact: any;
    layers: any;
    wordSize: 6 | 8 | 10 | 12;
    totalBits: number;
    usableBits: number;
    totalCodewords: number;
    maxDataCodewords: number;
    baseMatrixSize: number;
    symbolSize: number;
    modeMessageDataWords: 2 | 4;
    modeMessageWords: 7 | 10;
    modeMessageBits: 28 | 40;
    rsGeneratorBase: 1;
}>[];
/** All allowed symbols. Compact entries precede Full entries for automatic selection. */
export declare const AZTEC_LAYERS: readonly Readonly<{
    compact: any;
    layers: any;
    wordSize: 6 | 8 | 10 | 12;
    totalBits: number;
    usableBits: number;
    totalCodewords: number;
    maxDataCodewords: number;
    baseMatrixSize: number;
    symbolSize: number;
    modeMessageDataWords: 2 | 4;
    modeMessageWords: 7 | 10;
    modeMessageBits: 28 | 40;
    rsGeneratorBase: 1;
}>[];
/** Return one immutable layer record. */
export declare function aztecLayer(layers: any, compact?: boolean): Readonly<{
    compact: any;
    layers: any;
    wordSize: 6 | 8 | 10 | 12;
    totalBits: number;
    usableBits: number;
    totalCodewords: number;
    maxDataCodewords: number;
    baseMatrixSize: number;
    symbolSize: number;
    modeMessageDataWords: 2 | 4;
    modeMessageWords: 7 | 10;
    modeMessageBits: 28 | 40;
    rsGeneratorBase: 1;
}>;
/**
 * Calculate the minimum parity count for a data word count.
 *
 * The percentage is rounded up because a fractional codeword cannot be
 * emitted. The mandatory three words protect short payloads, where a bare
 * percentage would otherwise round to zero.
 */
export declare function eccCodewordsFor(dataCodewords: any, eccPercent?: number): number;
/**
 * Choose the first symbol which holds an already stuffed payload.
 *
 * `dataBits` must be a multiple of the candidate word size; callers which
 * start from high-level bits must stuff separately per candidate word size.
 */
export declare function selectAztecLayer(dataBits: any, { eccPercent, layers, compact, }?: {
    compact?: null | undefined;
    eccPercent?: number | undefined;
    layers?: null | undefined;
}): Readonly<{
    compact: any;
    layers: any;
    wordSize: 6 | 8 | 10 | 12;
    totalBits: number;
    usableBits: number;
    totalCodewords: number;
    maxDataCodewords: number;
    baseMatrixSize: number;
    symbolSize: number;
    modeMessageDataWords: 2 | 4;
    modeMessageWords: 7 | 10;
    modeMessageBits: 28 | 40;
    rsGeneratorBase: 1;
    dataCodewords: number;
    eccCodewords: number;
}>;
/** Check static identities so table corruption fails explicitly in tests. */
export declare function validateAztecTables(): string[];
