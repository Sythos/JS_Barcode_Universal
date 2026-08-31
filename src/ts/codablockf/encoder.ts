/*
 * Sythos Barcode Suite — Codablock-F writer
 *
 * MIT License
 * Copyright (c) 2026 Sythos
 * SPDX-License-Identifier: MIT
 *
 * Original work. No code from any other barcode implementation.
 */

import { BitMatrix } from '../core/bit-matrix.js';
import { EncodeError } from '../core/errors.js';
import { code128DataCodewords } from '../oned/writers.js';
import {
  code128Checksum,
  code128CodewordsModules,
  renderStackedRows,
} from '../stacked128/common.js';

export interface CodablockFEncodeOptions {
  /** Number of stacked rows, from 2 through 44. */
  rows?: number;
  /** Data symbols per row, from 4 through 62. */
  columns?: number;
  /** Height of each row in modules. */
  rowHeight?: number;
  /** Height of the separator bars in modules. */
  separatorHeight?: number;
}

export interface CodablockFMatrixMetadata {
  readonly rows: number;
  readonly columns: number;
  readonly rowHeight: number;
  readonly separatorHeight: number;
  readonly checks: readonly [number, number];
}

const START_A = 103;
const CODE_B = 100;
const PAD = 103;
const MIN_ROWS = 2;
const MAX_ROWS = 44;
const MIN_COLUMNS = 4;
const MAX_COLUMNS = 62;

/** Weighted modulo-86 K1/K2 checks used by the complete Codablock stream. */
export function codablockFChecks(values: readonly number[]): [number, number] {
  let k1 = 0;
  let k2 = 0;
  for (let i = 0; i < values.length; i++) {
    k1 = (k1 + (i + 1) * values[i]) % 86;
    k2 = (k2 + (i + 2) * values[i]) % 86;
  }
  k2 = (k2 + k1) % 86;
  return [k1, k2];
}

function validateDimensions(rows: number | undefined, columns: number | undefined) {
  if (rows !== undefined && (!Number.isInteger(rows) || rows < MIN_ROWS || rows > MAX_ROWS)) {
    throw new EncodeError(`Codablock-F: rows must be an integer in ${MIN_ROWS}..${MAX_ROWS}`);
  }
  if (columns !== undefined && (!Number.isInteger(columns) || columns < MIN_COLUMNS || columns > MAX_COLUMNS)) {
    throw new EncodeError(`Codablock-F: columns must be an integer in ${MIN_COLUMNS}..${MAX_COLUMNS}`);
  }
}

function chooseDimensions(length: number, rowsOption?: number, columnsOption?: number) {
  validateDimensions(rowsOption, columnsOption);
  const candidates: { rows: number; columns: number; score: number }[] = [];
  for (let rows = rowsOption ?? MIN_ROWS; rows <= (rowsOption ?? MAX_ROWS); rows++) {
    for (let columns = columnsOption ?? MIN_COLUMNS; columns <= (columnsOption ?? MAX_COLUMNS); columns++) {
      if (rows * columns - 2 < length) continue;
      // Keep the default reasonably compact while favouring a readable width.
      const ratio = (columns + 4) / rows;
      const score = (rows * columns - 2 - length) * 10 + Math.abs(ratio - 2.5);
      candidates.push({ rows, columns, score });
    }
  }
  if (candidates.length === 0) {
    throw new EncodeError('Codablock-F: payload does not fit the requested rows and columns');
  }
  candidates.sort((a, b) => a.score - b.score || a.rows - b.rows || a.columns - b.columns);
  return candidates[0];
}

/** Encode an ASCII payload as a conservative, standards-shaped Codablock-F symbol. */
export function encodeCodablockF(value: string, options: CodablockFEncodeOptions = {}): BitMatrix {
  if (typeof value !== 'string' || value.length === 0) {
    throw new EncodeError('Codablock-F: payload must be a non-empty ASCII string');
  }
  const dataStream = code128DataCodewords(value, { startSet: 'B' });
  const { rows, columns } = chooseDimensions(dataStream.values.length, options.rows, options.columns);
  const rowHeight = options.rowHeight ?? 3;
  const separatorHeight = options.separatorHeight ?? 1;
  if (!Number.isInteger(rowHeight) || rowHeight < 1 || rowHeight > 128) {
    throw new EncodeError('Codablock-F: rowHeight must be an integer in 1..128');
  }
  if (!Number.isInteger(separatorHeight) || separatorHeight < 1 || separatorHeight > 16) {
    throw new EncodeError('Codablock-F: separatorHeight must be an integer in 1..16');
  }

  const slotCount = rows * columns;
  const body = dataStream.values.slice();
  while (body.length < slotCount - 2) body.push(PAD);
  const checks = codablockFChecks(body);
  body.push(checks[0], checks[1]);

  const rowModules: string[] = [];
  for (let row = 0; row < rows; row++) {
    const indicator = row === 0 ? rows : row;
    const data = body.slice(row * columns, (row + 1) * columns);
    const withoutRowCheck = [START_A, CODE_B, indicator, ...data];
    const rowCheck = code128Checksum(withoutRowCheck);
    const codewords = [...withoutRowCheck, rowCheck, 106];
    rowModules.push(code128CodewordsModules(codewords));
  }

  const matrix = renderStackedRows(rowModules, rowHeight, separatorHeight);
  (matrix as BitMatrix & { codablockf?: CodablockFMatrixMetadata }).codablockf = {
    rows,
    columns,
    rowHeight,
    separatorHeight,
    checks,
  };
  return matrix;
}
