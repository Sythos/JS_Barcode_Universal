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
 * WebGPU drawing.
 *
 * The same idea as the WebGL2 backend, expressed in WGSL: the matrix is
 * uploaded as a one-byte-per-module `r8unorm` texture and sampled with NEAREST
 * filtering, so module edges stay perfectly sharp at any size. A barcode
 * resampled with interpolation stops being a barcode, which is why the filter
 * choice is not a detail.
 *
 * Every entry point is failure-tolerant: no `navigator.gpu`, no adapter, a
 * device that refuses the shader, a lost device — all return false (or a
 * resolved false) so the caller falls back rather than showing nothing. The
 * functions here are async only because WebGPU's own setup is; nothing about
 * the drawing needs to be.
 *
 * @module render/webgpu
 */

import { normalizeOptions, parseColor } from './options.js';

/**
 * Vertex and fragment stages in one module, mirroring the WebGL2 pair.
 *
 * The vertex stage builds one oversized triangle from `vertex_index` alone:
 * three positions, no vertex buffer to allocate, bind or release.
 */
const SHADER = `
struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) uv : vec2<f32>,
};

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
  let x = f32((vertexIndex << 1u) & 2u);
  let y = f32(vertexIndex & 2u);
  var result : VertexOutput;
  result.uv = vec2<f32>(x, y);
  result.position = vec4<f32>(x * 2.0 - 1.0, y * 2.0 - 1.0, 0.0, 1.0);
  return result;
}

struct Style {
  dark : vec4<f32>,
  light : vec4<f32>,
  size : vec2<f32>,
};

@group(0) @binding(0) var moduleTexture : texture_2d<f32>;
@group(0) @binding(1) var moduleSampler : sampler;
@group(0) @binding(2) var<uniform> style : Style;

@fragment
fn fragmentMain(@location(0) quadUV : vec2<f32>) -> @location(0) vec4<f32> {
  // Flip Y: texture row 0 is the top of the symbol, but clip space puts +Y at
  // the top, so the interpolated quad coordinate runs the other way.
  let uv = vec2<f32>(quadUV.x, 1.0 - quadUV.y);
  // Sample at the centre of the module, never on a boundary, so rounding
  // cannot pull a neighbouring module's value in at fractional scales.
  let texel = (floor(uv * style.size) + vec2<f32>(0.5, 0.5)) / style.size;
  let v = textureSample(moduleTexture, moduleSampler, texel).r;
  return select(style.light, style.dark, v > 0.5);
}
`;

/**
 * The adapter and device are per-page, not per-barcode.
 *
 * Unlike a WebGL context — which the canvas owns, and which dies with it —
 * a `GPUDevice` is independent of any canvas, and requesting one is slow. A
 * page drawing a table of barcodes would otherwise pay for a full adapter
 * negotiation per symbol, and leak a device per symbol on top, because the
 * device cannot be destroyed while the canvas it configured is still on screen.
 *
 * @type {Promise<any> | null}
 */
let sharedDevice = null;

/**
 * Get the shared device, requesting one on first use.
 *
 * Never rejects: an unusable platform resolves to null.
 *
 * @returns {Promise<any>} The device, or null.
 */
function acquireDevice() {
  if (sharedDevice) return sharedDevice;

  // Hoisted so the `lost` handler below can compare against this exact
  // promise, and never clear a newer one that has replaced it.
  function forget() {
    if (sharedDevice === pending) sharedDevice = null;
  }

  const pending = (async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.gpu) return null;
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        forget();
        return null;
      }
      const device = await adapter.requestDevice();
      if (!device) {
        forget();
        return null;
      }
      // A lost device can never be revived, so drop it and let the next
      // render ask for a fresh one instead of failing forever.
      if (device.lost && typeof device.lost.then === 'function') {
        device.lost.then(forget, forget);
      }
      return device;
    } catch {
      forget();
      return null;
    }
  })();

  sharedDevice = pending;
  return pending;
}

/**
 * Is WebGPU usable here?
 *
 * Resolves false rather than throwing on every unsupported path, including
 * Node, where there is no `navigator.gpu` at all.
 *
 * @returns {Promise<boolean>}
 */
export async function isWebGPUAvailable() {
  try {
    if (typeof navigator === 'undefined') return false;
    if (!navigator.gpu || typeof navigator.gpu.requestAdapter !== 'function') return false;
    // An adapter is the real test: `navigator.gpu` exists on machines whose
    // GPU is blocklisted, where every request still comes back null.
    const adapter = await navigator.gpu.requestAdapter();
    return Boolean(adapter);
  } catch {
    return false;
  }
}

/**
 * Did the shader compile?
 *
 * The WGSL analogue of checking `COMPILE_STATUS` in WebGL. Diagnostics are
 * optional in practice, so an implementation that cannot report them is given
 * the benefit of the doubt and the pipeline decides instead.
 *
 * @param {any} module
 * @returns {Promise<boolean>}
 */
async function compiles(module) {
  try {
    const query = module.getCompilationInfo ?? module.compilationInfo;
    if (typeof query !== 'function') return true;
    const info = await query.call(module);
    if (!info || !info.messages) return true;
    for (let i = 0; i < info.messages.length; i++) {
      if (info.messages[i].type === 'error') return false;
    }
    return true;
  } catch {
    return true;
  }
}

