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

import type { BitMatrix } from '../core/bit-matrix.js';

export interface DataBarStackedEncodeOptions {
  linkage?: boolean;
  /** Total height; must be an integer multiple of the 13-module profile. */
  height?: number;
  /** Integer nearest-neighbour scale for the 50-module symbol width. */
  moduleScale?: number;
  /** Alias for moduleScale. */
  scale?: number;
  /** Explicit output height of the top row, in modules. */
  topHeight?: number;
  /** Explicit output height of the separator, in modules. */
  separatorHeight?: number;
  /** Explicit output height of the bottom row, in modules. */
  bottomHeight?: number;
}

export interface DataBarStackedDecodeResult {
  readonly format: 'databar-stacked';
  readonly variant: 'stacked';
  readonly text: string;
  readonly gtin: string;
  readonly gs1: true;
  readonly linkage: boolean;
  readonly checksum: number;
  readonly rows: 2;
  readonly topHeight: number;
  readonly separatorHeight: number;
  readonly bottomHeight: number;
  readonly moduleScale: number;
  readonly symbologyIdentifier: ']e0';
  readonly elements: ReadonlyArray<{ readonly ai: '01'; readonly value: string; readonly fixed: true }>;
}

export interface DataBarStackedDetection extends DataBarStackedDecodeResult {
  readonly result: DataBarStackedDecodeResult;
  readonly matrix: BitMatrix;
  readonly corners: ReadonlyArray<{ readonly x: number; readonly y: number }>;
  readonly rotation: 0 | 90 | 180 | 270;
  readonly moduleSize: number;
}

/** Encode a checked 14-digit GTIN as GS1 DataBar Stacked. */
export declare function encodeDataBar14Stacked(
  value: string | number,
  options?: DataBarStackedEncodeOptions,
): BitMatrix;

/** Decode a clean or integer-scaled GS1 DataBar Stacked matrix. */
export declare function decodeDataBar14Stacked(matrix: BitMatrix): DataBarStackedDecodeResult;

/** Detect one clean axis-aligned or quarter-turned Stacked symbol. */
export declare function detectDataBar14Stacked(binaryImage: BitMatrix): DataBarStackedDetection | null;

/** Detect and decode one clean Stacked symbol, or return null. */
export declare function detectAndDecodeDataBar14Stacked(binaryImage: BitMatrix): DataBarStackedDetection | null;

export declare const encodeDataBarStacked: typeof encodeDataBar14Stacked;
export declare const decodeDataBarStacked: typeof decodeDataBar14Stacked;
export declare const detectDataBarStacked: typeof detectDataBar14Stacked;
export declare const detectAndDecodeDataBarStacked: typeof detectAndDecodeDataBar14Stacked;
export declare const encodeGS1DataBarStacked: typeof encodeDataBar14Stacked;
export declare const decodeGS1DataBarStacked: typeof decodeDataBar14Stacked;
export declare const detectGS1DataBarStacked: typeof detectDataBar14Stacked;
export declare const detectAndDecodeGS1DataBarStacked: typeof detectAndDecodeDataBar14Stacked;
