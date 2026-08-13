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
 * Detector for Aztec Rune symbols.
 *
 * Rune has a fixed 11x11 geometry and a distinctive five-ring bull's-eye. This
 * detector targets binarized, module-aligned rasters (including an integer
 * scale, quiet zone and quarter turns). Arbitrary perspective and severe blur
 * remain detector-level limitations; callers needing those conditions should
 * pass a rectified 11x11 matrix to decodeAztecRune.
 *
 * @module aztecrune/detector
 */

import { NotFoundError } from '../core/errors.js';
import { BitMatrix } from '../core/bit-matrix.js';
import { decodeAztecRune } from './decoder.js';
import { AZTEC_RUNE_SIZE } from './tables.js';

/** @typedef {{x:number,y:number}} Point */

/**
 * Find connected components of a polarity. Components touching the image
 * border are ignored when they exceed the plausible module area; this avoids
 * returning the light background as a candidate while retaining an inverted
 * Rune's isolated light centre module.
 */
function components(image, value) {
  const width = image.width;
  const height = image.height;
  const seen = new Uint8Array(width * height);
  const limit = Math.max(64, Math.floor(width * height * 0.04));
  const found = [];

  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const start = y * width + x;
    if (seen[start] || image.get(x, y) !== value) continue;
    const queue = [[x, y]];
    seen[start] = 1;
    let head = 0;
    let minX = x; let maxX = x; let minY = y; let maxY = y;
    let count = 0;
    let touchesBorder = false;

    while (head < queue.length) {
      const [px, py] = queue[head++];
      count++;
      minX = Math.min(minX, px); maxX = Math.max(maxX, px);
      minY = Math.min(minY, py); maxY = Math.max(maxY, py);
      if (px === 0 || py === 0 || px === width - 1 || py === height - 1) touchesBorder = true;
      for (const [nx, ny] of [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const at = ny * width + nx;
        if (!seen[at] && image.get(nx, ny) === value) {
          seen[at] = 1;
          queue.push([nx, ny]);
        }
      }
    }

    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;
    if (count <= limit && !touchesBorder &&
      Math.abs(boxWidth - boxHeight) <= Math.max(1, Math.ceil(Math.max(boxWidth, boxHeight) * 0.35)) &&
      count >= boxWidth * boxHeight * 0.45) {
      found.push({ x: (minX + maxX) / 2, y: (minY + maxY) / 2, width: boxWidth, height: boxHeight, count });
    }
  }
  return found.sort((a, b) => b.count - a.count);
}
/** @param {import('../core/bit-matrix.js').BitMatrix} image @param {Point} center @param {number} pitch */
function sample(image, center, pitch) {
  const matrix = new BitMatrix(AZTEC_RUNE_SIZE);
  for (let y = 0; y < AZTEC_RUNE_SIZE; y++) for (let x = 0; x < AZTEC_RUNE_SIZE; x++) {
    const px = Math.round(center.x + (x - 5) * pitch);
    const py = Math.round(center.y + (y - 5) * pitch);
    if (px >= 0 && py >= 0 && px < image.width && py < image.height && image.get(px, py)) matrix.set(x, y);
  }
  return matrix;
}

function corners(center, pitch) {
  const half = AZTEC_RUNE_SIZE * pitch / 2;
  return [
    { x: center.x - half, y: center.y - half },
    { x: center.x + half, y: center.y - half },
    { x: center.x + half, y: center.y + half },
    { x: center.x - half, y: center.y + half },
  ];
}

function sameCandidate(left, right) {
  return Math.hypot(left.center.x - right.center.x, left.center.y - right.center.y) <= Math.max(left.moduleSize, right.moduleSize) * 2;
}

/**
 * Detect the most prominent Aztec Rune in a binarized image.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} binaryImage
 * @returns {{corners:Point[],dimension:11,moduleSize:number,matrix:BitMatrix,result:object}|null}
 */
export function detectAztecRune(binaryImage) {
  if (!binaryImage || !binaryImage.width || !binaryImage.height) {
    throw new NotFoundError('detectAztecRune: no image supplied');
  }
  const candidates = [];
  for (const value of [true, false]) {
    for (const component of components(binaryImage, value)) {
      const pitch = (component.width + component.height) / 2;
      if (pitch < 0.8) continue;
      const matrix = sample(binaryImage, component, pitch);
      let decoded;
      try { decoded = decodeAztecRune(matrix); } catch { continue; }
      const candidate = {
        center: component,
        corners: corners(component, pitch),
        dimension: AZTEC_RUNE_SIZE,
        moduleSize: pitch,
        matrix,
        result: decoded,
      };
      if (!candidates.some((entry) => sameCandidate(entry, candidate))) candidates.push(candidate);
    }
  }
  candidates.sort((a, b) => b.moduleSize - a.moduleSize);
  const best = candidates[0];
  if (!best) return null;
  delete best.center;
  return best;
}

/** Detect and decode one Aztec Rune, or return `null` when none is verified. */
export function detectAndDecodeAztecRune(binaryImage) {
  let detection;
  try { detection = detectAztecRune(binaryImage); } catch { return null; }
  if (!detection) return null;
  return { ...detection.result, corners: detection.corners, moduleSize: detection.moduleSize };
}
