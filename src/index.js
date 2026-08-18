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
import * as pdf417 from './pdf417/index.js';
import * as micropdf417 from './micropdf417/index.js';
import * as microqr from './microqr/index.js';
import * as rmqr from './rmqr/index.js';
import * as frameqr from './frameqr/index.js';
import * as aztecRune from './aztecrune/index.js';
import * as compactPdf417 from './compactpdf417/index.js';
import * as databar from './databar/index.js';

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
export * from './aztecrune/index.js';
export { encodePDF417, decodePDF417, detectPDF417, detectAndDecodePDF417 } from './pdf417/index.js';
export * from './compactpdf417/index.js';
  // DataBar exports include both the verified GTIN/data layer and the
  // Omnidirectional/Truncated physical image path.
export * from './databar/index.js';
export {
  encodeMicroPDF417, decodeMicroPDF417, detectMicroPDF417, detectAndDecodeMicroPDF417,
} from './micropdf417/index.js';
export { encodeMicroQR, decodeMicroQR, detectMicroQR, detectAndDecodeMicroQR } from './microqr/index.js';
export { encodeRMQR, decodeRMQR, detectRMQR, detectAndDecodeRMQR } from './rmqr/index.js';
export {
  encodeFrameQR, decodeFrameQR, detectFrameQR, detectAndDecodeFrameQR,
} from './frameqr/index.js';

