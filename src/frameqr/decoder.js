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
 * Decoder for FrameQR Code.
 *
 * This is intentionally not a DENSO FrameQR decoder. The profile is a QR
 * symbol with a bounded artwork reservation and an explicit `frameqr` marker.
 * A normal QR matrix is rejected unless a detector (or another trusted
 * caller) supplies the profile and explicitly opts in to an unmarked matrix.
 *
 * The QR decoder is deliberately kept as the single payload decoder. It can
 * repair the bounded modules removed for the canvas because the encoder fixes
 * error correction to H and validates the reservation before clearing it.
 *
 * @module frameqr/decoder
 */

import { FormatError } from '../core/errors.js';
import { decodeQR } from '../qr/decoder.js';
import {
  FRAMEQR_PROFILE,
  normalizeCanvasSpec,
  validateCanvasSpec,
  analyzeCanvasDamage,
} from './tables.js';

/** @param {unknown} value @returns {boolean} */
function isObject(value) {
  return value !== null && typeof value === 'object';
}

/**
 * Return the profile marker attached by the encoder. Older callers sometimes
 * use camel case, so accepting it here is harmless while the emitted marker
 * remains the canonical `frameqr` property.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 * @returns {object|null}
 */
function markerOf(matrix) {
  const marker = matrix && (matrix.frameqr ?? matrix.frameQR);
  return isObject(marker) ? marker : null;
}

/** @param {unknown} profile @returns {boolean} */
function isExpectedProfile(profile) {
  if (profile === FRAMEQR_PROFILE.id) return true;
  return isObject(profile) && profile.id === FRAMEQR_PROFILE.id;
}

/**
 * Normalize and validate the canvas metadata. Validation functions in the
 * table module throw on invalid input; a few consumers also return `false` or
 * a problem list, so those forms are handled defensively here.
 *
 * @param {number} symbolSize
 * @param {number} version
 * @param {object} canvas
 * @returns {{canvas: object, damage: object}}
 */
function validateCanvas(symbolSize, version, canvas) {
  if (!isObject(canvas)) throw new FormatError('FrameQR Code: canvas metadata is missing');

  let normalized;
  try {
    normalized = normalizeCanvasSpec(symbolSize, canvas);
    const validation = validateCanvasSpec(version, normalized);
    if (
      validation === false ||
      (Array.isArray(validation) && validation.length > 0) ||
      (isObject(validation) && validation.valid === false) ||
      (isObject(validation) && validation.safe === false)
    ) {
      throw new Error('canvas geometry is outside the profile limits');
    }
  } catch (error) {
    if (error instanceof FormatError) throw error;
    throw new FormatError(`FrameQR Code: invalid canvas metadata: ${error.message}`);
  }

  let damage;
  try {
    damage = analyzeCanvasDamage(version, normalized);
  } catch (error) {
    throw new FormatError(`FrameQR Code: cannot analyse canvas damage: ${error.message}`);
  }
  return { canvas: normalized, damage };
}

/**
 * Resolve the profile marker and canvas from the matrix/options pair.
 *
 * `allowUnmarked` is deliberately opt-in. It exists for a detector that has
 * already verified the canvas signature after sampling a photograph; it is
 * not enabled by the public default and therefore cannot silently relabel an
 * ordinary QR Code as FrameQR.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 * @param {object} options
 * @returns {{profile: string, canvas: object, damage: object, certified: false}}
 */
function resolveProfile(matrix, options) {
  const marker = markerOf(matrix);
  const suppliedProfile = options.profile;
  const markerProfile = marker ? marker.profile : undefined;
  if (markerProfile !== undefined && suppliedProfile !== undefined) {
    const markerId = isObject(markerProfile) ? markerProfile.id : markerProfile;
    const suppliedId = isObject(suppliedProfile) ? suppliedProfile.id : suppliedProfile;
    if (markerId !== suppliedId) {
      throw new FormatError('FrameQR Code: matrix and requested profile markers disagree');
    }
  }
  const profile = markerProfile ?? suppliedProfile;

  if (!isExpectedProfile(profile)) {
    throw new FormatError(
      'FrameQR Code: profile marker is missing or is not a FrameQR Code symbol'
    );
  }
  if (marker && marker.certified === true) {
    throw new FormatError(
      'FrameQR Code: certified FrameQR input is not supported by this profile decoder'
    );
  }
  if (!marker && !options.allowUnmarked) {
    throw new FormatError(
      'FrameQR Code: unmarked QR matrix rejected; provide a verified profile marker'
    );
  }

  const markerCanvas = marker ? marker.canvas : undefined;
  const canvas = options.canvas ?? markerCanvas;
  const version = (matrix.width - 17) / 4;
  if (!Number.isInteger(version) || version < 1 || version > 40) {
    throw new FormatError(`FrameQR Code: invalid QR symbol size ${matrix.width}`);
  }
  const checked = validateCanvas(matrix.width, version, canvas);
  if (markerCanvas && options.canvas) {
    let marked;
    try {
      marked = normalizeCanvasSpec(matrix.width, markerCanvas);
    } catch (error) {
      throw new FormatError(`FrameQR Code: invalid marker canvas: ${error.message}`);
    }
    const fields = ['shape', 'centerX', 'centerY', 'width', 'height', 'angle'];
    if (fields.some((field) => marked[field] !== checked.canvas[field])) {
      throw new FormatError('FrameQR Code: matrix and requested canvas metadata disagree');
    }
  }
  return {
    profile: FRAMEQR_PROFILE.id,
    canvas: checked.canvas,
    damage: checked.damage,
    certified: false,
  };
}

/**
 * Decode a FrameQR Code matrix.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 *   Square QR modules, normally returned by `encodeFrameQR` or a FrameQR
 *   detector. The encoder's `frameqr` metadata is required by default.
 * @param {object} [options]
 * @param {object} [options.canvas] Explicit canvas metadata for a sampled
 *   matrix when the source marker was not preserved.
 * @param {string|object} [options.profile] Expected profile identifier.
 * @param {boolean} [options.allowUnmarked=false] Explicit detector opt-in for
 *   a matrix whose marker was lost during image sampling.
 * @returns {import('../qr/decoder.js').DecodeResult & {
 *   format: 'frameqr', profile: string, certified: false,
 *   frame: object, canvas: object, canvasDamage: object
 * }}
 * @throws {FormatError} If the profile marker/canvas is invalid or the input
 *   is an ordinary QR Code.
 */
export function decodeFrameQR(matrix, options = {}) {
  if (!matrix || !Number.isInteger(matrix.width) || !Number.isInteger(matrix.height)) {
    throw new FormatError('FrameQR Code: no matrix supplied');
  }
  if (matrix.width !== matrix.height) {
    throw new FormatError(
      `FrameQR Code: symbol must be square, got ${matrix.width}x${matrix.height}`
    );
  }

  const profile = resolveProfile(matrix, options);
  let decoded;
  try {
    decoded = decodeQR(matrix);
  } catch (error) {
    // Preserve the original QR/RS error when possible, but give callers a
    // profile-specific context without exposing implementation details.
    if (error instanceof FormatError) {
      throw new FormatError(`FrameQR Code: payload is not recoverable: ${error.message}`);
    }
    throw error;
  }

  return {
    ...decoded,
    format: 'frameqr',
    profile: profile.profile,
    certified: profile.certified,
    frame: profile.canvas,
    canvas: profile.canvas,
    canvasDamage: profile.damage,
  };
}

export { isExpectedProfile };
