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
import { BitMatrix } from '../core/bit-matrix.js';
export type FIMType = 'A' | 'B' | 'C' | 'D' | 'E';
export declare const FIM_PATTERNS: Readonly<Record<FIMType, string>>;
export declare function encodeFIM(value: FIMType | string): BitMatrix;