/**
 * @typedef {object} FormatInfo
 * @property {string} id
 * @property {string} label
 * @property {boolean} canWrite
 * @property {boolean} canRead
 * @property {'1D' | '2D'} kind
 * @property {'supplement'} [role]
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
const pdf417CanEncode = typeof pdf417.encodePDF417 === 'function';
// The matrix decoder is complete, but automatic image localization is still
// limited to clean module-aligned symbols or an application-supplied
// quadrilateral. Keep the generic scanner capability opt-in until a
// perspective/noise corpus is passed.
const pdf417CanDecode = typeof pdf417.detectAndDecodePDF417 === 'function';
const microPdf417CanEncode = typeof micropdf417.encodeMicroPDF417 === 'function';
const microPdf417CanDecode = typeof micropdf417.detectAndDecodeMicroPDF417 === 'function';
const microQrCanEncode = typeof microqr.encodeMicroQR === 'function';
const microQrCanDecode = typeof microqr.detectAndDecodeMicroQR === 'function';
const rmqrCanEncode = typeof rmqr.encodeRMQR === 'function';
const rmqrCanDecode = typeof rmqr.detectAndDecodeRMQR === 'function';
const frameQrCanEncode = typeof frameqr.encodeFrameQR === 'function';
const frameQrCanDecode = typeof frameqr.detectAndDecodeFrameQR === 'function';
const aztecRuneCanEncode = typeof aztecRune.encodeAztecRune === 'function';
const aztecRuneCanDecode = typeof aztecRune.detectAndDecodeAztecRune === 'function';
const compactPdf417CanEncode = typeof compactPdf417.encodeCompactPDF417 === 'function';
const compactPdf417CanDecode = typeof compactPdf417.detectAndDecodeCompactPDF417 === 'function';
const dataBarCanEncode = typeof databar.encodeDataBar14 === 'function';
const dataBarCanDecode = typeof databar.decodeDataBar14Scanline === 'function';

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
    ...(info.role ? { role: info.role } : {}),
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
  formats.push({
    id: 'aztecrune',
    label: 'Aztec Rune',
    canWrite: aztecRuneCanEncode,
    canRead: aztecRuneCanDecode,
    kind: /** @type {'2D'} */ ('2D'),
  });
  formats.push({
    id: 'pdf417',
    label: 'PDF417',
    canWrite: pdf417CanEncode,
    canRead: pdf417CanDecode,
    kind: /** @type {'2D'} */ ('2D'),
  });
  formats.push({
    id: 'compactpdf417',
    label: 'Compact PDF417',
    canWrite: compactPdf417CanEncode,
    canRead: compactPdf417CanDecode,
    kind: /** @type {'2D'} */ ('2D'),
  });
  formats.push({
    id: 'micropdf417',
    label: 'MicroPDF417',
    canWrite: microPdf417CanEncode,
    canRead: microPdf417CanDecode,
    kind: /** @type {'2D'} */ ('2D'),
  });
  formats.push({
    id: 'microqr',
    label: 'Micro QR Code',
    canWrite: microQrCanEncode,
    canRead: microQrCanDecode,
    kind: /** @type {'2D'} */ ('2D'),
  });
  formats.push({
    id: 'rmqr',
    label: 'rMQR Code',
    canWrite: rmqrCanEncode,
    canRead: rmqrCanDecode,
    kind: /** @type {'2D'} */ ('2D'),
  });
  formats.push({
    id: 'frameqr',
    label: 'FrameQR Code',
    canWrite: frameQrCanEncode,
    canRead: frameQrCanDecode,
    kind: /** @type {'2D'} */ ('2D'),
  });
  formats.push({
    id: 'gs1databar14',
    label: 'GS1 DataBar Omnidirectional / Truncated',
    canWrite: dataBarCanEncode,
    canRead: dataBarCanDecode,
    kind: /** @type {'1D'} */ ('1D'),
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
 * @param {number} [options.eccLevel] PDF417 error-correction level, 0-8.
 * @param {number} [options.columns] PDF417 columns, 1-30.
 * @param {number} [options.rows] PDF417 rows, 3-90.
 * @param {number} [options.rowHeight] PDF417 row height in modules.
 * @param {'auto'|'text'|'byte'|'numeric'} [options.compaction] PDF417 compaction mode.
 * @param {number} [options.eci] MicroPDF417 byte-compaction ECI assignment (3 or 26).
 * @param {number} [options.aspectRatio] Preferred MicroPDF417 symbol aspect ratio.
 * @param {object} [options.canvas] FrameQR Code artwork reservation.
 * @param {'square'|'circle'|'diamond'} [options.canvas.shape] Canvas shape.
 * @param {number} [options.canvas.size] Odd canvas size in QR modules.
 * @param {number} [options.canvas.width] Canvas width in QR modules.
 * @param {number} [options.canvas.height] Canvas height in QR modules.
 * @param {number} [options.canvas.centerX] Canvas centre X in QR modules.
 * @param {number} [options.canvas.centerY] Canvas centre Y in QR modules.
 * @param {0|90|180|270} [options.canvas.angle] Canvas quarter-turn.
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
  if (format === 'aztecrune' || format === 'aztec-rune' || format === 'rune') {
    return aztecRune.encodeAztecRune(value, options);
  }
  if (format === 'pdf417' || format === 'pdf-417') {
    return pdf417.encodePDF417(value, options);
  }
  if (format === 'compactpdf417' || format === 'compact-pdf417' || format === 'compact-pdf-417') {
    return compactPdf417.encodeCompactPDF417(value, options);
  }
  if (format === 'micropdf417' || format === 'micro-pdf417' || format === 'micro-pdf-417') {
    return micropdf417.encodeMicroPDF417(value, options);
  }
  if (format === 'microqr' || format === 'micro-qr') {
    return microqr.encodeMicroQR(value, options);
  }
  if (format === 'rmqr' || format === 'r-mqr' || format === 'rectangular-micro-qr') {
    return rmqr.encodeRMQR(value, options);
  }
  if (format === 'frameqr' || format === 'frame-qr' || format === 'canvas-qr') {
    return frameqr.encodeFrameQR(value, options);
  }
  if (format === 'gs1databar14' || format === 'gs1-databar14' || format === 'databar') {
    return databar.encodeDataBar14(value, options);
  }

  const entry = ONED_FORMATS[format];
  if (!entry) {
    const known = [...Object.keys(ONED_FORMATS), 'qr', 'datamatrix', 'aztec', 'aztecrune', 'pdf417', 'compactpdf417', 'micropdf417', 'microqr', 'rmqr', 'frameqr', 'gs1databar14'].join(', ');
    throw new EncodeError(`Unknown format "${format}". Known formats: ${known}`);
  }
  return entry.encode(value, options);
}

/**
 * @typedef {object} DecodeResult
 * @property {string} text
 * @property {string} format
 * @property {Uint8Array} [bytes] Raw octets exposed by byte-oriented payload modes, before text decoding.
 * @property {{mode: 'text'|'byte'|'numeric', text: string, bytes: Uint8Array, eci: number, latch: number|null, codewordStart: number, codewordEnd: number}[]} [segments] PDF417 compaction segments in source order.
 * @property {number} [version] QR version.
 * @property {string} [ecc] QR error-correction level.
 * @property {number} [layers] Aztec layer count.
 * @property {boolean} [compact] Whether an Aztec symbol is Compact.
 * @property {number} [corrections] Reed–Solomon corrections applied by an Aztec decode.
 * @property {number} [rows] PDF417 row count.
 * @property {number} [columns] PDF417 column count.
 * @property {number} [eccLevel] PDF417 error-correction level.
 * @property {number} [rowHeight] PDF417 row height in modules.
 * @property {number} [variant] MicroPDF417 predefined variant number.
 * @property {number} [eccCodewords] MicroPDF417 fixed error-correction codewords.
 * @property {string} [profile] FrameQR Code profile identifier.
 * @property {boolean} [certified] Whether the profile is certified by its originator.
 * @property {object} [canvas] Canvas reservation metadata for the FrameQR Code profile.
 * @property {{format:'ean2'|'ean5', text:string, parity:string, checksum?:number}} [addon] Attached EAN/UPC supplement.
 * @property {number} [confidence] Camera-profile confidence from 0 to 1.
 * @property {{x:number,y:number,width:number,height:number}} [bounds] Camera-profile bounds in the scanned orientation.
 * @property {0|90|180|270} [rotation] Camera-profile orientation in degrees.
 * @property {{quietZone:boolean,checksum:boolean|null,rows:number|null,consistency:number|null}} [quality] Camera-profile validation evidence.
 * @property {boolean} [gs1] Whether the physical symbol is classified as GS1.
 * @property {string} [symbologyIdentifier] GS1 symbology identifier.
 * @property {Array<{ai:string,value:string,fixed?:boolean}>} [elements] Parsed GS1 Application Identifier fields.
 * @property {string} [gs1ParseError] Semantic GS1 parsing error after a valid physical read.
 * @property {string} [gtin] GS1 DataBar GTIN-14 payload.
 * @property {boolean} [linkage] GS1 DataBar linkage flag.
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
 * @param {'camera'} [options.profile] Opt-in strict camera profile for validated 1D reads.
 * @param {object} [options.frameqr] FrameQR Code detector options when
 *   the profile marker is not preserved through image rendering.
 * @returns {DecodeResult[]}
 */
export function decode(image, options = {}) {
  const { formats = null, tryHarder = true, binarizer = 'auto', profile = null } = options;
  const want = formats ? new Set(formats.map((f) => f.toLowerCase())) : null;
  const wantQR = !want || want.has('qr') || want.has('qrcode');
  const wantDataMatrix = !want || want.has('datamatrix') || want.has('data-matrix');
  const wantAztec = !want || want.has('aztec') || want.has('aztec-code');
  const wantAztecRune = !want || want.has('aztecrune') || want.has('aztec-rune') || want.has('rune');
  const wantPDF417 = !want || want.has('pdf417') || want.has('pdf-417');
  const wantCompactPDF417 = !want || want.has('compactpdf417') || want.has('compact-pdf417') || want.has('compact-pdf-417');
  const wantMicroPDF417 = !want || want.has('micropdf417') || want.has('micro-pdf417') || want.has('micro-pdf-417');
  const wantMicroQR = !want || want.has('microqr') || want.has('micro-qr');
  const wantRMQR = !want || want.has('rmqr') || want.has('r-mqr') || want.has('rectangular-micro-qr');
  const wantFrameQR = !want || want.has('frameqr') || want.has('frame-qr') || want.has('canvas-qr');
  const oneDAliases = new Set(['gs1databar14', 'databar', 'gs1-databar14']);
  const wantOneD = !want || [...want].some((f) => f in ONED_FORMATS || oneDAliases.has(f));

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

    if (wantAztecRune && aztecRuneCanDecode) {
      try {
        const found = aztecRune.detectAndDecodeAztecRune(bits);
        if (found) results.push({ ...found, format: 'aztecrune' });
      } catch {
        /* no Aztec Rune in this pass */
      }
    }

    if (wantPDF417 && pdf417CanDecode) {
      try {
        const found = pdf417.detectAndDecodePDF417(bits);
        if (found) results.push({ ...found, format: 'pdf417' });
      } catch {
        /* no PDF417 in this pass */
      }
    }

    if (wantCompactPDF417 && compactPdf417CanDecode) {
      try {
        const found = compactPdf417.detectAndDecodeCompactPDF417(bits);
        if (found) results.push({ ...found, format: 'compactpdf417' });
      } catch {
        /* no Compact PDF417 in this pass */
      }
    }

    if (wantMicroPDF417 && microPdf417CanDecode) {
      // MicroPDF417 detection measures runs across the whole raster. Hybrid
      // thresholding can alter uniform modules near local-window boundaries,
      // so retry the global threshold in auto mode as for the other 2D codes.
      const microPdf417Bits = binarizer === 'auto' ? [bits, binarize(pass, 'global')] : [bits];
      for (const candidateBits of microPdf417Bits) {
        try {
          const found = micropdf417.detectAndDecodeMicroPDF417(candidateBits);
          if (found) { results.push({ ...found, format: 'micropdf417' }); break; }
        } catch {
          /* no MicroPDF417 with this threshold */
        }
      }
    }

    if (wantMicroQR && microQrCanDecode) {
      try {
        for (const found of microqr.detectAndDecodeMicroQR(bits)) {
          results.push({ ...found, format: 'microqr' });
        }
      } catch {
        /* no Micro QR in this pass */
      }
    }

    if (wantRMQR && rmqrCanDecode) {
      try {
        const found = rmqr.detectAndDecodeRMQR(bits);
        if (found) results.push({ ...found, format: 'rmqr' });
      } catch {
        /* no rMQR in this pass */
      }
    }

    if (wantFrameQR && frameQrCanDecode) {
      try {
        for (const found of frameqr.detectAndDecodeFrameQR(bits, options.frameqr ?? {})) {
          results.push({ ...found, format: 'frameqr' });
        }
      } catch {
        /* no FrameQR Code in this pass */
      }
    }

    if (wantOneD) {
      const oneDFormats = want
        ? [...want].filter((f) => f in ONED_FORMATS || oneDAliases.has(f))
        : null;
      const oneDPasses = [{ bits, rotation: 0 }];
      // A linear symbol rotated by 90° has no usable horizontal scanline.
      // The strict camera profile adds exactly two normalized orientations,
      // only when the native orientation found no validated 1D result.
      const readOneD = (candidateBits, rotation) => decodeOneD(candidateBits, {
        ...options, formats: oneDFormats, tryHarder, profile, cameraRotation: rotation,
      });
      let oneDResults = readOneD(bits, 0);
      if (profile === 'camera' && oneDResults.length === 0) {
        oneDPasses.push(
          { bits: rotateBitMatrix90(bits, false), rotation: 90 },
          { bits: rotateBitMatrix90(bits, true), rotation: 270 },
        );
        for (let i = 1; i < oneDPasses.length && oneDResults.length === 0; i++) {
          oneDResults = readOneD(oneDPasses[i].bits, oneDPasses[i].rotation);
        }
      }
      for (const found of oneDResults) {
        const { row, ...publicFound } = found;
        void row;
        if (publicFound.gs1) {
          const semanticText = publicFound.format === 'gs1databar14'
            ? `01${publicFound.gtin ?? publicFound.text}`
            : publicFound.text;
          try {
            publicFound.elements = databar.decodeGS1ElementString(semanticText);
          } catch (error) {
            publicFound.gs1ParseError = error instanceof Error ? error.message : String(error);
          }
        }
        results.push(publicFound);
      }
    }

    if (results.length > 0) break;
  }

  // De-duplicate: the same symbol is often read on several scan rows.
  const seen = new Set();
  const unique = results.filter((r) => {
    const key = `${r.format}:${r.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // On large clean rasters, hybrid thresholding can erase otherwise uniform
  // QR/PDF417 modules. Keep auto/hybrid as the primary strategy, then make one
  // focused global retry only when the complete primary pass found nothing.
  // This deliberately leaves an explicit global request single-pass.
  const retryFormats = formats
    ? formats.filter((format) => {
      const id = String(format).toLowerCase();
      return id === 'qr' || id === 'qrcode'
        || id === 'pdf417' || id === 'pdf-417'
        || id === 'compactpdf417' || id === 'compact-pdf417' || id === 'compact-pdf-417';
    })
    : ['qr', 'pdf417', 'compactpdf417'];
  const shouldRetryGlobal = unique.length === 0
    && (binarizer === 'auto' || binarizer === 'hybrid')
    && retryFormats.length > 0;

  if (!shouldRetryGlobal) {
    return profile === 'camera'
      ? unique.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
      : unique;
  }

  const fallback = decode(image, {
    ...options,
    formats: retryFormats,
    binarizer: 'global',
  });
  const fallbackSeen = new Set();
  const merged = [...unique, ...fallback].filter((r) => {
    const key = `${r.format}:${r.text}`;
    if (fallbackSeen.has(key)) return false;
    fallbackSeen.add(key);
    return true;
  });
  return profile === 'camera'
    ? merged.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    : merged;
}

/**
 * @param {BitMatrix} matrix
 * @param {boolean} clockwise
 * @returns {BitMatrix}
 */
function rotateBitMatrix90(matrix, clockwise) {
  const rotated = new BitMatrix(matrix.height, matrix.width);
  for (let y = 0; y < matrix.height; y++) {
    for (let x = 0; x < matrix.width; x++) {
      if (!matrix.get(x, y)) continue;
      if (clockwise) rotated.set(matrix.height - 1 - y, x);
      else rotated.set(y, matrix.width - 1 - x);
    }
  }
  return rotated;
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
export const VERSION = '1.5.7';
