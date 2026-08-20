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
 * SPDX-FileCopyrightText: 2026 Sythos (https://www.sythos.net)
 * SPDX-License-Identifier: MIT
 *
 * Original work. No code from any other barcode implementation.
 */
/**
 * QR Code encoder.
 *
 * Pipeline: analyse the text into mode segments, pick the smallest version that
 * holds them, serialise the bitstream, split it into Reed-Solomon blocks,
 * interleave data and parity, lay the result into the module grid along the
 * zig-zag path, then choose the mask that scores best under the four penalty
 * rules.
 *
 * Segment selection is a shortest-path problem, not a greedy scan. "1234ABCD"
 * is cheaper as one alphanumeric segment than as numeric plus alphanumeric,
 * because a mode switch costs a mode indicator plus a character count field;
 * whether that trade pays depends on run lengths that a left-to-right scan
 * cannot see yet. The dynamic program below weighs it properly.
 *
 * It also has to run *per version band*, because the character count field
 * widens at versions 10 and 27 — so the cheapest segmentation depends on the
 * version, and the smallest sufficient version depends on the segmentation.
 * {@link encodeQR} resolves the circularity by solving each band independently
 * and taking the first version that fits.
 *
 * @module qr/encoder
 */
import { BitMatrix } from '../core/bit-matrix.js';
/** Alphanumeric mode character set; a character's index is its encoded value. */
export declare const ALPHANUMERIC_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
/** ECI designator for UTF-8. */
export declare const ECI_UTF8 = 26;
export type EncodeOptions = {
    /**
     * Error correction level. Default 'M'.
     */
    ecc?: 'L' | 'M' | 'Q' | 'H';
    /**
     * Force a version 1-40 instead of the smallest fit.
     */
    version?: number;
    /**
     * Force a mask 0-7 instead of the best-scoring one.
     */
    mask?: number;
    /**
     * Byte mode interpretation.
     * 'auto' uses ISO-8859-1 when the text allows it and UTF-8 with an ECI
     * header otherwise.
     */
    charset?: 'auto' | 'utf-8' | 'iso-8859-1';
    /**
     * Allow kanji mode. Default true; ignored when the
     * platform cannot supply a Shift_JIS codec.
     */
    kanji?: boolean;
};
/**
 * Pack a Shift_JIS double byte into the 13-bit kanji mode value.
 *
 * The two covered ranges are folded onto a single contiguous space by
 * subtracting a different offset from each, then re-basing the low byte to 0xC0
 * values per high byte.
 *
 * @param {number} sjis 16-bit Shift_JIS value.
 * @returns {number} 13-bit value, or -1 if outside the kanji mode ranges.
 */
export declare function sjisToThirteenBits(sjis: number): number;
export type CharInfo = {
    /**
     * Code points.
     */
    points: string[];
    numeric: Uint8Array;
    /**
     * Alphanumeric value, or -1.
     */
    alnum: Int32Array;
    /**
     * Bytes this code point costs in byte mode.
     */
    byteLen: Int32Array;
    /**
     * 13-bit kanji value, or -1.
     */
    kanji: Int32Array;
    utf8: boolean;
};
export type Segment = {
    mode: number;
    /**
     * Inclusive index into the code point array.
     */
    start: number;
    /**
     * Exclusive.
     */
    end: number;
};
/**
 * The 15-bit masked format information.
 *
 * @param {string} ecc @param {number} mask
 * @returns {number}
 */
export declare function formatInfoBits(ecc: string, mask: number): number;
/**
 * The 18-bit version information, for versions 7 and up.
 *
 * @param {number} version
 * @returns {number}
 */
export declare function versionInfoBits(version: number): number;
/**
 * The four penalty rules. Lower is better.
 *
 * These exist to keep a symbol readable: long uniform runs and large blocks
 * confuse the binarizer, finder lookalikes confuse the detector, and a symbol
 * far from half dark loses contrast headroom. Scoring is a heuristic, not a
 * correctness surface — any of the eight masks decodes, because the format
 * information says which one was used.
 *
 * @param {BitMatrix} m
 * @returns {number}
 */
export declare function maskPenalty(m: BitMatrix): number;
/**
 * Encode text as a QR Code.
 *
 * The result carries no quiet zone; callers add one with
 * `matrix.withMargin(4)`. Keeping the margin out of the encoder means the
 * renderer decides it, which is where the decision belongs — a symbol embedded
 * in a design and a symbol printed on a label want different borders.
 *
 * @param {string} text
 * @param {EncodeOptions} [options]
 * @returns {BitMatrix} Set bit = dark module.
 * @throws {EncodeError} If the text does not fit, or the options are invalid.
 */
export declare function encodeQR(text: string, options?: EncodeOptions): BitMatrix;
