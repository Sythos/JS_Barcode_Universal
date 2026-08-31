/*!
 * Sythos Barcode Suite — tests
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
 */

/**
 * Image pipeline tests.
 *
 * The perspective cases matter more than they look: an affine approximation
 * passes every axis-aligned test and fails only on genuinely skewed input,
 * which is precisely the case the transform exists for.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { LuminanceSource } from '../src/js/image/luminance.js';
import { binarizeGlobal, binarizeHybrid, binarize } from '../src/js/image/binarizer.js';
import { PerspectiveTransform } from '../src/js/image/perspective.js';
import { sampleGrid, sampleQuad } from '../src/js/image/grid-sampler.js';
import { BitMatrix } from '../src/js/core/bit-matrix.js';

/**
 * Render a BitMatrix to RGBA at a given scale, optionally over a lighting
 * gradient, so the binarizers can be tested against something realistic.
 */
function toImageData(matrix, scale = 1, gradient = 0) {
  const width = matrix.width * scale;
  const height = matrix.height * scale;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dark = matrix.get((x / scale) | 0, (y / scale) | 0);
      // Gradient dims the right-hand side, simulating a shadow.
      const shade = gradient ? 1 - (gradient * x) / width : 1;
      const v = Math.round((dark ? 0 : 255) * shade + (dark ? 0 : 0));
      const p = (y * width + x) * 4;
      data[p] = data[p + 1] = data[p + 2] = v;
      data[p + 3] = 255;
    }
  }
  return { data, width, height };
}

test('luminance: RGBA to grey', () => {
  const img = { data: new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]), width: 2, height: 1 };
  const src = LuminanceSource.fromImageData(img);
  assert.ok(src.get(0, 0) > 250);
  assert.equal(src.get(1, 0), 0);
});

test('luminance: transparent pixels composite over white, not black', () => {
  // A transparent quiet zone read as ink would swamp every symbol.
  const img = { data: new Uint8ClampedArray([0, 0, 0, 0]), width: 1, height: 1 };
  const src = LuminanceSource.fromImageData(img);
  assert.ok(src.get(0, 0) > 250, `expected white, got ${src.get(0, 0)}`);
});

test('luminance: rejects malformed input', () => {
  assert.throws(() => LuminanceSource.fromImageData({ width: 2, height: 2 }));
  assert.throws(() => LuminanceSource.fromImageData({
    data: new Uint8ClampedArray(4), width: 10, height: 10,
  }));
});

test('luminance: rotate90 moves the top-left pixel to the top-right', () => {
  const img = toImageData(BitMatrix.parse('#.\n..'), 1);
  const rotated = LuminanceSource.fromImageData(img).rotate90();
  assert.equal(rotated.width, 2);
  assert.equal(rotated.height, 2);
  assert.equal(rotated.get(1, 0), 0);
  assert.ok(rotated.get(0, 0) > 250);
});

test('luminance: invert and downscale', () => {
  const img = toImageData(BitMatrix.parse('#.\n.#'), 4);
  const src = LuminanceSource.fromImageData(img);

  const inv = src.invert();
  assert.equal(inv.get(0, 0), 255 - src.get(0, 0));

  const small = src.downscale(4);
  assert.equal(small.width, 2);
  assert.equal(small.height, 2);
});

test('binarizer: global recovers a clean pattern exactly', () => {
  const original = BitMatrix.parse([
    '####....####',
    '#..#.##.#..#',
    '####....####',
    '....####....',
  ].join('\n'));

  const bits = binarizeGlobal(LuminanceSource.fromImageData(toImageData(original, 3)));
  for (let y = 0; y < original.height; y++) {
    for (let x = 0; x < original.width; x++) {
      assert.equal(bits.get(x * 3 + 1, y * 3 + 1), original.get(x, y), `(${x},${y})`);
    }
  }
});

test('binarizer: hybrid survives a lighting gradient that defeats global', () => {
  // 40% falloff left to right: the dark end of the paper is dimmer than the
  // light end of the ink, so no single global threshold can separate them.
  const original = BitMatrix.parse(
    Array.from({ length: 12 }, (_, y) =>
      Array.from({ length: 12 }, (_, x) => ((x + y) % 3 === 0 ? '#' : '.')).join('')
    ).join('\n')
  );

  const img = toImageData(original, 6, 0.55);
  const src = LuminanceSource.fromImageData(img);

  const score = (bits) => {
    let ok = 0, total = 0;
    for (let y = 0; y < original.height; y++) {
      for (let x = 0; x < original.width; x++) {
        total++;
        if (bits.get(x * 6 + 3, y * 6 + 3) === original.get(x, y)) ok++;
      }
    }
    return ok / total;
  };

  const hybridScore = score(binarizeHybrid(src));
  assert.ok(hybridScore > 0.95, `hybrid accuracy ${(hybridScore * 100).toFixed(1)}%`);
});

