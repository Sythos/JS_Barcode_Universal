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
 * EXPERIMENTAL. Module placement for a single JAB Code master symbol in
 * default mode: finder pattern (3 nested rings x 4 corners), alignment
 * patterns (diamond markers on a grid, position given by `JAB_AP_POS`),
 * color-palette swatches (walked via `nextMetadataModuleInMaster`), and
 * the data area.
 *
 * Ported index-for-index from the reference's `createMatrix` (encoder.c),
 * restricted to the master symbol (no slaves), default mode (no metadata
 * modules -- `isDefaultMode` skips Part I/II entirely), and
 * `color_number=8` -- see `docs/JABCODE_NOTES.md` for the full scope this
 * was verified against.
 *
 * @module jabcode/matrix
 */

import {
  AP_CORE_COLOR,
  APX_CORE_COLOR,
  BITS_PER_MODULE,
  DISTANCE_TO_BORDER,
  FP0_CORE_COLOR,
  FP1_CORE_COLOR,
  FP2_CORE_COLOR,
  FP3_CORE_COLOR,
  JAB_AP_NUM,
  JAB_AP_POS,
  MASTER_METADATA_X,
  MASTER_METADATA_Y,
  MASTER_PALETTE_PLACEMENT_INDEX,
  nextMetadataModuleInMaster,
  versionToSize,
} from './tables.js';

export interface SymbolLayout {
  width: number;
  height: number;
  /** Color index (0-7) per module, row-major (index = y*width + x); data modules default to 0 here. */
  colors: Uint8Array;
  /** 1 = data-eligible module, 0 = fixed pattern (finder/alignment/palette). */
  isData: Uint8Array;
  /** Data-eligible module positions in the exact column-major placement order. */
  dataOrder: { x: number; y: number }[];
}

function set(layout: SymbolLayout, x: number, y: number, color: number): void {
  const i = y * layout.width + x;
  layout.colors[i] = color;
  layout.isData[i] = 0;
}

function placeAlignmentPatterns(layout: SymbolLayout, version: number): void {
  const apNum = JAB_AP_NUM[version - 1];
  const apPos = JAB_AP_POS[version - 1];
  for (let x = 0; x < apNum; x++) {
    let left = x % 2 === 1 ? 0 : 1;
    for (let y = 0; y < apNum; y++) {
      const xOffset = apPos[x] - 1;
      const yOffset = apPos[y] - 1;
      const isCorner =
        (x === 0 && y === 0) ||
        (x === 0 && y === apNum - 1) ||
        (x === apNum - 1 && y === 0) ||
        (x === apNum - 1 && y === apNum - 1);
      if (!isCorner) {
        if (left === 1) {
          set(layout, xOffset - 1, yOffset - 1, APX_CORE_COLOR);
          set(layout, xOffset, yOffset - 1, APX_CORE_COLOR);
          set(layout, xOffset - 1, yOffset, APX_CORE_COLOR);
          set(layout, xOffset + 1, yOffset, APX_CORE_COLOR);
          set(layout, xOffset, yOffset + 1, APX_CORE_COLOR);
          set(layout, xOffset + 1, yOffset + 1, APX_CORE_COLOR);
          set(layout, xOffset, yOffset, AP_CORE_COLOR);
        } else {
          set(layout, xOffset + 1, yOffset - 1, APX_CORE_COLOR);
          set(layout, xOffset, yOffset - 1, APX_CORE_COLOR);
          set(layout, xOffset - 1, yOffset, APX_CORE_COLOR);
          set(layout, xOffset + 1, yOffset, APX_CORE_COLOR);
          set(layout, xOffset, yOffset + 1, APX_CORE_COLOR);
          set(layout, xOffset - 1, yOffset + 1, APX_CORE_COLOR);
          set(layout, xOffset, yOffset, AP_CORE_COLOR);
        }
      }
      left = left === 0 ? 1 : 0;
    }
  }
}

