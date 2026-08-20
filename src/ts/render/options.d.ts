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
 * Shared render options, normalised once so every backend agrees.
 *
 * @module render/options
 */
import { BitMatrix } from '../core/bit-matrix.js';
export type RenderOptions = {
    /**
     * Pixels per module. Default 8.
     */
    scale?: number;
    /**
     * Quiet-zone modules on every side. Default 4.
     */
    margin?: number;
    /**
     * Colour of set modules. Default '#000000'.
     */
    dark?: string;
    /**
     * Colour of clear modules, or 'none' for transparent.
     */
    light?: string;
    /**
     * For 1D symbols: total bar height in pixels.
     */
    barHeight?: number;
};
/**
 * @typedef {object} RenderOptions
 * @property {number} [scale] Pixels per module. Default 8.
 * @property {number} [margin] Quiet-zone modules on every side. Default 4.
 * @property {string} [dark] Colour of set modules. Default '#000000'.
 * @property {string} [light] Colour of clear modules, or 'none' for transparent.
 * @property {number} [barHeight] For 1D symbols: total bar height in pixels.
 */
/**
 * Expand and pad the matrix, and resolve every dimension.
 *
 * Linear symbols arrive one module tall. They are stretched to `barHeight`
 * *before* the quiet zone is applied, so the margin ends up uniform on all
 * four sides — padding first would leave a quiet zone one module tall against
 * bars a hundred pixels tall, which no scanner would accept.
 *
 * @param {BitMatrix} matrix
 * @param {RenderOptions} options
 */
export declare function normalizeOptions(matrix: BitMatrix, options?: RenderOptions): {
    scale: number;
    margin: number;
    dark: string;
    light: string;
    is1D: boolean;
    source: BitMatrix;
    rowHeight: number;
    pixelWidth: number;
    pixelHeight: number;
};
/**
 * Parse a CSS colour into RGBA bytes.
 *
 * Supports the forms a barcode actually needs: #rgb, #rgba, #rrggbb,
 * #rrggbbaa, rgb(), rgba(), plus 'none' and 'transparent'.
 *
 * @param {string} colour
 * @returns {[number, number, number, number]}
 */
export declare function parseColor(colour: string): [number, number, number, number];
