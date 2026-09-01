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
 * Compare measured run lengths against an ideal pattern, scale-independently.
 *
 * Returns a normalised mismatch score, or Infinity when any single element is
 * further out of proportion than `maxIndividual` allows. Rejecting on the
 * worst element as well as the total is what stops a run of noise whose widths
 * happen to average out from being accepted as a character.
 *
 * @param {number[]} counters Measured widths, in pixels.
 * @param {number[]} pattern Ideal widths, in modules.
 * @param {number} maxIndividual Tolerance per element, as a fraction of a module.
 * @returns {number}
 */
export declare function patternVariance(counters: number[], pattern: number[], maxIndividual: number): number;
/**
 * Measure alternating run lengths starting at `start`.
 *
 * @param {Uint8Array} row One byte per pixel, 1 = dark.
 * @param {number} start
 * @param {number[]} counters Filled in place; its length sets how many runs to read.
 * @returns {boolean} False if the row ended before the runs were filled.
 */
export declare function recordPattern(row: Uint8Array, start: number, counters: number[]): boolean;
/**
 * Classify run lengths into narrow and wide, for the n/w symbologies.
 *
 * The wide:narrow ratio is not fixed by these formats — it is anywhere from
 * 2:1 to 3:1 and varies with the printer — so the split has to be discovered
 * from the data. Candidate thresholds are tried from the smallest counter
 * upward until exactly the expected number of wide elements falls out.
 *
 * @param {number[]} counters
 * @param {number} expectedWide How many elements must be wide.
 * @returns {number} Bit pattern, MSB = first element wide; -1 if undecidable.
 */
export declare function toNarrowWidePattern(counters: number[], expectedWide: number): number;
/**
 * Decode Code 11 from one binarized scanline.
 *
 * @param {Uint8Array} row
 * @param {object} [options]
 * @param {boolean} [options.checkDigit]
 * @returns {{format:'code11', text:string}|null}
 */
export declare function decodeCode11(row: Uint8Array, options?: {
    checkDigit?: boolean;
}): {
    format: 'code11';
    text: string;
} | null;
/**
 * Decode MSI/Plessey from one binarized scanline.
 *
 * @param {Uint8Array} row
 * @param {object} [options]
 * @param {boolean} [options.checkDigit]
 * @returns {{format:'msi', text:string}|null}
 */
export declare function decodeMSI(row: Uint8Array, options?: {
    checkDigit?: boolean;
}): {
    format: 'msi';
    text: string;
} | null;
/** Decode Italian Code 32 from a Code 39-shaped scanline. */
export declare function decodeCode32(row: Uint8Array): {
    format: 'code32';
    text: string;
    checkDigit: boolean;
} | null;
/** Decode PZN-7 or PZN-8 from a Code 39-shaped scanline. */
export declare function decodePZN(row: Uint8Array): {
    format: 'pzn';
    text: string;
    pznVariant: 'pzn7' | 'pzn8';
    checkDigit: boolean;
} | null;
/** Decode Industrial/Standard 2 of 5. */
export declare function decodeIndustrial2of5(row: Uint8Array, options?: {
    checkDigit?: boolean;
    profile?: 'camera';
}): {
    format: 'industrial2of5';
    text: string;
    checkDigit: boolean;
} | null;
/** Decode IATA 2 of 5. */
export declare function decodeIATA2of5(row: Uint8Array, options?: {
    checkDigit?: boolean;
    profile?: 'camera';
}): {
    format: 'iata2of5';
    text: string;
    checkDigit: boolean;
} | null;
/** Decode Code 2 of 5 Data Logic (also known as China Post). */
export declare function decodeDataLogic2of5(row: Uint8Array, options?: {
    checkDigit?: boolean;
    profile?: 'camera';
}): {
    format: 'datalogic2of5';
    text: string;
    checkDigit: boolean;
} | null;
/** Decode the canonical Standard 2 of 5 frame. */
export declare const decodeStandard2of5: typeof decodeIndustrial2of5;
/** Decode any supported Code 25 family frame. */
export declare const decodeCode25: typeof decodeIndustrial2of5;
/**
 * Read every linear symbol found in a binarized image.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} image Binarized; set bit = dark.
 * @param {object} [options]
 * @param {string[]} [options.formats] Restrict to these format ids.
 * @param {number} [options.rows] How many horizontal slices to try.
 * @param {boolean} [options.tryHarder] Also scan reversed rows, for mirrored symbols.
 * @param {'camera'} [options.profile] Require stable, quiet-zone-qualified reads.
 * @param {0|90|180|270} [options.cameraRotation] Orientation already normalized by the caller.
 * @returns {Array<{format: string, text: string, row: number}>}
 */
export declare function decodeOneD(image: import('../core/bit-matrix.js').BitMatrix, options?: {
    formats?: string[];
    rows?: number;
    tryHarder?: boolean;
    profile?: 'camera';
    cameraRotation?: 0 | 90 | 180 | 270;
}): Array<{
    format: string;
    text: string;
    row: number;
}>;
/**
 * Convenience wrapper that throws when nothing is found.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} image
 * @param {object} [options]
 * @returns {{format: string, text: string, row: number}}
 */
export declare function decodeOneDStrict(image: import('../core/bit-matrix.js').BitMatrix, options?: object): {
    format: string;
    text: string;
    row: number;
};
