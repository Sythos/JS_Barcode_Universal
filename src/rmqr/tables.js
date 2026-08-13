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

import { BitMatrix } from '../core/bit-matrix.js';

/** The 32 rMQR dimensions in ISO/IEC 23941 order (width, height). */
export const RMQR_SIZES = Object.freeze([
  [43, 7], [59, 7], [77, 7], [99, 7], [139, 7],
  [43, 9], [59, 9], [77, 9], [99, 9], [139, 9],
  [27, 11], [43, 11], [59, 11], [77, 11], [99, 11], [139, 11],
  [27, 13], [43, 13], [59, 13], [77, 13], [99, 13], [139, 13],
  [43, 15], [59, 15], [77, 15], [99, 15], [139, 15],
  [43, 17], [59, 17], [77, 17], [99, 17], [139, 17],
]);

const REMAINDER_BITS = Object.freeze([0, 3, 5, 6, 1, 2, 3, 1, 4, 5, 2, 1, 0, 2, 7, 6, 4, 1, 6, 4, 3, 0, 1, 4, 6, 7, 2, 1, 2, 0, 3, 4]);
const TOTAL_CODEWORDS = Object.freeze([13, 21, 32, 44, 68, 21, 33, 49, 66, 99, 15, 31, 47, 67, 89, 132, 21, 41, 60, 85, 113, 166, 51, 74, 103, 136, 199, 61, 88, 122, 160, 232]);

// Each block is [number of blocks, total codewords per block, data codewords per block].
const M_BLOCKS = [
  [[1, 13, 6]], [[1, 21, 12]], [[1, 32, 20]], [[1, 44, 28]], [[1, 68, 44]],
  [[1, 21, 12]], [[1, 33, 21]], [[1, 49, 31]], [[1, 66, 42]], [[1, 49, 31], [1, 50, 32]],
  [[1, 15, 7]], [[1, 31, 19]], [[1, 47, 31]], [[1, 67, 43]], [[1, 44, 28], [1, 45, 29]], [[2, 66, 42]],
  [[1, 21, 14]], [[1, 41, 27]], [[1, 60, 38]], [[1, 42, 26], [1, 43, 27]], [[1, 56, 36], [1, 57, 37]], [[2, 55, 35], [1, 56, 36]],
  [[1, 51, 33]], [[1, 74, 48]], [[1, 51, 33], [1, 52, 34]], [[2, 68, 44]], [[2, 66, 42], [1, 67, 43]],
  [[1, 60, 39]], [[2, 44, 28]], [[2, 61, 39]], [[2, 53, 33], [1, 54, 34]], [[4, 58, 38]],
];
const H_BLOCKS = [
  [[1, 13, 3]], [[1, 21, 7]], [[1, 32, 10]], [[1, 44, 14]], [[2, 34, 12]],
  [[1, 21, 7]], [[1, 33, 11]], [[1, 24, 8], [1, 25, 9]], [[2, 33, 11]], [[3, 33, 11]],
  [[1, 15, 5]], [[1, 31, 11]], [[1, 23, 7], [1, 24, 8]], [[1, 33, 11], [1, 34, 12]], [[1, 44, 14], [1, 45, 15]], [[3, 44, 14]],
  [[1, 21, 7]], [[1, 41, 13]], [[2, 30, 10]], [[1, 42, 14], [1, 43, 15]], [[1, 37, 11], [2, 38, 12]], [[2, 41, 13], [2, 42, 14]],
  [[1, 25, 7], [1, 26, 8]], [[2, 37, 13]], [[2, 34, 10], [1, 35, 11]], [[4, 34, 12]], [[1, 39, 13], [4, 40, 14]],
  [[1, 30, 10], [1, 31, 11]], [[2, 44, 14]], [[1, 40, 12], [2, 41, 13]], [[4, 40, 14]], [[2, 38, 12], [4, 39, 13]],
];

const COUNT_BITS = Object.freeze({
  numeric: [4, 5, 6, 7, 7, 5, 6, 7, 7, 8, 4, 6, 7, 7, 8, 8, 5, 6, 7, 7, 8, 8, 7, 7, 8, 8, 9, 7, 8, 8, 8, 9],
  alphanumeric: [3, 5, 5, 6, 6, 5, 5, 6, 6, 7, 4, 5, 6, 6, 7, 7, 5, 6, 6, 7, 7, 8, 6, 7, 7, 7, 8, 6, 7, 7, 8, 8],
  byte: [3, 4, 5, 5, 6, 4, 5, 5, 6, 6, 3, 5, 5, 6, 6, 7, 4, 6, 6, 7, 7, 7, 6, 6, 7, 7, 7, 6, 6, 7, 7, 8],
  kanji: [2, 3, 4, 5, 5, 3, 4, 5, 5, 6, 2, 4, 5, 5, 6, 6, 3, 5, 5, 6, 6, 7, 5, 5, 6, 6, 7, 5, 6, 6, 6, 7],
});

const ALIGNMENT_BY_WIDTH = Object.freeze({ 27: [], 43: [21], 59: [19, 39], 77: [25, 51], 99: [23, 49, 75], 139: [27, 55, 83, 111] });

