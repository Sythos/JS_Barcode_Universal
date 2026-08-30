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

import { BitMatrix } from '../core/bit-matrix.js';

export type DataBarStackedOmnidirectionalVariant =
  | 'stacked-omnidirectional'
  | 'stacked-omni'
  | 'stackedomni';

export interface DataBarStackedOmnidirectionalOptions {
  /** Optional alias accepted for compatibility with the DataBar writer. */
  variant?: DataBarStackedOmnidirectionalVariant;
  /** Whether the symbol carries the composite/linkage flag. */
  linkage?: boolean;
  /** Height in modules of each of the two rows; minimum is 33. */
  rowHeight?: number;
  /** Alias for rowHeight. */
  barHeight?: number;
  /** Alias for rowHeight. */
  height?: number;
  /** The standard separator is fixed at three modules. */
  separatorModules?: 3;
}

export interface DataBarStackedOmnidirectionalElement {
  readonly ai: '01';
  readonly value: string;
  readonly fixed: true;
}

export interface DataBarStackedOmnidirectionalResult {
  readonly format: 'databar-stacked-omnidirectional';
  readonly variant: 'stacked-omnidirectional';
  readonly text: string;
  readonly gtin: string;
  readonly gs1: true;
  readonly linkage: boolean;
  readonly symbologyIdentifier: ']e0';
  readonly checksum: number;
  readonly checksumValid: true;
  readonly rows: 2;
  readonly rowHeight: number;
  readonly separatorModules: 3;
  readonly elements: readonly [DataBarStackedOmnidirectionalElement];
}

export type DataBarStackedOmnidirectionalRotation = 0 | 90 | 180 | 270;

export interface DataBarStackedOmnidirectionalDetection extends DataBarStackedOmnidirectionalResult {
  readonly matrix: BitMatrix;
  readonly corners: readonly [
    { readonly x: number; readonly y: number },
    { readonly x: number; readonly y: number },
    { readonly x: number; readonly y: number },
    { readonly x: number; readonly y: number },
  ];
  readonly moduleSize: number;
  readonly rotation: DataBarStackedOmnidirectionalRotation;
  readonly confidence: 1;
  readonly quality: {
    readonly quietZone: boolean;
    readonly checksum: true;
    readonly rows: 2;
    readonly consistency: 1;
  };
  readonly score: 1;
}

/** Encode a checked GTIN as GS1 DataBar Stacked Omnidirectional. */
export declare function encodeDataBarStackedOmnidirectional(
  value: string | number | bigint,
  options?: DataBarStackedOmnidirectionalOptions,
): BitMatrix;

/** Decode a clean, upright GS1 DataBar Stacked Omnidirectional matrix. */
export declare function decodeDataBarStackedOmnidirectional(
  matrix: BitMatrix,
  options?: Pick<DataBarStackedOmnidirectionalOptions, 'rowHeight' | 'barHeight' | 'height' | 'separatorModules'>,
): DataBarStackedOmnidirectionalResult;

/** Detect and decode one clean, integer-scaled Stacked Omnidirectional symbol. */
export declare function detectDataBarStackedOmnidirectional(
  binaryImage: BitMatrix,
  options?: Pick<DataBarStackedOmnidirectionalOptions, 'rowHeight' | 'barHeight' | 'height' | 'separatorModules'>,
): DataBarStackedOmnidirectionalDetection | null;

/** Detect-and-decode alias matching the other matrix-format modules. */
export declare const detectAndDecodeDataBarStackedOmnidirectional: typeof detectDataBarStackedOmnidirectional;

export declare const encodeDataBarStackedOmni: typeof encodeDataBarStackedOmnidirectional;
export declare const decodeDataBarStackedOmni: typeof decodeDataBarStackedOmnidirectional;
export declare const detectDataBarStackedOmni: typeof detectDataBarStackedOmnidirectional;
export declare const detectAndDecodeDataBarStackedOmni: typeof detectDataBarStackedOmnidirectional;
export declare const encodeDataBar14StackedOmnidirectional: typeof encodeDataBarStackedOmnidirectional;
export declare const decodeDataBar14StackedOmnidirectional: typeof decodeDataBarStackedOmnidirectional;
export declare const detectDataBar14StackedOmnidirectional: typeof detectDataBarStackedOmnidirectional;
export declare const encodeDataBar14StackedOmni: typeof encodeDataBarStackedOmnidirectional;
export declare const decodeDataBar14StackedOmni: typeof decodeDataBarStackedOmnidirectional;
export declare const detectDataBar14StackedOmni: typeof detectDataBarStackedOmnidirectional;
