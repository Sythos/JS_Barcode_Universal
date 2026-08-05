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
 * QR Code detection — finding symbols in a binarized image.
 *
 * The whole thing hangs off one property of the finder pattern: along any line
 * through its centre, in any direction, the dark and light runs are in the
 * ratio 1:1:3:1:1. That is true horizontally, vertically and diagonally, it is
 * scale-independent, and no ordinary printed matter reproduces it by accident.
 * So the search is: scan rows for that ratio, confirm each hit by scanning the
 * column through it, cluster what survives, and look for three clusters
 * arranged in a right isoceles triangle.
 *
 * Three finders give three corners. The fourth is the problem: extrapolating
 * `topRight + bottomLeft - topLeft` assumes the symbol is a parallelogram,
 * which is only true if it was photographed square-on. For version 2 and up the
 * bottom-right alignment pattern pins that corner down properly, which is what
 * makes a tilted symbol readable. When the alignment pattern cannot be found,
 * detection degrades to the parallelogram estimate rather than failing — a
 * slightly wrong corner still decodes on a flat image, and Reed-Solomon absorbs
 * the rest.
 *
 * @module qr/detector
 */

import { NotFoundError } from '../core/errors.js';
import { PerspectiveTransform } from '../image/perspective.js';
import { sampleQuad } from '../image/grid-sampler.js';
import { decodeQR } from './decoder.js';

/** Finder pattern run ratios, centre run first in the array's own order. */
const FINDER_RATIOS = [1, 1, 3, 1, 1];

/** Alignment pattern run ratios. */
const ALIGNMENT_RATIOS = [1, 1, 1, 1, 1];

/** Smallest and largest legal symbol dimensions, in modules. */
const MIN_DIMENSION = 21;
const MAX_DIMENSION = 177;

/**
 * Do five alternating runs match the expected ratios?
 *
 * Tolerance is half a module, scaled by the ratio, which is the widest band
 * that still rejects ordinary text and rules while accepting the blur and
 * rounding of a real scan.
 *
 * @param {number[]} counts Five run lengths, dark first.
 * @param {number[]} ratios
 * @returns {number} The implied module size, or 0 if the ratios do not match.
 */
function matchRatios(counts, ratios) {
  let total = 0;
  let units = 0;
  for (let i = 0; i < 5; i++) {
    if (counts[i] === 0) return 0;
    total += counts[i];
    units += ratios[i];
  }
  if (total < units) return 0;

  const moduleSize = total / units;
  const tolerance = moduleSize / 2;
  for (let i = 0; i < 5; i++) {
    if (Math.abs(counts[i] - moduleSize * ratios[i]) > tolerance * ratios[i]) return 0;
  }
  return moduleSize;
}

/**
 * Scan one row for the finder run ratio.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} image
 * @param {number} y
 * @param {number[]} ratios
 * @param {(centreX: number, moduleSize: number) => void} onHit
 */
function scanRow(image, y, ratios, onHit) {
  const width = image.width;
  const counts = [0, 0, 0, 0, 0];
  let state = 0;

  for (let x = 0; x < width; x++) {
    const dark = image.get(x, y);

    // Even states are dark runs, odd states light.
    if (dark === ((state & 1) === 0)) {
      counts[state]++;
      continue;
    }

    // A leading light margin is not part of any pattern.
    if (state === 0 && counts[0] === 0) continue;

    if (state < 4) {
      state++;
      counts[state] = 1;
      continue;
    }

    // Five runs complete, and the sixth has begun.
    const moduleSize = matchRatios(counts, ratios);
    if (moduleSize > 0) {
      onHit(x - counts[4] - counts[3] - counts[2] / 2, moduleSize);
    }

    // Slide the window on by two runs: the trailing dark run of a rejected
    // candidate is often the leading dark run of the real one.
    counts[0] = counts[2];
    counts[1] = counts[3];
    counts[2] = counts[4];
    counts[3] = 1;
    counts[4] = 0;
    state = 3;
  }

  if (state === 4) {
    const moduleSize = matchRatios(counts, ratios);
    if (moduleSize > 0) {
      onHit(width - counts[4] - counts[3] - counts[2] / 2, moduleSize);
    }
  }
}

