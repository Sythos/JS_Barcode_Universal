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
 * Data Matrix ECC 200 detection in a binarized image.
 *
 * An ECC 200 symbol is distinguished by two neighbouring solid finder borders
 * (the L) and two alternating clock borders.  The detector first finds dark
 * connected components, then scores every legal ECC 200 size and every
 * quarter-turn of the component's bounding quadrilateral against those four
 * borders.  This deliberately verifies the complete border rather than merely
 * looking for an L: ordinary text and table rules produce L shapes often.
 *
 * The resulting quadrilateral is sampled back into the canonical orientation:
 * solid borders at left and bottom.  It is intentionally independent of the
 * payload decoder, so geometry can be used by callers that need the matrix.
 *
 * @module datamatrix/detector
 */

import { NotFoundError } from '../core/errors.js';
import { sampleGrid, sampleQuad } from '../image/grid-sampler.js';
import { PerspectiveTransform } from '../image/perspective.js';
import { decodeDataMatrix } from './decoder.js';

// ECC 200 dimensions.  DMRE is deliberately not included: it uses a separate
// size table and is not part of the original ECC 200 family implemented here.
const SIZES = [
  [10, 10], [12, 12], [14, 14], [16, 16], [18, 18], [20, 20], [22, 22], [24, 24], [26, 26],
  [32, 32], [36, 36], [40, 40], [44, 44], [48, 48], [52, 52], [64, 64], [72, 72], [80, 80],
  [88, 88], [96, 96], [104, 104], [120, 120], [132, 132], [144, 144],
  [18, 8], [32, 8], [26, 12], [36, 12], [36, 16], [48, 16],
];

/** @typedef {{x:number, y:number}} Point */
/** @typedef {{corners: Point[], dimension: number, width: number, height: number, moduleSize: number, matrix: import('../core/bit-matrix.js').BitMatrix}} Detection */

function dark(image, x, y) {
  return image.get(Math.max(0, Math.min(image.width - 1, Math.round(x))),
    Math.max(0, Math.min(image.height - 1, Math.round(y))));
}

/** Return components which are large enough to plausibly contain a symbol. */
function components(image) {
  const seen = new Uint8Array(image.width * image.height);
  const out = [];
  const push = (x, y, xs, ys) => { xs.push(x); ys.push(y); };
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    const start = y * image.width + x;
    if (seen[start] || !image.get(x, y)) continue;
    const xs = [x], ys = [y]; seen[start] = 1;
    let head = 0, minX = x, maxX = x, minY = y, maxY = y;
    while (head < xs.length) {
      const px = xs[head], py = ys[head++];
      if (px < minX) minX = px; if (px > maxX) maxX = px;
      if (py < minY) minY = py; if (py > maxY) maxY = py;
      for (const [nx, ny] of [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]]) {
        if (nx < 0 || ny < 0 || nx >= image.width || ny >= image.height) continue;
        const at = ny * image.width + nx;
        if (!seen[at] && image.get(nx, ny)) { seen[at] = 1; push(nx, ny, xs, ys); }
      }
    }
    if (maxX - minX >= 7 && maxY - minY >= 7) out.push({ minX, minY, maxX, maxY, pixels: xs.length });
  }
  return out.sort((a, b) => b.pixels - a.pixels).slice(0, 40);
}

/** Sample a physical edge at module centres. */
function edge(image, a, b, count) {
  const values = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    values.push(dark(image, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t));
  }
  return values;
}

function solidScore(values) {
  let n = 0; for (const value of values) if (value) n++;
  return n / values.length;
}

function clockScore(values, startsDark) {
  let n = 0;
  for (let i = 0; i < values.length; i++) if (values[i] === ((i & 1) === 0 ? startsDark : !startsDark)) n++;
  return n / values.length;
}

/** Count light/dark changes along a physical edge at approximately one-pixel intervals. */
function edgeTransitions(image, a, b) {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
  let previous = dark(image, a.x, a.y);
  let changes = 0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const value = dark(image, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
    if (value !== previous) changes++;
    previous = value;
  }
  return changes;
}

/** Reject a smaller harmonic whose module-centre samples happen to alternate. */
function transitionCountFits(observed, modules) {
  const expected = modules - 1;
  const tolerance = Math.max(2, Math.floor(expected * 0.08));
  return Math.abs(observed - expected) <= tolerance;
}

