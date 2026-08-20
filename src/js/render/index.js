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
 * Draw into a canvas using the best backend available.
 *
 * Tries WebGL2, then the 2D context. The 2D path is always available, so this
 * never fails on a browser that can run the library at all — including every
 * version of Safari on iOS.
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
        if (renderToCanvasWebGL(matrix, canvas, options))
            return { backend: 'webgl2' };
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
 * Each backend is *probed* before the canvas is handed to it. That ordering is
 * deliberate: a canvas can only ever have one kind of context, so committing it
 * to WebGPU and failing afterwards would leave it unable to fall back to
 * WebGL2 or 2D. The probes use throwaway objects of their own, so the caller's
 * canvas is only touched by a backend that is already known to work.
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
            if (await renderToCanvasWebGPU(matrix, canvas, options))
                return { backend: 'webgpu' };
        }
    }
    if ((preferred === 'auto' || preferred === 'webgl2') && isWebGL2Available()) {
        if (renderToCanvasWebGL(matrix, canvas, options))
            return { backend: 'webgl2' };
    }
    if (toCanvas(matrix, canvas, options))
        return { backend: '2d' };
    return { backend: 'none' };
}
