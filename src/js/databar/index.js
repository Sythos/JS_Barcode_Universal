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
/** Verified GS1 DataBar data-layer primitives. @module databar */
export { dataBarGtinTransmission, decodeDataBar14GTIN, decodeDataBarLimitedGTIN, encodeDataBar14GTIN, encodeDataBarLimitedGTIN, gtinCheckDigit, makeGTIN14, normalizeGTIN, } from './codec.js';
export { GS1_SEPARATOR, decodeGS1ElementString, encodeGS1ElementString, formatGS1Elements, gs1AIInfo, parseGS1ElementString, } from './gs1.js';
export { DATABAR14_VARIANTS, DATABAR_LIMITED_VARIANT, dataBar14GroupFor, validateDataBarTables, } from './tables.js';
export { encodeDataBar14 } from './encoder.js';
export { decodeDataBar14, decodeDataBar14Scanline } from './decoder.js';
export { DATABAR14_CHECKSUM_WEIGHTS, DATABAR14_FINDERS, dataBar14CharacterWidths, dataBar14ValueForWidths, dataBarWidths, } from './patterns.js';