/**
 * Walk a line through a candidate centre and confirm the ratio holds there too.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} image
 * @param {number} x @param {number} y
 * @param {number} dx @param {number} dy Unit step defining the line.
 * @param {number[]} ratios
 * @param {number} maxRun Guard against running the length of a dark image.
 * @returns {number} Refined centre offset along the line, or NaN.
 */
function crossCheck(image, x, y, dx, dy, ratios, maxRun) {
  const width = image.width;
  const height = image.height;

  /** @returns {boolean | null} Null when the sample falls outside the image. */
  const at = (i) => {
    const px = x + dx * i;
    const py = y + dy * i;
    if (px < 0 || py < 0 || px >= width || py >= height) return null;
    return image.get(px, py);
  };

  if (at(0) !== true) return NaN;

  const counts = [0, 0, 0, 0, 0];
  let i = 0;

  // Forward from the centre: rest of the centre run, then light, then dark.
  while (at(i) === true && counts[2] < maxRun) { counts[2]++; i++; }
  if (at(i) === null) return NaN;
  const centreForward = counts[2];

  while (at(i) === false && counts[3] < maxRun) { counts[3]++; i++; }
  if (at(i) === null || counts[3] === 0) return NaN;

  while (at(i) === true && counts[4] < maxRun) { counts[4]++; i++; }
  if (counts[4] === 0) return NaN;

  // Backward from the centre.
  i = -1;
  while (at(i) === true && counts[2] < maxRun * 2) { counts[2]++; i--; }
  if (at(i) === null) return NaN;
  const centreBackward = counts[2] - centreForward;

  while (at(i) === false && counts[1] < maxRun) { counts[1]++; i--; }
  if (at(i) === null || counts[1] === 0) return NaN;

  while (at(i) === true && counts[0] < maxRun) { counts[0]++; i--; }
  if (counts[0] === 0) return NaN;

  if (matchRatios(counts, ratios) === 0) return NaN;

  // The centre run spans offsets [-centreBackward, centreForward - 1].
  return (centreForward - 1 - centreBackward) / 2;
}

/**
 * @typedef {object} Candidate
 * @property {number} x
 * @property {number} y
 * @property {number} moduleSize
 * @property {number} hits
 */

/**
 * Locate pattern centres of a given run ratio.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} image
 * @param {number[]} ratios
 * @param {number} unitsWide Modules the pattern spans (7 or 5).
 * @param {{x0: number, y0: number, x1: number, y1: number}} [region]
 * @returns {Candidate[]}
 */
function findPatterns(image, ratios, unitsWide, region) {
  /** @type {Candidate[]} */
  const found = [];

  const y0 = region ? Math.max(0, region.y0) : 0;
  const y1 = region ? Math.min(image.height, region.y1) : image.height;

  for (let y = y0; y < y1; y++) {
    scanRow(image, y, ratios, (centreX, moduleSize) => {
      if (region && (centreX < region.x0 || centreX > region.x1)) return;

      const px = Math.floor(centreX);
      const maxRun = Math.ceil(moduleSize * unitsWide);
      const offsetY = crossCheck(image, px, y, 0, 1, ratios, maxRun);
      if (Number.isNaN(offsetY)) return;

      const cy = y + offsetY;
      // Re-check horizontally at the refined row, which both confirms the hit
      // and gives a better x than the original scan line did.
      const offsetX = crossCheck(image, px, Math.round(cy), 1, 0, ratios, maxRun);
      if (Number.isNaN(offsetX)) return;

      const cx = px + offsetX;

      // Merge with an existing centre when they describe the same pattern.
      for (let i = 0; i < found.length; i++) {
        const c = found[i];
        if (
          Math.abs(c.x - cx) <= c.moduleSize &&
          Math.abs(c.y - cy) <= c.moduleSize &&
          Math.abs(c.moduleSize - moduleSize) <= Math.max(1, c.moduleSize / 2)
        ) {
          const n = c.hits + 1;
          c.x = (c.x * c.hits + cx) / n;
          c.y = (c.y * c.hits + cy) / n;
          c.moduleSize = (c.moduleSize * c.hits + moduleSize) / n;
          c.hits = n;
          return;
        }
      }

      found.push({ x: cx, y: cy, moduleSize, hits: 1 });
    });
  }

  return found;
}

/**
 * @param {{x: number, y: number}} a @param {{x: number, y: number}} b
 * @returns {number}
 */
