/*!
 * Sythos Barcode Suite
 *
 * MIT License
 * Copyright (c) 2026 Sythos
 * SPDX-License-Identifier: MIT
 *
 * Original work. No code from any other barcode implementation.
 */

/**
 * Structural facts and option validation for Code 16K.
 *
 * A Code 16K row is 70 modules wide: a seven-module start pattern, a one
 * module guard bar, five eleven-module Code 128 symbols and a seven-module
 * stop pattern. The row start and stop pair identifies its one-based row
 * number. This module contains only the public table facts; packing and
 * decoding live in encoder.ts and decoder.ts.
 *
 * @module code16k/tables
 */

import { EncodeError } from '../core/errors.js';
import { alternatingWidths } from '../stacked128/common.js';

export const CODE16K_MIN_ROWS = 2;
export const CODE16K_MAX_ROWS = 16;
export const CODE16K_SYMBOLS_PER_ROW = 5;
export const CODE16K_MODULE_WIDTH = 70;
export const CODE16K_START_WIDTH = 7;
export const CODE16K_GUARD_WIDTH = 1;
export const CODE16K_CODEWORD_WIDTH = 11;
export const CODE16K_STOP_WIDTH = 7;
export const CODE16K_DEFAULT_ROW_HEIGHT = 8;
export const CODE16K_DEFAULT_SEPARATOR_HEIGHT = 1;
export const CODE16K_PAD = 103;

/** Start/stop values used to identify rows, in top-to-bottom order. */
export const CODE16K_ROW_PAIRS = Object.freeze([
  Object.freeze([0, 0]), Object.freeze([1, 1]),
  Object.freeze([2, 2]), Object.freeze([3, 3]),
  Object.freeze([4, 4]), Object.freeze([5, 5]),
  Object.freeze([6, 6]), Object.freeze([7, 7]),
  Object.freeze([0, 4]), Object.freeze([1, 5]),
  Object.freeze([2, 6]), Object.freeze([3, 7]),
  Object.freeze([4, 0]), Object.freeze([5, 1]),
  Object.freeze([6, 2]), Object.freeze([7, 3]),
] as const);

/** Widths for the eight edge-decodable start patterns. */
export const CODE16K_START_WIDTHS = Object.freeze([
  Object.freeze([3, 2, 1, 1]), Object.freeze([2, 2, 2, 1]),
  Object.freeze([2, 1, 2, 2]), Object.freeze([1, 4, 1, 1]),
  Object.freeze([1, 1, 3, 2]), Object.freeze([1, 2, 3, 1]),
  Object.freeze([1, 1, 1, 4]), Object.freeze([3, 1, 1, 2]),
] as const);

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

/** Return the canonical mode number used by the first symbol character. */
export function code16kModeNumber(
  mode: Code16KMode | Code16KModeName | undefined,
  gs1 = false,
): Code16KMode {
  if (mode === undefined) return gs1 ? 3 : 1;
  if (typeof mode === 'string') {
    if (mode === 'A') return 0;
    if (mode === 'B') return gs1 ? 3 : 1;
    return gs1 ? 4 : 2;
  }
  if (!Number.isInteger(mode) || mode < 0 || mode > 6) {
    throw new EncodeError('Code 16K: mode must be A, B, C or an integer in 0..6');
  }
  return mode as Code16KMode;
}

/** Resolve the initial Code 128 set and whether the first data value is FNC1. */
export function code16kModeInfo(
  mode: Code16KMode | Code16KModeName | undefined,
  gs1 = false,
): { mode: Code16KMode; startSet: Code16KModeName; gs1: boolean } {
  const resolved = code16kModeNumber(mode, gs1);
  if (resolved === 5 || resolved === 6) {
    throw new EncodeError('Code 16K: modes 5 and 6 require a dedicated shift encoder');
  }
  const startSet: Code16KModeName = resolved === 0 ? 'A' :
    resolved === 1 || resolved === 3 ? 'B' : 'C';
  return {
    mode: resolved,
    startSet,
    gs1: resolved === 3 || resolved === 4,
  };
}

