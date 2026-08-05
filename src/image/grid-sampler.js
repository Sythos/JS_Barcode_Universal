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
 * Resample a distorted symbol in the image into an upright module grid.
 *
 * Given a transform that maps grid coordinates to image coordinates, this
 * samples the centre of every module. Sampling centres rather than averaging
 * whole cells is deliberate: module edges are where blur and bleed live, and
 * including them turns a marginal symbol into an unreadable one.
 *
 * @module image/grid-sampler
 */

import { BitMatrix } from '../core/bit-matrix.js';
import { NotFoundError } from '../core/errors.js';
import { PerspectiveTransform } from './perspective.js';

/**
 * Sample a `dimension` x `dimension` grid (or `width` x `height`).
 *
 * @param {BitMatrix} image Binarized source image.
 * @param {number} width Modules across.
 * @param {number} height Modules down.
 * @param {PerspectiveTransform} transform Grid space -> image space.
 * @returns {BitMatrix}
 * @throws {NotFoundError} If the grid falls outside the image.
 */
export function sampleGrid(image, width, height, transform) {
  const out = new BitMatrix(width, height);
  const points = new Float32Array(width * 2);

  for (let y = 0; y < height; y++) {
    // Module centres: offset by half a module in both axes.
    const gridY = y + 0.5;
    for (let x = 0; x < width; x++) {
      points[x * 2] = x + 0.5;
      points[x * 2 + 1] = gridY;
    }
    transform.transform(points);

    for (let x = 0; x < width; x++) {
      const px = points[x * 2] | 0;
      const py = points[x * 2 + 1] | 0;
      if (px < 0 || py < 0 || px >= image.width || py >= image.height) {
        throw new NotFoundError(
          `Sampling grid escapes the image at module (${x}, ${y})`
        );
      }
      if (image.get(px, py)) out.set(x, y);
    }
  }

  return out;
}

/**
 * Sample with a 3x3 majority vote per module.
 *
 * Slower, and worth it when a single-point sample lands on a speck of noise or
 * a JPEG artefact. Readers fall back to this after a clean sample fails to
 * decode, rather than paying for it on every attempt.
 *
 * @param {BitMatrix} image
 * @param {number} width
 * @param {number} height
 * @param {PerspectiveTransform} transform
 * @returns {BitMatrix}
 */
export function sampleGridVoting(image, width, height, transform) {
  const out = new BitMatrix(width, height);

  // Spacing between module centres, measured in image pixels, so the vote
  // spreads across the module rather than a fixed pixel radius that would be
  // meaningless at a different scale.
  const p0 = transform.transformPoint(0.5, 0.5);
  const p1 = transform.transformPoint(1.5, 0.5);
  const p2 = transform.transformPoint(0.5, 1.5);
  const stepX = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  const stepY = Math.hypot(p2.x - p0.x, p2.y - p0.y);
  const rx = Math.max(1, Math.round(stepX / 4));
  const ry = Math.max(1, Math.round(stepY / 4));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = transform.transformPoint(x + 0.5, y + 0.5);
      const cx = c.x | 0;
      const cy = c.y | 0;
      if (cx < 0 || cy < 0 || cx >= image.width || cy >= image.height) {
        throw new NotFoundError(
          `Sampling grid escapes the image at module (${x}, ${y})`
        );
      }

      let dark = 0;
      let total = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const sx = cx + dx * rx;
          const sy = cy + dy * ry;
          if (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height) continue;
          total++;
          if (image.get(sx, sy)) dark++;
        }
      }
      if (total > 0 && dark * 2 > total) out.set(x, y);
    }
  }

  return out;
}

/**
 * Build the transform for a symbol whose four corners are known, and sample it.
 *
 * Corners are in reading order: top-left, top-right, bottom-right, bottom-left.
 *
 * @param {BitMatrix} image
 * @param {number} dimension Modules per side.
 * @param {Array<{x: number, y: number}>} corners
 * @param {boolean} [voting]
 * @returns {BitMatrix}
 */
export function sampleQuad(image, dimension, corners, voting = false) {
  if (corners.length !== 4) throw new NotFoundError('sampleQuad needs exactly 4 corners');
  const [tl, tr, br, bl] = corners;
  const d = dimension;

  const transform = PerspectiveTransform.quadToQuad(
    0, 0, d, 0, d, d, 0, d,
    tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y
  );

  return voting
    ? sampleGridVoting(image, d, d, transform)
    : sampleGrid(image, d, d, transform);
}
