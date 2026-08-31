/*!
 * Sythos Barcode Suite
 *
 * MIT License
 *
 * Copyright (c) 2026 Sythos
 * SPDX-FileCopyrightText: 2026 Sythos (https://www.sythos.net)
 * SPDX-License-Identifier: MIT
 *
 * Original work. No code from any other barcode implementation.
 */
/**
 * Integer-scale Han Xin detector.
 *
 * Detection deliberately accepts one prominent, axis-aligned symbol from a
 * binarized image.  It does not guess a perspective quadrilateral or return a
 * low-confidence payload: the strict module decoder remains the final gate.
 *
 * @module hanxin/detector
 */
import { BitMatrix } from '../core/bit-matrix.js';
import { HanXinDecodeResult } from './decoder.js';
export interface HanXinDetection {
    corners: Array<{
        x: number;
        y: number;
    }>;
    dimension: {
        width: number;
        height: number;
    };
    moduleSize: number;
    matrix: BitMatrix;
    result: HanXinDecodeResult;
}
/** Detect one strict, integer-scale Han Xin symbol in a binarized image. */
export declare function detectHanXin(binaryImage: BitMatrix): HanXinDetection | null;
/** Detect and decode one verified Han Xin symbol, or return null. */
export declare function detectAndDecodeHanXin(binaryImage: BitMatrix): (HanXinDecodeResult & {
    corners: Array<{
        x: number;
        y: number;
    }>;
    moduleSize: number;
}) | null;
