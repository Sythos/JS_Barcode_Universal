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
 * Resample a distorted symbol in the image into an upright module grid.
 *
 * Given a transform that maps grid coordinates to image coordinates, this
 * samples the centre of every module. Sampling centres rather than averaging
 * whole cells is deliberate: module edges are where blur and bleed live, and
 * including them turns a marginal symbol into an unreadable one.
 *
 * @module image/grid-sampler
 */
import { BitMatrix } from '../core/bit-matrix.js';
import { PerspectiveTransform } from './perspective.js';
/**
 * Sample a `dimension` x `dimension` grid (or `width` x `height`).
 *
 * @param {BitMatrix} image Binarized source image.
 * @param {number} width Modules across.
 * @param {number} height Modules down.
 * @param {PerspectiveTransform} transform Grid space -> image space.
 * @returns {BitMatrix}
 * @throws {NotFoundError} If the grid falls outside the image.
 */
export declare function sampleGrid(image: BitMatrix, width: number, height: number, transform: PerspectiveTransform): BitMatrix;
/**
 * Sample with a 3x3 majority vote per module.
 *
 * Slower, and worth it when a single-point sample lands on a speck of noise or
 * a JPEG artefact. Readers fall back to this after a clean sample fails to
 * decode, rather than paying for it on every attempt.
 *
 * @param {BitMatrix} image
 * @param {number} width
 * @param {number} height
 * @param {PerspectiveTransform} transform
 * @returns {BitMatrix}
 */
export declare function sampleGridVoting(image: BitMatrix, width: number, height: number, transform: PerspectiveTransform): BitMatrix;
/**
 * Build the transform for a symbol whose four corners are known, and sample it.
 *
 * Corners are in reading order: top-left, top-right, bottom-right, bottom-left.
 *
 * @param {BitMatrix} image
 * @param {number} dimension Modules per side.
 * @param {Array<{x: number, y: number}>} corners
 * @param {boolean} [voting]
 * @returns {BitMatrix}
 */
export declare function sampleQuad(image: BitMatrix, dimension: number, corners: Array<{
    x: number;
    y: number;
}>, voting?: boolean): BitMatrix;
