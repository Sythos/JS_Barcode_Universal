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
 * Output backends.
 *
 * ## On GPU acceleration — read this before assuming what it does
 *
 * The WebGL2 and WebGPU backends accelerate **drawing** a barcode, not
 * **computing** one. That distinction is worth stating plainly, because "GPU
 * barcode generation" naturally sounds like the latter.
 *
 * Encoding is sequential integer work: Reed-Solomon polynomial division, mask
 * penalty scoring, bit placement along a zig-zag path. Each step depends on the
 * one before it, which is precisely the shape a GPU cannot exploit. A complete
 * QR encode takes well under a millisecond on the CPU — less time than it takes
 * to dispatch a compute shader and read the result back. Moving it to the GPU
 * would make it slower, not faster, and no amount of engineering changes that.
 *
 * What the GPU genuinely helps with:
 *
 *   - **Drawing** large symbols, or many symbols per frame, straight into a
 *     canvas without a CPU-side pixel buffer.
 *   - **Reading**, where per-frame greyscale conversion and block statistics
 *     over a 1080p or 4K camera image are the real bottleneck and are
 *     embarrassingly parallel.
 *
 * So: encoding stays on the CPU because that is the correct engineering answer,
 * not because of a missing feature.
 *
 * @module render
 */
export { toSVG, toSVGDataURI } from './svg.js';
export { toImageData, toCanvas } from './image-data.js';
export { toPNG, toPNGDataURI, deflateStored } from './png.js';
export { isWebGL2Available, renderToCanvasWebGL } from './webgl.js';
export { isWebGPUAvailable, renderToCanvasWebGPU } from './webgpu.js';
export { normalizeOptions, parseColor } from './options.js';
import { toCanvas } from './image-data.js';
import { isWebGL2Available, renderToCanvasWebGL } from './webgl.js';
import { isWebGPUAvailable, renderToCanvasWebGPU } from './webgpu.js';
/**
 * A throwaway canvas for a GPU backend to draw on.
 *
 * @returns {HTMLCanvasElement | OffscreenCanvas | null}
 */
function createScratchCanvas() {
    try {
        if (typeof document !== 'undefined')
            return document.createElement('canvas');
        if (typeof OffscreenCanvas !== 'undefined')
            return new OffscreenCanvas(1, 1);
    }
    catch {
        /* no usable surface */
    }
    return null;
}
/**
 * Copy a finished scratch canvas onto the destination through its 2D context.
 *
 * @param {HTMLCanvasElement | OffscreenCanvas} scratch
 * @param {HTMLCanvasElement | OffscreenCanvas} canvas
 * @returns {boolean}
 */
