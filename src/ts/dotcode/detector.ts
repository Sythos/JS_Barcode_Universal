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

/** Clean-raster DotCode detector. @module dotcode/detector */

import { BitMatrix } from '../core/bit-matrix.js';
import { FormatError, NotFoundError } from '../core/errors.js';
import { decodeDotCode } from './decoder.js';
import type { DotCodeDecodeResult, DotCodeRotation } from './decoder.js';

export interface DotCodeDetectOptions {
  /** Restrict the search to one known integer module size. */
  moduleSize?: number;
  /** Maximum scale searched when moduleSize is not supplied. */
  maxModuleSize?: number;
  /** Candidate source orientations. Defaults to all quarter turns. */
  rotations?: readonly DotCodeRotation[];
  /** Search normal, inverted, or both polarities. */
  inverted?: boolean | 'auto';
}

export interface DotCodePoint { readonly x: number; readonly y: number; }

export interface DotCodeDetection extends DotCodeDecodeResult {
  readonly matrix: BitMatrix;
  readonly corners: readonly [DotCodePoint, DotCodePoint, DotCodePoint, DotCodePoint];
  readonly moduleSize: number;
}

type Bounds = { x: number; y: number; width: number; height: number };
type Candidate = { x: number; y: number; width: number; height: number; scale: number; inverted: boolean };

const MAX_RASTER_PIXELS = 16_777_216;

function validateImage(image: BitMatrix): void {
  if (!image || !Number.isInteger(image.width) || !Number.isInteger(image.height) || typeof image.get !== 'function') {
    throw new NotFoundError('DotCode detector: no binary image supplied');
  }
  if (image.width < 1 || image.height < 1 || image.width * image.height > MAX_RASTER_PIXELS) {
    throw new FormatError(`DotCode detector: raster must contain at most ${MAX_RASTER_PIXELS} pixels`);
  }
}

function boundsFor(image: BitMatrix, dark: boolean): Bounds | null {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    if (image.get(x, y) !== dark) continue;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function rotateImage(image: BitMatrix, degrees: DotCodeRotation): BitMatrix {
  if (degrees === 0) return image.clone();
  const result = degrees === 90 || degrees === 270 ? new BitMatrix(image.height, image.width) : new BitMatrix(image.width, image.height);
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    let nx = x;
    let ny = y;
    if (degrees === 90) { nx = image.height - 1 - y; ny = x; }
    else if (degrees === 180) { nx = image.width - 1 - x; ny = image.height - 1 - y; }
    else { nx = y; ny = image.width - 1 - x; }
    result.setValue(nx, ny, image.get(x, y));
  }
  return result;
}

function sampleCandidate(image: BitMatrix, candidate: Candidate): BitMatrix | null {
  const { x, y, width, height, scale, inverted } = candidate;
  if (x < 0 || y < 0 || x + width * scale > image.width || y + height * scale > image.height) return null;
  const matrix = new BitMatrix(width, height);
  const threshold = Math.ceil(scale * scale / 2);
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    let dark = 0;
    for (let py = 0; py < scale; py++) for (let px = 0; px < scale; px++) {
      if (image.get(x + column * scale + px, y + row * scale + py) === !inverted) dark++;
    }
    if (dark >= threshold) matrix.set(column, row);
  }
  return matrix;
}

function validDimension(width: number, height: number): boolean {
  return Number.isInteger(width) && Number.isInteger(height) && width >= 5 && height >= 5 && ((width + height) & 1) === 1;
}

function addCandidate(list: Candidate[], seen: Set<string>, candidate: Candidate): void {
  if (!validDimension(candidate.width, candidate.height) || candidate.scale < 1) return;
  const key = `${candidate.x},${candidate.y},${candidate.width},${candidate.height},${candidate.scale},${candidate.inverted ? 1 : 0}`;
  if (seen.has(key)) return;
  seen.add(key);
  list.push(candidate);
}

function candidateList(image: BitMatrix, bounds: Bounds, scale: number, inverted: boolean): Candidate[] {
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  const frameWidth = Math.floor(image.width / scale);
  const frameHeight = Math.floor(image.height / scale);

  // Most generated matrices have a known integer quiet-zone margin. Trying a
  // few margins first keeps the detector fast and deterministic.
  for (let margin = 0; margin <= 4; margin++) {
    addCandidate(candidates, seen, {
      x: margin * scale, y: margin * scale,
      width: frameWidth - margin * 2, height: frameHeight - margin * 2,
      scale, inverted,
    });
  }

  // A cropped camera ROI may not include the quiet zone. Estimate the logical
  // dimensions from the dark bounding box and permit a small border slack.
  const estimateWidth = Math.round(bounds.width / scale);
  const estimateHeight = Math.round(bounds.height / scale);
  for (let extraWidth = -2; extraWidth <= 6; extraWidth++) for (let extraHeight = -2; extraHeight <= 6; extraHeight++) {
    const width = estimateWidth + extraWidth;
    const height = estimateHeight + extraHeight;
    if (!validDimension(width, height)) continue;
    for (let left = 0; left <= 4; left++) for (let top = 0; top <= 4; top++) {
      addCandidate(candidates, seen, {
        x: bounds.x - left * scale, y: bounds.y - top * scale,
        width, height, scale, inverted,
      });
    }
  }
  return candidates;
}

