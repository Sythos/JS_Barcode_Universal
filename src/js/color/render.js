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
/**
 * EXPERIMENTAL — not part of the public API. See `matrix.ts`'s module
 * comment for status.
 *
 * Renders a `PolychromeMatrix` to an `ImageData`-shaped raster, the colour
 * equivalent of `render/image-data.ts`'s `toImageData`. Deliberately not
 * merged with that module: it takes a `BitMatrix` and two colours by
 * design, and forcing it to also handle an N-colour palette would blur a
 * contract every existing renderer call site relies on.
 *
 * @module color/render
 */
const MAX_RENDER_DIMENSION = 16384;
const MAX_RENDER_PIXELS = 16777216;
function boundedInteger(value, name, defaultValue, minimum, maximum) {
    const resolved = value ?? defaultValue;
    if (!Number.isSafeInteger(resolved) || resolved < minimum || resolved > maximum) {
        throw new RangeError(`Render option "${name}" must be an integer between ${minimum} and ${maximum}, got ${resolved}`);
    }
    return resolved;
}
/**
 * @param {import('./matrix.js').PolychromeMatrix} matrix
 * @param {{scale?: number, margin?: number}} [options]
 * @returns {{data: Uint8ClampedArray, width: number, height: number}}
 */
export function toColorImageData(matrix, options = {}) {
    const scale = boundedInteger(options.scale, 'scale', 8, 1, MAX_RENDER_DIMENSION);
    const margin = boundedInteger(options.margin, 'margin', 4, 0, MAX_RENDER_DIMENSION >> 1);
    const source = margin > 0 ? matrix.withMargin(margin) : matrix;
    const pixelWidth = source.width * scale;
    const pixelHeight = source.height * scale;
    const pixels = pixelWidth * pixelHeight;
    if (!Number.isSafeInteger(pixels) || pixels > MAX_RENDER_PIXELS
        || pixelWidth > MAX_RENDER_DIMENSION || pixelHeight > MAX_RENDER_DIMENSION) {
        throw new RangeError(`Render image contains too many pixels: ${pixels} (maximum ${MAX_RENDER_PIXELS})`);
    }
    const data = new Uint8ClampedArray(pixelWidth * pixelHeight * 4);
    const line = new Uint8ClampedArray(pixelWidth * 4);
    for (let my = 0; my < source.height; my++) {
        for (let mx = 0; mx < source.width; mx++) {
            const [r, g, b] = source.palette[source.get(mx, my)];
            const start = mx * scale * 4;
            for (let px = 0; px < scale; px++) {
                const p = start + px * 4;
                line[p] = r;
                line[p + 1] = g;
                line[p + 2] = b;
                line[p + 3] = 255;
            }
        }
        for (let py = 0; py < scale; py++) {
            data.set(line, ((my * scale + py) * pixelWidth) * 4);
        }
    }
    return { data, width: pixelWidth, height: pixelHeight };
}
