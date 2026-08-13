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
 * Sythos Canvas QR profile encoder.
 *
 * This encoder deliberately builds on this project's QR Code implementation
 * and then removes a conservatively bounded set of data modules for artwork.
 * It is not an implementation of DENSO FrameQR and makes no interoperability
 * claim for that proprietary format.
 *
 * @module frameqr/encoder
 */

import { EncodeError } from '../core/errors.js';
import { encodeQR } from '../qr/encoder.js';
import {
  FRAMEQR_PROFILE,
  canvasModules,
  normalizeCanvasSpec,
  validateCanvasSpec,
} from './tables.js';

/**
 * @typedef {object} FrameQrEncodeOptions
 * @property {'H'} [ecc] The profile always uses QR error correction H.
 * @property {number} [version] Force a QR version 1-40.
 * @property {number} [mask] Force a QR mask 0-7.
 * @property {'auto'|'utf-8'|'iso-8859-1'} [charset] Byte mode interpretation.
 * @property {boolean} [kanji] Allow QR kanji mode.
 * @property {object} [canvas] Profile artwork reservation.
 */

function versionFor(matrix) {
  return (matrix.width - 17) / 4;
}

function clearCanvas(matrix, modules) {
  for (const [x, y] of modules) matrix.unset(x, y);
}

/**
 * Encode a QR Code with a conservative artwork canvas according to the
 * non-certified Sythos Canvas QR profile.
 *
 * The profile forces QR H error correction and rejects a canvas whenever its
 * known codeword damage exceeds the per-block correction budget. When a
 * version is not forced, the smallest QR version that holds both payload and
 * safe canvas is selected. A decoder can reconstruct the reserved modules from
 * the returned profile metadata.
 *
 * @param {string} text
 * @param {FrameQrEncodeOptions} [options]
 * @returns {import('../core/bit-matrix.js').BitMatrix}
 * @throws {EncodeError} When the QR payload/options are invalid or the canvas
 *   cannot safely fit the selected QR version.
 */
export function encodeFrameQR(text, options = {}) {
  if (typeof text !== 'string') {
    throw new EncodeError('Sythos Canvas QR: text must be a string');
  }
  if (options.ecc !== undefined && options.ecc !== 'H') {
    throw new EncodeError('Sythos Canvas QR: ecc is fixed to H for this profile');
  }

  const qrOptions = {
    mask: options.mask,
    charset: options.charset,
    kanji: options.kanji,
    ecc: 'H',
  };
  for (const key of Object.keys(qrOptions)) {
    if (qrOptions[key] === undefined) delete qrOptions[key];
  }

  const versions = options.version === undefined
    ? Array.from({ length: 40 }, (_, index) => index + 1)
    : [options.version];
  let capacityError = null;
  let unsafeAnalysis = null;
  let selected = null;

  for (const version of versions) {
    let matrix;
    try {
      matrix = encodeQR(text, { ...qrOptions, version });
    } catch (error) {
      capacityError = error;
      continue;
    }

    let canvas;
    let analysis;
    try {
      canvas = normalizeCanvasSpec(matrix.width, options.canvas);
      analysis = validateCanvasSpec(versionFor(matrix), canvas);
    } catch (error) {
      if (error instanceof EncodeError) throw error;
      throw new EncodeError(`Sythos Canvas QR: invalid canvas: ${error.message}`);
    }
    if (!analysis.safe) {
      unsafeAnalysis = analysis;
      continue;
    }
    selected = { matrix, canvas };
    break;
  }

  if (!selected) {
    if (unsafeAnalysis) {
      throw new EncodeError(
        'Sythos Canvas QR: canvas is not safe for the selected QR version; ' +
        `it touches ${unsafeAnalysis.touchedCodewordCount} codewords and has ` +
        `a per-block correction budget of ${unsafeAnalysis.correctionBudgetPerBlock}`
      );
    }
    if (capacityError) throw capacityError;
    throw new EncodeError('Sythos Canvas QR: unable to select a QR version');
  }

  const { matrix, canvas } = selected;
  clearCanvas(matrix, canvasModules(matrix.width, canvas));
  matrix.frameqr = {
    profile: FRAMEQR_PROFILE.id,
    certified: false,
    canvas,
  };
  return matrix;
}
