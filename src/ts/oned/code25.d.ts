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
export type Code25Variant = 'standard' | 'industrial' | 'iata';
export declare const CODE25_DIGIT_PATTERNS: readonly [
    '1111313111', '3111111131', '1131111131', '3131111111', '1111311131',
    '3111311111', '1131311111', '1111113131', '3111113111', '1131113111'
];
export declare const CODE25_VARIANTS: Readonly<Record<Code25Variant, {
    readonly id: 'industrial2of5' | 'iata2of5';
    readonly label: string;
    readonly start: string;
    readonly stop: string;
}>>;
export declare const CODE25_MAX_DIGITS: 500;
export declare function code25CheckDigit(value: string): number;
export declare function encodeCode25(value: string, options?: {
    variant?: Code25Variant | string;
    checkDigit?: boolean;
    wideRatio?: number;
}): BitMatrix;
export declare function encodeStandard2of5(value: string, options?: {
    checkDigit?: boolean;
    wideRatio?: number;
}): BitMatrix;
export declare function encodeIndustrial2of5(value: string, options?: {
    checkDigit?: boolean;
    wideRatio?: number;
}): BitMatrix;
export declare function encodeIATA2of5(value: string, options?: {
    checkDigit?: boolean;
    wideRatio?: number;
}): BitMatrix;
