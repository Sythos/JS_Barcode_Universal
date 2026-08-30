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

/** MaxiCode detector for fixed 30 by 33 module images. @module maxicode/detector */

import { BitMatrix } from '../core/bit-matrix.js';
import { NotFoundError } from '../core/errors.js';
import { decodeMaxiCode } from './decoder.js';
import { MAXICODE_HEIGHT, MAXICODE_WIDTH } from './tables.js';

/** @param {BitMatrix} source @param {{x:number,y:number,width:number,height:number}} bounds */
function sampleBounds(source, bounds) {
  const matrix = new BitMatrix(MAXICODE_WIDTH, MAXICODE_HEIGHT);
  for (let y = 0; y < MAXICODE_HEIGHT; y++) for (let x = 0; x < MAXICODE_WIDTH; x++) {
    const px = Math.min(source.width - 1, Math.max(0,
      Math.floor(bounds.x + ((x + 0.5) * bounds.width) / MAXICODE_WIDTH)));
    const py = Math.min(source.height - 1, Math.max(0,
      Math.floor(bounds.y + ((y + 0.5) * bounds.height) / MAXICODE_HEIGHT)));
    if (source.get(px, py)) matrix.set(x, y);
  }
  return matrix;
}

/** @param {BitMatrix} source @returns {BitMatrix} */
function inverted(source) {
  const out = source.clone();
  for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) out.flip(x, y);
  return out;
}

/**
 * Detect a MaxiCode in a binarized image. The detector intentionally accepts a
 * single prominent symbol and an integer or near-integer scale; callers that
 * have a perspective quadrilateral can sample it first and call the matrix
 * decoder directly.
 *
 * @param {BitMatrix} binaryImage
 * @returns {{corners:Array<{x:number,y:number}>,dimension:{width:number,height:number},moduleSize:number,matrix:BitMatrix,result:object}|null}
 */
export function detectMaxiCode(binaryImage) {
  if (!binaryImage || !binaryImage.width || !binaryImage.height) {
    throw new NotFoundError('detectMaxiCode: no image supplied');
  }
  const candidates = [];
  for (const source of [binaryImage, inverted(binaryImage)]) {
    const bounds = source.width === MAXICODE_WIDTH && source.height === MAXICODE_HEIGHT
      ? { x: 0, y: 0, width: source.width, height: source.height }
      : source.getBounds();
    if (!bounds || bounds.width < MAXICODE_WIDTH || bounds.height < MAXICODE_HEIGHT) continue;
    const ratio = bounds.width / bounds.height;
    if (Math.abs(ratio - MAXICODE_WIDTH / MAXICODE_HEIGHT) > 0.2) continue;
    // A valid symbol may legitimately fill the complete input frame (for
    // example an integer-scaled 30x33 matrix).  Payload validation below
    // rejects a uniform background, so do not discard full-frame candidates
    // before sampling them.
    const matrix = sampleBounds(source, bounds);
    let result;
    try { result = decodeMaxiCode(matrix); } catch { continue; }
    candidates.push({
      corners: [
        { x: bounds.x, y: bounds.y },
        { x: bounds.x + bounds.width, y: bounds.y },
        { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
        { x: bounds.x, y: bounds.y + bounds.height },
      ],
      dimension: { width: MAXICODE_WIDTH, height: MAXICODE_HEIGHT },
      moduleSize: (bounds.width / MAXICODE_WIDTH + bounds.height / MAXICODE_HEIGHT) / 2,
      matrix,
      result,
    });
  }
  candidates.sort((a, b) => b.moduleSize - a.moduleSize);
  return candidates[0] ?? null;
}

/** Detect and decode a MaxiCode or return null when no verified symbol exists. */
export function detectAndDecodeMaxiCode(binaryImage) {
  let detection;
  try { detection = detectMaxiCode(binaryImage); } catch { return null; }
  if (!detection) return null;
  return { ...detection.result, corners: detection.corners, moduleSize: detection.moduleSize };
}