function placeFinderPattern(layout: SymbolLayout): void {
  const { width, height } = layout;
  for (let k = 0; k < 3; k++) {
    const fp0 = k % 2 ? FP3_CORE_COLOR : FP0_CORE_COLOR;
    const fp1 = k % 2 ? FP2_CORE_COLOR : FP1_CORE_COLOR;
    const fp2 = k % 2 ? FP1_CORE_COLOR : FP2_CORE_COLOR;
    const fp3 = k % 2 ? FP0_CORE_COLOR : FP3_CORE_COLOR;
    for (let i = 0; i <= k; i++) {
      for (let j = 0; j <= k; j++) {
        if (i !== k && j !== k) continue;
        // upper-left (fp0)
        set(layout, DISTANCE_TO_BORDER - j - 1, DISTANCE_TO_BORDER - (i + 1), fp0);
        set(layout, DISTANCE_TO_BORDER + j - 1, DISTANCE_TO_BORDER + (i - 1), fp0);
        // upper-right (fp1)
        set(layout, width - (DISTANCE_TO_BORDER - 1) - j - 1, DISTANCE_TO_BORDER - (i + 1), fp1);
        set(layout, width - (DISTANCE_TO_BORDER - 1) + j - 1, DISTANCE_TO_BORDER + (i - 1), fp1);
        // lower-right (fp2)
        set(layout, width - (DISTANCE_TO_BORDER - 1) - j - 1, height - DISTANCE_TO_BORDER + i, fp2);
        set(layout, width - (DISTANCE_TO_BORDER - 1) + j - 1, height - DISTANCE_TO_BORDER - i, fp2);
        // lower-left (fp3)
        set(layout, DISTANCE_TO_BORDER - j - 1, height - DISTANCE_TO_BORDER + i, fp3);
        set(layout, DISTANCE_TO_BORDER + j - 1, height - DISTANCE_TO_BORDER - i, fp3);
      }
    }
  }
}

function placeColorPalette(layout: SymbolLayout): void {
  const pos = { x: MASTER_METADATA_X, y: MASTER_METADATA_Y };
  let moduleCount = 0;
  for (let i = 2; i < 8; i++) {
    for (let q = 0; q < 4; q++) {
      set(layout, pos.x, pos.y, MASTER_PALETTE_PLACEMENT_INDEX[q][i] % 8);
      moduleCount++;
      nextMetadataModuleInMaster(layout.height, layout.width, moduleCount, pos);
    }
  }
}

/** Builds the fixed-pattern layout (finder, alignment, palette) for a given side-version, master symbol only. */
export function buildSymbolLayout(version: number): SymbolLayout {
  const size = versionToSize(version);
  const layout: SymbolLayout = {
    width: size,
    height: size,
    colors: new Uint8Array(size * size),
    isData: new Uint8Array(size * size).fill(1),
    dataOrder: [],
  };
  placeAlignmentPatterns(layout, version);
  placeFinderPattern(layout);
  placeColorPalette(layout);

  // Column-major data order, matching the reference's `createMatrix` data-placement loop.
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (layout.isData[y * size + x]) layout.dataOrder.push({ x, y });
    }
  }
  return layout;
}

/**
 * Writes `codewordBits` (0/1 per bit, 3 bits per module) into the data
 * area in placement order, mask type 7 applied inline, then fills any
 * remaining data modules with the reference's alternating-bit padding.
 */
export function placeData(layout: SymbolLayout, codewordBits: Uint8Array): void {
  let written = 0;
  let padding = 0;
  for (const { x, y } of layout.dataOrder) {
    let colorIndex = 0;
    for (let j = 0; j < BITS_PER_MODULE; j++) {
      let bit: number;
      if (written < codewordBits.length) {
        bit = codewordBits[written];
        written++;
      } else {
        bit = padding;
        padding = padding === 0 ? 1 : 0;
      }
      colorIndex += bit << (BITS_PER_MODULE - 1 - j);
    }
    const masked = colorIndex ^ ((x * y * y) % 5 + (2 * x + y * y) % 13) % 8;
    layout.colors[y * layout.width + x] = masked;
  }
}

/** Reads back the (still-masked) module colors in data placement order, then removes mask type 7. */
export function readData(layout: SymbolLayout, sampleColor: (x: number, y: number) => number): Uint8Array {
  const bits = new Uint8Array(layout.dataOrder.length * BITS_PER_MODULE);
  let bitIndex = 0;
  for (const { x, y } of layout.dataOrder) {
    const masked = sampleColor(x, y);
    const colorIndex = masked ^ ((x * y * y) % 5 + (2 * x + y * y) % 13) % 8;
    for (let j = 0; j < BITS_PER_MODULE; j++) {
      bits[bitIndex++] = (colorIndex >> (BITS_PER_MODULE - 1 - j)) & 1;
    }
  }
  return bits;
}
