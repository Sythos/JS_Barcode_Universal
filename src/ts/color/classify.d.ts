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
import { PolychromeMatrix, RGB } from './matrix.js';
import { PerspectiveTransform } from '../image/perspective.js';
export declare function classifyGrid(
    image: { data: Uint8ClampedArray; width: number; height: number },
    width: number,
    height: number,
    transform: PerspectiveTransform,
    palette: readonly RGB[],
): PolychromeMatrix;