function inversePoint(point: DotCodePoint, originalWidth: number, originalHeight: number, rotation: DotCodeRotation): DotCodePoint {
  if (rotation === 0) return point;
  if (rotation === 90) return { x: point.y, y: originalHeight - 1 - point.x };
  if (rotation === 180) return { x: originalWidth - 1 - point.x, y: originalHeight - 1 - point.y };
  return { x: originalWidth - 1 - point.y, y: point.x };
}

function cornersFor(candidate: Candidate, source: BitMatrix, rotation: DotCodeRotation): [DotCodePoint, DotCodePoint, DotCodePoint, DotCodePoint] {
  const right = candidate.x + candidate.width * candidate.scale;
  const bottom = candidate.y + candidate.height * candidate.scale;
  return [
    inversePoint({ x: candidate.x, y: candidate.y }, source.width, source.height, rotation),
    inversePoint({ x: right, y: candidate.y }, source.width, source.height, rotation),
    inversePoint({ x: right, y: bottom }, source.width, source.height, rotation),
    inversePoint({ x: candidate.x, y: bottom }, source.width, source.height, rotation),
  ];
}

/**
 * Detect clean, axis-aligned DotCode rasters at integer module scale.
 *
 * DotCode has no finder pattern. This detector therefore treats geometry and
 * the strict decoder as one gate: a bounding-box hypothesis is returned only
 * after checkerboard structure, legal patterns, padding, and Reed-Solomon all
 * pass. It intentionally does not claim perspective or arbitrary-angle camera
 * support; callers should rectify those images before invoking this API.
 */
export function detectDotCode(binaryImage: BitMatrix, options: DotCodeDetectOptions = {}): DotCodeDetection[] {
  validateImage(binaryImage);
  if (options.moduleSize !== undefined && (!Number.isInteger(options.moduleSize) || options.moduleSize < 1 || options.moduleSize > 128)) {
    throw new FormatError('DotCode detector: moduleSize must be an integer in 1..128');
  }
  if (options.maxModuleSize !== undefined && (!Number.isInteger(options.maxModuleSize) || options.maxModuleSize < 1 || options.maxModuleSize > 128)) {
    throw new FormatError('DotCode detector: maxModuleSize must be an integer in 1..128');
  }
  const rotations = options.rotations ?? [0, 90, 180, 270];
  if (!Array.isArray(rotations) || rotations.some((value) => value !== 0 && value !== 90 && value !== 180 && value !== 270)) {
    throw new FormatError('DotCode detector: rotations must contain quarter-turns only');
  }
  const polarities = options.inverted === undefined || options.inverted === 'auto'
    ? [false, true] : [options.inverted];
  const detections: DotCodeDetection[] = [];
  const seen = new Set<string>();

  for (const rotation of rotations) {
    const oriented = rotateImage(binaryImage, rotation);
    for (const inverted of polarities) {
      const bounds = boundsFor(oriented, !inverted);
      if (!bounds) continue;
      const maxScale = options.moduleSize ?? Math.min(
        options.maxModuleSize ?? 32,
        128,
        Math.max(1, Math.floor(Math.min(oriented.width, oriented.height) / 5)),
      );
      const scales = options.moduleSize ? [options.moduleSize] : Array.from({ length: maxScale }, (_, index) => index + 1);
      for (const scale of scales) {
        const candidates = candidateList(oriented, bounds, scale, inverted);
        for (const candidate of candidates) {
          const matrix = sampleCandidate(oriented, candidate);
          if (!matrix) continue;
          let decoded: DotCodeDecodeResult;
          try {
            decoded = decodeDotCode(matrix, { rotation: 0, inverted: false });
          } catch {
            continue;
          }
          const detectionCorners = cornersFor(candidate, binaryImage, rotation);
          const centre = detectionCorners.reduce(
            (sum, point) => ({ x: sum.x + point.x / 4, y: sum.y + point.y / 4 }),
            { x: 0, y: 0 },
          );
          const shape = [decoded.width, decoded.height].sort((left, right) => left - right).join('x');
          const key = `${decoded.text}\u0000${shape}\u0000${Math.round(centre.x / (scale * 2))},${Math.round(centre.y / (scale * 2))}`;
          if (seen.has(key)) continue;
          seen.add(key);
          detections.push({
            ...decoded,
            rotation,
            inverted,
            matrix,
            moduleSize: scale,
            corners: detectionCorners,
          });
          // The first strict hit for a given orientation and scale is the
          // highest-quality hypothesis; later dimensions are usually margin
          // variants of the same symbol.
          break;
        }
      }
    }
  }
  detections.sort((left, right) => left.corrections - right.corrections || right.moduleSize - left.moduleSize);
  return detections;
}

/** Return the first strictly decoded DotCode result, or an empty array. */
export function detectAndDecodeDotCode(binaryImage: BitMatrix, options: DotCodeDetectOptions = {}): DotCodeDetection[] {
  try {
    return detectDotCode(binaryImage, options);
  } catch {
    return [];
  }
}
