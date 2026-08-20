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
/** Compact a value using the PDF417 Text Compaction alphabet. */
export declare function compactPdf417Text(value: any): any[];
/** Compact bytes using latch 924 for exact six-byte blocks and 901 otherwise. */
export declare function compactPdf417Bytes(value: any): number[];
/** Compact decimal digits using latch 902 and groups of at most 44 digits. */
export declare function compactPdf417Numeric(value: any): number[];
/** Compact a single value, selecting text, numeric or byte mode. */
export declare function compactPdf417(value: any, options?: {}): any[];
/**
 * Decode PDF417 compaction while preserving raw Byte Compaction and byte-shift
 * payloads. Text and Numeric Compaction do not manufacture bytes: their text
 * is available on each segment, while `bytes` contains only octets carried by
 * modes that encode octets explicitly.
 */
export declare function decodePdf417CompactionDetailed(codewords: any): {
    text: string;
    bytes: Uint8Array<ArrayBuffer>;
    segments: {
        mode: string;
        text: string;
        bytes: Uint8Array<ArrayBuffer>;
        eci: number;
        latch: any;
        codewordStart: number;
        codewordEnd: number;
    }[];
};
/** Decode PDF417 Text, Byte, Numeric and UTF-8 ECI compaction segments in source order. */
export declare function decodePdf417Compaction(codewords: any): string;
