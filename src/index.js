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
 * Sythos Barcode Suite — public API.
 *
 * Two functions carry the whole surface:
 *
 *   encode(text, { format })  ->  BitMatrix
 *   decode(image, { formats })  ->  Result[]
 *
 * Everything else is a renderer or a format-specific escape hatch. The core is
 * free of I/O and of any platform assumption: images go in as
 * `{ data, width, height }` with RGBA bytes, which is exactly what `ImageData`
 * is, so a canvas, an `OffscreenCanvas`, sharp, jimp and node-canvas all work
 * without an adapter.
 *
 * @module @sythos/js_barcode_universal
 */

import { BitMatrix } from './core/bit-matrix.js';
import { EncodeError, NotFoundError } from './core/errors.js';
import { LuminanceSource } from './image/luminance.js';
import { binarize } from './image/binarizer.js';
import { ONED_FORMATS } from './oned/index.js';
import { decodeOneD } from './oned/reader.js';
import * as datamatrix from './datamatrix/index.js';
import * as qr from './qr/index.js';
import * as aztec from './aztec/index.js';

export { BitMatrix };
export {
  BarcodeError, EncodeError, NotFoundError, FormatError, ChecksumError,
} from './core/errors.js';
export { LuminanceSource } from './image/luminance.js';
export { binarize, binarizeGlobal, binarizeHybrid } from './image/binarizer.js';
export * from './oned/index.js';
export { toSVG, toSVGDataURI } from './render/svg.js';
export { toImageData, toCanvas } from './render/image-data.js';
export { toPNG, toPNGDataURI } from './render/png.js';
export { renderToCanvasAuto, isWebGL2Available } from './render/index.js';
export { renderToCanvasAutoAsync, isWebGPUAvailable } from './render/index.js';
export { encodeQR, decodeQR, detectQR, detectAndDecodeQR } from './qr/index.js';
export {
  encodeDataMatrix, decodeDataMatrix, detectDataMatrix, detectAndDecodeDataMatrix,
} from './datamatrix/index.js';
export { encodeAztec, decodeAztec, detectAztec, detectAndDecodeAztec } from './aztec/index.js';

/**
 * @typedef {object} FormatInfo
 * @property {string} id
 * @property {string} label
 * @property {boolean} canWrite
 * @property {boolean} canRead
 * @property {'1D' | '2D'} kind
 */

// Writing and reading a format are separate capabilities that can land at
// different times, so they are reported separately rather than collapsed into
// one "supported" flag that would be wrong in one direction or the other.
//
// Capability is probed rather than declared, so this stays correct whether the
// QR module is the full implementation or a stand-in: a module may opt out
// explicitly with QR_CAN_ENCODE/QR_CAN_DECODE, and is otherwise taken at face
// value.
const qrPresent = qr.QR_PLACEHOLDER !== true;
const qrCanEncode = qrPresent &&
  typeof qr.encodeQR === 'function' && qr.QR_CAN_ENCODE !== false;
const qrCanDecode = qrPresent &&
  typeof qr.detectAndDecodeQR === 'function' && qr.QR_CAN_DECODE !== false;
const dataMatrixCanEncode = typeof datamatrix.encodeDataMatrix === 'function';
const dataMatrixCanDecode = typeof datamatrix.detectAndDecodeDataMatrix === 'function';
const aztecCanEncode = typeof aztec.encodeAztec === 'function';
const aztecCanDecode = typeof aztec.detectAndDecodeAztec === 'function';

/**
 * Every format this build supports.
 *
 * Writing and reading are listed separately on purpose. Writing a symbology is
 * a table lookup; reading one needs a detector that finds it in a photograph,
 * which is far more work. The two lists legitimately differ, and saying so
 * here is better than failing at call time.
 *
 * @returns {FormatInfo[]}
 */
export function listFormats() {
  const formats = Object.entries(ONED_FORMATS).map(([id, info]) => ({
    id,
    label: info.label,
    canWrite: true,
    canRead: info.readable,
    kind: /** @type {'1D'} */ ('1D'),
  }));

  formats.push({
    id: 'qr',
    label: 'QR Code',
    canWrite: qrCanEncode,
    canRead: qrCanDecode,
    kind: /** @type {'2D'} */ ('2D'),
  });
  formats.push({
    id: 'datamatrix',
    label: 'Data Matrix ECC 200',
    canWrite: dataMatrixCanEncode,
    canRead: dataMatrixCanDecode,
    kind: /** @type {'2D'} */ ('2D'),
  });
  formats.push({
    id: 'aztec',
    label: 'Aztec Code',
    canWrite: aztecCanEncode,
    canRead: aztecCanDecode,
    kind: /** @type {'2D'} */ ('2D'),
  });

  return formats;
}

/**
 * Encode a payload into a barcode matrix.
 *
 * The result is a `BitMatrix` where a set bit is a dark module, with no quiet
 * zone — the renderers add that, because the right margin depends on the
 * output medium. Linear symbols come back one module tall; height is a
 * rendering decision, not an encoding one.
 *
 * @param {string | number} text
 * @param {object} [options]
 * @param {string} [options.format] Format id. Default 'qr'.
 * @param {'L'|'M'|'Q'|'H'} [options.ecc] QR error-correction level.
 * @param {number} [options.version] QR version, 1-40. Auto if omitted.
 * @param {boolean} [options.checkDigit] Append a check digit, where optional.
 * @param {boolean} [options.fullAscii] Code 39 extended encoding.
 * @param {boolean} [options.gs1] Emit a leading FNC1.
 * @param {number} [options.layers] Aztec layer count; automatic if omitted.
 * @param {boolean} [options.compact] Force an Aztec Compact or Full symbol.
 * @param {number} [options.eccPercent] Requested Aztec error-correction percentage.
 * @returns {BitMatrix}
 */
