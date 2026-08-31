/*! SPDX-FileCopyrightText: 2026 Sythos (https://www.sythos.net) */
/*! SPDX-License-Identifier: MIT */
export { CODE16K_MIN_ROWS, CODE16K_MAX_ROWS, CODE16K_SYMBOLS_PER_ROW, CODE16K_MODULE_WIDTH, CODE16K_START_WIDTH, CODE16K_GUARD_WIDTH, CODE16K_CODEWORD_WIDTH, CODE16K_STOP_WIDTH, CODE16K_DEFAULT_ROW_HEIGHT, CODE16K_DEFAULT_SEPARATOR_HEIGHT, CODE16K_PAD, CODE16K_ROW_PAIRS, CODE16K_START_WIDTHS, code16kModeNumber, code16kModeInfo, code16kStartModules, code16kStopModules, code16kWidth, code16kGeometry, validateCode16KOptions, validateCode16KTables, } from './tables.js';
export type { Code16KMode, Code16KModeName, Code16KEncodeOptions, Code16KDecodeOptions, } from './tables.js';
export { encodeCode16K, code16kDimensions } from './encoder.js';
export type { Code16KMetadata, Code16KMatrix } from './encoder.js';
export { decodeCode16K, decodeCode16KRow } from './decoder.js';
export type { Code16KRow, Code16KDecodeResult } from './decoder.js';
export { detectCode16K, detectAndDecodeCode16K } from './detector.js';
export type { Code16KDetectOptions, Code16KPoint, Code16KDetectedResult } from './detector.js';
