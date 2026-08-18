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
export type FrameQrEncodeOptions = {
    /**
     * The profile always uses QR error correction H.
     */
    ecc?: 'H';
    /**
     * Force a QR version 1-40.
     */
    version?: number;
    /**
     * Force a QR mask 0-7.
     */
    mask?: number;
    /**
     * Byte mode interpretation.
     */
    charset?: 'auto' | 'utf-8' | 'iso-8859-1';
    /**
     * Allow QR kanji mode.
     */
    kanji?: boolean;
    /**
     * Profile artwork reservation.
     */
    canvas?: object;
};
/**
 * Encode a QR Code with a conservative artwork canvas according to the
 * non-certified FrameQR Code profile.
 *
 * The profile forces QR H error correction and rejects a canvas whenever its
 * known codeword damage exceeds the per-block correction budget. When a
 * version is not forced, the smallest QR version that holds both payload and
 * safe canvas is selected. A decoder can reconstruct the reserved modules from
 * the returned profile metadata.
 *
 * @param {string} text
 * @param {FrameQrEncodeOptions} [options]
 * @returns {import('../core/bit-matrix.js').BitMatrix}
 * @throws {EncodeError} When the QR payload/options are invalid or the canvas
 *   cannot safely fit the selected QR version.
 */
export declare function encodeFrameQR(text: string, options?: FrameQrEncodeOptions): import('../core/bit-matrix.js').BitMatrix;
