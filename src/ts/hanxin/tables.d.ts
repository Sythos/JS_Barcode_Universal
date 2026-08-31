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
 * Han Xin Code structural tables and geometry.
 *
 * This module deliberately starts with the compact, alignment-free part of
 * ISO/IEC 20830: versions 1 through 3.  Keeping the function pattern mask in
 * one place makes the encoder, decoder and detector agree about every payload
 * cell and prevents accidental data placement over structural information.
 *
 * @module hanxin/tables
 */
import { BitMatrix } from '../core/bit-matrix.js';
import { GaloisField } from '../core/galois-field.js';
export declare const HANXIN_MIN_VERSION = 1;
export declare const HANXIN_MAX_VERSION = 3;
export declare const HANXIN_VERSIONS: readonly [1, 2, 3];
export type HanXinVersion = typeof HANXIN_VERSIONS[number];
export declare const HANXIN_ECC_LEVELS: readonly ['L1', 'L2', 'L3', 'L4'];
export type HanXinEccLevel = typeof HANXIN_ECC_LEVELS[number];
/** Han Xin's data field is GF(2^8) with x^8+x^6+x^5+x+1. */
export declare const GF256_HANXIN: GaloisField;
/** Total codewords, including error correction, for versions 1 through 3. */
export declare const HANXIN_TOTAL_CODEWORDS: readonly [25, 37, 50];
/** Data modules, including the five zero remainder modules in each compact version. */
export declare const HANXIN_DATA_MODULES: readonly [205, 301, 405];
/** Unused tail modules after the complete codeword stream. */
export declare const HANXIN_REMAINDER_BITS: readonly [5, 5, 5];
/** @returns {number} Side length in modules. */
export declare function hanXinSize(version: number): number;
/** @returns {HanXinVersion} */
export declare function normalizeHanXinVersion(value: unknown): HanXinVersion;
/** @returns {HanXinEccLevel} */
export declare function normalizeHanXinEcc(value: unknown): HanXinEccLevel;
/** @returns {number} Index of an error-correction level. */
export declare function hanXinEccIndex(level: HanXinEccLevel): number;
/** @returns {{blockCount:number,dataCodewords:number,eccCodewords:number}} */
export declare function hanXinEcLayout(version: HanXinVersion, level: HanXinEccLevel): {
    blockCount: number;
    dataCodewords: number;
    eccCodewords: number;
};
/** @returns {number} Data codewords for a version and EC level. */
export declare function hanXinDataCodewords(version: HanXinVersion, level: HanXinEccLevel): number;
/** Four orientation-specific 7x7 finder patterns, packed MSB first. */
export declare const HANXIN_FINDER_TOP_LEFT: readonly [127, 64, 95, 80, 87, 87, 87];
export declare const HANXIN_FINDER_SIDE: readonly [127, 1, 125, 5, 117, 117, 117];
export declare const HANXIN_FINDER_BOTTOM_RIGHT: readonly [117, 117, 117, 5, 125, 1, 127];
export type HanXinCoordinate = readonly [number, number];
/** Return the function modules and their fixed darkness for a version. */
export declare function createHanXinFunctionGrid(version: HanXinVersion): {
    matrix: BitMatrix;
    reserved: Uint8Array;
};
/** Return payload positions in the normative row-major order. */
export declare function hanXinDataCoordinates(version: HanXinVersion): HanXinCoordinate[];
/** Whether a data module is inverted by one of Han Xin's four masks. */
export declare function hanXinMaskFlip(mask: number, x: number, y: number): boolean;
/** Build the 34 structural bits protected by the GF(16) short RS block. */
export declare function hanXinFunctionInfoBits(version: HanXinVersion, level: HanXinEccLevel, mask: number): boolean[];
/** Place both redundant structural-information copies in the fixed strips. */
export declare function placeHanXinFunctionInfo(matrix: BitMatrix, version: HanXinVersion, level: HanXinEccLevel, mask: number): void;
/** Decode a structural information copy, correcting up to two nibble errors. */
export declare function decodeHanXinFunctionInfo(matrix: BitMatrix, version: HanXinVersion): {
    version: HanXinVersion;
    level: HanXinEccLevel;
    mask: number;
    corrections: number;
};
/** Verify all fixed modules and count the payload cells. */
export declare function validateHanXinTables(): string[];