function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Order three finder centres as top-left, top-right, bottom-left.
 *
 * The corner is the centre opposite the longest side. Which of the remaining
 * two is "top right" follows from the sign of the cross product: in image
 * coordinates, with y increasing downward, a symbol the right way round has
 * (topRight - topLeft) x (bottomLeft - topLeft) positive.
 *
 * @param {Candidate[]} three
 * @returns {{tl: Candidate, tr: Candidate, bl: Candidate} | null}
 */
function orientFinders(three) {
  const [a, b, c] = three;
  const ab = distance(a, b);
  const bc = distance(b, c);
  const ca = distance(c, a);

  let tl, p, q, hypotenuse, leg1, leg2;
  if (ab >= bc && ab >= ca) {
    tl = c; p = a; q = b; hypotenuse = ab; leg1 = ca; leg2 = bc;
  } else if (bc >= ab && bc >= ca) {
    tl = a; p = b; q = c; hypotenuse = bc; leg1 = ab; leg2 = ca;
  } else {
    tl = b; p = c; q = a; hypotenuse = ca; leg1 = bc; leg2 = ab;
  }

  if (leg1 === 0 || leg2 === 0) return null;

  // The two legs must be near enough equal, and Pythagoras must hold: this is
  // what rejects three unrelated finder-lookalikes that happen to co-occur.
  const ratio = leg1 / leg2;
  if (ratio < 0.7 || ratio > 1.4) return null;
  const expected = Math.hypot(leg1, leg2);
  if (Math.abs(hypotenuse - expected) > expected * 0.25) return null;

  const cross = (p.x - tl.x) * (q.y - tl.y) - (p.y - tl.y) * (q.x - tl.x);
  return cross >= 0 ? { tl, tr: p, bl: q } : { tl, tr: q, bl: p };
}

/**
 * Snap a measured dimension to a legal symbol size.
 *
 * Every QR dimension is 17 + 4v, so `dimension % 4 === 1`. A measurement one
 * off is rounding; two off means the module size estimate is wrong and the
 * candidate is not worth pursuing.
 *
 * @param {number} raw
 * @returns {number} 0 if it cannot be reconciled.
 */
function snapDimension(raw) {
  let d = Math.round(raw);
  switch (d & 3) {
    case 0: d--; break;
    case 2: d++; break;
    case 3: return 0;
    default: break;
  }
  if (d < MIN_DIMENSION || d > MAX_DIMENSION) return 0;
  return d;
}

/** The alignment pattern, as modules. 1 is dark. */
const ALIGNMENT_MODULES = [
  [1, 1, 1, 1, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 1, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 1, 1, 1, 1],
];

/**
 * Confirm a candidate by reading the 5x5 module block it claims to be.
 *
 * The run-ratio scan alone is not enough here. A finder pattern's 1:1:3:1:1 is
 * rare enough to stand on its own, but an alignment pattern's 1:1:1:1:1 occurs
 * constantly in ordinary data modules, so an unverified match near the expected
 * position is more likely to be payload than pattern — and a false match drags
 * the fourth corner off by several modules, which is worse than having no
 * alignment pattern at all.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} image
 * @param {number} cx @param {number} cy @param {number} moduleSize
 * @returns {boolean}
 */
function verifyAlignment(image, cx, cy, moduleSize) {
  let good = 0;
  for (let j = 0; j < 5; j++) {
    for (let i = 0; i < 5; i++) {
      const px = Math.round(cx + (i - 2) * moduleSize);
      const py = Math.round(cy + (j - 2) * moduleSize);
      if (px < 0 || py < 0 || px >= image.width || py >= image.height) return false;
      if (image.get(px, py) === (ALIGNMENT_MODULES[j][i] === 1)) good++;
    }
  }
  // Allow two modules of slop for blur and sampling, but no more.
  return good >= 23;
}

/**
 * Look for the bottom-right alignment pattern near where the geometry predicts.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} image
 * @param {{x: number, y: number}} expected
 * @param {number} moduleSize
 * @returns {{x: number, y: number} | null}
 */
