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

/** Clean-matrix decoder for GS1 DataBar Omnidirectional and Truncated. @module databar/decoder */

import { ChecksumError, FormatError } from '../core/errors.js';
import { BitMatrix } from '../core/bit-matrix.js';
import { decodeDataBar14GTIN } from './codec.js';
import {
  DATABAR14_CHECKSUM_WEIGHTS,
  DATABAR14_FINDERS,
  dataBar14ValueForWidths,
} from './patterns.js';

function sampledRuns(matrix) {
  if (!matrix || !Number.isInteger(matrix.width) || !Number.isInteger(matrix.height)) {
    throw new TypeError('GS1 DataBar decoder expects a BitMatrix-like value');
  }
  if (matrix.width % 96 !== 0) throw new FormatError('GS1 DataBar-14 matrix width must be an integer multiple of 96 modules');
  const scale = matrix.width / 96;
  const y = Math.floor(matrix.height / 2);
  const bits = Array.from({ length: 96 }, (_, x) => matrix.get(x * scale + Math.floor(scale / 2), y));
  if (bits[0] || !bits[95]) throw new FormatError('GS1 DataBar-14 guard pattern is invalid');
  const runs = [];
  let current = bits[0];
  let length = 0;
  for (const bit of bits) {
    if (bit === current) length++;
    else {
      runs.push(length);
      current = bit;
      length = 1;
    }
  }
  runs.push(length);
  if (runs.length !== 46 || runs[0] !== 1 || runs[1] !== 1 || runs[44] !== 1 || runs[45] !== 1) {
    throw new FormatError('GS1 DataBar-14 element count or guard widths are invalid');
  }
  return runs;
}

function finderIndex(widths) {
  const key = widths.join(',');
  return DATABAR14_FINDERS.findIndex((candidate) => candidate.join(',') === key);
}

function expectedChecksum(widths) {
  const offsets = [0, 8, 24, 16];
  let checksum = 0;
  for (let character = 0; character < 4; character++) {
    for (let element = 0; element < 8; element++) {
      checksum += widths[character][element] * DATABAR14_CHECKSUM_WEIGHTS[offsets[character] + element];
    }
  }
  checksum %= 79;
  if (checksum >= 8) checksum++;
  if (checksum >= 72) checksum++;
  return checksum;
}

/** Decode a clean or integer-scaled 96-module DataBar-14 matrix. */
export function decodeDataBar14(matrix) {
  const runs = sampledRuns(matrix);
  const widths = [
    runs.slice(2, 10),
    runs.slice(15, 23).slice().reverse(),
    runs.slice(23, 31),
    runs.slice(36, 44).slice().reverse(),
  ];
  const leftFinder = finderIndex(runs.slice(10, 15));
  const rightFinder = finderIndex(runs.slice(31, 36).slice().reverse());
  if (leftFinder < 0 || rightFinder < 0) throw new FormatError('GS1 DataBar-14 finder pattern is invalid');
  const encodedChecksum = leftFinder * 9 + rightFinder;
  if (encodedChecksum !== expectedChecksum(widths)) throw new ChecksumError('GS1 DataBar-14 checksum mismatch');

  const outerLeft = dataBar14ValueForWidths(widths[0], 'outside');
  const innerLeft = dataBar14ValueForWidths(widths[1], 'inside');
  const innerRight = dataBar14ValueForWidths(widths[2], 'inside');
  const outerRight = dataBar14ValueForWidths(widths[3], 'outside');
  const decoded = decodeDataBar14GTIN({ outerLeft, innerLeft, outerRight, innerRight });
  return Object.freeze({
    format: 'databar-omnidirectional',
    text: decoded.gtin,
    gtin: decoded.gtin,
    linkage: decoded.linkage,
    symbologyIdentifier: ']e0',
  });
}

/**
 * Extract alternating runs from a binarized scanline.
 * @param {Uint8Array} row
 * @returns {{widths:number[], dark:boolean}[]}
 */
function scanlineRuns(row) {
  if (!row || row.length < 96) return [];
  const runs = [];
  let dark = row[0] === 1;
  let start = 0;
  for (let x = 1; x < row.length; x++) {
    const nextDark = row[x] === 1;
    if (nextDark === dark) continue;
    runs.push({ width: x - start, dark });
    start = x;
    dark = nextDark;
  }
  runs.push({ width: row.length - start, dark });
  return runs;
}

/**
 * Normalize a candidate's pixel runs to the 96 logical DataBar modules.
 * Rounding is followed by a small conservation pass so mild non-integer
 * scaling does not change the total symbol width.
 * @param {number[]} raw
 * @returns {number[]|null}
 */
function normalizeScanlineWidths(raw) {
  const total = raw.reduce((sum, width) => sum + width, 0);
  if (total <= 0) return null;
  const scale = total / 96;
  if (scale < 0.5) return null;
  const widths = raw.map((width) => Math.max(1, Math.round(width / scale)));
  let delta = 96 - widths.reduce((sum, width) => sum + width, 0);
  while (delta !== 0) {
    if (delta > 0) {
      let index = 0;
      for (let i = 1; i < widths.length; i++) if (raw[i] > raw[index]) index = i;
      widths[index]++;
      delta--;
    } else {
      let index = -1;
      for (let i = 0; i < widths.length; i++) {
        if (widths[i] <= 1) continue;
        if (index < 0 || raw[i] / widths[i] > raw[index] / widths[index]) index = i;
      }
      if (index < 0) return null;
      widths[index]--;
      delta++;
    }
  }
  if (widths[0] !== 1 || widths[widths.length - 1] !== 1) return null;
  return widths;
}

/** Build a 96-module row from normalized alternating runs. */
function matrixFromRuns(widths, darkFirst) {
  const matrix = new BitMatrix(96, 1);
  let x = 0;
  let dark = darkFirst;
  for (const width of widths) {
    if (dark) for (let i = 0; i < width; i++) matrix.set(x + i, 0);
    x += width;
    dark = !dark;
  }
  return matrix;
}

/**
 * Decode GS1 DataBar-14 from one raster scanline. This is the image layer over
 * the existing clean 96-module decoder; it recognizes both Omnidirectional
 * and Truncated symbols because their horizontal pattern is identical.
 *
 * @param {Uint8Array} row
 * @returns {{format:'gs1databar14', text:string, gtin:string, gs1:boolean, linkage:boolean, symbologyIdentifier:string, elements:Array}|null}
 */
export function decodeDataBar14Scanline(row) {
  const runs = scanlineRuns(row);
  for (let start = 0; start + 46 <= runs.length; start++) {
    if (runs[start].dark) continue;
    const candidate = runs.slice(start, start + 46);
    if (start + 46 < runs.length && runs[start + 46].dark) continue;
    const widths = normalizeScanlineWidths(candidate.map((run) => run.width));
    if (!widths) continue;
    try {
      const decoded = decodeDataBar14(matrixFromRuns(widths, false));
      return {
        ...decoded,
        format: 'gs1databar14',
        gs1: true,
        elements: [{ ai: '01', value: decoded.gtin, fixed: true }],
      };
    } catch {
      // Try the next light-run candidate in the scanline.
    }
  }
  return null;
}
