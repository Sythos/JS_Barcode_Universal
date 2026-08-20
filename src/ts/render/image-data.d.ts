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
 * Render to an `ImageData`-shaped object.
 *
 * A plain object rather than a real `ImageData`, so this works in Node and in
 * workers without a DOM. It is accepted directly by `ctx.putImageData` in the
 * browser, and by this library's own reader.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 * @param {import('./options.js').RenderOptions} [options]
 * @returns {{data: Uint8ClampedArray, width: number, height: number}}
 */
export declare function toImageData(matrix: import('../core/bit-matrix.js').BitMatrix, options?: import('./options.js').RenderOptions): {
    data: Uint8ClampedArray;
    width: number;
    height: number;
};
/**
 * Draw into a canvas using its 2D context.
 *
 * This is the universal fallback: every browser that runs JavaScript at all
 * has a 2D context, including every iOS Safari version.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 * @param {HTMLCanvasElement | OffscreenCanvas} canvas
 * @param {import('./options.js').RenderOptions} [options]
 * @returns {boolean} True when it drew.
 */
export declare function toCanvas(matrix: import('../core/bit-matrix.js').BitMatrix, canvas: HTMLCanvasElement | OffscreenCanvas, options?: import('./options.js').RenderOptions): boolean;
