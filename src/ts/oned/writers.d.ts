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
 * Linear barcode writers.
 *
 * Every writer returns a `BitMatrix` one module tall. Height is a rendering
 * decision, not an encoding one — a linear symbol carries no information
 * vertically, which is exactly why it survives a laser line that crosses it
 * anywhere. The renderers stretch it via the `barHeight` option.
 *
 * @module oned/writers
 */
import { BitMatrix } from '../core/bit-matrix.js';
/**
 * Modulo-10 check digit for the EAN/UPC family.
 *
 * Weights alternate 3 and 1, with the digit immediately left of the check
 * position weighted 3. Anchoring from the right rather than the left makes one
 * routine correct for EAN-8, EAN-13 and UPC-A alike, despite their different
 * payload lengths.
 *
 * @param {string} payload Digits, excluding the check digit.
 * @returns {number}
 */
export declare function ean13CheckDigit(payload: string): number;
/**
 * EAN-13. Accepts 12 digits (check digit appended) or 13 (verified).
 *
 * @param {string} value
 * @returns {BitMatrix}
 */
export declare function encodeEAN13(value: string): BitMatrix;
/**
 * EAN-8. Accepts 7 digits (check digit appended) or 8 (verified).
 *
 * @param {string} value
 * @returns {BitMatrix}
 */
export declare function encodeEAN8(value: string): BitMatrix;
/**
 * ISBN, as its printed EAN-13 ("Bookland") symbol.
 *
 * ISBN is not a separate symbology — an ISBN barcode *is* an EAN-13 carrying a
 * 978 or 979 prefix. What ISBN adds is its own numbering rules, and those are
 * worth enforcing here: an ISBN-10 uses a modulo-**11** check digit, in which
 * the value ten is written `X`. That is a different calculation from the
 * modulo-10 check the EAN symbol will carry. Passing an ISBN-10 straight
 * through would produce a perfectly scannable symbol encoding the wrong
 * number, so the two checks are kept distinct and the digit is recomputed.
 *
 * Accepts ISBN-10 or ISBN-13, with or without hyphens and spaces.
 *
 * @param {string} value
 * @returns {BitMatrix}
 */
export declare function encodeISBN(value: string): BitMatrix;
/**
 * UPC-A. Structurally an EAN-13 whose first digit is zero.
 *
 * @param {string} value 11 or 12 digits.
 * @returns {BitMatrix}
 */
export declare function encodeUPCA(value: string): BitMatrix;
/**
 * Expand a UPC-E body to the 11 digits preceding the check digit.
 *
 * @param {number} system Number system, 0 or 1.
 * @param {string} body 6 digits.
 * @returns {string} 11 digits.
 */
export declare function upceToUpcaBody(system: number, body: string): string;
/**
 * UPC-E, the zero-suppressed form of UPC-A.
 *
 * @param {string} value 6 digits (system 0 assumed), 7 (system + body), or 8 (with check).
 * @returns {BitMatrix}
 */
export declare function encodeUPCE(value: string): BitMatrix;
/**
 * Code 39.
 *
 * @param {string} value
 * @param {object} [options]
 * @param {boolean} [options.checkDigit] Append the modulo-43 check character.
 * @param {boolean} [options.fullAscii] Escape characters outside the native set.
 * @param {number} [options.wideRatio] Wide-to-narrow ratio, 2 or 3.
 * @returns {BitMatrix}
 */
export declare function encodeCode39(value: string, options?: {
    checkDigit?: boolean;
    fullAscii?: boolean;
    wideRatio?: number;
}): BitMatrix;
/**
 * Code 93, always with its two mandatory check characters.
 *
 * @param {string} value
 * @returns {BitMatrix}
 */
export declare function encodeCode93(value: string): BitMatrix;
/**
 * Code 128, with automatic code-set selection.
 *
 * The heuristic: switch into set C when enough consecutive digits are present
 * to repay the switch symbol — four at the start or end of the payload, six in
 * the middle, since C packs two digits per symbol. An encoder that never
 * switches produces a valid but needlessly wide symbol.
 *
 * @param {string} value
 * @param {object} [options]
 * @param {boolean} [options.gs1] Emit a leading FNC1, making this GS1-128.
 * @returns {BitMatrix}
 */
export declare function encodeCode128(value: string, options?: {
    gs1?: boolean;
}): BitMatrix;
/**
 * Interleaved 2 of 5.
 *
 * Digits are encoded in pairs: the first supplies the bars, the second the
 * spaces between them. That interleaving is where the density comes from, and
 * why the payload length must be even.
 *
 * @param {string} value
 * @param {object} [options]
 * @param {boolean} [options.checkDigit] Append a modulo-10 check digit.
 * @param {number} [options.wideRatio]
 * @returns {BitMatrix}
 */
export declare function encodeITF(value: string, options?: {
    checkDigit?: boolean;
    wideRatio?: number;
}): BitMatrix;
/**
 * ITF-14, the shipping-container form: exactly 14 digits.
 *
 * @param {string} value 13 or 14 digits.
 * @returns {BitMatrix}
 */
export declare function encodeITF14(value: string): BitMatrix;
/**
 * Codabar.
 *
 * @param {string} value Optionally already wrapped in start/stop characters A-D.
 * @param {object} [options]
 * @param {string} [options.start] One of A, B, C, D.
 * @param {string} [options.stop]
 * @param {number} [options.wideRatio]
 * @returns {BitMatrix}
 */
export declare function encodeCodabar(value: string, options?: {
    start?: string;
    stop?: string;
    wideRatio?: number;
}): BitMatrix;
/**
 * Code 11, digits and hyphen.
 *
 * @param {string} value
 * @param {object} [options]
 * @param {boolean} [options.checkDigit] Append check character C, plus K when long.
 * @param {number} [options.wideRatio]
 * @returns {BitMatrix}
 */
export declare function encodeCode11(value: string, options?: {
    checkDigit?: boolean;
    wideRatio?: number;
}): BitMatrix;
/**
 * MSI Plessey.
 *
 * @param {string} value Digits.
 * @param {object} [options]
 * @param {boolean} [options.checkDigit] Append the Luhn modulo-10 check digit.
 * @returns {BitMatrix}
 */
export declare function encodeMSI(value: string, options?: {
    checkDigit?: boolean;
}): BitMatrix;
/**
 * Pharmacode, one-track.
 *
 * Unusual among linear symbologies: it encodes an integer directly in a
 * bijective base-2 representation rather than digit by digit, and carries no
 * check digit at all — its only redundancy is the narrow legal value range.
 *
 * @param {number | string} value 3 to 131070.
 * @returns {BitMatrix}
 */
export declare function encodePharmacode(value: number | string): BitMatrix;
/** Italian Code 32 check digit for an eight-digit body. */
export declare function code32CheckDigit(value: string): number;
/** Encode an Italian Code 32 pharmaceutical identifier. */
export declare function encodeCode32(value: string): BitMatrix;
/** Decode and validate a six-character Code 32 payload. */
export declare function decodeCode32Payload(text: string): {
    text: string;
    checkDigit: number;
} | null;
/** Encode a PZN-7 or PZN-8 pharmaceutical identifier through Code 39. */
export declare function encodePZN(value: string, options?: {
    pzn8?: boolean;
    variant?: 'pzn7' | 'pzn8';
}): BitMatrix;
/** Decode and validate a PZN Code 39 payload. */
export declare function decodePZNPayload(text: string): {
    text: string;
    variant: 'pzn7' | 'pzn8';
    checkDigit: number;
} | null;