function findAlignment(image, expected, moduleSize) {
  // Three modules of slack. The parallelogram estimate is good to well under
  // that on any symbol flat enough to decode, and a wider net only admits more
  // data modules as candidates.
  const radius = Math.max(3, Math.ceil(moduleSize * 3));
  const region = {
    x0: expected.x - radius,
    x1: expected.x + radius,
    y0: Math.floor(expected.y - radius),
    y1: Math.ceil(expected.y + radius),
  };

  const found = findPatterns(image, ALIGNMENT_RATIOS, 5, region);

  let best = null;
  let bestDistance = Infinity;
  for (let i = 0; i < found.length; i++) {
    // The alignment pattern is 5 modules across, so its implied module size
    // should agree with the one the finders reported.
    if (found[i].moduleSize > moduleSize * 1.5 || found[i].moduleSize < moduleSize / 1.5) continue;
    if (!verifyAlignment(image, found[i].x, found[i].y, moduleSize)) continue;
    const d = distance(found[i], expected);
    if (d < bestDistance) {
      bestDistance = d;
      best = found[i];
    }
  }

  // Last resort: the pattern is exactly where predicted but its runs were
  // mangled by blur. Reading the modules directly still confirms it.
  if (!best && verifyAlignment(image, expected.x, expected.y, moduleSize)) {
    best = { x: expected.x, y: expected.y };
  }

  return best;
}

/**
 * @typedef {object} Detection
 * @property {Array<{x: number, y: number}>} corners Outer corners of the
 *   symbol, ordered top-left, top-right, bottom-right, bottom-left.
 * @property {number} dimension Modules per side.
 * @property {number} version
 * @property {number} moduleSize Estimated pixels per module.
 * @property {boolean} alignmentFound
 */

/**
 * Find QR Code symbols in a binarized image.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} binaryImage Set bit = dark.
 * @returns {Detection[]} Possibly empty; ordered by descending module size, so
 *   the most prominent symbol comes first.
 */
export function detectQR(binaryImage) {
  if (!binaryImage || !binaryImage.width) {
    throw new NotFoundError('detectQR: no image supplied');
  }

  const finders = findPatterns(binaryImage, FINDER_RATIOS, 7);
  // A single stray row hit is noise; a real finder is crossed many times.
  const solid = finders.filter((f) => f.hits >= 2);
  const pool = solid.length >= 3 ? solid : finders;
  if (pool.length < 3) return [];

  // Prefer the largest patterns, and cap the combinatorics on noisy images.
  pool.sort((a, b) => b.moduleSize - a.moduleSize || b.hits - a.hits);
  const limit = Math.min(pool.length, 12);

  /** @type {Detection[]} */
  const detections = [];
  const used = new Set();

  for (let i = 0; i < limit; i++) {
    for (let j = i + 1; j < limit; j++) {
      for (let k = j + 1; k < limit; k++) {
        const three = [pool[i], pool[j], pool[k]];

        // All three finders belong to one symbol, so they share a module size.
        const sizes = three.map((f) => f.moduleSize);
        if (Math.max(...sizes) > Math.min(...sizes) * 1.6) continue;

        const oriented = orientFinders(three);
        if (!oriented) continue;

        const { tl, tr, bl } = oriented;
        const moduleSize = (tl.moduleSize + tr.moduleSize + bl.moduleSize) / 3;
        if (moduleSize <= 0) continue;

        // Centre-to-centre spans dimension - 7 modules.
        const across = (distance(tl, tr) + distance(tl, bl)) / 2;
        const dimension = snapDimension(across / moduleSize + 7);
        if (dimension === 0) continue;

        const version = (dimension - 17) / 4;
        if (version < 1 || version > 40) continue;

        const key = `${Math.round(tl.x)},${Math.round(tl.y)},${dimension}`;
        if (used.has(key)) continue;
        used.add(key);

        detections.push(
          buildDetection(binaryImage, tl, tr, bl, dimension, version, moduleSize)
        );
      }
    }
  }

  detections.sort((a, b) => b.moduleSize - a.moduleSize);
  return detections;
}

/**
 * Turn three finder centres into four symbol corners.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} image
 * @param {Candidate} tl @param {Candidate} tr @param {Candidate} bl
 * @param {number} dimension @param {number} version @param {number} moduleSize
 * @returns {Detection}
 */
