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

import { BitMatrix } from '../core/bit-matrix.js';
import { NotFoundError } from '../core/errors.js';
import { decodeRMQR } from './decoder.js';
import { versionForSize } from './tables.js';

function rotate90(source) {
  const out = new BitMatrix(source.height, source.width);
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) if (source.get(x, y)) out.set(source.height - 1 - y, x);
  return out;
}
function rotate180(source) { const out = new BitMatrix(source.width, source.height); for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) if (source.get(x, y)) out.set(source.width - 1 - x, source.height - 1 - y); return out; }
function rotate270(source) { return rotate90(rotate180(source)); }
function crop(source, box) {
  const out = new BitMatrix(box.width, box.height); for (let y = 0; y < box.height; y++) for (let x = 0; x < box.width; x++) if (source.get(box.x + x, box.y + y)) out.set(x, y); return out;
}
function sample(matrix, width, height, scale, offsetX, offsetY) {
  const out = new BitMatrix(width, height); const half = Math.max(0, Math.floor(scale / 2));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let dark = 0, count = 0; const x0 = offsetX + x * scale, y0 = offsetY + y * scale;
    for (let yy = 0; yy < scale; yy++) for (let xx = 0; xx < scale; xx++) { if (matrix.get(x0 + xx, y0 + yy)) dark++; count++; }
    if (dark * 2 >= count) out.set(x, y);
  }
  return out;
}
function bounds(matrix) { return matrix.getBounds(); }

/** Detect an axis-aligned, clean rMQR raster and return the exact module matrix. */
export function detectRMQR(image, options = {}) {
  if (!image || !image.width || !image.height) throw new NotFoundError('rMQR: no raster supplied');
  if (options.perspective) throw new NotFoundError('rMQR: perspective detection is not available for clean-raster mode');
  const orientations = [image, rotate90(image), rotate180(image), rotate270(image)];
  for (let rotation = 0; rotation < orientations.length; rotation++) {
    const source = orientations[rotation]; const box = bounds(source); if (!box) continue;
    for (let version = 1; version <= 32; version++) {
      const v = versionForSize(box.width, box.height); // exact modules, scale 1
      if (v && v.version === version) {
        try { const matrix = crop(source, box); const result = decodeRMQR(matrix); return { matrix, result, rotation, corners: { x: box.x, y: box.y, width: box.width, height: box.height } }; } catch { /* try next orientation/candidate */ }
      }
      // Integer nearest-neighbour scale. The dark bounding box must still be an
      // exact multiple of the standard geometry; this rejects arbitrary text.
      const candidate = versionForSize(box.width, box.height);
      if (candidate) continue;
      const canonical = (awaitableVersion(version));
      const wScale = box.width / canonical.width;
      const hScale = box.height / canonical.height;
      if (!Number.isInteger(wScale) || wScale < 1 || wScale !== hScale) continue;
      const info = canonical;
      try { const matrix = sample(source, info.width, info.height, wScale, box.x, box.y); const result = decodeRMQR(matrix); return { matrix, result, rotation, scale: wScale, corners: { x: box.x, y: box.y, width: box.width, height: box.height } }; } catch { /* continue */ }
    }
  }
  throw new NotFoundError('rMQR: no clean axis-aligned symbol found');
}

function awaitableVersion(version) {
  const sizes = [[43, 7], [59, 7], [77, 7], [99, 7], [139, 7], [43, 9], [59, 9], [77, 9], [99, 9], [139, 9], [27, 11], [43, 11], [59, 11], [77, 11], [99, 11], [139, 11], [27, 13], [43, 13], [59, 13], [77, 13], [99, 13], [139, 13], [43, 15], [59, 15], [77, 15], [99, 15], [139, 15], [43, 17], [59, 17], [77, 17], [99, 17], [139, 17]];
  return { version, width: sizes[version - 1][0], height: sizes[version - 1][1] };
}

/** Detect and decode a raster in one call. */
export function detectAndDecodeRMQR(image, options = {}) { return detectRMQR(image, options).result; }
