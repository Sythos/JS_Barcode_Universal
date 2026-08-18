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
export type ImageLike = {
    /**
     * RGBA, 4 bytes per pixel.
     */
    data: Uint8ClampedArray | Uint8Array | number[];
    width: number;
    height: number;
};
/**
 * @typedef {object} ImageLike
 * @property {Uint8ClampedArray | Uint8Array | number[]} data RGBA, 4 bytes per pixel.
 * @property {number} width
 * @property {number} height
 */
export declare class LuminanceSource {
    grey: Uint8Array<ArrayBufferLike>;
    width: number;
    height: number;
    /**
     * @param {Uint8Array} grey One byte per pixel.
     * @param {number} width
     * @param {number} height
     */
    constructor(grey: Uint8Array, width: number, height: number);
    /**
     * Build from any ImageData-shaped object.
     *
     * Transparent pixels are composited over white rather than read as black:
     * a PNG barcode with a transparent background is common, and treating alpha
     * as ink turns the entire quiet zone into a solid dark field.
     *
     * @param {ImageLike} image
     * @returns {LuminanceSource}
     */
    static fromImageData(image: ImageLike): LuminanceSource;
    /**
     * Build directly from single-channel data, skipping conversion.
     *
     * @param {Uint8Array} grey
     * @param {number} width
     * @param {number} height
     * @returns {LuminanceSource}
     */
    static fromGrey(grey: Uint8Array, width: number, height: number): LuminanceSource;
    /**
     * @param {number} x @param {number} y
     * @returns {number} 0-255.
     */
    get(x: number, y: number): number;
    /**
     * @param {number} y
     * @param {Uint8Array} [out]
     * @returns {Uint8Array}
     */
    getRow(y: number, out?: Uint8Array): Uint8Array;
    /**
     * Rotate 90 degrees clockwise.
     *
     * The 1D readers scan horizontally, so this is how they find vertically
     * oriented barcodes: scan, rotate, scan again.
     *
     * @returns {LuminanceSource}
     */
    rotate90(): LuminanceSource;
    /**
     * Downscale by an integer factor with box averaging.
     *
     * Large camera frames are slow to scan and no more informative than a
     * half-size copy; detectors use this to find candidates cheaply.
     *
     * @param {number} factor
     * @returns {LuminanceSource}
     */
    downscale(factor: number): LuminanceSource;
    /**
     * Invert. Some symbols are printed light-on-dark, and readers retry inverted
     * when a first pass finds nothing.
     *
     * @returns {LuminanceSource}
     */
    invert(): LuminanceSource;
}
