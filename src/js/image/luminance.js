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
 * SPDX-License-Identifier: MIT
 *
 * Original work. No code from any other barcode implementation.
 */
/**
 * Greyscale conversion — the boundary between "an image" and "our problem".
 *
 * The whole library accepts exactly one image shape: `{ data, width, height }`
 * with `data` in RGBA order. That is what `ImageData` is, so a `<canvas>`, an
 * `OffscreenCanvas`, `createImageBitmap`, sharp, jimp and node-canvas all
 * satisfy it without an adapter. Nothing below this file knows about the DOM,
 * the filesystem, or any image codec.
 *
 * @module image/luminance
 */
import { NotFoundError } from '../core/errors.js';
// Camera and file inputs are untrusted. Keep allocations bounded before any
// raster is copied into the decoder pipeline.
const MAX_IMAGE_DIMENSION = 16384;
const MAX_IMAGE_PIXELS = 16777216;
function validateDimensions(width, height) {
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)
        || width < 1 || height < 1
        || width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        throw new NotFoundError(`Image dimensions must be positive safe integers no larger than ${MAX_IMAGE_DIMENSION}`);
    }
    const pixels = width * height;
    if (pixels > MAX_IMAGE_PIXELS) {
        throw new NotFoundError(`Image contains too many pixels: ${pixels} (maximum ${MAX_IMAGE_PIXELS})`);
    }
    return pixels;
}
function isByteArray(data) {
    return data instanceof Uint8Array || data instanceof Uint8ClampedArray;
}
function validateByteData(data, expected, label) {
    if (!isByteArray(data) && !Array.isArray(data)) {
        throw new NotFoundError(`${label} must be a Uint8Array, Uint8ClampedArray, or number[]`);
    }
    if (!Number.isSafeInteger(data.length) || data.length < expected) {
        throw new NotFoundError(`${label} is shorter than the required ${expected} bytes`);
    }
    if (Array.isArray(data)) {
        for (let i = 0; i < expected; i++) {
            const value = data[i];
            if (!Number.isInteger(value) || value < 0 || value > 255) {
                throw new NotFoundError(`${label} contains a non-byte value at index ${i}`);
            }
        }
    }
}
/**
 * @typedef {object} ImageLike
 * @property {Uint8ClampedArray | Uint8Array | number[]} data RGBA, 4 bytes per pixel.
 * @property {number} width
 * @property {number} height
 */
export class LuminanceSource {
    /**
     * @param {Uint8Array} grey One byte per pixel.
     * @param {number} width
     * @param {number} height
     */
    constructor(grey, width, height) {
        const pixels = validateDimensions(width, height);
        if (!isByteArray(grey) || grey.length < pixels) {
            throw new NotFoundError(`Greyscale buffer is shorter than the required ${pixels} bytes`);
        }
        this.grey = grey;
        this.width = width;
        this.height = height;
    }
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
    static fromImageData(image) {
        if (!image || typeof image !== 'object') {
            throw new NotFoundError('Image must be an object with RGBA data');
        }
        const { data, width, height } = image;
        const pixels = validateDimensions(width, height);
        const expected = pixels * 4;
        validateByteData(data, expected, 'Image data');
        const grey = new Uint8Array(pixels);
        for (let i = 0, p = 0; i < grey.length; i++, p += 4) {
            const a = data[p + 3];
            let r = data[p], g = data[p + 1], b = data[p + 2];
            if (a !== 255) {
                // Composite over white.
                const inv = 255 - a;
                r = (r * a + 255 * inv) / 255;
                g = (g * a + 255 * inv) / 255;
                b = (b * a + 255 * inv) / 255;
            }
            // Integer luma approximation of Rec. 601: 0.299/0.587/0.114 scaled by 256.
            grey[i] = (r * 77 + g * 150 + b * 29) >> 8;
        }
        return new LuminanceSource(grey, width, height);
    }
    /**
     * Build directly from single-channel data, skipping conversion.
     *
     * @param {Uint8Array} grey
     * @param {number} width
     * @param {number} height
     * @returns {LuminanceSource}
     */
    static fromGrey(grey, width, height) {
        const pixels = validateDimensions(width, height);
        validateByteData(grey, pixels, 'Greyscale buffer');
        // Snapshot caller-owned data so later mutations cannot alter a decode in progress.
        const copy = Uint8Array.from(Array.isArray(grey) ? grey.slice(0, pixels) : grey.subarray(0, pixels));
        return new LuminanceSource(copy, width, height);
    }
    /**
     * @param {number} x @param {number} y
     * @returns {number} 0-255.
     */
    get(x, y) {
        return this.grey[y * this.width + x];
    }
    /**
     * @param {number} y
     * @param {Uint8Array} [out]
     * @returns {Uint8Array}
     */
    getRow(y, out) {
        if (!Number.isSafeInteger(y) || y < 0 || y >= this.height) {
            throw new RangeError(`LuminanceSource row is outside the image: ${y}`);
        }
        const row = out && out.length >= this.width ? out : new Uint8Array(this.width);
        row.set(this.grey.subarray(y * this.width, (y + 1) * this.width));
        return row;
    }
    /**
     * Rotate 90 degrees clockwise.
     *
     * The 1D readers scan horizontally, so this is how they find vertically
     * oriented barcodes: scan, rotate, scan again.
     *
     * @returns {LuminanceSource}
     */
    rotate90() {
        const { width: w, height: h, grey } = this;
        const out = new Uint8Array(grey.length);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                out[x * h + (h - 1 - y)] = grey[y * w + x];
            }
        }
        return new LuminanceSource(out, h, w);
    }
    /**
     * Downscale by an integer factor with box averaging.
     *
     * Large camera frames are slow to scan and no more informative than a
     * half-size copy; detectors use this to find candidates cheaply.
     *
     * @param {number} factor
     * @returns {LuminanceSource}
     */
    downscale(factor) {
        const f = Math.max(1, Math.floor(factor));
        if (f === 1)
            return this;
        const w = Math.floor(this.width / f);
        const h = Math.floor(this.height / f);
        const out = new Uint8Array(w * h);
        const area = f * f;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let sum = 0;
                for (let dy = 0; dy < f; dy++) {
                    const base = (y * f + dy) * this.width + x * f;
                    for (let dx = 0; dx < f; dx++)
                        sum += this.grey[base + dx];
                }
                out[y * w + x] = (sum / area) | 0;
            }
        }
        return new LuminanceSource(out, w, h);
    }
    /**
     * Invert. Some symbols are printed light-on-dark, and readers retry inverted
     * when a first pass finds nothing.
     *
     * @returns {LuminanceSource}
     */
    invert() {
        const out = new Uint8Array(this.grey.length);
        for (let i = 0; i < out.length; i++)
            out[i] = 255 - this.grey[i];
        return new LuminanceSource(out, this.width, this.height);
    }
}