export function encode(text, options = {}) {
  const format = String(options.format ?? 'qr').toLowerCase();
  const value = typeof text === 'number' ? String(text) : text;

  if (format === 'qr' || format === 'qrcode') {
    return qr.encodeQR(value, options);
  }
  if (format === 'datamatrix' || format === 'data-matrix') {
    return datamatrix.encodeDataMatrix(value, options);
  }
  if (format === 'aztec' || format === 'aztec-code') {
    return aztec.encodeAztec(value, options);
  }

  const entry = ONED_FORMATS[format];
  if (!entry) {
    const known = [...Object.keys(ONED_FORMATS), 'qr', 'datamatrix', 'aztec'].join(', ');
    throw new EncodeError(`Unknown format "${format}". Known formats: ${known}`);
  }
  return entry.encode(value, options);
}

/**
 * @typedef {object} DecodeResult
 * @property {string} text
 * @property {string} format
 * @property {Uint8Array} [bytes] Raw payload, before text decoding.
 * @property {number} [version] QR version.
 * @property {string} [ecc] QR error-correction level.
 * @property {number} [layers] Aztec layer count.
 * @property {boolean} [compact] Whether an Aztec symbol is Compact.
 * @property {number} [corrections] Reed–Solomon corrections applied by an Aztec decode.
 */

/**
 * Find and decode every barcode in an image.
 *
 * Returns an array, empty when nothing is found — an image with no barcode is
 * an ordinary outcome for a camera frame, not an error, and throwing would
 * make the common scanning loop a try/catch.
 *
 * @param {{data: Uint8ClampedArray|Uint8Array|number[], width: number, height: number}} image
 * @param {object} [options]
 * @param {string[]} [options.formats] Restrict to these format ids.
 * @param {boolean} [options.tryHarder] Retry inverted and rotated. Default true.
 * @param {'global'|'hybrid'|'auto'} [options.binarizer]
 * @returns {DecodeResult[]}
 */
export function decode(image, options = {}) {
  const { formats = null, tryHarder = true, binarizer = 'auto' } = options;
  const want = formats ? new Set(formats.map((f) => f.toLowerCase())) : null;
  const wantQR = !want || want.has('qr') || want.has('qrcode');
  const wantDataMatrix = !want || want.has('datamatrix') || want.has('data-matrix');
  const wantAztec = !want || want.has('aztec') || want.has('aztec-code');
  const wantOneD = !want || [...want].some((f) => f in ONED_FORMATS);

  const source = LuminanceSource.fromImageData(image);
  const results = [];

  // Light-on-dark symbols are common on screens and packaging, so a second
  // inverted pass is worth the cost when the first finds nothing.
  const passes = tryHarder ? [source, source.invert()] : [source];

  for (const pass of passes) {
    const bits = binarize(pass, binarizer);

    if (wantQR && qrCanDecode) {
      try {
        for (const found of qr.detectAndDecodeQR(bits)) {
          results.push({ ...found, format: 'qr' });
        }
      } catch {
        /* no QR in this pass */
      }
    }

    if (wantDataMatrix && dataMatrixCanDecode) {
      // Hybrid thresholding can erase the interior of very large, perfectly
      // uniform modules. In auto mode keep the local-threshold attempt, then
      // retry Data Matrix once with the global threshold before giving up.
      const dataMatrixBits = binarizer === 'auto' ? [bits, binarize(pass, 'global')] : [bits];
      for (const candidateBits of dataMatrixBits) {
        try {
          const found = datamatrix.detectAndDecodeDataMatrix(candidateBits);
          if (found) { results.push({ ...found, format: 'datamatrix' }); break; }
        } catch {
          /* no Data Matrix with this threshold */
        }
      }
    }

    if (wantAztec && aztecCanDecode) {
      // The central bull's-eye is a small, high-contrast target. Hybrid
      // thresholding can flatten it on clean rendered symbols, so mirror the
      // Data Matrix global fallback in auto mode.
      const aztecBits = binarizer === 'auto' ? [bits, binarize(pass, 'global')] : [bits];
      for (const candidateBits of aztecBits) {
        try {
          const found = aztec.detectAndDecodeAztec(candidateBits);
          if (found) { results.push({ ...found, format: 'aztec' }); break; }
        } catch {
          /* no Aztec code with this threshold */
        }
      }
    }

    if (wantOneD) {
      const oneDFormats = want ? [...want].filter((f) => f in ONED_FORMATS) : null;
      for (const found of decodeOneD(bits, { formats: oneDFormats, tryHarder })) {
        results.push({ text: found.text, format: found.format });
      }
    }

    if (results.length > 0) break;
  }

  // De-duplicate: the same symbol is often read on several scan rows.
  const seen = new Set();
  return results.filter((r) => {
    const key = `${r.format}:${r.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Decode, or throw if nothing is found.
 *
 * @param {{data: Uint8ClampedArray|Uint8Array|number[], width: number, height: number}} image
 * @param {object} [options]
 * @returns {DecodeResult}
 */
export function decodeStrict(image, options) {
  const results = decode(image, options);
  if (results.length === 0) throw new NotFoundError('No barcode found in image');
  return results[0];
}

/** Library version, matching package.json. */
export const VERSION = '1.1.0';
