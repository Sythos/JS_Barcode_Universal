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
import { PolychromeMatrix } from './matrix.js';
export declare function toColorImageData(matrix: PolychromeMatrix, options?: {
    scale?: number;
    margin?: number;
}): {
    data: Uint8ClampedArray;
    width: number;
    height: number;
};