/**
 * Draw a matrix into a canvas with WebGPU.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 * @param {HTMLCanvasElement | OffscreenCanvas} canvas
 * @param {import('./options.js').RenderOptions} [options]
 * @returns {Promise<boolean>} True if it drew; false means the caller should
 *   fall back. Note that a canvas whose context has already been taken for
 *   WebGPU cannot then be handed to WebGL2 or 2D, so callers should probe
 *   availability before committing a canvas to this path.
 */
export async function renderToCanvasWebGPU(matrix, canvas, options = {}) {
  let device = null;
  let texture = null;
  let uniforms = null;

  try {
    if (typeof navigator === 'undefined' || !navigator.gpu) return false;

    const opts = normalizeOptions(matrix, options);
    const { source, pixelWidth, pixelHeight } = opts;

    device = await acquireDevice();
    if (!device) return false;

    // Oversized symbols are a legitimate failure, not a crash: say so and let
    // the caller fall back to a path with no texture ceiling.
    // 8192 is the floor the specification guarantees, so it is the right
    // assumption when an implementation does not report its limits.
    const maxDimension = (device.limits && device.limits.maxTextureDimension2D) || 8192;
    if (source.width > maxDimension || source.height > maxDimension) return false;

    const context = canvas.getContext('webgpu');
    if (!context) return false;

    canvas.width = pixelWidth;
    canvas.height = pixelHeight;

    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'premultiplied' });

    // One byte per module. r8unorm is the narrowest format every WebGPU
    // implementation is required to support as a sampled texture.
    const pixels = new Uint8Array(source.width * source.height);
    for (let y = 0; y < source.height; y++) {
      for (let x = 0; x < source.width; x++) {
        pixels[y * source.width + x] = source.get(x, y) ? 255 : 0;
      }
    }

    texture = device.createTexture({
      size: { width: source.width, height: source.height, depthOrArrayLayers: 1 },
      format: 'r8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    // `bytesPerRow` needs no 256-byte alignment here — that rule belongs to
    // buffer-to-texture copies, not to writeTexture's linear source data.
    device.queue.writeTexture(
      { texture },
      pixels,
      { offset: 0, bytesPerRow: source.width, rowsPerImage: source.height },
      { width: source.width, height: source.height, depthOrArrayLayers: 1 }
    );

    const sampler = device.createSampler({
      magFilter: 'nearest',
      minFilter: 'nearest',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    // The canvas is configured as premultiplied, so the colours have to be
    // too — otherwise a translucent `light` would come out too bright and a
    // fully transparent one would tint the page behind it.
    const dark = parseColor(opts.dark);
    const light = parseColor(opts.light);
    const premultiplied = (c) => {
      const a = c[3] / 255;
      return [(c[0] / 255) * a, (c[1] / 255) * a, (c[2] / 255) * a, a];
    };
    const darkF = premultiplied(dark);
    const lightF = premultiplied(light);

    // std140-style layout: two vec4 then a vec2, rounded up to the struct's
    // 16-byte alignment. 48 bytes, of which the last 8 are padding.
    const style = new Float32Array(12);
    style.set(darkF, 0);
    style.set(lightF, 4);
    style[8] = source.width;
    style[9] = source.height;

    uniforms = device.createBuffer({
      size: style.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(uniforms, 0, style);

    const shader = device.createShaderModule({ code: SHADER });
    if (!(await compiles(shader))) return false;

    // An error scope is the WGSL analogue of checking LINK_STATUS: a rejected
    // pipeline is reported here instead of surfacing later as a lost device.
    let pipeline = null;
    if (typeof device.pushErrorScope === 'function') {
      device.pushErrorScope('validation');
      pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: shader, entryPoint: 'vertexMain' },
        fragment: { module: shader, entryPoint: 'fragmentMain', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
      });
      const failure = await device.popErrorScope();
      if (failure) return false;
    } else {
      pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: shader, entryPoint: 'vertexMain' },
        fragment: { module: shader, entryPoint: 'fragmentMain', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
      });
    }
    if (!pipeline) return false;

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: texture.createView() },
        { binding: 1, resource: sampler },
        { binding: 2, resource: { buffer: uniforms } },
      ],
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();
    device.queue.submit([encoder.finish()]);

    // Wait for the draw before the `finally` below frees its inputs, so
    // returning true genuinely means the pixels are there.
    if (device.queue && typeof device.queue.onSubmittedWorkDone === 'function') {
      await device.queue.onSubmittedWorkDone();
    }

    return true;
  } catch {
    return false;
  } finally {
    // Release eagerly: a page generating many barcodes would otherwise hold
    // every texture until GC caught up, and GPU memory is not GC's priority.
    // The device itself is deliberately kept — it is shared, and destroying it
    // would blank every canvas already configured with it.
    try {
      if (texture && typeof texture.destroy === 'function') texture.destroy();
      if (uniforms && typeof uniforms.destroy === 'function') uniforms.destroy();
    } catch {
      /* device already gone */
    }
  }
}