function transferToCanvas(scratch, canvas) {
    try {
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return false;
        canvas.width = scratch.width;
        canvas.height = scratch.height;
        ctx.drawImage(scratch, 0, 0);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Can the destination still hand out a 2D context?
 *
 * It cannot if the caller already initialised it for WebGL or WebGPU. Such a
 * canvas cannot receive a copy, so the GPU backend has to draw on it directly.
 *
 * @param {HTMLCanvasElement | OffscreenCanvas} canvas
 * @returns {boolean}
 */
function hasCanvas2d(canvas) {
    try {
        return Boolean(canvas.getContext('2d'));
    }
    catch {
        return false;
    }
}
/**
 * Draw with a GPU backend on a scratch canvas, then copy the result over.
 *
 * Whatever the GPU backend does — take a context, fail halfway through shader,
 * pipeline or configure steps — only the scratch canvas is affected, so the
 * destination can still be drawn on by the next backend. A destination that
 * already holds a GPU context is drawn on directly instead.
 *
 * @param {HTMLCanvasElement | OffscreenCanvas} canvas
 * @param {(scratch: HTMLCanvasElement | OffscreenCanvas) => boolean} draw
 * @returns {boolean}
 */
function drawViaScratch(canvas, draw) {
    if (!hasCanvas2d(canvas))
        return draw(canvas);
    const scratch = createScratchCanvas();
    if (!scratch)
        return false;
    try {
        return draw(scratch) && transferToCanvas(scratch, canvas);
    }
    catch {
        return false;
    }
}
/**
 * Async counterpart of `drawViaScratch`.
 *
 * @param {HTMLCanvasElement | OffscreenCanvas} canvas
 * @param {(scratch: HTMLCanvasElement | OffscreenCanvas) => Promise<boolean>} draw
 * @returns {Promise<boolean>}
 */
async function drawViaScratchAsync(canvas, draw) {
    if (!hasCanvas2d(canvas))
        return draw(canvas);
    const scratch = createScratchCanvas();
    if (!scratch)
        return false;
    try {
        return (await draw(scratch)) && transferToCanvas(scratch, canvas);
    }
    catch {
        return false;
    }
}
/**
 * Draw into a canvas using the best backend available.
 *
 * Tries WebGL2, then the 2D context. The 2D path is always available, so this
 * never fails on a browser that can run the library at all — including every
 * version of Safari on iOS.
 *
 * WebGL2 draws on a scratch canvas that is then copied onto `canvas` with 2D
 * `drawImage`, so a failure inside the GPU path leaves `canvas` free for the
 * 2D fallback. The returned backend is the one that drew the symbol.
 *
 * WebGPU is not reachable from here, and cannot be: obtaining an adapter is
 * asynchronous, so a synchronous function can never wait for one. Use
 * `renderToCanvasAutoAsync` to include it. This one stays synchronous because
 * it is the documented signature and callers rely on the returned backend name
 * being available immediately.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 * @param {HTMLCanvasElement | OffscreenCanvas} canvas
 * @param {import('./options.js').RenderOptions & {backend?: 'auto'|'webgl2'|'2d'}} [options]
 * @returns {{backend: 'webgl2' | '2d' | 'none'}}
 */
export function renderToCanvasAuto(matrix, canvas, options = {}) {
    const preferred = options.backend ?? 'auto';
    if ((preferred === 'auto' || preferred === 'webgl2') && isWebGL2Available()) {
        if (drawViaScratch(canvas, (scratch) => renderToCanvasWebGL(matrix, scratch, options))) {
            return { backend: 'webgl2' };
        }
    }
    if (toCanvas(matrix, canvas, options))
        return { backend: '2d' };
    return { backend: 'none' };
}
/**
 * Draw into a canvas using the best backend available, including WebGPU.
 *
 * Tries WebGPU, then WebGL2, then the 2D context, and returns the name of the
 * one that drew.
 *
 * Each backend is *probed* before it is used, and the GPU backends draw on a
 * scratch canvas that is copied onto `canvas` with 2D `drawImage`. That
 * ordering is deliberate: a canvas can only ever have one kind of context, so
 * handing it to WebGPU and failing afterwards would leave it unable to fall
 * back to WebGL2 or 2D. The caller's canvas only ever gets a 2D context.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 * @param {HTMLCanvasElement | OffscreenCanvas} canvas
 * @param {import('./options.js').RenderOptions & {backend?: 'auto'|'webgpu'|'webgl2'|'2d'}} [options]
 * @returns {Promise<{backend: 'webgpu' | 'webgl2' | '2d' | 'none'}>}
 */
export async function renderToCanvasAutoAsync(matrix, canvas, options = {}) {
    const preferred = options.backend ?? 'auto';
    if (preferred === 'auto' || preferred === 'webgpu') {
        if (await isWebGPUAvailable()) {
            if (await drawViaScratchAsync(canvas, (scratch) => renderToCanvasWebGPU(matrix, scratch, options))) {
                return { backend: 'webgpu' };
            }
        }
    }
    if ((preferred === 'auto' || preferred === 'webgl2') && isWebGL2Available()) {
        if (drawViaScratch(canvas, (scratch) => renderToCanvasWebGL(matrix, scratch, options))) {
            return { backend: 'webgl2' };
        }
    }
    if (toCanvas(matrix, canvas, options))
        return { backend: '2d' };
    return { backend: 'none' };
}
