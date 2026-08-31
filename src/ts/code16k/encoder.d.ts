/*! SPDX-FileCopyrightText: 2026 Sythos (https://www.sythos.net) */
/*! SPDX-License-Identifier: MIT */
import { BitMatrix } from '../core/bit-matrix.js';
import type { Code16KEncodeOptions } from './tables.js';
export type Code16KMetadata = {
    format: 'code16k';
    rows: number;
    columns: number;
    rowHeight: number;
    separatorHeight: number;
    mode: number;
    codewords: number[];
    checksum: true;
};
export type Code16KMatrix = BitMatrix & {
    code16k?: Code16KMetadata;
};
export declare function encodeCode16K(value: string | Uint8Array | readonly number[], options?: Code16KEncodeOptions): Code16KMatrix;
export declare function code16kDimensions(value: string | Uint8Array | readonly number[], options?: Code16KEncodeOptions): {
    rows: number;
    columns: number;
    width: number;
    height: number;
    rowHeight: number;
    separatorHeight: number;
};