/** @param {number} version */
export function versionInfo(version) {
  if (!Number.isInteger(version) || version < 1 || version > 32) throw new RangeError(`rMQR: version must be 1-32, got ${version}`);
  const [width, height] = RMQR_SIZES[version - 1];
  const blockTable = (ecc) => ecc === 'M' ? M_BLOCKS[version - 1] : H_BLOCKS[version - 1];
  const blockLayout = (ecc) => {
    if (ecc !== 'M' && ecc !== 'H') throw new RangeError(`rMQR: ECC must be M or H, got ${ecc}`);
    const blocks = [];
    for (const [count, total, data] of blockTable(ecc)) for (let i = 0; i < count; i++) blocks.push({ total, data, ecc: total - data });
    return { blocks, totalCodewords: TOTAL_CODEWORDS[version - 1], totalDataCodewords: blocks.reduce((n, b) => n + b.data, 0), eccCodewords: blocks.reduce((n, b) => n + b.ecc, 0) };
  };
  return Object.freeze({ version, width, height, name: `R${height}x${width}`, indicator: version - 1, remainderBits: REMAINDER_BITS[version - 1], totalCodewords: TOTAL_CODEWORDS[version - 1], countBits(mode) { return COUNT_BITS[mode]?.[version - 1] ?? 0; }, blockLayout });
}

/** @param {number} width @param {number} height */
export function versionForSize(width, height) {
  const i = RMQR_SIZES.findIndex(([w, h]) => w === width && h === height);
  return i < 0 ? null : versionInfo(i + 1);
}

/** @param {number} version */
export function alignmentCoordinates(version) { return ALIGNMENT_BY_WIDTH[versionInfo(version).width] || []; }

function bchRemainder(value) {
  const generator = 0x1f25;
  let v = value << 12;
  while (v !== 0 && v.toString(2).length >= 13) v ^= generator << (v.toString(2).length - 13);
  return v;
}

/** Unmasked 18-bit format sequence: 5-bit version indicator plus ECC bit. */
export function formatBits(version, ecc) {
  const v = versionInfo(version);
  if (ecc !== 'M' && ecc !== 'H') throw new RangeError(`rMQR: ECC must be M or H, got ${ecc}`);
  const data = v.indicator | (ecc === 'H' ? 1 << 5 : 0);
  return (data << 12) | bchRemainder(data);
}

export const FORMAT_MASK_FINDER = 0b011111101010110010;
export const FORMAT_MASK_SUB = 0b100000101001111011;

/** rMQR has one fixed mask: floor(y/2)+floor(x/3) even. */
export function maskBit(x, y) { return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0; }

/** Function modules; set bits are non-data cells. */
export function functionModules(version) {
  const v = versionInfo(version); const m = new BitMatrix(v.width, v.height); const { width: w, height: h } = v;
  m.setRegion(0, 0, w, 1); m.setRegion(0, h - 1, w, 1); m.setRegion(0, 1, 1, h - 2); m.setRegion(w - 1, 1, 1, h - 2);
  for (const cx of alignmentCoordinates(version)) { m.setRegion(cx - 1, 1, 3, 2); m.setRegion(cx - 1, h - 3, 3, 2); m.setRegion(cx, 3, 1, h - 6); }
  m.setRegion(1, 1, 7, h === 7 ? 5 : 7); m.setRegion(8, 1, 3, 5); m.setRegion(11, 1, 1, 3);
  m.setRegion(w - 5, h - 5, 4, 4); m.setRegion(w - 8, h - 6, 3, 5); m.setRegion(w - 5, h - 6, 3, 1);
  m.set(w - 2, 1); if (h > 9) m.set(1, h - 2);
  return m;
}

/** Data coordinates in the standard right-to-left two-column traversal. */
export function dataModuleOrder(version) {
  const v = versionInfo(version); const fn = functionModules(version); const out = [];
  let cx = v.width - 2, cy = v.height - 6, dy = -1;
  // The data path starts beside the lower-right format area, then snakes
  // through each pair of columns between the one-module outer border.
  while (cx > 0) {
    for (const xx of [cx, cx - 1]) if (!fn.get(xx, cy)) out.push([xx, cy]);
    if (dy < 0 && cy === 1) { cx -= 2; dy = 1; }
    else if (dy > 0 && cy === v.height - 2) { cx -= 2; dy = -1; }
    else cy += dy;
  }
  return out;
}

export function dataBitCapacity(version, ecc) { const b = versionInfo(version).blockLayout(ecc); return b.totalDataCodewords * 8; }

export function validateTables() {
  const problems = [];
  if (RMQR_SIZES.length !== 32) problems.push(`expected 32 sizes, got ${RMQR_SIZES.length}`);
  for (let i = 1; i <= 32; i++) {
    const v = versionInfo(i); const order = dataModuleOrder(i); const expected = v.totalCodewords * 8 + v.remainderBits;
    if (order.length !== expected) problems.push(`${v.name}: data modules ${order.length}, expected ${expected}`);
    for (const ecc of ['M', 'H']) { const b = v.blockLayout(ecc); if (b.totalCodewords !== v.totalCodewords) problems.push(`${v.name}-${ecc}: block total mismatch`); }
  }
  return problems;
}
