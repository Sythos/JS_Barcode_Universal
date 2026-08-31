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

import test from 'node:test';
import assert from 'node:assert/strict';

import { FormatError } from '../src/js/core/errors.js';
import { encodeQR } from '../src/js/qr/encoder.js';
import {
  FRAMEQR_PROFILE,
  normalizeCanvasSpec,
} from '../src/js/frameqr/tables.js';
import { encodeFrameQR } from '../src/js/frameqr/encoder.js';
import { decodeFrameQR } from '../src/js/frameqr/decoder.js';

test('frameqr decoder: round-trips the non-certified Sythos Canvas QR profile', () => {
  const matrix = encodeFrameQR('HELLO', { version: 1 });
  const result = decodeFrameQR(matrix);

  assert.equal(result.text, 'HELLO');
  assert.equal(result.format, 'frameqr');
  assert.equal(result.profile, FRAMEQR_PROFILE.id);
  assert.equal(result.certified, false);
  assert.deepEqual(result.frame, matrix.frameqr.canvas);
  assert.equal(result.canvasDamage.safe, true);
  assert.equal(result.canvasDamage.version, 1);
  assert.equal(result.canvasDamage.profile, FRAMEQR_PROFILE.id);
});

test('frameqr decoder: rejects an ordinary QR matrix without a marker', () => {
  const matrix = encodeQR('HELLO', { version: 1, ecc: 'H' });

  assert.throws(
    () => decodeFrameQR(matrix),
    (error) => error instanceof FormatError && /profile marker/.test(error.message)
  );
});

test('frameqr decoder: explicit detector opt-in handles a marker lost in sampling', () => {
  const matrix = encodeQR('HELLO', { version: 1, ecc: 'H' });
  const canvas = normalizeCanvasSpec(matrix.width);

  const result = decodeFrameQR(matrix, {
    profile: FRAMEQR_PROFILE.id,
    canvas,
    allowUnmarked: true,
  });

  assert.equal(result.text, 'HELLO');
  assert.equal(result.certified, false);
  assert.deepEqual(result.canvas, canvas);
});

test('frameqr decoder: does not relabel a different profile or certified FrameQR', () => {
  const matrix = encodeQR('HELLO', { version: 1, ecc: 'H' });
  matrix.frameqr = {
    profile: 'denso-frameqr',
    certified: true,
    canvas: normalizeCanvasSpec(matrix.width),
  };

  assert.throws(
    () => decodeFrameQR(matrix),
    (error) => error instanceof FormatError && /profile marker/.test(error.message)
  );

  matrix.frameqr = {
    profile: FRAMEQR_PROFILE.id,
    certified: true,
    canvas: normalizeCanvasSpec(matrix.width),
  };
  assert.throws(
    () => decodeFrameQR(matrix),
    (error) => error instanceof FormatError && /certified FrameQR/.test(error.message)
  );
});

test('frameqr decoder: rejects a canvas that damages function modules or exceeds ECC', () => {
  const matrix = encodeQR('HELLO', { version: 1, ecc: 'H' });
  matrix.frameqr = {
    profile: FRAMEQR_PROFILE.id,
    certified: false,
    canvas: normalizeCanvasSpec(matrix.width, { width: 5, height: 5 }),
  };

  assert.throws(
    () => decodeFrameQR(matrix),
    (error) => error instanceof FormatError && /invalid canvas metadata/.test(error.message)
  );
});
