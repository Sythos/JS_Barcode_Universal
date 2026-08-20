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
 * A 2D bit grid — the common currency of this library.
 *
 * Every writer produces one; every reader consumes one; every renderer draws
 * one. Keeping it as the single interchange type is what lets formats and
 * output targets stay independent of each other.
 *
 * Storage is row-packed into a Uint32Array: one allocation, cache-friendly row
 * scans, and cheap whole-row operations for the 1D readers.
 *
 * Convention: a set bit is a DARK module (ink). This matches how symbols are
 * described in every specification, and renderers invert as needed.
 *
 * @module core/bit-matrix
 */
export declare class BitMatrix {
    width: number;
    height: number;
    rowWords: number;
    bits: Uint32Array<ArrayBuffer>;
    /**
     * @param {number} width
     * @param {number} height
     */
    constructor(width: number, height?: number);
    /**
     * @param {number} x @param {number} y
     * @returns {boolean} True if the module is dark.
     */
    get(x: number, y: number): boolean;
    /** @param {number} x @param {number} y */
    set(x: number, y: number): void;
    /** @param {number} x @param {number} y */
    unset(x: number, y: number): void;
    /** @param {number} x @param {number} y */
    flip(x: number, y: number): void;
    /**
     * @param {number} x @param {number} y @param {boolean} value
     */
    setValue(x: number, y: number, value: boolean): void;
    /** Fill a rectangle. @param {number} x @param {number} y @param {number} w @param {number} h */
    setRegion(x: number, y: number, w: number, h: number): void;
    clear(): void;
    /** @returns {BitMatrix} */
    clone(): BitMatrix;
    /**
     * Copy row `y` into a reusable array, avoiding an allocation per row in the
     * 1D scanning loops which run this thousands of times per image.
     *
     * @param {number} y
     * @param {Uint8Array} [out]
     * @returns {Uint8Array}
     */
    getRow(y: number, out?: Uint8Array): Uint8Array;
    /**
     * Add a uniform light border. Symbols need a quiet zone to be scannable at
     * all, so this is applied by default when rendering.
     *
     * @param {number} size Modules of margin on every side.
     * @returns {BitMatrix}
     */
    withMargin(size: number): BitMatrix;
    /**
     * Nearest-neighbour upscale. Integer factors only — a barcode resampled with
     * interpolation stops being readable.
     *
     * @param {number} factor
     * @returns {BitMatrix}
     */
    scale(factor: number): BitMatrix;
    /**
     * Bounding box of the dark modules, or null if the matrix is empty.
     * @returns {{x: number, y: number, width: number, height: number} | null}
     */
    getBounds(): {
        x: number;
        y: number;
        width: number;
        height: number;
    } | null;
    /**
     * Rotate 180 degrees, in place. Cheaper than re-detecting when a reader
     * discovers a symbol is upside down.
     */
    rotate180(): void;
    /**
     * Build from a string of '1'/'X'/'#' (dark) and anything else (light),
     * newline-separated. Test fixtures are far more legible this way.
     *
     * @param {string} text
     * @returns {BitMatrix}
     */
    static parse(text: string): BitMatrix;
    /**
     * @param {string} [dark] @param {string} [light]
     * @returns {string}
     */
    toString(dark?: string, light?: string): string;
}
