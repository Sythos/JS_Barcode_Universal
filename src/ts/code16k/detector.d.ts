/*! SPDX-FileCopyrightText: 2026 Sythos (https://www.sythos.net) */
/*! SPDX-License-Identifier: MIT */
import type { BitMatrix } from '../core/bit-matrix.js';
import type { Code16KDecodeResult } from './decoder.js';
export type Code16KDetectOptions = {
    rowHeight?: number;
    separatorHeight?: number;
    moduleSize?: number;
};
export type Code16KPoint = {
    x: number;
    y: number;
};
export type Code16KDetectedResult = Code16KDecodeResult & {
    matrix: BitMatrix;
    corners: Code16KPoint[];
    rotation: 0 | 90 | 180 | 270;
    moduleSize: number;
};
export declare function detectCode16K(binaryImage: BitMatrix, options?: Code16KDetectOptions): Code16KDetectedResult | null;
export declare function detectAndDecodeCode16K(binaryImage: BitMatrix, options?: Code16KDetectOptions): Code16KDetectedResult | null;
