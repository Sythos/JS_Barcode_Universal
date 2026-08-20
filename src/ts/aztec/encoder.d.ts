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
/**
 * Aztec encoder: high-level bits, bit stuffing, Reed-Solomon and matrix layout.
 *
 * `tables.js` is intentionally the source of geometry and field selection.
 * Its `aztecLayer(layers, compact)` entries must expose `totalBits`,
 * `totalCodewords`, `baseMatrixSize` and `symbolSize`; `fieldForLayers()` must
 * return the matching binary field.  All Aztec Reed-Solomon generators start
 * at alpha^1, hence the explicit base `1` in both data and mode messages.
 *
 * @module aztec/encoder
 */
import { BitWriter } from '../core/bit-buffer.js';
import { BitMatrix } from '../core/bit-matrix.js';
/**
 * Prevent all-zero and all-one codewords except their final bit.  The final
 * bit is intentionally re-consumed after a stuffed word; it is the mechanism
 * that makes the transform injective and reversible.
 *
 * @param {BitWriter} bits @param {number} wordSize @returns {BitWriter}
 */
export declare function stuffBits(bits: BitWriter, wordSize: number): BitWriter;
/**
 * Add systematic Aztec Reed-Solomon parity and the leading alignment bits.
 * @param {BitWriter} data @param {number} totalBits @param {number} wordSize
 * @param {import('../core/galois-field.js').GaloisField} field
 * @returns {{bits: BitWriter, dataWords: number, eccWords: number}}
 */
export declare function addCheckWords(data: BitWriter, totalBits: number, wordSize: number, field: import('../core/galois-field.js').GaloisField): {
    bits: BitWriter;
    dataWords: number;
    eccWords: number;
};
/** @param {number} layers @param {number} dataWords @param {boolean} compact @returns {BitWriter} */
export declare function modeMessage(layers: number, dataWords: number, compact: boolean): BitWriter;
/**
 * Lay low-level bits in the four-sided, inward Aztec spiral.
 * @param {BitWriter} bits @param {{layers:number,compact:boolean,baseMatrixSize:number,symbolSize:number}} symbol
 * @returns {BitMatrix}
 */
export declare function buildAztecMatrix(bits: BitWriter, symbol: {
    layers: number;
    compact: boolean;
    baseMatrixSize: number;
    symbolSize: number;
}): BitMatrix;
/**
 * Encode a UTF-8 string or bytes into an Aztec Code matrix.
 *
 * @param {string|ArrayBuffer|ArrayBufferView} value
 * @param {{layers?:number,compact?:boolean,eccPercent?:number,charset?:'utf-8'}} [options]
 * @returns {BitMatrix & {format?:string,layers?:number,compact?:boolean,eccPercent?:number,dataCodewords?:number}}
 */
export declare function encodeAztec(value: string | ArrayBuffer | ArrayBufferView, options?: {
    layers?: number;
    compact?: boolean;
    eccPercent?: number;
    charset?: 'utf-8';
}): BitMatrix & {
    format?: string;
    layers?: number;
    compact?: boolean;
    eccPercent?: number;
    dataCodewords?: number;
};
