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
 * Raster output as ImageData, and 2D-canvas drawing.
 *
 * @module render/image-data
 */
import { normalizeOptions, parseColor } from './options.js';
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
export function toImageData(matrix, options = {}) {
    const opts = normalizeOptions(matrix, options);
    const { scale, source, pixelWidth, pixelHeight } = opts;
    const dark = parseColor(opts.dark);
    const light = parseColor(opts.light);
    const data = new Uint8ClampedArray(pixelWidth * pixelHeight * 4);
    // Fill one scanline per module row, then copy it `scale` times. Barcodes are
    // wide and repetitive, so this is markedly faster than a per-pixel loop.
    const line = new Uint8ClampedArray(pixelWidth * 4);
    for (let my = 0; my < source.height; my++) {
        for (let mx = 0; mx < source.width; mx++) {
            const colour = source.get(mx, my) ? dark : light;
            const start = mx * scale * 4;
            for (let px = 0; px < scale; px++) {
                const p = start + px * 4;
                line[p] = colour[0];
                line[p + 1] = colour[1];
                line[p + 2] = colour[2];
                line[p + 3] = colour[3];
            }
        }
        for (let py = 0; py < scale; py++) {
            data.set(line, ((my * scale + py) * pixelWidth) * 4);
        }
    }
    return { data, width: pixelWidth, height: pixelHeight };
}
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
export function toCanvas(matrix, canvas, options = {}) {
    const opts = normalizeOptions(matrix, options);
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return false;
    canvas.width = opts.pixelWidth;
    canvas.height = opts.pixelHeight;
    // Draw with fillRect rather than putImageData: it respects the canvas's
    // alpha compositing, so a transparent `light` leaves the page showing
    // through instead of punching a hole.
    const [, , , lightAlpha] = parseColor(opts.light);
    if (lightAlpha > 0) {
        ctx.fillStyle = opts.light;
        ctx.fillRect(0, 0, opts.pixelWidth, opts.pixelHeight);
    }
    else {
        ctx.clearRect(0, 0, opts.pixelWidth, opts.pixelHeight);
    }
    ctx.fillStyle = opts.dark;
    const { source, scale } = opts;
    for (let y = 0; y < source.height; y++) {
        let x = 0;
        while (x < source.width) {
            if (!source.get(x, y)) {
                x++;
                continue;
            }
            let run = 1;
            while (x + run < source.width && source.get(x + run, y))
                run++;
            ctx.fillRect(x * scale, y * scale, run * scale, scale);
            x += run;
        }
    }
    return true;
}
