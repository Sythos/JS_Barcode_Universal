/*! SPDX-FileCopyrightText: 2026 Sythos (https://www.sythos.net) */
/*! SPDX-License-Identifier: MIT */
import type { Code16KMatrix } from './encoder.js';
import type { Code16KDecodeOptions } from './tables.js';
export type Code16KRow = {
    row: number;
    values: number[];
};
export type Code16KDecodeResult = {
    format: 'code16k';
    text: string;
    rows: number;
    columns: number;
    rowHeight: number;
    separatorHeight: number;
    mode: number;
    codewords: number[];
    checksum: true;
    symbologyIdentifier: string;
    gs1?: boolean;
    fnc1AtStart?: boolean;
    fnc1Positions?: number[];
};
export declare function decodeCode16KRow(modules: string, expectedRow?: number): Code16KRow | null;
export declare function decodeCode16K(matrix: Code16KMatrix, options?: Code16KDecodeOptions): Code16KDecodeResult;
