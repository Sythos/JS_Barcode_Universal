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
 * DX film edge barcode (Kodak, 1983/1990). The latent-image two-track code
 * printed along the edge of 35mm film below the sprocket holes: a fixed
 * "clock" track for scanner synchronization and a "data" track carrying the
 * film's DX product/generation code and, every half frame, the frame number.
 *
 * Structure verified directly from US Patent 4,965,628A ("Photographic Film
 * With Latent Image Multi-Field Bar Code and Eye-Readable Symbols," Eastman
 * Kodak, filed 1989, granted 1990) — read from its own page images, not
 * automated text extraction. The patent's own high-level summary states a
 * 7-bit frame-number field, which conflicts with the field width actually
 * used by every real-world sample and by the only known open-source
 * implementation; the field widths and separator-bit positions below follow
 * the real, working structure (6-bit frame number, one separator bit after
 * the product code, one after the half-frame flag), cross-checked against
 * Wikipedia's "DX encoding" article (itself citing a 2017 peer-reviewed
 * archival-science paper analyzing real film samples) and confirmed against
 * Zint's dxfilmedge.c as a black-box behavioural reference — not copied from
 * it. See `licenses/dx-film-edge-barcode.license`.
 *
 * @module oned/dxfilmedge
 */

import { BitMatrix } from '../core/bit-matrix.js';
import { EncodeError, FormatError } from '../core/errors.js';

const START_PATTERN = '101010'; // 6 bits
const STOP_PATTERN = '0101'; // 4 bits
const SHORT_LENGTH = 23; // no frame info: 6 + 7 + 1 + 4 + 1 + 4
const LONG_LENGTH = 31; // with frame info: 6 + 7 + 1 + 4 + 6 + 1 + 1 + 1 + 4

function clockTrack(length) {
  // The clock track carries no data: a fixed synchronization pattern
  // determined purely by the data track's length (short/no-frame-info vs
  // long/with-frame-info), reproduced from Zint's dxfilmedge.c as a
  // black-box behavioural reference.
  if (length === SHORT_LENGTH) return '11111010101010101010111';
  if (length === LONG_LENGTH) return '1111101010101010101010101010111';
  return null;
}

function toBits(value, width) {
  let bits = '';
  for (let shift = width - 1; shift >= 0; shift--) bits += (value >> shift) & 1;
  return bits;
}

function fromBits(bits) {
  return parseInt(bits, 2);
}

export interface DXFilmEdgeFields {
  productCode: number;
  generation: number;
  frameNumber?: number;
  halfFrame?: boolean;
}

/**
 * Encode a DX film edge barcode.
 *
 * @param {{productCode: number, generation: number, frameNumber?: number, halfFrame?: boolean}} fields
 * `productCode` (1-127) and `generation` (0-15) together form the DX
 * product/generation number. `frameNumber` (0-63), when supplied, adds the
 * half-frame-interval frame field and `halfFrame` flags the odd half of a
 * pair.
 * @returns {BitMatrix} Two rows: clock track (row 0), data track (row 1).
 */
export function encodeDXFilmEdge(fields) {
  const productCode = fields?.productCode;
  const generation = fields?.generation;
  if (!Number.isInteger(productCode) || productCode < 1 || productCode > 127) {
    throw new EncodeError('DX film edge productCode must be an integer 1-127');
  }
  if (!Number.isInteger(generation) || generation < 0 || generation > 15) {
    throw new EncodeError('DX film edge generation must be an integer 0-15');
  }
  const hasFrame = fields.frameNumber !== undefined && fields.frameNumber !== null;
  let frameNumber = 0;
  if (hasFrame) {
    frameNumber = fields.frameNumber;
    if (!Number.isInteger(frameNumber) || frameNumber < 0 || frameNumber > 63) {
      throw new EncodeError('DX film edge frameNumber must be an integer 0-63');
    }
  } else if (fields.halfFrame) {
    throw new EncodeError('DX film edge halfFrame requires frameNumber to be set');
  }

  let data = START_PATTERN;
  data += toBits(productCode, 7);
  data += '0'; // separator between product code and generation
  data += toBits(generation, 4);
  if (hasFrame) {
    data += toBits(frameNumber, 6);
    data += fields.halfFrame ? '1' : '0';
    data += '0'; // separator between half-frame flag and parity
  }

  let parity = 0;
  for (let i = START_PATTERN.length; i < data.length; i++) if (data[i] === '1') parity ^= 1;
  data += String(parity);
  data += STOP_PATTERN;

  const expected = hasFrame ? LONG_LENGTH : SHORT_LENGTH;
  if (data.length !== expected) {
    throw new EncodeError('DX film edge: internal bit layout mismatch');
  }
  const clock = clockTrack(data.length);

  const matrix = new BitMatrix(data.length, 2);
  for (let x = 0; x < data.length; x++) {
    if (clock[x] === '1') matrix.set(x, 0);
    if (data[x] === '1') matrix.set(x, 1);
  }
  return matrix;
}

