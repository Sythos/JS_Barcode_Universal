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

export interface MaxiCodePrimary {
  postalCode: string;
  countryCode: number;
  serviceClass: number;
}

export interface MaxiCodeEncodeOptions {
  mode?: 2 | 3 | 4 | 5;
  primary?: MaxiCodePrimary;
  charset?: 'latin1';
}

export interface MaxiCodeDecodeOptions {
  inverted?: boolean | 'auto';
  rotation?: 0 | 180 | 'auto';
}

export interface MaxiCodeDecodeResult {
  readonly format: 'maxicode';
  readonly text: string;
  readonly bytes: Uint8Array;
  readonly mode: 2 | 3 | 4 | 5;
  readonly corrections: number;
  readonly rows: 33;
  readonly columns: 30;
  readonly inverted: boolean;
  readonly rotation: 0 | 180;
  readonly primary?: MaxiCodePrimary;
}

export interface MaxiCodeDetection extends MaxiCodeDecodeResult {
  readonly corners: readonly [
    { readonly x: number; readonly y: number },
    { readonly x: number; readonly y: number },
    { readonly x: number; readonly y: number },
    { readonly x: number; readonly y: number },
  ];
  readonly moduleSize: number;
}

/** Encode a Latin-1 payload into a MaxiCode mode 2, 3, 4 or 5 matrix. */
export declare function encodeMaxiCode(
  value: string | Uint8Array | number[],
  options?: MaxiCodeEncodeOptions,
): BitMatrix;

/** Encode a payload into MaxiCode six-bit data codewords. */
export declare function encodeMaxiCodeText(
  value: string | Uint8Array | number[],
): number[];

/** Place a complete 144-codeword stream into the MaxiCode module matrix. */
export declare function placeMaxiCodeCodewords(codewords: number[]): BitMatrix;

/** Decode an upright or 180-degree-rotated MaxiCode matrix. */
export declare function decodeMaxiCode(
  matrix: BitMatrix,
  options?: MaxiCodeDecodeOptions,
): MaxiCodeDecodeResult;

/** Decode a sequence of six-bit payload words. */
export declare function decodeMaxiCodeText(
  words: number[],
): { text: string; bytes: Uint8Array };

/** Check fixed finder and orientation modules. */
export declare function maxicodeStructureMatches(matrix: BitMatrix): boolean;

/** Read the 144 six-bit codewords from a canonical module matrix. */
export declare function readMaxiCodeCodewords(matrix: BitMatrix): number[];

/** Detect a scaled, inverted or full-frame MaxiCode raster. */
export declare function detectMaxiCode(binaryImage: BitMatrix): MaxiCodeDetection | null;

/** Detect and decode a MaxiCode, or return null. */
export declare function detectAndDecodeMaxiCode(binaryImage: BitMatrix): MaxiCodeDetection | null;

export declare const MAXICODE_WIDTH: 30;
export declare const MAXICODE_HEIGHT: 33;
export declare const MAXICODE_CODEWORDS: 144;
export declare const MAXICODE_DATA_MODULES: 864;
export declare const MAXICODE_FIELD_SIZE: 64;
export declare const MAXICODE_GRID: readonly number[];
export declare const validateMaxiCodeTables: () => string[];
