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
 * Aztec image detection.
 *
 * Aztec has no finder pattern at its outer border. Its reliable geometric
 * anchor is instead the alternating square bull's-eye in the centre: five
 * rings in Compact symbols, seven rings in Full symbols. The detector finds
 * isolated central modules, verifies those rings at module centres, then
 * samples each legal symbol dimension. The decoder is deliberately the final
 * arbiter: its mode-message Reed--Solomon check rejects accidental concentric
 * artwork and tells us which of the compact/full dimensions is real.
 *
 * Sampling uses a quadrilateral, not a cropped bitmap, so the detected
 * rotation is corrected before decoding. The ring search covers arbitrary
 * in-plane rotations (four-degree coarse search; at normal camera scales its
 * positional error remains well inside a module). The optional inverse pass
 * supports light modules on a dark field.
 *
 * @module aztec/detector
 */

import { NotFoundError } from '../core/errors.js';
import { sampleQuad } from '../image/grid-sampler.js';
import { decodeAztec } from './decoder.js';

/** @typedef {{x:number, y:number}} Point */
/** @typedef {{corners: Point[], dimension: number, compact: boolean, moduleSize: number, matrix: import('../core/bit-matrix.js').BitMatrix}} Detection */

// Compact: 11 + 4 layers. Full symbols add reference-grid rows/columns every
// 15 modules measured from their central 14-module base, not every 15 layers.
const DIMENSIONS = [
  ...[1, 2, 3, 4].map((layers) => ({ compact: true, dimension: 11 + 4 * layers })),
  ...Array.from({ length: 32 }, (_, index) => {
    const layers = index + 1;
    return { compact: false, dimension: 15 + 4 * layers + 2 * Math.floor((2 * layers + 6) / 15) };
  }),
];

function pixel(image, x, y) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  return ix >= 0 && iy >= 0 && ix < image.width && iy < image.height && image.get(ix, iy);
}

/** Connected components of either polarity, retaining only plausible modules. */
function components(image, value) {
  const seen = new Uint8Array(image.width * image.height);
  const out = [];
  const maximumArea = Math.max(4, Math.floor(image.width * image.height * 0.08));
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    const start = y * image.width + x;
    if (seen[start] || image.get(x, y) !== value) continue;
    const xs = [x];
    const ys = [y];
    seen[start] = 1;
    let head = 0;
    let minX = x; let maxX = x; let minY = y; let maxY = y;
    while (head < xs.length) {
      const px = xs[head]; const py = ys[head++];
      if (px < minX) minX = px; if (px > maxX) maxX = px;
      if (py < minY) minY = py; if (py > maxY) maxY = py;
      for (const [nx, ny] of [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]]) {
        if (nx < 0 || ny < 0 || nx >= image.width || ny >= image.height) continue;
        const at = ny * image.width + nx;
        if (!seen[at] && image.get(nx, ny) === value) {
          seen[at] = 1; xs.push(nx); ys.push(ny);
        }
      }
    }
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    const area = width * height;
    // The central module is solid and approximately square. This filter is
    // intentionally permissive because a rotated raster module is diamond-ish.
    if (xs.length <= maximumArea && Math.abs(width - height) <= Math.max(1, Math.ceil(Math.max(width, height) * 0.35)) &&
      xs.length >= area * 0.45) {
      out.push({ x: (minX + maxX) / 2, y: (minY + maxY) / 2, width, height, pixels: xs.length });
    }
  }
  return out.sort((a, b) => b.pixels - a.pixels).slice(0, 2000);
}

function expectedDark(ring, inverted) {
  return inverted ? (ring & 1) === 1 : (ring & 1) === 0;
}