export interface DXFilmEdgeDecodeResult {
  format: 'dxfilmedge';
  productCode: number;
  generation: number;
  frameNumber?: number;
  halfFrame?: boolean;
}

function decodeTrack(matrix, row) {
  let bits = '';
  for (let x = 0; x < matrix.width; x++) bits += matrix.get(x, row) ? '1' : '0';
  return bits;
}

function decodeFromBits(clock, data) {
  const length = data.length;
  if (length !== SHORT_LENGTH && length !== LONG_LENGTH) return null;
  if (clock !== clockTrack(length)) return null;
  if (data.slice(0, START_PATTERN.length) !== START_PATTERN) return null;
  if (data.slice(-STOP_PATTERN.length) !== STOP_PATTERN) return null;

  let parity = 0;
  for (let i = START_PATTERN.length; i < data.length - STOP_PATTERN.length - 1; i++) {
    if (data[i] === '1') parity ^= 1;
  }
  const parityBit = data[data.length - STOP_PATTERN.length - 1];
  if (String(parity) !== parityBit) return null;

  let cursor = START_PATTERN.length;
  const productCode = fromBits(data.slice(cursor, cursor + 7)); cursor += 7;
  cursor += 1; // separator
  const generation = fromBits(data.slice(cursor, cursor + 4)); cursor += 4;

  const result = { format: 'dxfilmedge', productCode, generation };
  if (length === LONG_LENGTH) {
    const frameNumber = fromBits(data.slice(cursor, cursor + 6)); cursor += 6;
    const halfFrame = data[cursor] === '1'; cursor += 1;
    Object.assign(result, { frameNumber, halfFrame });
  }
  return Object.freeze(result);
}

/** Decode one DX film edge symbol from a 2-row, one-pixel-per-module BitMatrix. Returns `null` if not a valid symbol. */
export function decodeDXFilmEdgeMatrix(matrix): DXFilmEdgeDecodeResult | null {
  if (!matrix || matrix.height !== 2) return null;
  return decodeFromBits(decodeTrack(matrix, 0), decodeTrack(matrix, 1));
}

export interface DXFilmEdgeOptions {
  profile?: 'camera';
}

/**
 * Locate and decode one DX film edge symbol in a clean binary raster at
 * arbitrary pixel scale: the whole image is expected to contain exactly the
 * symbol's two track bands (clock above data, or reversed) against a light
 * background, the same "clean, bounded" contract as this SDK's other
 * structurally strict detectors. Returns `[]` if not found.
 */
export function decodeDXFilmEdge(image, options: DXFilmEdgeOptions = {}): DXFilmEdgeDecodeResult[] {
  if (!image || image.width < 1 || image.height < 2) return [];

  // The clock and data tracks are two adjacent rows with no gap between
  // them (unlike e.g. PostBar's separated symbols), so they form one
  // contiguous dark region, not two. Find the overall bounding box, then
  // split it into two equal vertical bands rather than looking for a gap.
  let minX = image.width, maxX = -1, minY = image.height, maxY = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (image.get(x, y)) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return [];
  const rowHeight = (maxY - minY + 1) / 2;
  if (rowHeight < 1) return [];
  if (options.profile === 'camera') {
    const leftQuiet = minX >= rowHeight * 2;
    const rightQuiet = image.width - 1 - maxX >= rowHeight * 2;
    if (!leftQuiet || !rightQuiet) return [];
  }
  const bands = [
    { start: minY, end: minY + rowHeight },
    { start: minY + rowHeight, end: maxY + 1 },
  ];
  const rowCentres = bands.map((b) => (b.start + b.end - 1) / 2);
  const span = maxX - minX + 1;

  for (const length of [SHORT_LENGTH, LONG_LENGTH]) {
    const pitch = span / length;
    if (pitch < 1) continue;
    const tracks = rowCentres.map((cy) => {
      let bits = '';
      for (let i = 0; i < length; i++) {
        const cx = Math.round(minX + (i + 0.5) * pitch);
        bits += image.get(Math.min(cx, image.width - 1), Math.round(cy)) ? '1' : '0';
      }
      return bits;
    });
    for (const [clock, data] of [[tracks[0], tracks[1]], [tracks[1], tracks[0]]]) {
      const result = decodeFromBits(clock, data);
      if (result) return [result];
    }
  }
  return [];
}