function sample(image, width, height, corners, voting) {
  if (width === height) return sampleQuad(image, width, corners, voting);
  const [tl, tr, br, bl] = corners;
  const transform = PerspectiveTransform.quadToQuad(0, 0, width, 0, width, height, 0, height,
    tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y);
  return sampleGrid(image, width, height, transform);
}

/**
 * Find Data Matrix symbols in a binarized image.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} binaryImage Set bit = dark.
 * @returns {Detection | null} The strongest candidate, or null when absent.
 */
export function detectDataMatrix(binaryImage) {
  if (!binaryImage || !binaryImage.width || !binaryImage.height) {
    throw new NotFoundError('detectDataMatrix: no image supplied');
  }
  const detections = [];
  const used = new Set();
  for (const box of components(binaryImage)) {
    const base = [
      { x: box.minX, y: box.minY }, { x: box.maxX + 1, y: box.minY },
      { x: box.maxX + 1, y: box.maxY + 1 }, { x: box.minX, y: box.maxY + 1 },
    ];
    // Profile the actual ink, rather than the outer sampling quadrilateral:
    // its far x/y boundary lies one pixel beyond the last dark pixel.
    const ink = [
      { x: box.minX, y: box.minY }, { x: box.maxX, y: box.minY },
      { x: box.maxX, y: box.maxY }, { x: box.minX, y: box.maxY },
    ];
    for (const [w, h] of SIZES) for (let turn = 0; turn < 4; turn++) {
      // A 90 degree turn swaps physical width and height.
      const physicalW = (turn & 1) ? h : w, physicalH = (turn & 1) ? w : h;
      const pitchX = (box.maxX - box.minX + 1) / physicalW;
      const pitchY = (box.maxY - box.minY + 1) / physicalH;
      if (Math.min(pitchX, pitchY) < 1 || Math.abs(pitchX - pitchY) > Math.max(pitchX, pitchY) * 0.22) continue;
      const corners = base.slice(turn).concat(base.slice(0, turn));
      const profile = ink.slice(turn).concat(ink.slice(0, turn));
      // Canonical edge order: top clock, right clock, bottom solid, left solid.
      const top = edge(binaryImage, profile[0], profile[1], w);
      const right = edge(binaryImage, profile[1], profile[2], h);
      const bottom = edge(binaryImage, profile[2], profile[3], w);
      const left = edge(binaryImage, profile[3], profile[0], h);
      // Sampling only the proposed module centres aliases exact harmonics: an
      // 80-module clock border, for example, can look like a perfect 16-module
      // border.  Count transitions at image-pixel resolution as an independent
      // dimension measurement before accepting the candidate.
      if (!transitionCountFits(edgeTransitions(binaryImage, profile[0], profile[1]), w) ||
          !transitionCountFits(edgeTransitions(binaryImage, profile[1], profile[2]), h)) continue;
      // The top clock starts dark at the solid left border.  The right clock is
      // anchored dark at the solid bottom border instead, so its top phase
      // depends on the symbol height (all ECC 200 heights are even and
      // therefore start light).
      const score = (clockScore(top, true) + clockScore(right, (h & 1) === 1) +
        solidScore(bottom) + solidScore(left)) / 4;
      if (score < 0.88) continue;
      const key = `${box.minX},${box.minY},${box.maxX},${box.maxY}`;
      if (used.has(key)) continue;
      let matrix;
      try { matrix = sample(binaryImage, w, h, corners, false); } catch (e) { continue; }
      used.add(key);
      detections.push({ corners, dimension: w === h ? w : 0, width: w, height: h,
        moduleSize: (pitchX + pitchY) / 2, matrix, score });
    }
  }
  detections.sort((a, b) => b.score - a.score || b.moduleSize - a.moduleSize);
  return detections[0] ?? null;
}

/**
 * Detect and decode Data Matrix symbols.  Detection failure is normal for an
 * image without a symbol, so candidates that cannot decode are skipped.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} binaryImage
 * @returns {(import('./decoder.js').DecodeResult & {corners: Point[]}) | null}
 */
export function detectAndDecodeDataMatrix(binaryImage) {
  let detection;
  try { detection = detectDataMatrix(binaryImage); } catch (e) { return null; }
  if (!detection) return null;
  for (const voting of [false, true]) {
    let matrix = detection.matrix;
    try { if (voting) matrix = sample(binaryImage, detection.width, detection.height, detection.corners, true); } catch (e) { continue; }
    try { return Object.assign({ corners: detection.corners }, decodeDataMatrix(matrix)); }
    catch (e) { /* A geometric candidate is not necessarily a symbol. */ }
  }
  return null;
}