/** Score one square bull's-eye at an angle and a candidate module pitch. */
function ringScore(image, centre, pitch, angle, inverted, rings) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  let correct = 0;
  let total = 0;
  for (let ring = 0; ring < rings; ring++) {
    const wanted = expectedDark(ring, inverted);
    for (let j = -ring; j <= ring; j++) for (let i = -ring; i <= ring; i++) {
      if (ring && Math.abs(i) !== ring && Math.abs(j) !== ring) continue;
      const x = centre.x + (i * cos - j * sin) * pitch;
      const y = centre.y + (i * sin + j * cos) * pitch;
      if (pixel(image, x, y) === wanted) correct++;
      total++;
    }
  }
  return correct / total;
}

function rotateCorners(corners, turn) {
  return corners.slice(turn).concat(corners.slice(0, turn));
}

function invert(matrix) {
  const out = matrix.clone();
  for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) out.flip(x, y);
  return out;
}

function cornersFor(centre, pitch, angle, dimension) {
  const half = dimension * pitch / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const point = (x, y) => ({ x: centre.x + x * cos - y * sin, y: centre.y + x * sin + y * cos });
  return [point(-half, -half), point(half, -half), point(half, half), point(-half, half)];
}

/**
 * Find an Aztec symbol in a binarized image.
 *
 * The returned matrix is in the orientation accepted by the Aztec decoder.
 * A valid mode message is required before a geometric candidate is returned,
 * making false positives from decorative concentric squares very unlikely.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} binaryImage Set bit = dark.
 * @returns {Detection | null}
 */
export function detectAztec(binaryImage) {
  if (!binaryImage || !binaryImage.width || !binaryImage.height) {
    throw new NotFoundError('detectAztec: no image supplied');
  }
  const candidates = [];
  for (const inverted of [false, true]) {
    for (const core of components(binaryImage, !inverted)) {
      // A non-rotated one-module component directly gives its pitch. For
      // rotated modules its bounding box grows by |sin| + |cos|, compensated
      // below for every tested angle.
      for (let degrees = 0; degrees < 180; degrees += 4) {
        const angle = degrees * Math.PI / 180;
        const scale = Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle));
        const pitch = ((core.width + core.height) / 2) / scale;
        if (pitch < 0.8) continue;
        // Test Full first: its seven rings also exclude Compact candidates.
        const fullScore = ringScore(binaryImage, core, pitch, angle, inverted, 7);
        const rings = fullScore >= 0.88 ? 7 : 5;
        const score = rings === 7 ? fullScore : ringScore(binaryImage, core, pitch, angle, inverted, 5);
        if (score < 0.91) continue;
        const symbolKinds = rings === 7 ? DIMENSIONS.filter((item) => !item.compact) : DIMENSIONS.filter((item) => item.compact);
        for (const kind of symbolKinds) {
          const baseCorners = cornersFor(core, pitch, angle, kind.dimension);
          for (let turn = 0; turn < 4; turn++) {
            const corners = rotateCorners(baseCorners, turn);
            let matrix;
            try { matrix = sampleQuad(binaryImage, kind.dimension, corners); } catch (e) { continue; }
            if (inverted) matrix = invert(matrix);
            try {
              // The decoder verifies the mode-message ECC and exact geometry.
              // We do not expose its result here so callers can use pure
              // detection without treating payload decoding as an API contract.
              decodeAztec(matrix);
              candidates.push({ corners, dimension: kind.dimension, compact: kind.compact,
                moduleSize: pitch, matrix, score });
            } catch (e) { /* Not an Aztec mode message at this dimension. */ }
          }
        }
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score || b.moduleSize - a.moduleSize);
  const best = candidates[0];
  if (!best) return null;
  delete best.score;
  return best;
}

/**
 * Detect then decode an Aztec symbol. Detection failure is a normal result for
 * images without an Aztec code, therefore invalid candidates return null.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} binaryImage
 * @returns {(import('./decoder.js').DecodeResult & {corners: Point[]}) | null}
 */
export function detectAndDecodeAztec(binaryImage) {
  let detection;
  try { detection = detectAztec(binaryImage); } catch (e) { return null; }
  if (!detection) return null;
  try { return Object.assign({ corners: detection.corners }, decodeAztec(detection.matrix)); }
  catch (e) { return null; }
}
