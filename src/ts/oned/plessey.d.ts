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
export declare const PLESSEY_DIGIT_PATTERNS: readonly [
    '13131313', '31131313', '13311313', '31311313',
    '13133113', '31133113', '13313113', '31313113',
    '13131331', '31131331', '13311331', '31311331',
    '13133131', '31133131', '13313131', '31313131'
];
export declare const PLESSEY_START: '31311331';
export declare const PLESSEY_STOP: '331311313';
export declare const PLESSEY_CRC_POLYNOMIAL: readonly [1, 1, 1, 1, 0, 1, 0, 0, 1];
export declare const PLESSEY_MAX_DIGITS: 200;
export declare function plesseyCheckDigits(digits: number[]): [number, number];
export declare function encodePlessey(value: string): BitMatrix;