/** Return the seven-module start pattern for a zero-based row index. */
export function code16kStartModules(row: number): string {
  if (!Number.isInteger(row) || row < 0 || row >= CODE16K_MAX_ROWS) {
    throw new RangeError('Code 16K: row index must be an integer in 0..15');
  }
  return alternatingWidths(CODE16K_START_WIDTHS[CODE16K_ROW_PAIRS[row][0]], true);
}

/** Return the seven-module stop pattern for a zero-based row index. */
export function code16kStopModules(row: number): string {
  if (!Number.isInteger(row) || row < 0 || row >= CODE16K_MAX_ROWS) {
    throw new RangeError('Code 16K: row index must be an integer in 0..15');
  }
  return alternatingWidths(CODE16K_START_WIDTHS[CODE16K_ROW_PAIRS[row][1]], false);
}

/** Return a complete row's bare module width. */
export function code16kWidth(): number {
  return CODE16K_MODULE_WIDTH;
}

/** Validate a matrix geometry and return its row count and separator height. */
export function code16kGeometry(
  width: number,
  height: number,
  rows: number,
  rowHeight: number,
  separatorHeight: number,
  outerSeparators = true,
): { width: number; height: number; rows: number; rowHeight: number; separatorHeight: number } {
  if (width !== CODE16K_MODULE_WIDTH) {
    throw new RangeError(`Code 16K: width must be ${CODE16K_MODULE_WIDTH} modules`);
  }
  if (!Number.isInteger(rows) || rows < CODE16K_MIN_ROWS || rows > CODE16K_MAX_ROWS) {
    throw new RangeError('Code 16K: rows must be an integer in 2..16');
  }
  if (!Number.isInteger(rowHeight) || rowHeight < 1 || rowHeight > 128) {
    throw new RangeError('Code 16K: rowHeight must be an integer in 1..128');
  }
  if (!Number.isInteger(separatorHeight) || separatorHeight < 1 || separatorHeight > 16) {
    throw new RangeError('Code 16K: separatorHeight must be an integer in 1..16');
  }
  const outer = outerSeparators ? 2 : 0;
  const expected = outer + rows * rowHeight + (rows - 1) * separatorHeight;
  if (height !== expected) {
    throw new RangeError(`Code 16K: height ${height} does not match the row geometry`);
  }
  return { width, height, rows, rowHeight, separatorHeight };
}

/** Validate public encoder options before any large matrix allocation. */
export function validateCode16KOptions(options: Code16KEncodeOptions = {}): {
  rows?: number;
  rowHeight: number;
  separatorHeight: number;
  mode: Code16KMode;
  startSet: Code16KModeName;
  gs1: boolean;
} {
  const rowHeight = options.rowHeight ?? CODE16K_DEFAULT_ROW_HEIGHT;
  const separatorHeight = options.separatorHeight ?? CODE16K_DEFAULT_SEPARATOR_HEIGHT;
  if (!Number.isInteger(rowHeight) || rowHeight < 1 || rowHeight > 128) {
    throw new EncodeError('Code 16K: rowHeight must be an integer in 1..128');
  }
  if (!Number.isInteger(separatorHeight) || separatorHeight < 1 || separatorHeight > 16) {
    throw new EncodeError('Code 16K: separatorHeight must be an integer in 1..16');
  }
  if (options.rows !== undefined &&
      (!Number.isInteger(options.rows) || options.rows < CODE16K_MIN_ROWS || options.rows > CODE16K_MAX_ROWS)) {
    throw new EncodeError('Code 16K: rows must be an integer in 2..16');
  }
  const info = code16kModeInfo(options.mode, options.gs1 === true);
  return { rows: options.rows, rowHeight, separatorHeight, ...info };
}

/** Check table invariants used by tests and CI. */
export function validateCode16KTables(): string[] {
  const problems: string[] = [];
  if (CODE16K_ROW_PAIRS.length !== CODE16K_MAX_ROWS) problems.push('row pair count mismatch');
  if (CODE16K_START_WIDTHS.length !== 8) problems.push('start pattern count mismatch');
  for (let row = 0; row < CODE16K_MAX_ROWS; row++) {
    if (code16kStartModules(row).length !== CODE16K_START_WIDTH) problems.push(`row ${row + 1} start width mismatch`);
    if (code16kStopModules(row).length !== CODE16K_STOP_WIDTH) problems.push(`row ${row + 1} stop width mismatch`);
  }
  return problems;
}