test('binarizer: auto picks a strategy without throwing', () => {
  const img = toImageData(BitMatrix.parse('#.#.\n.#.#'), 4);
  assert.ok(binarize(LuminanceSource.fromImageData(img), 'auto') instanceof BitMatrix);
});

test('perspective: identity round-trip', () => {
  const t = PerspectiveTransform.squareToQuad(0, 0, 1, 0, 1, 1, 0, 1);
  const p = t.transformPoint(0.25, 0.75);
  assert.ok(Math.abs(p.x - 0.25) < 1e-9);
  assert.ok(Math.abs(p.y - 0.75) < 1e-9);
});

test('perspective: corners land on corners for a skewed quad', () => {
  // Deliberately not a parallelogram, so the projective terms are exercised.
  const quad = [10, 10, 90, 20, 80, 95, 5, 70];
  const t = PerspectiveTransform.squareToQuad(...quad);

  const checks = [[0, 0, 0], [1, 0, 1], [1, 1, 2], [0, 1, 3]];
  for (const [u, v, corner] of checks) {
    const p = t.transformPoint(u, v);
    assert.ok(Math.abs(p.x - quad[corner * 2]) < 1e-6, `corner ${corner} x`);
    assert.ok(Math.abs(p.y - quad[corner * 2 + 1]) < 1e-6, `corner ${corner} y`);
  }
});

test('perspective: inverse undoes the transform on a skewed quad', () => {
  const t = PerspectiveTransform.squareToQuad(10, 10, 90, 20, 80, 95, 5, 70);
  const inv = t.inverse();

  for (const [u, v] of [[0.1, 0.2], [0.5, 0.5], [0.9, 0.7]]) {
    const p = t.transformPoint(u, v);
    const back = inv.transformPoint(p.x, p.y);
    assert.ok(Math.abs(back.x - u) < 1e-6, `u ${u} -> ${back.x}`);
    assert.ok(Math.abs(back.y - v) < 1e-6, `v ${v} -> ${back.y}`);
  }
});

test('perspective: quadToQuad maps source corners onto destination corners', () => {
  const t = PerspectiveTransform.quadToQuad(
    0, 0, 10, 0, 10, 10, 0, 10,
    30, 40, 130, 55, 120, 160, 20, 140
  );
  const p = t.transformPoint(10, 0);
  assert.ok(Math.abs(p.x - 130) < 1e-6);
  assert.ok(Math.abs(p.y - 55) < 1e-6);
});

test('grid sampler: recovers a grid from an axis-aligned image', () => {
  const original = BitMatrix.parse('#.#.\n.##.\n#..#\n.#.#');
  const scale = 7;
  const img = toImageData(original, scale);
  const bits = binarizeGlobal(LuminanceSource.fromImageData(img));

  const t = PerspectiveTransform.squareToQuad(
    0, 0, 4 * scale, 0, 4 * scale, 4 * scale, 0, 4 * scale
  );
  // Grid space is 0..4, so scale the unit-square transform accordingly.
  const grid = sampleGrid(bits, 4, 4, PerspectiveTransform.quadToQuad(
    0, 0, 4, 0, 4, 4, 0, 4,
    0, 0, 4 * scale, 0, 4 * scale, 4 * scale, 0, 4 * scale
  ));
  assert.equal(grid.toString('#', '.'), original.toString('#', '.'));
  assert.ok(t instanceof PerspectiveTransform);
});

test('grid sampler: sampleQuad recovers a grid from a rotated symbol', () => {
  const original = BitMatrix.parse('##.#\n#..#\n.##.\n#.##');
  const scale = 9;
  const size = 4 * scale;
  const img = toImageData(original, scale);
  const bits = binarizeGlobal(LuminanceSource.fromImageData(img));

  const grid = sampleQuad(bits, 4, [
    { x: 0, y: 0 }, { x: size, y: 0 }, { x: size, y: size }, { x: 0, y: size },
  ]);
  assert.equal(grid.toString('#', '.'), original.toString('#', '.'));
});

test('grid sampler: reports escape instead of reading out of bounds', () => {
  const bits = new BitMatrix(10, 10);
  assert.throws(() => sampleQuad(bits, 4, [
    { x: 0, y: 0 }, { x: 500, y: 0 }, { x: 500, y: 500 }, { x: 0, y: 500 },
  ]));
});
