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
 * Projective (perspective) transforms.
 *
 * A 2D symbol photographed off-axis is not a rotated square — it is a
 * quadrilateral with converging edges. Correcting that needs a full projective
 * map, not an affine one; an affine approximation reads the near edge of a
 * tilted symbol correctly and drifts a module or more by the far edge.
 *
 * The map is a 3x3 homogeneous matrix. Points are transformed as
 * (x, y, 1) * M, then divided through by the resulting w.
 *
 * @module image/perspective
 */
export declare class PerspectiveTransform {
    a11: any;
    a21: any;
    a31: any;
    a12: any;
    a22: any;
    a32: any;
    a13: any;
    a23: any;
    a33: any;
    constructor(a11: any, a21: any, a31: any, a12: any, a22: any, a32: any, a13: any, a23: any, a33: any);
    /**
     * Transform points in place.
     *
     * @param {Float32Array | number[]} points Interleaved [x0, y0, x1, y1, ...].
     * @returns {Float32Array | number[]} The same array.
     */
    transform(points: Float32Array | number[]): Float32Array | number[];
    /**
     * Transform a single point.
     *
     * @param {number} x @param {number} y
     * @returns {{x: number, y: number}}
     */
    transformPoint(x: number, y: number): {
        x: number;
        y: number;
    };
    /**
     * Map the unit square — (0,0), (1,0), (1,1), (0,1) — onto an arbitrary quad.
     *
     * Corners are given in that same order, i.e. going around the quad, not
     * as opposite pairs.
     *
     * @returns {PerspectiveTransform}
     */
    static squareToQuad(x0: any, y0: any, x1: any, y1: any, x2: any, y2: any, x3: any, y3: any): PerspectiveTransform;
    /**
     * Map an arbitrary quad onto the unit square — the inverse of
     * {@link squareToQuad}, via the adjugate.
     *
     * @returns {PerspectiveTransform}
     */
    static quadToSquare(x0: any, y0: any, x1: any, y1: any, x2: any, y2: any, x3: any, y3: any): PerspectiveTransform;
    /**
     * Map one quad onto another, corner for corner.
     *
     * This is what turns four detected finder corners into a sampling grid:
     * compose "detected quad -> unit square" with "unit square -> ideal grid".
     *
     * @returns {PerspectiveTransform}
     */
    static quadToQuad(sx0: any, sy0: any, sx1: any, sy1: any, sx2: any, sy2: any, sx3: any, sy3: any, dx0: any, dy0: any, dx1: any, dy1: any, dx2: any, dy2: any, dx3: any, dy3: any): PerspectiveTransform;
    /**
     * Adjugate — the inverse up to a scale factor, which is irrelevant in
     * homogeneous coordinates because the division by w cancels it.
     *
     * @returns {PerspectiveTransform}
     */
    inverse(): PerspectiveTransform;
    /**
     * Matrix product: apply `this` first, then `other`.
     *
     * @param {PerspectiveTransform} other
     * @returns {PerspectiveTransform}
     */
    times(other: PerspectiveTransform): PerspectiveTransform;
}
