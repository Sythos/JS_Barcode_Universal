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
import type { GS1CompositeComponent, GS1CompositeInput } from './composite/index.js';
export { BitMatrix };
export { BarcodeError, EncodeError, NotFoundError, FormatError, ChecksumError, } from './core/errors.js';
export { LuminanceSource } from './image/luminance.js';
export { binarize, binarizeGlobal, binarizeHybrid } from './image/binarizer.js';
export * from './oned/index.js';
export { toSVG, toSVGDataURI } from './render/svg.js';
export { toImageData, toCanvas } from './render/image-data.js';
export { toPNG, toPNGDataURI } from './render/png.js';
export { renderToCanvasAuto, isWebGL2Available } from './render/index.js';
export { renderToCanvasAutoAsync, isWebGPUAvailable } from './render/index.js';
export { encodeQR, decodeQR, detectQR, detectAndDecodeQR } from './qr/index.js';
export { encodeDataMatrix, decodeDataMatrix, detectDataMatrix, detectAndDecodeDataMatrix, } from './datamatrix/index.js';
export { encodeAztec, decodeAztec, detectAztec, detectAndDecodeAztec } from './aztec/index.js';
export * from './aztecrune/index.js';
export { encodePDF417, decodePDF417, detectPDF417, detectAndDecodePDF417 } from './pdf417/index.js';
export * from './compactpdf417/index.js';
export * from './databar/index.js';
export { encodeMicroPDF417, decodeMicroPDF417, detectMicroPDF417, detectAndDecodeMicroPDF417, } from './micropdf417/index.js';
export { encodeMicroQR, decodeMicroQR, detectMicroQR, detectAndDecodeMicroQR } from './microqr/index.js';
export { encodeRMQR, decodeRMQR, detectRMQR, detectAndDecodeRMQR } from './rmqr/index.js';
export { encodeFrameQR, decodeFrameQR, detectFrameQR, detectAndDecodeFrameQR, } from './frameqr/index.js';
export {
  GS1_COMPOSITE_PROFILE,
  GS1_COMPOSITE_HOSTS,
  encodeGS1Composite,
  decodeGS1Composite,
  detectGS1Composite,
  detectAndDecodeGS1Composite,
} from './composite/index.js';
export type {
  GS1CompositeHostFormat,
  GS1CompositeComponent,
  GS1Element,
  GS1CompositeInput,
  GS1CompositeOptions,
  GS1CompositeResult,
} from './composite/index.js';
export type FormatInfo = {
    id: string;
    label: string;
    canWrite: boolean;
    canRead: boolean;
    kind: '1D' | '2D';
    role?: 'supplement';
};
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
export declare function listFormats(): FormatInfo[];
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
 * @param {boolean} [options.pzn8] Select the eight-digit PZN profile.
 * @param {'pzn7'|'pzn8'|'standard'|'industrial'|'iata'} [options.variant] PZN or Code 25 variant.
 * @param {number} [options.wideRatio] Wide-bar ratio for Code 25 variants.
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
export declare function encode(text: string | number | GS1CompositeInput, options?: {
    format?: string;
    ecc?: 'L' | 'M' | 'Q' | 'H';
    version?: number;
    checkDigit?: boolean;
    pzn8?: boolean;
    variant?: 'pzn7' | 'pzn8' | 'standard' | 'industrial' | 'iata';
    wideRatio?: number;
    telepenMode?: 'ascii' | 'numeric';
    numeric?: boolean;
    fullAscii?: boolean;
    gs1?: boolean;
    layers?: number;
    compact?: boolean;
    eccPercent?: number;
    eccLevel?: number;
    columns?: number;
    rows?: number;
    rowHeight?: number;
    compaction?: 'auto' | 'text' | 'byte' | 'numeric';
    eci?: number;
    aspectRatio?: number;
    canvas?: {
        shape?: 'square' | 'circle' | 'diamond';
        size?: number;
        width?: number;
        height?: number;
        centerX?: number;
        centerY?: number;
        angle?: 0 | 90 | 180 | 270;
    };
    component?: GS1CompositeComponent;
    separatorGap?: 1 | 2 | 3;
    moduleScale?: number;
}): BitMatrix;
export type DecodeResult = {
    text: string;
    format: string;
    /**
     * Raw octets exposed by byte-oriented payload modes, before text decoding.
     */
    bytes?: Uint8Array;
    /**
     * PDF417 compaction segments in source order.
     */
    segments?: {
        mode: 'text' | 'byte' | 'numeric';
        text: string;
        bytes: Uint8Array;
        eci: number;
        latch: number | null;
        codewordStart: number;
        codewordEnd: number;
    }[];
    /**
     * QR version.
     */
    version?: number;
    /**
     * QR error-correction level.
     */
    ecc?: string;
    /**
     * Aztec layer count.
     */
    layers?: number;
    /**
     * Whether an Aztec symbol is Compact.
     */
    compact?: boolean;
    /**
     * Reed–Solomon corrections applied by an Aztec decode.
     */
    corrections?: number;
    /**
     * PDF417 row count.
     */
    rows?: number;
    /**
     * PDF417 column count.
     */
    columns?: number;
    /**
     * PDF417 error-correction level.
     */
    eccLevel?: number;
    /**
     * PDF417 row height in modules.
     */
    rowHeight?: number;
    /**
     * MicroPDF417 predefined variant number.
     */
    variant?: number;
    /**
     * MicroPDF417 fixed error-correction codewords.
     */
    eccCodewords?: number;
    /**
     * FrameQR Code profile identifier.
     */
    profile?: string;
    /**
     * Whether the profile is certified by its originator.
     */
    certified?: boolean;
    /**
     * Canvas reservation metadata for the FrameQR Code profile.
     */
    canvas?: object;
    /**
     * Attached EAN/UPC supplement.
     */
    addon?: {
        format: 'ean2' | 'ean5';
        text: string;
        parity: string;
        checksum?: number;
    };
    /**
     * Camera-profile confidence from 0 to 1.
     */
    confidence?: number;
    /**
     * Camera-profile bounds in the scanned orientation.
     */
    bounds?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    /**
     * Camera-profile orientation in degrees.
     */
    rotation?: 0 | 45 | 90 | 135 | 180 | 225 | 270 | 315;
    /**
     * Camera-profile validation evidence.
     */
    quality?: {
        quietZone: boolean;
        checksum: boolean | null;
        rows: number | null;
        consistency: number | null;
    };
    /**
     * Whether the physical symbol is classified as GS1.
     */
    gs1?: boolean;
    /**
     * GS1 symbology identifier.
     */
    symbologyIdentifier?: string;
    /**
     * Parsed GS1 Application Identifier fields.
     */
    elements?: Array<{
        ai: string;
        value: string;
        fixed?: boolean;
    }>;
    /**
     * Semantic GS1 parsing error after a valid physical read.
     */
    gs1ParseError?: string;
    /**
     * GS1 DataBar GTIN-14 payload.
     */
    gtin?: string;
    /**
     * GS1 DataBar linkage flag.
     */
    linkage?: boolean;
    /** Whether an optional numeric check digit was validated. */
    checkDigit?: boolean;
    /** PZN variant identified by the decoder. */
    pznVariant?: 'pzn7' | 'pzn8';
    /** Whether the composite component is CC-A or CC-B. */
    component?: 'cc-a' | 'cc-b';
    /** Selected MicroPDF417-derived composite component variant. */
    componentVariant?: number;
    componentRows?: number;
    componentColumns?: number;
    componentRowHeight?: number;
    separatorGap?: number;
    linearFormat?: string;
    linear?: Record<string, unknown>;
};
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
 * @param {'camera'} [options.profile] Opt-in strict camera profile for validated 1D reads.
 * @param {object} [options.frameqr] FrameQR Code detector options when
 *   the profile marker is not preserved through image rendering.
 * @returns {DecodeResult[]}
 */
export declare function decode(image: {
    data: Uint8ClampedArray | Uint8Array | number[];
    width: number;
    height: number;
}, options?: {
    formats?: string[];
    tryHarder?: boolean;
    binarizer?: 'global' | 'hybrid' | 'auto';
    profile?: 'camera';
    frameqr?: object;
}): DecodeResult[];
/**
 * Decode, or throw if nothing is found.
 *
 * @param {{data: Uint8ClampedArray|Uint8Array|number[], width: number, height: number}} image
 * @param {object} [options]
 * @returns {DecodeResult}
 */
export declare function decodeStrict(image: {
    data: Uint8ClampedArray | Uint8Array | number[];
    width: number;
    height: number;
}, options?: object): DecodeResult;
/** Library version, matching package.json. */
export declare const VERSION = "1.5.15";
