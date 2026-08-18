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
/** @param {unknown} profile @returns {boolean} */
declare function isExpectedProfile(profile: unknown): boolean;
/**
 * Decode a FrameQR Code matrix.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 *   Square QR modules, normally returned by `encodeFrameQR` or a FrameQR
 *   detector. The encoder's `frameqr` metadata is required by default.
 * @param {object} [options]
 * @param {object} [options.canvas] Explicit canvas metadata for a sampled
 *   matrix when the source marker was not preserved.
 * @param {string|object} [options.profile] Expected profile identifier.
 * @param {boolean} [options.allowUnmarked=false] Explicit detector opt-in for
 *   a matrix whose marker was lost during image sampling.
 * @returns {import('../qr/decoder.js').DecodeResult & {
 *   format: 'frameqr', profile: string, certified: false,
 *   frame: object, canvas: object, canvasDamage: object
 * }}
 * @throws {FormatError} If the profile marker/canvas is invalid or the input
 *   is an ordinary QR Code.
 */
export declare function decodeFrameQR(matrix: import('../core/bit-matrix.js').BitMatrix, options?: {
    canvas?: object;
    profile?: string | object;
    allowUnmarked?: boolean;
}): import('../qr/decoder.js').DecodeResult & {
    format: 'frameqr';
    profile: string;
    certified: false;
    frame: object;
    canvas: object;
    canvasDamage: object;
};
export { isExpectedProfile };
