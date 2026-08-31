/*! SPDX-FileCopyrightText: 2026 Sythos (https://www.sythos.net) */
/*! SPDX-License-Identifier: MIT */
export declare const CODE16K_MIN_ROWS = 2;
export declare const CODE16K_MAX_ROWS = 16;
export declare const CODE16K_SYMBOLS_PER_ROW = 5;
export declare const CODE16K_MODULE_WIDTH = 70;
export declare const CODE16K_START_WIDTH = 7;
export declare const CODE16K_GUARD_WIDTH = 1;
export declare const CODE16K_CODEWORD_WIDTH = 11;
export declare const CODE16K_STOP_WIDTH = 7;
export declare const CODE16K_DEFAULT_ROW_HEIGHT = 8;
export declare const CODE16K_DEFAULT_SEPARATOR_HEIGHT = 1;
export declare const CODE16K_PAD = 103;
export declare const CODE16K_ROW_PAIRS: readonly (readonly [number, number])[];
export declare const CODE16K_START_WIDTHS: readonly (readonly [number, number, number, number])[];
export type Code16KMode = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type Code16KModeName = 'A' | 'B' | 'C';
export type Code16KEncodeOptions = {
    rows?: number;
    rowHeight?: number;
    separatorHeight?: number;
    mode?: Code16KMode | Code16KModeName;
    gs1?: boolean;
};
export type Code16KDecodeOptions = {
    rowHeight?: number;
    separatorHeight?: number;
    rows?: number;
};
export declare function code16kModeNumber(mode: Code16KMode | Code16KModeName | undefined, gs1?: boolean): Code16KMode;
export declare function code16kModeInfo(mode: Code16KMode | Code16KModeName | undefined, gs1?: boolean): {
    mode: Code16KMode;
    startSet: Code16KModeName;
    gs1: boolean;
};
export declare function code16kStartModules(row: number): string;
export declare function code16kStopModules(row: number): string;
export declare function code16kWidth(): number;
export declare function code16kGeometry(width: number, height: number, rows: number, rowHeight: number, separatorHeight: number, outerSeparators?: boolean): {
    width: number;
    height: number;
    rows: number;
    rowHeight: number;
    separatorHeight: number;
};
export declare function validateCode16KOptions(options?: Code16KEncodeOptions): {
    rows?: number;
    rowHeight: number;
    separatorHeight: number;
    mode: Code16KMode;
    startSet: Code16KModeName;
    gs1: boolean;
};
export declare function validateCode16KTables(): string[];
