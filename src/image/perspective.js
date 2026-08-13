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

export class PerspectiveTransform {
  /* eslint-disable-next-line max-params */
  constructor(a11, a21, a31, a12, a22, a32, a13, a23, a33) {
    this.a11 = a11; this.a21 = a21; this.a31 = a31;
    this.a12 = a12; this.a22 = a22; this.a32 = a32;
    this.a13 = a13; this.a23 = a23; this.a33 = a33;
  }

  /**
   * Transform points in place.
   *
   * @param {Float32Array | number[]} points Interleaved [x0, y0, x1, y1, ...].
   * @returns {Float32Array | number[]} The same array.
   */
  transform(points) {
    const { a11, a21, a31, a12, a22, a32, a13, a23, a33 } = this;
    for (let i = 0; i < points.length; i += 2) {
      const x = points[i];
      const y = points[i + 1];
      const w = a13 * x + a23 * y + a33;
      points[i] = (a11 * x + a21 * y + a31) / w;
      points[i + 1] = (a12 * x + a22 * y + a32) / w;
    }
    return points;
  }

  /**
   * Transform a single point.
   *
   * @param {number} x @param {number} y
   * @returns {{x: number, y: number}}
   */
  transformPoint(x, y) {
    const w = this.a13 * x + this.a23 * y + this.a33;
    return {
      x: (this.a11 * x + this.a21 * y + this.a31) / w,
      y: (this.a12 * x + this.a22 * y + this.a32) / w,
    };
  }

  /**
   * Map the unit square — (0,0), (1,0), (1,1), (0,1) — onto an arbitrary quad.
   *
   * Corners are given in that same order, i.e. going around the quad, not
   * as opposite pairs.
   *
   * @returns {PerspectiveTransform}
   */
  /* eslint-disable-next-line max-params */
  static squareToQuad(x0, y0, x1, y1, x2, y2, x3, y3) {
    const dx3 = x0 - x1 + x2 - x3;
    const dy3 = y0 - y1 + y2 - y3;

    if (dx3 === 0 && dy3 === 0) {
      // The quad is a parallelogram, so the map is affine and the projective
      // terms vanish. Worth special-casing: it is the common case for flat
      // scans, and the general solution divides by zero here.
      return new PerspectiveTransform(
        x1 - x0, x2 - x1, x0,
        y1 - y0, y2 - y1, y0,
        0, 0, 1
      );
    }

    const dx1 = x1 - x2;
    const dx2 = x3 - x2;
    const dy1 = y1 - y2;
    const dy2 = y3 - y2;
    const denominator = dx1 * dy2 - dx2 * dy1;
    const a13 = (dx3 * dy2 - dx2 * dy3) / denominator;
    const a23 = (dx1 * dy3 - dx3 * dy1) / denominator;

    return new PerspectiveTransform(
      x1 - x0 + a13 * x1, x3 - x0 + a23 * x3, x0,
      y1 - y0 + a13 * y1, y3 - y0 + a23 * y3, y0,
      a13, a23, 1
    );
  }

  /**
   * Map an arbitrary quad onto the unit square — the inverse of
   * {@link squareToQuad}, via the adjugate.
   *
   * @returns {PerspectiveTransform}
   */
  /* eslint-disable-next-line max-params */
  static quadToSquare(x0, y0, x1, y1, x2, y2, x3, y3) {
    return PerspectiveTransform.squareToQuad(x0, y0, x1, y1, x2, y2, x3, y3).inverse();
  }

  /**
   * Map one quad onto another, corner for corner.
   *
   * This is what turns four detected finder corners into a sampling grid:
   * compose "detected quad -> unit square" with "unit square -> ideal grid".
   *
   * @returns {PerspectiveTransform}
   */
  /* eslint-disable-next-line max-params */
  static quadToQuad(
    sx0, sy0, sx1, sy1, sx2, sy2, sx3, sy3,
    dx0, dy0, dx1, dy1, dx2, dy2, dx3, dy3
  ) {
    const toSquare = PerspectiveTransform.quadToSquare(sx0, sy0, sx1, sy1, sx2, sy2, sx3, sy3);
    const toQuad = PerspectiveTransform.squareToQuad(dx0, dy0, dx1, dy1, dx2, dy2, dx3, dy3);
    return toSquare.times(toQuad);
  }

  /**
   * Adjugate — the inverse up to a scale factor, which is irrelevant in
   * homogeneous coordinates because the division by w cancels it.
   *
   * @returns {PerspectiveTransform}
   */
  inverse() {
    const { a11, a21, a31, a12, a22, a32, a13, a23, a33 } = this;
    return new PerspectiveTransform(
      a22 * a33 - a23 * a32,
      a23 * a31 - a21 * a33,
      a21 * a32 - a22 * a31,
      a13 * a32 - a12 * a33,
      a11 * a33 - a13 * a31,
      a12 * a31 - a11 * a32,
      a12 * a23 - a13 * a22,
      a13 * a21 - a11 * a23,
      a11 * a22 - a12 * a21
    );
  }

  /**
   * Matrix product: apply `this` first, then `other`.
   *
   * @param {PerspectiveTransform} other
   * @returns {PerspectiveTransform}
   */
  times(other) {
    const { a11, a21, a31, a12, a22, a32, a13, a23, a33 } = this;
    const o = other;
    return new PerspectiveTransform(
      o.a11 * a11 + o.a21 * a12 + o.a31 * a13,
      o.a11 * a21 + o.a21 * a22 + o.a31 * a23,
      o.a11 * a31 + o.a21 * a32 + o.a31 * a33,
      o.a12 * a11 + o.a22 * a12 + o.a32 * a13,
      o.a12 * a21 + o.a22 * a22 + o.a32 * a23,
      o.a12 * a31 + o.a22 * a32 + o.a32 * a33,
      o.a13 * a11 + o.a23 * a12 + o.a33 * a13,
      o.a13 * a21 + o.a23 * a22 + o.a33 * a23,
      o.a13 * a31 + o.a23 * a32 + o.a33 * a33
    );
  }
}
