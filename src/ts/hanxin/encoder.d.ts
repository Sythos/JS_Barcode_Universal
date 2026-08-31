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
 * Dependency-free Han Xin Code encoder for the alignment-free versions 1-3.
 *
 * The implementation follows the public ISO/IEC 20830 structure: four corner
 * position patterns, protected structural information, GF(256) Reed--Solomon
 * blocks, 13-column picket-fence ordering and one of the four data masks.
 * Numeric, Text and Byte modes are intentionally explicit so callers never
 * get a silent lossy conversion.
 *
 * @module hanxin/encoder
 */
import { BitMatrix } from '../core/bit-matrix.js';
import { HanXinEccLevel, HanXinVersion } from './tables.js';
export type HanXinEncodeMode = 'auto' | 'numeric' | 'text' | 'byte';
export interface HanXinEncodeOptions {
    /** Force one of the three implemented dimensions. */
    version?: HanXinVersion | `V${HanXinVersion}` | number;
    /** L1 is the least redundant level; L4 is the strongest. */
    ecc?: HanXinEccLevel | 1 | 2 | 3 | 4;
    /** Select the payload interpretation. Defaults to auto. */
    mode?: HanXinEncodeMode;
    /** Force a mask 0-3. By default the lowest local penalty is chosen. */
    mask?: 0 | 1 | 2 | 3 | number;
}
/** Encode a string or byte array as a Han Xin Code module matrix. */
export declare function encodeHanXin(value: string | Uint8Array | number[], options?: HanXinEncodeOptions): BitMatrix;
/** Encode explicitly in byte mode; useful when the input contains arbitrary data. */
export declare function encodeHanXinBytes(bytes: Uint8Array | number[], options?: Omit<HanXinEncodeOptions, 'mode'>): BitMatrix;
/** Expose the implemented geometric side length for callers building rasters. */
export declare function hanXinDimension(version: HanXinVersion | number): number;
