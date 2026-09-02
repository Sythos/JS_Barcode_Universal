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
 * SPDX-License-Identifier: MIT
 *
 * Original work. No code from any other barcode implementation.
 */

/**
 * EXPERIMENTAL, published for early/beta use at the
 * `@sythos/js_barcode_universal/jabcode` subpath. Not exported from the
 * package root and not registered in `ONED_FORMATS`/`listFormats()` --
 * like `../kartrak/`, its output is a `PolychromeMatrix` (colour), not a
 * `BitMatrix`, so it sits outside the format registry's binary contract.
 *
 * JAB Code (ISO/IEC 23634:2022, Fraunhofer SIT, MIT since April 2026).
 * This module implements one real, documented configuration of the
 * format -- the reference encoder's own "default mode" fast path
 * (`color_number=8`, ECC level 3, mask type 7 fixed, no metadata Part I/II,
 * no optimisation search) -- plus byte-mode-only data encoding (the
 * reference's 7-mode text compaction is skipped; byte mode alone can
 * always encode any input, per the reference's own comment). Single
 * symbol only, no cascaded slaves.
 *
 * See `docs/JABCODE_NOTES.md` for the full scope this was verified
 * against and its honest limits -- most importantly, no live reference
 * build was available as a decode oracle, so verification here is
 * self-consistency (round-trip through this module's own encoder and
 * decoder), not confirmed interop with the real jabcode library.
 *
 * Decoding, like KarTrak, is scoped to a *known* geometry (a caller- or
 * future-detector-supplied quad) classified against the *known* default
 * palette -- not live palette calibration or arbitrary-photo detection,
 * which the real reference does and this module does not.
 *
 * @module jabcode
 */

import { EncodeError, NotFoundError } from '../core/errors.js';
import { PolychromeMatrix } from '../color/matrix.js';
import { classifyGrid } from '../color/classify.js';
import { toColorImageData } from '../color/render.js';
import { PerspectiveTransform } from '../image/perspective.js';
import { encodeLDPC, decodeLDPC } from './ldpc.js';
import { encodeByteMode, decodeByteMode } from './byte-mode.js';
import { buildSymbolLayout, placeData, readData, SymbolLayout } from './matrix.js';
import { DEFAULT_PALETTE, WC, WR, masterSymbolCapacity, netCapacity } from './tables.js';

export { PolychromeMatrix, toColorImageData };

export const JABCODE_PROFILE = 'sythos-jabcode-default-mode';

// Index 0 is PolychromeMatrix's fixed background/quiet-zone slot, kept
// distinct from every real JAB module colour (which legitimately includes
// both black and white) -- same reasoning as KarTrak's mid-grey background.
const BACKGROUND: readonly [number, number, number] = [128, 128, 128];
export const JABCODE_PALETTE: readonly [number, number, number][] = Object.freeze([
  BACKGROUND,
  ...DEFAULT_PALETTE,
]);

const MAX_VERSION = 32;

function chooseVersion(requiredBits: number): number {
  for (let version = 1; version <= MAX_VERSION; version++) {
    const gross = masterSymbolCapacity(version);
    if (netCapacity(gross) >= requiredBits) return version;
  }
  throw new EncodeError(
    `jabcode: payload requires ${requiredBits} bits, which exceeds the largest supported master symbol (version ${MAX_VERSION})`,
  );
}

/**
 * Encodes `payload` as a single JAB Code master symbol in default mode.
 * @param {Uint8Array} payload
 * @returns {PolychromeMatrix}
 */
export function encodeJABCode(payload: Uint8Array): PolychromeMatrix {
  if (!(payload instanceof Uint8Array) || payload.length === 0) {
    throw new EncodeError('jabcode: payload must be a non-empty Uint8Array');
  }
  const byteModeBits = encodeByteMode(payload);
  const version = chooseVersion(byteModeBits.length);
  const layout = buildSymbolLayout(version);

  const grossCapacity = masterSymbolCapacity(version);
  const netCap = netCapacity(grossCapacity);
  const message = new Uint8Array(netCap);
  message.set(byteModeBits);
  // Net-capacity padding beyond the real byte-mode segment: alternating
  // bits, matching the reference's own padding convention (see matrix.ts).
  let pad = 0;
  for (let i = byteModeBits.length; i < netCap; i++) {
    message[i] = pad;
    pad = pad === 0 ? 1 : 0;
  }

  const codeword = encodeLDPC(message, WC, WR);
  placeData(layout, codeword);

  const matrix = new PolychromeMatrix(layout.width, layout.height, JABCODE_PALETTE);
  for (let y = 0; y < layout.height; y++) {
    for (let x = 0; x < layout.width; x++) {
      matrix.set(x, y, layout.colors[y * layout.width + x] + 1); // +1: shift past the background slot
    }
  }
  Object.defineProperty(matrix, 'jabcode', {
    value: Object.freeze({ version, payloadLength: payload.length }),
    enumerable: true,
  });
  return matrix;
}

function decodeLayout(layout: SymbolLayout, version: number, sampleColor: (x: number, y: number) => number): Uint8Array {
  const bits = readData(layout, sampleColor);
  const grossCapacity = masterSymbolCapacity(version);
  const gross = WR * Math.floor(grossCapacity / WR);
  const message = decodeLDPC(bits.subarray(0, gross), WC, WR);
  return decodeByteMode(message);
}

/** Decodes an already-classified `PolychromeMatrix` of the exact symbol layout for its version. */
export function decodeJABCodeMatrix(matrix: PolychromeMatrix): Uint8Array {
  const version = Math.round((matrix.width - 17) / 4);
  if (matrix.width !== matrix.height || matrix.width !== 4 * version + 17) {
    throw new NotFoundError(`jabcode: matrix dimensions ${matrix.width}x${matrix.height} do not match any valid symbol side-version`);
  }
  const layout = buildSymbolLayout(version);
  return decodeLayout(layout, version, (x, y) => {
    const index = matrix.get(x, y) - 1;
    if (index < 0 || index >= DEFAULT_PALETTE.length) {
      throw new NotFoundError(`jabcode: module (${x}, ${y}) classified as background, not a data colour`);
    }
    return index;
  });
}

/**
 * Decodes a JAB Code master symbol from a raw (not binarized) RGBA image,
 * given the symbol's four corners in image space and its side-version
 * (known geometry -- see the module doc for what this does not do).
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} image
 * @param {{topLeft: {x:number,y:number}, topRight: {x:number,y:number}, bottomRight: {x:number,y:number}, bottomLeft: {x:number,y:number}}} corners
 * @param {number} version Side-version (1-32) of the symbol being decoded.
 * @returns {Uint8Array}
 */
export function decodeJABCode(
  image: { data: Uint8ClampedArray; width: number; height: number },
  corners: { topLeft: { x: number; y: number }; topRight: { x: number; y: number }; bottomRight: { x: number; y: number }; bottomLeft: { x: number; y: number } },
  version: number,
): Uint8Array {
  const size = 4 * version + 17;
  const transform = PerspectiveTransform.quadToQuad(
    0, 0, size, 0, size, size, 0, size,
    corners.topLeft.x, corners.topLeft.y,
    corners.topRight.x, corners.topRight.y,
    corners.bottomRight.x, corners.bottomRight.y,
    corners.bottomLeft.x, corners.bottomLeft.y,
  );
  const classified = classifyGrid(image, size, size, transform, JABCODE_PALETTE);
  return decodeJABCodeMatrix(classified);
}
