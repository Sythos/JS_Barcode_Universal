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
 * Detector for the non-certified FrameQR Code profile.
 *
 * The profile deliberately reuses QR Model 2 geometry. Finder localisation and
 * projective sampling therefore use the QR detector; the additional profile
 * check is the light canvas signature. A sampled image cannot carry the
 * encoder's in-memory marker, so the detector reconstructs the expected
 * metadata, verifies that every reserved canvas module is light, and only then
 * opts into the profile decoder. This rejects ordinary QR symbols whose centre
 * merely happens to contain a plausible payload.
 *
 * Detection is verified for clean binarized rasters, integer scaling, quiet
 * zones, and in-plane quarter turns. Arbitrary photographic perspective is not
 * claimed by this module.
 *
 * @module frameqr/detector
 */

import { NotFoundError } from '../core/errors.js';
import { sampleQuad } from '../image/grid-sampler.js';
import { detectQR } from '../qr/detector.js';
import { decodeFrameQR } from './decoder.js';
import {
  FRAMEQR_PROFILE,
  canvasModules,
  normalizeCanvasSpec,
} from './tables.js';

/** @typedef {{x:number, y:number}} Point */

/** @typedef {object} FrameQRDetection
 * @property {Point[]} corners Outer corners in reading order.
 * @property {number} dimension QR modules per side.
 * @property {number} version QR Model 2 version.
 * @property {number} moduleSize Estimated pixels per module.
 * @property {number} rotation Clockwise in-plane orientation in degrees.
 * @property {BitMatrix} matrix Rectified profile matrix.
 * @property {object} canvas Normalized canvas specification.
 * @property {string} profile Profile identifier.
 * @property {false} certified Always false for this implementation.
 */

function orientationDegrees(corners) {
  const [tl, tr] = corners;
  const angle = Math.atan2(tr.y - tl.y, tr.x - tl.x) * 180 / Math.PI;
  return ((Math.round(angle / 90) * 90) % 360 + 360) % 360;
}
/**
 * Return the number of canvas modules that are dark in a sampled matrix.
 *
 * Encoded profile symbols clear the whole reserved canvas. A non-zero count
 * means either a normal QR symbol or a raster whose canvas was overwritten by
 * artwork; both are rejected because decoding that image would be speculative.
 */
function canvasDarkCount(matrix, canvas) {
  let dark = 0;
  for (const [x, y] of canvasModules(matrix.width, canvas)) {
    if (matrix.get(x, y)) dark++;
  }
  return dark;
}

function sameCandidate(left, right) {
  if (left.dimension !== right.dimension) return false;
  const a = left.corners[0];
  const b = right.corners[0];
  return Math.hypot(a.x - b.x, a.y - b.y) <= Math.max(left.moduleSize, right.moduleSize) * 2;
}

/**
 * Detect FrameQR Code symbols in a binarized raster.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} binaryImage Set bit = dark.
 * @param {object} [options]
 * @param {object} [options.canvas] Explicit canvas metadata for non-default
 *   shapes/size. Without it, the profile's canonical centered square is used.
 * @param {boolean} [options.voting=false] Use majority sampling per module.
 * @returns {FrameQRDetection[]} Best candidate first; empty when no verified
 *   profile signature is found.
 */
export function detectFrameQR(binaryImage, options = {}) {
  if (!binaryImage || !binaryImage.width || !binaryImage.height) {
    throw new NotFoundError('detectFrameQR: no image supplied');
  }

  let candidates;
  try { candidates = detectQR(binaryImage); } catch { return []; }
  const detections = [];

  for (const candidate of candidates) {
    // QR detector dimensions are already constrained to legal Model 2 sizes.
    let canvas;
    try { canvas = normalizeCanvasSpec(candidate.dimension, options.canvas); }
    catch { continue; }

    for (const voting of [Boolean(options.voting), !Boolean(options.voting)]) {
      let matrix;
      try { matrix = sampleQuad(binaryImage, candidate.dimension, candidate.corners, voting); }
      catch { continue; }

      // The signature check is intentionally strict. It prevents an ordinary
      // QR symbol from being relabelled as Canvas QR by the decoder's explicit
      // allowUnmarked escape hatch.
      if (canvasDarkCount(matrix, canvas) !== 0) continue;

      const marked = matrix;
      marked.frameqr = {
        profile: FRAMEQR_PROFILE.id,
        certified: false,
        canvas,
      };
      let decoded;
      try {
        decoded = decodeFrameQR(marked, {
          profile: FRAMEQR_PROFILE.id,
          canvas,
          allowUnmarked: true,
        });
      } catch { continue; }

      const detection = {
        corners: candidate.corners,
        dimension: candidate.dimension,
        version: candidate.version,
        moduleSize: candidate.moduleSize,
        rotation: orientationDegrees(candidate.corners),
        matrix: marked,
        canvas,
        profile: FRAMEQR_PROFILE.id,
        certified: false,
        result: decoded,
      };
      if (!detections.some((entry) => sameCandidate(entry, detection))) detections.push(detection);
      break;
    }
  }

  detections.sort((a, b) => b.moduleSize - a.moduleSize);
  return detections;
}

/**
 * Detect and decode all verified Canvas QR symbols in one call.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} binaryImage
 * @param {object} [options]
 * @returns {Array<object>}
 */
export function detectAndDecodeFrameQR(binaryImage, options = {}) {
  let detections;
  try { detections = detectFrameQR(binaryImage, options); } catch { return []; }
  const results = [];
  const seen = new Set();
  for (const detection of detections) {
    const result = detection.result;
    const key = `${result.version}|${result.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ ...result, corners: detection.corners, rotation: detection.rotation });
  }
  return results;
}
