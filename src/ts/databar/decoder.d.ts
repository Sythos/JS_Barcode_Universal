/*!
 * Sythos Barcode Suite
 *
 * MIT License
 *
 * Copyright (c) 2026 Sythos
 * SPDX-FileCopyrightText: 2026 Sythos (https://www.sythos.net)
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
/** Decode a clean or integer-scaled 96-module DataBar-14 matrix. */
export declare function decodeDataBar14(matrix: any): Readonly<{
    format: "databar-omnidirectional";
    text: string;
    gtin: string;
    linkage: boolean;
    symbologyIdentifier: "]e0";
}>;
/**
 * Decode GS1 DataBar-14 from one raster scanline. This is the image layer over
 * the existing clean 96-module decoder; it recognizes both Omnidirectional
 * and Truncated symbols because their horizontal pattern is identical.
 *
 * @param {Uint8Array} row
 * @returns {{format:'gs1databar14', text:string, gtin:string, gs1:boolean, linkage:boolean, symbologyIdentifier:string, elements:Array}|null}
 */
export declare function decodeDataBar14Scanline(row: Uint8Array): {
    format: 'gs1databar14';
    text: string;
    gtin: string;
    gs1: boolean;
    linkage: boolean;
    symbologyIdentifier: string;
    elements: any[];
} | null;
