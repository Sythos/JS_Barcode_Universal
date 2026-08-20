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
 * WebGL2 drawing.
 *
 * The matrix is uploaded as a one-byte-per-module R8 texture and drawn with a
 * fragment shader sampling it at NEAREST. That keeps module edges perfectly
 * sharp at any zoom, which is the property that matters — a barcode resampled
 * with interpolation stops being a barcode.
 *
 * Every entry point is failure-tolerant: no context, a lost context, a driver
 * that rejects the shader — all return false so the caller falls back to the
 * 2D path rather than showing the user nothing.
 *
 * @module render/webgl
 */
import { normalizeOptions, parseColor } from './options.js';
const VERTEX_SHADER = `#version 300 es
// A single oversized triangle covers the viewport with no vertex buffer:
// three gl_VertexID lookups, no attribute state to set up or leak.
out vec2 vUV;
void main() {
  vec2 pos = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUV = pos;
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}`;
const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;
uniform sampler2D uMatrix;
uniform vec4 uDark;
uniform vec4 uLight;
uniform vec2 uSize;
void main() {
  // Flip Y: texture row 0 is the top of the symbol, but GL's origin is bottom.
  vec2 uv = vec2(vUV.x, 1.0 - vUV.y);
  // Sample at the centre of the module, never on a boundary, so rounding
  // cannot pull a neighbouring module's value in at fractional scales.
  vec2 texel = (floor(uv * uSize) + 0.5) / uSize;
  float v = texture(uMatrix, texel).r;
  fragColor = v > 0.5 ? uDark : uLight;
}`;
/**
 * Is WebGL2 usable here?
 *
 * @returns {boolean}
 */
export function isWebGL2Available() {
    try {
        if (typeof document === 'undefined')
            return false;
        if (typeof WebGL2RenderingContext === 'undefined')
            return false;
        const probe = document.createElement('canvas');
        const gl = probe.getContext('webgl2');
        if (!gl)
            return false;
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose)
            lose.loseContext();
        return true;
    }
    catch {
        return false;
    }
}
/**
 * @param {WebGL2RenderingContext} gl
 * @param {number} type
 * @param {string} source
 * @returns {WebGLShader | null}
 */
function compile(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader)
        return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}
/**
 * Draw a matrix into a canvas with WebGL2.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 * @param {HTMLCanvasElement | OffscreenCanvas} canvas
 * @param {import('./options.js').RenderOptions} [options]
 * @returns {boolean} True if it drew; false means the caller should fall back.
 */
export function renderToCanvasWebGL(matrix, canvas, options = {}) {
    let gl = null;
    let program = null;
    let vs = null;
    let fs = null;
    let texture = null;
    let vao = null;
    try {
        const opts = normalizeOptions(matrix, options);
        const { source, pixelWidth, pixelHeight } = opts;
        gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false });
        if (!gl)
            return false;
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
        fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
        if (!vs || !fs)
            return false;
        program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS))
            return false;
        gl.useProgram(program);
        // One byte per module. R8 is the narrowest single-channel format WebGL2
        // guarantees as colour-renderable and filterable.
        const pixels = new Uint8Array(source.width * source.height);
        for (let y = 0; y < source.height; y++) {
            for (let x = 0; x < source.width; x++) {
                pixels[y * source.width + x] = source.get(x, y) ? 255 : 0;
            }
        }
        texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, source.width, source.height, 0, gl.RED, gl.UNSIGNED_BYTE, pixels);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const dark = parseColor(opts.dark).map((c) => c / 255);
        const light = parseColor(opts.light).map((c) => c / 255);
        gl.uniform1i(gl.getUniformLocation(program, 'uMatrix'), 0);
        gl.uniform4f(gl.getUniformLocation(program, 'uDark'), dark[0], dark[1], dark[2], dark[3]);
        gl.uniform4f(gl.getUniformLocation(program, 'uLight'), light[0], light[1], light[2], light[3]);
        gl.uniform2f(gl.getUniformLocation(program, 'uSize'), source.width, source.height);
        // WebGL2 still requires a bound VAO even when drawing without attributes.
        vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        gl.viewport(0, 0, pixelWidth, pixelHeight);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        return true;
    }
    catch {
        return false;
    }
    finally {
        // Release eagerly: a page generating many barcodes would otherwise hold
        // every texture until GC caught up, and GL memory is not GC's priority.
        if (gl) {
            try {
                if (vao)
                    gl.deleteVertexArray(vao);
                if (texture)
                    gl.deleteTexture(texture);
                if (program)
                    gl.deleteProgram(program);
                if (vs)
                    gl.deleteShader(vs);
                if (fs)
                    gl.deleteShader(fs);
            }
            catch {
                /* context already gone */
            }
        }
    }
}