function buildDetection(image, tl, tr, bl, dimension, version, moduleSize) {
  const d = dimension;
  // Finder centres sit on module (3, 3) and friends, so at grid coordinate 3.5.
  const gridTl = [3.5, 3.5];
  const gridTr = [d - 3.5, 3.5];
  const gridBl = [3.5, d - 3.5];

  // Parallelogram estimate of the far corner, used both as the search seed for
  // the alignment pattern and as the fallback when it is not there.
  const guess = { x: tr.x + bl.x - tl.x, y: tr.y + bl.y - tl.y };

  /** @type {PerspectiveTransform | null} */
  let transform = null;
  let alignmentFound = false;

  if (version >= 2) {
    // The bottom-right alignment pattern is centred on module (d - 7, d - 7).
    const gridAlign = [d - 6.5, d - 6.5];
    // Where that module lands under the parallelogram assumption.
    const seed = {
      x: tl.x + ((gridAlign[0] - 3.5) / (d - 7)) * (tr.x - tl.x) +
        ((gridAlign[1] - 3.5) / (d - 7)) * (bl.x - tl.x),
      y: tl.y + ((gridAlign[0] - 3.5) / (d - 7)) * (tr.y - tl.y) +
        ((gridAlign[1] - 3.5) / (d - 7)) * (bl.y - tl.y),
    };

    const align = findAlignment(image, seed, moduleSize);
    if (align) {
      alignmentFound = true;
      transform = PerspectiveTransform.quadToQuad(
        gridTl[0], gridTl[1], gridTr[0], gridTr[1], gridAlign[0], gridAlign[1], gridBl[0], gridBl[1],
        tl.x, tl.y, tr.x, tr.y, align.x, align.y, bl.x, bl.y
      );
    }
  }

  const plain = PerspectiveTransform.quadToQuad(
    gridTl[0], gridTl[1], gridTr[0], gridTr[1], d - 3.5, d - 3.5, gridBl[0], gridBl[1],
    tl.x, tl.y, tr.x, tr.y, guess.x, guess.y, bl.x, bl.y
  );

  const corners = cornersOf(transform ?? plain, d);
  // Keep the parallelogram corners as a second opinion whenever an alignment
  // pattern steered the first set. Verification makes a false match unlikely,
  // not impossible, and one extra sampling attempt is far cheaper than losing
  // a symbol to it.
  const altCorners = transform ? cornersOf(plain, d) : null;

  return { corners, altCorners, dimension, version, moduleSize, alignmentFound };
}

/**
 * The four outer corners of the symbol under a grid-to-image transform.
 *
 * @param {PerspectiveTransform} transform @param {number} d
 * @returns {Array<{x: number, y: number}>}
 */
function cornersOf(transform, d) {
  return [
    transform.transformPoint(0, 0),
    transform.transformPoint(d, 0),
    transform.transformPoint(d, d),
    transform.transformPoint(0, d),
  ];
}

/**
 * Find and decode every QR Code in a binarized image.
 *
 * Each candidate gets up to four attempts: a plain centre sample, a 3x3
 * majority vote for noisy input, and both of those rotated 180 degrees. The
 * rotation retry matters because three finders in a right isoceles triangle
 * look identical to the same three rotated half a turn — the orientation is
 * only settled once the format information reads cleanly, which is to say once
 * the decode succeeds.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} binaryImage
 * @returns {Array<import('./decoder.js').DecodeResult & {corners: Array<{x: number, y: number}>}>}
 *   Empty when nothing decodes; never throws for "no symbol here".
 */
export function detectAndDecodeQR(binaryImage) {
  let detections;
  try {
    detections = detectQR(binaryImage);
  } catch (e) {
    return [];
  }

  const results = [];
  const seen = new Set();

  for (let i = 0; i < detections.length; i++) {
    const det = detections[i];

    for (let attempt = 0; attempt < 4; attempt++) {
      const voting = attempt === 1 || attempt === 3;
      const rotated = attempt >= 2;

      let matrix;
      try {
        matrix = sampleQuad(binaryImage, det.dimension, det.corners, voting);
      } catch (e) {
        continue;
      }
      if (rotated) matrix.rotate180();

      try {
        const result = decodeQR(matrix);
        // The same symbol can be detected through more than one finder triple.
        const key = `${result.version}|${result.text}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push(Object.assign({ corners: det.corners }, result));
        }
        break;
      } catch (e) {
        /* Try the next sampling strategy. */
      }
    }
  }

  return results;
}
