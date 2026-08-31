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
import { BitMatrix } from './js/core/bit-matrix.js';
import { EncodeError, NotFoundError } from './js/core/errors.js';
import { LuminanceSource } from './js/image/luminance.js';
import { binarize } from './js/image/binarizer.js';
import { ONED_FORMATS, encodeCode32, encodePZN, encodeStandard2of5, encodeIndustrial2of5, encodeIATA2of5, encodePostnet, encodePlanet, encodeRM4SCC, encodeKIX, encodeAustraliaPost, encodeJapanPost, encodeIMB, } from './js/oned/index.js';
import { decodeOneD } from './js/oned/reader.js';
import { encodeTelepen, encodeTelepenNumeric } from './js/oned/telepen.js';
import * as datamatrix from './js/datamatrix/index.js';
import * as qr from './js/qr/index.js';
import * as aztec from './js/aztec/index.js';
import * as pdf417 from './js/pdf417/index.js';
import * as micropdf417 from './js/micropdf417/index.js';
import * as microqr from './js/microqr/index.js';
import * as rmqr from './js/rmqr/index.js';
import * as frameqr from './js/frameqr/index.js';
import * as aztecRune from './js/aztecrune/index.js';
import * as compactPdf417 from './js/compactpdf417/index.js';
import * as databar from './js/databar/index.js';
import * as maxicode from './js/maxicode/index.js';
export { BitMatrix };
export { BarcodeError, EncodeError, NotFoundError, FormatError, ChecksumError, } from './js/core/errors.js';
export { LuminanceSource } from './js/image/luminance.js';
export { binarize, binarizeGlobal, binarizeHybrid } from './js/image/binarizer.js';
export * from './js/oned/index.js';
export { toSVG, toSVGDataURI } from './js/render/svg.js';
export { toImageData, toCanvas } from './js/render/image-data.js';
export { toPNG, toPNGDataURI } from './js/render/png.js';
export { renderToCanvasAuto, isWebGL2Available } from './js/render/index.js';
export { renderToCanvasAutoAsync, isWebGPUAvailable } from './js/render/index.js';
export { encodeQR, decodeQR, detectQR, detectAndDecodeQR } from './js/qr/index.js';
export { encodeDataMatrix, decodeDataMatrix, detectDataMatrix, detectAndDecodeDataMatrix, } from './js/datamatrix/index.js';
export { encodeAztec, decodeAztec, detectAztec, detectAndDecodeAztec } from './js/aztec/index.js';
export * from './js/aztecrune/index.js';
export { encodePDF417, decodePDF417, detectPDF417, detectAndDecodePDF417 } from './js/pdf417/index.js';
export * from './js/compactpdf417/index.js';
// DataBar exports include the verified GTIN/data layer and the supported
// Omnidirectional/Truncated, Limited, Stacked and Stacked Omnidirectional paths.
export * from './js/databar/index.js';
export { encodeMaxiCode, decodeMaxiCode, detectMaxiCode, detectAndDecodeMaxiCode, } from './js/maxicode/index.js';
export { encodeMicroPDF417, decodeMicroPDF417, detectMicroPDF417, detectAndDecodeMicroPDF417, } from './js/micropdf417/index.js';
export { encodeMicroQR, decodeMicroQR, detectMicroQR, detectAndDecodeMicroQR } from './js/microqr/index.js';
export { encodeRMQR, decodeRMQR, detectRMQR, detectAndDecodeRMQR } from './js/rmqr/index.js';
export { encodeFrameQR, decodeFrameQR, detectFrameQR, detectAndDecodeFrameQR, } from './js/frameqr/index.js';
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
const dataBarStackedCanEncode = typeof databar.encodeDataBar14Stacked === 'function';
const dataBarStackedCanDecode = typeof databar.detectAndDecodeDataBar14Stacked === 'function';
const dataBarStackedOmniCanEncode = typeof databar.encodeDataBarStackedOmnidirectional === 'function';
const dataBarStackedOmniCanDecode = typeof databar.detectAndDecodeDataBarStackedOmnidirectional === 'function';
const dataBarLimitedCanEncode = typeof databar.encodeDataBarLimited === 'function';
const dataBarLimitedCanDecode = typeof databar.detectAndDecodeDataBarLimited === 'function';
const dataBarExpandedCanEncode = typeof databar.encodeDataBarExpanded === 'function';
const dataBarExpandedCanDecode = typeof databar.detectAndDecodeDataBarExpanded === 'function';
const maxicodeCanEncode = typeof maxicode.encodeMaxiCode === 'function';
const maxicodeCanDecode = typeof maxicode.detectAndDecodeMaxiCode === 'function';
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
        label: 'Sythos Canvas QR profile',
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
    formats.push({
        id: 'gs1databar-stacked',
        label: 'GS1 DataBar Stacked',
        canWrite: dataBarStackedCanEncode,
        canRead: dataBarStackedCanDecode,
        kind: /** @type {'1D'} */ ('1D'),
    });
    formats.push({
        id: 'gs1databar-stacked-omnidirectional',
        label: 'GS1 DataBar Stacked Omnidirectional',
        canWrite: dataBarStackedOmniCanEncode,
        canRead: dataBarStackedOmniCanDecode,
        kind: /** @type {'1D'} */ ('1D'),
    });
    formats.push({
        id: 'gs1databar-limited',
        label: 'GS1 DataBar Limited',
        canWrite: dataBarLimitedCanEncode,
        canRead: dataBarLimitedCanDecode,
        kind: /** @type {'1D'} */ ('1D'),
    });
    formats.push({
        id: 'gs1databar-expanded',
        label: 'GS1 DataBar Expanded',
        canWrite: dataBarExpandedCanEncode,
        canRead: dataBarExpandedCanDecode,
        kind: /** @type {'1D'} */ ('1D'),
    });
    formats.push({
        id: 'maxicode',
        label: 'MaxiCode',
        canWrite: maxicodeCanEncode,
        canRead: maxicodeCanDecode,
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
 * @param {'ascii'|'numeric'} [options.telepenMode] Telepen encoding mode.
 * @param {boolean} [options.numeric] Alias for Telepen Numeric mode.
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
 * @param {boolean} [options.pzn8] Select the eight-digit PZN profile.
 * @param {'pzn7'|'pzn8'|'standard'|'industrial'|'iata'} [options.variant] PZN or Code 25 variant.
 * @param {number} [options.wideRatio] Wide-bar ratio for Code 25 variants.
 * @param {2|3|4|5} [options.mode] MaxiCode mode.
 * @param {{postalCode:string,countryCode:number,serviceClass:number}} [options.primary] MaxiCode structured primary data for modes 2 and 3.
 * @param {'latin1'} [options.charset] MaxiCode character set declaration.
 * @param {boolean} [options.linkage] GS1 DataBar composite linkage flag.
 * @param {number} [options.moduleScale] Integer module scale for GS1 DataBar physical variants.
 * @param {number} [options.height] Output height for a GS1 DataBar physical variant.
 * @param {object} [options.canvas] Sythos Canvas QR artwork reservation.
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
    if (format === 'gs1databar-stacked' || format === 'gs1-databar-stacked' || format === 'databar-stacked') {
        return databar.encodeDataBar14Stacked(value, options);
    }
    if (format === 'gs1databar-stacked-omnidirectional'
        || format === 'gs1-databar-stacked-omnidirectional'
        || format === 'databar-stacked-omni') {
        return databar.encodeDataBarStackedOmnidirectional(value, options);
    }
    if (format === 'gs1databar-limited' || format === 'gs1-databar-limited' || format === 'databar-limited') {
        return databar.encodeDataBarLimited(value, options);
    }
    if (format === 'gs1databar-expanded' || format === 'gs1-databar-expanded' || format === 'databar-expanded') {
        return databar.encodeDataBarExpanded(value, options);
    }
    if (format === 'maxicode' || format === 'maxi-code') {
        return maxicode.encodeMaxiCode(value, options);
    }
    if (format === 'telepennumeric' || format === 'telepen-numeric') {
        return encodeTelepenNumeric(value);
    }
    if (format === 'telepen' || format === 'telepen-alpha') {
        return encodeTelepen(value, options);
    }
    if (format === 'code32' || format === 'italian-pharmacode') {
        return encodeCode32(value);
    }
    if (format === 'pzn' || format === 'pzn7' || format === 'pzn8') {
        return encodePZN(value, {
            ...options,
            pzn8: format === 'pzn8' || options.pzn8 === true || options.variant === 'pzn8',
        });
    }
    if (format === 'code2of5' || format === 'standard2of5' || format === 'standard-2-of-5') {
        return encodeStandard2of5(value, options);
    }
    if (format === 'industrial2of5' || format === 'industrial-2-of-5') {
        return encodeIndustrial2of5(value, options);
    }
    if (format === 'iata2of5' || format === 'iata-2-of-5') {
        return encodeIATA2of5(value, options);
    }
    if (format === 'postnet' || format === 'usps-postnet') {
        return encodePostnet(value, options);
    }
    if (format === 'planet' || format === 'usps-planet') {
        return encodePlanet(value, options);
    }
    if (format === 'rm4scc' || format === 'royalmail' || format === 'royal-mail') {
        return encodeRM4SCC(value, options);
    }
    if (format === 'kix') {
        return encodeKIX(value);
    }
    if (format === 'auspost' || format === 'australia-post' || format === 'australiapost') {
        return encodeAustraliaPost(value, options);
    }
    if (format === 'japanpost' || format === 'japan-post') {
        return encodeJapanPost(value);
    }
    if (format === 'imb' || format === 'onecode' || format === 'usps-onecode') {
        return encodeIMB(value);
    }
    const entry = ONED_FORMATS[format];
    if (!entry) {
        const known = [...Object.keys(ONED_FORMATS), 'telepennumeric', 'telepen-numeric',
            'code32', 'italian-pharmacode', 'pzn', 'pzn7', 'pzn8',
            'code2of5', 'standard2of5', 'standard-2-of-5', 'industrial-2-of-5', 'iata-2-of-5',
            'postnet', 'usps-postnet', 'planet', 'usps-planet', 'rm4scc', 'royalmail', 'royal-mail',
            'kix', 'auspost', 'australia-post', 'australiapost', 'japanpost', 'japan-post',
            'imb', 'onecode', 'usps-onecode',
            'qr', 'datamatrix', 'aztec', 'aztecrune', 'pdf417', 'compactpdf417', 'micropdf417', 'microqr', 'rmqr', 'frameqr', 'gs1databar14', 'gs1databar-stacked', 'gs1databar-stacked-omnidirectional', 'gs1databar-limited', 'gs1databar-expanded', 'maxicode'].join(', ');
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
 * @property {string} [profile] Sythos Canvas QR profile identifier.
 * @property {boolean} [certified] Whether the profile is certified by its originator.
 * @property {object} [canvas] Canvas reservation metadata for the Sythos profile.
 * @property {{format:'ean2'|'ean5', text:string, parity:string, checksum?:number}} [addon] Attached EAN/UPC supplement.
 * @property {number} [confidence] Camera-profile confidence from 0 to 1.
 * @property {{x:number,y:number,width:number,height:number}} [bounds] Camera-profile bounds in the scanned orientation.
 * @property {0|45|90|135|180|225|270|315} [rotation] Camera-profile orientation in degrees.
 * @property {{quietZone:boolean,checksum:boolean|null,rows:number|null,consistency:number|null}} [quality] Camera-profile validation evidence.
 * @property {boolean} [gs1] Whether the physical symbol is classified as GS1.
 * @property {string} [symbologyIdentifier] GS1 symbology identifier.
 * @property {Array<{ai:string,value:string,fixed?:boolean}>} [elements] Parsed GS1 Application Identifier fields.
 * @property {string} [gs1ParseError] Semantic GS1 parsing error after a valid physical read.
 * @property {string} [gtin] GS1 DataBar GTIN-14 payload.
 * @property {boolean} [linkage] GS1 DataBar linkage flag.
 * @property {boolean} [checkDigit] Whether an optional numeric check digit was validated.
 * @property {'pzn7'|'pzn8'} [pznVariant] PZN variant identified by the decoder.
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
 * @param {'camera'} [options.profile] Opt-in strict camera profile for validated reads.
 * @param {object} [options.frameqr] Sythos Canvas QR detector options when
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
    const wantMaxiCode = !want || want.has('maxicode') || want.has('maxi-code');
    const wantDataBarStacked = !want || want.has('gs1databar-stacked') || want.has('gs1-databar-stacked') || want.has('databar-stacked');
    const wantDataBarStackedOmni = !want || want.has('gs1databar-stacked-omnidirectional')
        || want.has('gs1-databar-stacked-omnidirectional') || want.has('databar-stacked-omni');
    const wantDataBarLimited = !want || want.has('gs1databar-limited')
        || want.has('gs1-databar-limited') || want.has('databar-limited');
    const wantDataBarExpanded = !want || want.has('gs1databar-expanded')
        || want.has('gs1-databar-expanded') || want.has('databar-expanded');
    const oneDAliases = new Set([
        'gs1databar14', 'databar', 'gs1-databar14',
        'gs1databar-stacked', 'gs1-databar-stacked', 'databar-stacked',
        'gs1databar-stacked-omnidirectional', 'gs1-databar-stacked-omnidirectional', 'databar-stacked-omni',
        'gs1databar-limited', 'gs1-databar-limited', 'databar-limited',
        'gs1databar-expanded', 'gs1-databar-expanded', 'databar-expanded',
        'telepen-alpha', 'telepennumeric', 'telepen-numeric',
        'code32', 'italian-pharmacode', 'pzn7', 'pzn8',
        'code2of5', 'standard2of5', 'standard-2-of-5',
        'industrial-2-of-5', 'iata-2-of-5',
        'usps-postnet', 'usps-planet', 'royalmail', 'royal-mail',
        'australia-post', 'australiapost', 'japan-post', 'onecode', 'usps-onecode',
    ]);
    const wantOneD = !want || [...want].some((f) => f in ONED_FORMATS || oneDAliases.has(f));
    const wantTwoD = wantQR || wantDataMatrix || wantAztec || wantAztecRune || wantPDF417
        || wantCompactPDF417 || wantMicroPDF417 || wantMicroQR || wantRMQR || wantFrameQR || wantMaxiCode
        || wantDataBarStacked || wantDataBarStackedOmni || wantDataBarLimited || wantDataBarExpanded;
    const source = LuminanceSource.fromImageData(image);
    const results = [];
    // Light-on-dark symbols are common on screens and packaging, so a second
    // inverted pass is worth the cost when the first finds nothing.
    const passes = tryHarder ? [source, source.invert()] : [source];
    for (const pass of passes) {
        const bits = binarize(pass, binarizer);
        // Keep all two-dimensional detector calls in one helper so camera-only
        // orientation retries use exactly the same validation path as the native
        // orientation. Arbitrary-angle retries remain opt-in to the camera
        // profile because resampling is intentionally not part of ordinary decode.
        const readTwoD = (candidateBits, cameraRotation = 0, candidateSource = pass) => {
            const before = results.length;
            const add = (found, format) => {
                if (!found)
                    return;
                const publicFound = { ...found, format };
                if (profile === 'camera' && cameraRotation !== 0)
                    publicFound.rotation = cameraRotation;
                results.push(publicFound);
            };
            if (wantQR && qrCanDecode) {
                try {
                    for (const found of qr.detectAndDecodeQR(candidateBits))
                        add(found, 'qr');
                }
                catch {
                    /* no QR in this pass */
                }
            }
            if (wantDataMatrix && dataMatrixCanDecode) {
                // Hybrid thresholding can erase the interior of very large, perfectly
                // uniform modules. In auto mode keep the local-threshold attempt, then
                // retry Data Matrix once with the global threshold before giving up.
                const dataMatrixBits = binarizer === 'auto'
                    ? [candidateBits, binarize(candidateSource, 'global')]
                    : [candidateBits];
                for (const thresholdBits of dataMatrixBits) {
                    try {
                        const found = datamatrix.detectAndDecodeDataMatrix(thresholdBits);
                        if (found) {
                            add(found, 'datamatrix');
                            break;
                        }
                    }
                    catch {
                        /* no Data Matrix with this threshold */
                    }
                }
            }
            if (wantAztec && aztecCanDecode) {
                // The central bull's-eye is a small, high-contrast target. Hybrid
                // thresholding can flatten it on clean rendered symbols, so mirror the
                // Data Matrix global fallback in auto mode.
                const aztecBits = binarizer === 'auto'
                    ? [candidateBits, binarize(candidateSource, 'global')]
                    : [candidateBits];
                for (const thresholdBits of aztecBits) {
                    try {
                        const found = aztec.detectAndDecodeAztec(thresholdBits);
                        if (found) {
                            add(found, 'aztec');
                            break;
                        }
                    }
                    catch {
                        /* no Aztec code with this threshold */
                    }
                }
            }
            if (wantAztecRune && aztecRuneCanDecode) {
                try {
                    const found = aztecRune.detectAndDecodeAztecRune(candidateBits);
                    if (found)
                        add(found, 'aztecrune');
                }
                catch {
                    /* no Aztec Rune in this pass */
                }
            }
            if (wantPDF417 && pdf417CanDecode) {
                try {
                    const found = pdf417.detectAndDecodePDF417(candidateBits);
                    if (found)
                        add(found, 'pdf417');
                }
                catch {
                    /* no PDF417 in this pass */
                }
            }
            if (wantCompactPDF417 && compactPdf417CanDecode) {
                try {
                    const found = compactPdf417.detectAndDecodeCompactPDF417(candidateBits);
                    if (found)
                        add(found, 'compactpdf417');
                }
                catch {
                    /* no Compact PDF417 in this pass */
                }
            }
            if (wantMicroPDF417 && microPdf417CanDecode) {
                // MicroPDF417 detection measures runs across the whole raster. Hybrid
                // thresholding can alter uniform modules near local-window boundaries,
                // so retry the global threshold in auto mode as for the other 2D codes.
                const microPdf417Bits = binarizer === 'auto'
                    ? [candidateBits, binarize(candidateSource, 'global')]
                    : [candidateBits];
                for (const thresholdBits of microPdf417Bits) {
                    try {
                        const found = micropdf417.detectAndDecodeMicroPDF417(thresholdBits);
                        if (found) {
                            add(found, 'micropdf417');
                            break;
                        }
                    }
                    catch {
                        /* no MicroPDF417 with this threshold */
                    }
                }
            }
            if (wantMicroQR && microQrCanDecode) {
                try {
                    for (const found of microqr.detectAndDecodeMicroQR(candidateBits))
                        add(found, 'microqr');
                }
                catch {
                    /* no Micro QR in this pass */
                }
            }
            if (wantRMQR && rmqrCanDecode) {
                try {
                    const found = rmqr.detectAndDecodeRMQR(candidateBits);
                    if (found)
                        add(found, 'rmqr');
                }
                catch {
                    /* no rMQR in this pass */
                }
            }
            if (wantFrameQR && frameQrCanDecode) {
                try {
                    for (const found of frameqr.detectAndDecodeFrameQR(candidateBits, options.frameqr ?? {}))
                        add(found, 'frameqr');
                }
                catch {
                    /* no Sythos Canvas QR profile in this pass */
                }
            }
            if (wantMaxiCode && maxicodeCanDecode) {
                try {
                    const found = maxicode.detectAndDecodeMaxiCode(candidateBits);
                    if (found)
                        add(found, 'maxicode');
                }
                catch {
                    /* no MaxiCode in this pass */
                }
            }
            if (wantDataBarStacked && dataBarStackedCanDecode) {
                try {
                    const found = databar.detectAndDecodeDataBar14Stacked(candidateBits);
                    if (found)
                        add(found, 'gs1databar-stacked');
                }
                catch {
                    /* no GS1 DataBar Stacked in this pass */
                }
            }
            if (wantDataBarStackedOmni && dataBarStackedOmniCanDecode) {
                try {
                    const found = databar.detectAndDecodeDataBarStackedOmnidirectional(candidateBits);
                    if (found)
                        add(found, 'gs1databar-stacked-omnidirectional');
                }
                catch {
                    /* no GS1 DataBar Stacked Omnidirectional in this pass */
                }
            }
            if (wantDataBarLimited && dataBarLimitedCanDecode) {
                try {
                    const found = databar.detectAndDecodeDataBarLimited(candidateBits);
                    if (found)
                        add(found, 'gs1databar-limited');
                }
                catch {
                    /* no GS1 DataBar Limited in this pass */
                }
            }
            if (wantDataBarExpanded && dataBarExpandedCanDecode) {
                try {
                    const found = databar.detectAndDecodeDataBarExpanded(candidateBits);
                    if (found)
                        add(found, 'gs1databar-expanded');
                }
                catch {
                    /* no GS1 DataBar Expanded in this pass */
                }
            }
            return results.length > before;
        };
        const twoDFound = readTwoD(bits);
        if (profile === 'camera' && wantTwoD && !twoDFound) {
            // Normalize a camera frame through the full eight-angle set only after
            // the native orientation has failed. This preserves the fast path while
            // limiting resampling to frames that need it.
            const cameraRotations = [45, 90, 135, 180, 225, 270, 315];
            for (const rotation of cameraRotations) {
                const inverse = (360 - rotation) % 360;
                const orientedSource = inverse % 90 === 0
                    ? inverse === 0
                        ? pass
                        : inverse === 90
                            ? pass.rotate90()
                            : inverse === 180
                                ? rotateLuminanceSourceByDegrees(pass, 180)
                                : pass.rotate90().rotate90().rotate90()
                    : rotateLuminanceSourceByDegrees(pass, inverse);
                if (readTwoD(binarize(orientedSource, binarizer), rotation, orientedSource))
                    break;
            }
        }
        if (wantOneD) {
            const oneDFormats = want
                ? [...want].filter((f) => f in ONED_FORMATS || oneDAliases.has(f))
                : null;
            const oneDPasses = [{ bits, rotation: 0 }];
            // A linear symbol rotated away from the horizontal has no usable
            // horizontal scanline. The strict camera profile adds normalized
            // orientations only when the native orientation found no validated 1D
            // result. Keep the two quarter-turns first: they are the established
            // path and avoid paying for diagonal resampling on the common case.
            const readOneD = (candidateBits, rotation) => decodeOneD(candidateBits, {
                ...options, formats: oneDFormats, tryHarder, profile, cameraRotation: rotation,
            });
            let oneDResults = readOneD(bits, 0);
            if (profile === 'camera' && oneDResults.length === 0) {
                // `rotation` describes the supplied raster, clockwise from the
                // canonical horizontal orientation. To normalize it, apply the
                // inverse rotation.  Include 180 explicitly so the full eight-angle
                // set still works when tryHarder is disabled (the normal reversed-row
                // pass also handles it without a second raster transform).
                const cameraRotations = [90, 270, 180, 45, 135, 225, 315];
                for (const rotation of cameraRotations) {
                    const inverse = (360 - rotation) % 360;
                    const oriented = inverse % 90 === 0
                        ? inverse === 0
                            ? bits.clone()
                            : inverse === 180
                                ? (() => { const copy = bits.clone(); copy.rotate180(); return copy; })()
                                : rotateBitMatrix90(bits, inverse === 90)
                        : rotateBitMatrixByDegrees(bits, inverse);
                    oneDPasses.push({ bits: oriented, rotation });
                }
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
                    }
                    catch (error) {
                        publicFound.gs1ParseError = error instanceof Error ? error.message : String(error);
                    }
                }
                results.push(publicFound);
            }
        }
        if (results.length > 0)
            break;
    }
    // De-duplicate: the same symbol is often read on several scan rows.
    const seen = new Set();
    const unique = results.filter((r) => {
        const key = `${r.format}:${r.text}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
    // On large clean rasters, hybrid thresholding can erase otherwise uniform
    // QR, PDF417 and MaxiCode modules. Keep auto/hybrid as the primary strategy,
    // then make one focused global retry only when the complete primary pass
    // found nothing.
    // This deliberately leaves an explicit global request single-pass.
    const retryFormats = formats
        ? formats.filter((format) => {
            const id = String(format).toLowerCase();
            return id === 'qr' || id === 'qrcode'
                || id === 'pdf417' || id === 'pdf-417'
                || id === 'compactpdf417' || id === 'compact-pdf417' || id === 'compact-pdf-417'
                || id === 'maxicode' || id === 'maxi-code';
        })
        : ['qr', 'pdf417', 'compactpdf417', 'maxicode'];
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
        if (fallbackSeen.has(key))
            return false;
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
            if (!matrix.get(x, y))
                continue;
            if (clockwise)
                rotated.set(matrix.height - 1 - y, x);
            else
                rotated.set(y, matrix.width - 1 - x);
        }
    }
    return rotated;
}
/**
 * Rotate a binarized raster by an arbitrary clockwise angle without changing
 * the source matrix. This is intentionally used only by the strict camera
 * profile: arbitrary-angle resampling is useful for linear symbols, but is
 * too permissive to become a default retry for every detector.
 *
 * @param {BitMatrix} matrix
 * @param {number} degrees Clockwise angle, normally one of 45/135/225/315.
 * @returns {BitMatrix}
 */
function rotateBitMatrixByDegrees(matrix, degrees) {
    const angle = ((degrees % 360) + 360) % 360;
    if (angle === 0)
        return matrix.clone();
    if (angle === 90)
        return rotateBitMatrix90(matrix, true);
    if (angle === 180) {
        const rotated = matrix.clone();
        rotated.rotate180();
        return rotated;
    }
    if (angle === 270)
        return rotateBitMatrix90(matrix, false);
    const radians = angle * Math.PI / 180;
    const sin = Math.sin(radians);
    const cos = Math.cos(radians);
    const width = Math.ceil(Math.abs(matrix.width * cos) + Math.abs(matrix.height * sin));
    const height = Math.ceil(Math.abs(matrix.width * sin) + Math.abs(matrix.height * cos));
    const rotated = new BitMatrix(width, height);
    const sourceCenterX = (matrix.width - 1) / 2;
    const sourceCenterY = (matrix.height - 1) / 2;
    const destinationCenterX = (width - 1) / 2;
    const destinationCenterY = (height - 1) / 2;
    // Inverse-map destination pixels into the source. Sampling the already
    // binarized raster keeps the operation deterministic and leaves the caller's
    // original image and threshold result untouched.
    for (let y = 0; y < height; y++) {
        const dy = y - destinationCenterY;
        for (let x = 0; x < width; x++) {
            const dx = x - destinationCenterX;
            const sourceX = Math.round(cos * dx + sin * dy + sourceCenterX);
            const sourceY = Math.round(-sin * dx + cos * dy + sourceCenterY);
            if (sourceX >= 0 && sourceX < matrix.width && sourceY >= 0 && sourceY < matrix.height &&
                matrix.get(sourceX, sourceY)) {
                rotated.set(x, y);
            }
        }
    }
    return rotated;
}
/**
 * Rotate the greyscale source before thresholding. Resampling luminance rather
 * than an already-binarized matrix preserves module contrast at diagonal
 * orientations and gives the format-specific detectors the same input quality
 * as the native camera frame.
 *
 * @param {LuminanceSource} source
 * @param {number} degrees Clockwise angle.
 * @returns {LuminanceSource}
 */
function rotateLuminanceSourceByDegrees(source, degrees) {
    const angle = ((degrees % 360) + 360) % 360;
    if (angle === 0)
        return source;
    if (angle === 90)
        return source.rotate90();
    if (angle === 180)
        return source.rotate90().rotate90();
    if (angle === 270)
        return source.rotate90().rotate90().rotate90();
    const radians = angle * Math.PI / 180;
    const sin = Math.sin(radians);
    const cos = Math.cos(radians);
    const width = Math.ceil(Math.abs(source.width * cos) + Math.abs(source.height * sin));
    const height = Math.ceil(Math.abs(source.width * sin) + Math.abs(source.height * cos));
    const rotated = new Uint8Array(width * height);
    rotated.fill(255);
    const sourceCenterX = (source.width - 1) / 2;
    const sourceCenterY = (source.height - 1) / 2;
    const destinationCenterX = (width - 1) / 2;
    const destinationCenterY = (height - 1) / 2;
    for (let y = 0; y < height; y++) {
        const dy = y - destinationCenterY;
        for (let x = 0; x < width; x++) {
            const dx = x - destinationCenterX;
            const sourceX = cos * dx + sin * dy + sourceCenterX;
            const sourceY = -sin * dx + cos * dy + sourceCenterY;
            if (sourceX >= 0 && sourceX < source.width && sourceY >= 0 && sourceY < source.height) {
                const left = Math.floor(sourceX), top = Math.floor(sourceY);
                const right = Math.min(source.width - 1, left + 1);
                const bottom = Math.min(source.height - 1, top + 1);
                const fx = sourceX - left, fy = sourceY - top;
                const topValue = source.get(left, top) * (1 - fx) + source.get(right, top) * fx;
                const bottomValue = source.get(left, bottom) * (1 - fx) + source.get(right, bottom) * fx;
                rotated[y * width + x] = Math.round(topValue * (1 - fy) + bottomValue * fy);
            }
        }
    }
    return LuminanceSource.fromGrey(rotated, width, height);
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
    if (results.length === 0)
        throw new NotFoundError('No barcode found in image');
    return results[0];
}
/** Library version, matching package.json. */
export const VERSION = '1.5.14';
