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
 * Axis-aligned MicroPDF417 raster detection.
 *
 * A MicroPDF417 symbol has a fixed module width for each column count and a
 * dark leading and trailing module in every row.  Consequently the bounding
 * rectangle of dark pixels identifies the complete symbol even when a light
 * quiet zone surrounds it.  Its width determines the integer raster scale;
 * the existing direct-module decoder then verifies every row-address pattern
 * and selects the exact variant.  This is intentionally narrower than the
 * PDF417 photo detector: it handles clean binarized rasters only, not skew or
 * projective camera images.
 *
 * @module micropdf417/detector
 */

import { BitMatrix } from '../core/bit-matrix.js';
import { decodeMicroPDF417 } from './decoder.js';

/** @typedef {{x:number, y:number}} Point */

// Each row has two 10-module side RAPs, a final separator, and 17 modules for
// each data column. Three and four columns also contain one central RAP.
function symbolWidth(columns) { return 21 + columns * 17 + (columns > 2 ? 10 : 0); }
const WIDTHS = [1, 2, 3, 4].map(symbolWidth);

function rotateClockwise(source) {
  const rotated = new BitMatrix(source.height, source.width);
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    if (source.get(x, y)) rotated.set(source.height - 1 - y, x);
  }
  return rotated;
}

function integerScale(width, modules) {
  if (width % modules) return 0;
  const scale = width / modules;
  return Number.isInteger(scale) && scale > 0 ? scale : 0;
}

/** Collapse exact integer scale blocks using a majority vote. */
function sampleRaster(image, bounds, modulesWide, scale) {
  const modulesHigh = bounds.height / scale;
  if (!Number.isInteger(modulesHigh) || modulesHigh < 1) return null;
  const matrix = new BitMatrix(modulesWide, modulesHigh);
  for (let y = 0; y < modulesHigh; y++) for (let x = 0; x < modulesWide; x++) {
    let dark = 0;
    for (let py = 0; py < scale; py++) for (let px = 0; px < scale; px++) {
      if (image.get(bounds.x + x * scale + px, bounds.y + y * scale + py)) dark++;
    }
    if (dark * 2 >= scale * scale) matrix.set(x, y);
  }
  return matrix;
}

function rectangle(bounds) {
  return [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ];
}

function detectAxisAligned(image, options) {
  const bounds = image.getBounds();
  if (!bounds) return null;
  for (const width of WIDTHS) {
    const scale = integerScale(bounds.width, width);
    if (!scale || bounds.height % scale) continue;
    const matrix = sampleRaster(image, bounds, width, scale);
    if (!matrix) continue;
    try {
      const decoded = decodeMicroPDF417(matrix, options);
      return { matrix, corners: rectangle(bounds), moduleSize: scale, ...decoded };
    } catch { /* The RAP sequence is not a MicroPDF417 symbol of this width. */ }
  }
  return null;
}

/**
 * Detect and decode one clean, binarized MicroPDF417 raster.
 *
 * Integer upscaling and quiet zones are accepted. The image is retried at all
 * quarter-turns, but arbitrary angles and perspective require caller-side
 * rectification before this function is used. `rotation` reports the clockwise
 * orientation of the supplied input relative to a normally oriented symbol;
 * it is not the inverse correction applied internally while searching.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} binaryImage Set bit = dark.
 * @param {object} [options] Passed to {@link decodeMicroPDF417}.
 * @returns {(ReturnType<typeof decodeMicroPDF417> & {matrix: BitMatrix, corners: Point[], moduleSize: number, rotation: number}) | null}
 */
export function detectMicroPDF417(binaryImage, options = {}) {
  if (!binaryImage?.width || !binaryImage?.height || typeof binaryImage.get !== 'function') return null;
  let oriented = binaryImage;
  let toOriginal = (point) => ({ x: point.x, y: point.y });
  for (let turns = 0; turns < 4; turns++) {
    const found = detectAxisAligned(oriented, options);
    // Search rotates clockwise to normalize the input. Public rotation has the
    // opposite meaning: it describes how the input itself was rotated.
    if (found) return {
      ...found,
      rotation: (360 - turns * 90) % 360,
      corners: found.corners.map(toOriginal),
    };
    const previous = oriented;
    const previousToOriginal = toOriginal;
    oriented = rotateClockwise(previous);
    // Boundary coordinates (rather than just pixel centres) are transformed
    // here, so callers can draw the returned rectangle directly on the input.
    toOriginal = (point) => previousToOriginal({ x: point.y, y: previous.height - point.x });
  }
  return null;
}

/** Alias kept symmetric with the other 2D readers. */
export function detectAndDecodeMicroPDF417(binaryImage, options = {}) {
  return detectMicroPDF417(binaryImage, options);
}
