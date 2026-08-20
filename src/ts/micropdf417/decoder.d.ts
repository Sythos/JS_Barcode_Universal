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
 * Decode a sampled MicroPDF417 matrix.
 *
 * The complete fixed data region is compacted after correction. Encoder padding
 * is PDF417 Text latch 900, which contributes no characters at the end of the
 * payload. This avoids relying on non-symbol metadata for payload length.
 */
export declare function decodeMicroPDF417(matrix: any, options?: {}): {
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
    codewords: number[];
    rows: any;
    columns: any;
    variant: any;
    eccCodewords: any;
    rowHeight: number;
    corrections: number;
};
