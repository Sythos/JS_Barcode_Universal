/*!
 * Sythos Barcode Suite
 *
 * MIT License
 *
 * Copyright (c) 2026 Sythos
 * SPDX-FileCopyrightText: 2026 Sythos (https://www.sythos.net)
 * SPDX-License-Identifier: MIT
 */

import type { BitMatrix } from '../core/bit-matrix.js';

export interface DataBarLimitedEncodeOptions {
  linkage?: boolean;
  /** Integer module scale; `scale` is accepted as an alias. */
  moduleScale?: number;
  scale?: number;
  /** Output height in modules; the minimum is ten modules per row. */
  height?: number;
}

export interface DataBarLimitedElement {
  readonly ai: '01';
  readonly value: string;
  readonly fixed: true;
}

export interface DataBarLimitedDecodeResult {
  readonly format: 'databar-limited';
  readonly variant: 'limited';
  readonly text: string;
  readonly gtin: string;
  readonly gs1: true;
  readonly linkage: boolean;
  readonly checksum: number;
  readonly checksumValid: true;
  readonly moduleScale: number;
  readonly height: number;
  readonly symbologyIdentifier: ']e0';
  readonly elements: readonly [DataBarLimitedElement];
}

export interface DataBarLimitedDetection extends DataBarLimitedDecodeResult {
  readonly result: DataBarLimitedDecodeResult;
  readonly matrix: BitMatrix;
  readonly corners: readonly [
    { readonly x: number; readonly y: number },
    { readonly x: number; readonly y: number },
    { readonly x: number; readonly y: number },
    { readonly x: number; readonly y: number },
  ];
  readonly rotation: 0 | 90 | 180 | 270;
  readonly moduleSize: number;
  readonly confidence: 1;
  readonly quality: {
    readonly quietZone: boolean;
    readonly checksum: true;
    readonly rows: 1;
    readonly consistency: 1;
  };
  readonly score: 1;
}

/** Encode a checked GTIN as GS1 DataBar Limited. */
export declare function encodeDataBarLimited(
  value: string | number,
  options?: DataBarLimitedEncodeOptions,
): BitMatrix;

/** Decode a complete, clean or integer-scaled Limited symbol. */
export declare function decodeDataBarLimited(matrix: BitMatrix): DataBarLimitedDecodeResult;

/** Detect one complete Limited symbol in a binary raster. */
export declare function detectDataBarLimited(
  binaryImage: BitMatrix,
  options?: object,
): DataBarLimitedDetection | null;

/** Detect and decode one Limited symbol, or return null. */
export declare const detectAndDecodeDataBarLimited: typeof detectDataBarLimited;

/** Decode a complete 79-module scanline, or return null for invalid input. */
export declare function decodeDataBarLimitedScanline(
  row: ArrayLike<number | boolean>,
): DataBarLimitedDecodeResult | null;
