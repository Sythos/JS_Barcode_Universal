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
 * Classifies a known module grid in a *raw* (not binarized) RGBA image
 * against a fixed palette, the colour equivalent of
 * `image/grid-sampler.ts`'s `sampleGridVoting` for `BitMatrix`. This is
 * deliberately built on the existing `PerspectiveTransform` rather than a
 * new geometry primitive, so a future detector can hand it the same
 * four-corner shape every other format's detector already produces.
 *
 * What this does NOT do, and is the largest open piece of real-world
 * readiness: locate the symbol in an arbitrary photo. Every other format in
 * this SDK pairs its sampler with a `detect*` module that finds the
 * symbol's position/orientation first; no colour-aware equivalent exists
 * yet. This module only classifies a grid whose corners are already known
 * (e.g. supplied by a caller, or a future detector).
 *
 * The classifier itself is a first pass: average RGB over a sampling
 * window per module, nearest-colour match in plain Euclidean RGB space.
 * That is a real, working starting point, not a finished algorithm —
 * lighting colour temperature, print dye variation and camera white
 * balance can all shift real photos in ways Euclidean RGB does not model
 * well. Whether it holds up is exactly what needs field validation with
 * real printed samples and real cameras, not synthetic images.
 *
 * @module color/classify
 */

import { NotFoundError } from '../core/errors.js';
import { PolychromeMatrix } from './matrix.js';

/**
 * Squared Euclidean distance in RGB space. Squared, not the true distance,
 * because only relative ordering matters for a nearest-match and the square
 * root would be pure waste run once per module per palette entry.
 */
function distanceSquared(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

function nearestPaletteIndex(sample, palette) {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const d = distanceSquared(sample, palette[i]);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best;
}

/**
 * Sample and classify a `width` x `height` grid.
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} image Raw RGBA, NOT binarized.
 * @param {number} width Modules across.
 * @param {number} height Modules down.
 * @param {import('../image/perspective.js').PerspectiveTransform} transform Grid space -> image space.
 * @param {readonly [number, number, number][]} palette
 * @returns {PolychromeMatrix}
 */
export function classifyGrid(image, width, height, transform, palette) {
  const out = new PolychromeMatrix(width, height, palette);

  // Window radius in image pixels, derived from the actual module pitch so
  // it stays meaningful regardless of render/photo scale — the same idea
  // `sampleGridVoting` uses for its vote radius.
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
        throw new NotFoundError(`Sampling grid escapes the image at module (${x}, ${y})`);
      }

      let sumR = 0, sumG = 0, sumB = 0, count = 0;
      for (let dy = -ry; dy <= ry; dy++) {
        for (let dx = -rx; dx <= rx; dx++) {
          const sx = cx + dx;
          const sy = cy + dy;
          if (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height) continue;
          const p = (sy * image.width + sx) * 4;
          sumR += image.data[p];
          sumG += image.data[p + 1];
          sumB += image.data[p + 2];
          count++;
        }
      }
      const sample = count > 0
        ? [sumR / count, sumG / count, sumB / count]
        : [image.data[(cy * image.width + cx) * 4], image.data[(cy * image.width + cx) * 4 + 1], image.data[(cy * image.width + cx) * 4 + 2]];

      out.set(x, y, nearestPaletteIndex(sample, palette));
    }
  }

  return out;
}
