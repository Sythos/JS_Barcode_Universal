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
/** PDF417 symbol-character pattern table. @module pdf417/tables */
export declare const PDF417_CLUSTER_NUMBERS: readonly number[];
export declare const PDF417_CODEWORDS_PER_CLUSTER = 929;
/** Return the cluster discriminator for an eight-element bar/space sequence. */
export declare function pdf417ClusterForWidths(widths: any): number;
/** Pattern table indexed by cluster index (0, 1, 2) and codeword value. */
export declare const PDF417_PATTERN_TABLE: readonly (readonly number[])[];
/**
 * Return the 17-bit bar/space pattern for a codeword in a row cluster.
 * @param {number} codeword
 * @param {number} cluster Cluster number 0, 3 or 6.
 * @returns {number}
 */
export declare function pdf417PatternForCodeword(codeword: number, cluster: number): number;
/**
 * Decode an exact 17-bit symbol-character pattern to its codeword and cluster.
 * @param {number} pattern
 * @returns {{codeword: number, cluster: number} | null}
 */
export declare function pdf417CodewordForPattern(pattern: number): {
    codeword: number;
    cluster: number;
} | null;
