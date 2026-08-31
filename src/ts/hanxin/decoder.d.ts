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
 * Strict Han Xin Code decoder for the alignment-free versions 1-3.
 *
 * The reader treats the matrix as untrusted input.  It first validates the
 * fixed corner patterns and both structural-information copies, then checks
 * Reed--Solomon parity and finally parses a complete payload.  A partially
 * readable stream is never returned as a successful result.
 *
 * @module hanxin/decoder
 */
import { BitMatrix } from '../core/bit-matrix.js';
import { HanXinEccLevel, HanXinVersion } from './tables.js';
export type HanXinRotation = 0 | 90 | 180 | 270;
export interface HanXinDecodeOptions {
    /** Try the listed clockwise orientation, or all right-angle turns. */
    rotation?: HanXinRotation | 'auto';
    /** Select polarity, or try normal then inverted modules. */
    inverted?: boolean | 'auto';
}
export interface HanXinDecodeResult {
    format: 'hanxin';
    text: string;
    bytes: Uint8Array;
    version: HanXinVersion;
    ecc: HanXinEccLevel;
    mask: 0 | 1 | 2 | 3;
    mode: 'numeric' | 'text' | 'byte';
    corrections: number;
    rows: number;
    columns: number;
    inverted: boolean;
    rotation: HanXinRotation;
}
/** Verify finder patterns, separators and all non-information function cells. */
export declare function hanXinStructureMatches(matrix: BitMatrix, version: HanXinVersion): boolean;
/** Decode a verified Han Xin module matrix. */
export declare function decodeHanXin(matrix: BitMatrix, options?: HanXinDecodeOptions): HanXinDecodeResult;
