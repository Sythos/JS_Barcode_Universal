/*!
 * Sythos Barcode Suite
 *
 * MIT License
 *
 * Copyright (c) 2026 Sythos
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * SPDX-FileCopyrightText: 2026 Sythos (https://www.sythos.net)
 * SPDX-License-Identifier: MIT
 *
 * Original work. No code from any other barcode implementation.
 */

/**
 * MicroPDF417 format facts and Row Address Pattern (RAP) helpers.
 *
 * The tables are represented as compact, immutable data and are guarded by
 * {@link validateMicroPdf417Tables}. They are deliberately separate from the
 * PDF417 symbol-character table: MicroPDF417 has a fixed family of symbols and
 * its own row-address system.
 *
 * Values are derived from publicly available symbology documentation and
 * independently checked against black-box reference output. This module makes
 * no certification or conformance claim.
 *
 * @module micropdf417/tables
 */

const variant = (id, columns, rows, eccCodewords, rapStart, rapRotation) => Object.freeze({
  id,
  columns,
  rows,
  totalCodewords: columns * rows,
  dataCodewords: columns * rows - eccCodewords,
  eccCodewords,
  rapStart,
  rapRotation,
});

/** All 34 predefined MicroPDF417 symbol variants, in format-table order. */
export const MICROPDF417_VARIANTS = Object.freeze([
  variant(1, 1, 11, 7, 1, 8), variant(2, 1, 14, 7, 8, 0),
  variant(3, 1, 17, 7, 36, 0), variant(4, 1, 20, 8, 19, 0),
  variant(5, 1, 24, 8, 9, 8), variant(6, 1, 28, 8, 25, 8),
  variant(7, 2, 8, 8, 1, 0), variant(8, 2, 11, 9, 1, 8),
  variant(9, 2, 14, 9, 8, 0), variant(10, 2, 17, 10, 36, 0),
  variant(11, 2, 20, 11, 19, 0), variant(12, 2, 23, 13, 9, 8),
  variant(13, 2, 26, 15, 27, 8),
  variant(14, 3, 6, 12, 1, 0), variant(15, 3, 8, 14, 7, 0),
  variant(16, 3, 10, 16, 15, 0), variant(17, 3, 12, 18, 25, 0),
  variant(18, 3, 15, 21, 37, 0), variant(19, 3, 20, 26, 1, 16),
  variant(20, 3, 26, 32, 1, 8), variant(21, 3, 32, 38, 21, 8),
  variant(22, 3, 38, 44, 15, 16), variant(23, 3, 44, 50, 1, 24),
  variant(24, 4, 4, 8, 47, 24), variant(25, 4, 6, 12, 1, 0),
  variant(26, 4, 8, 14, 7, 0), variant(27, 4, 10, 16, 15, 0),
  variant(28, 4, 12, 18, 25, 0), variant(29, 4, 15, 21, 37, 0),
  variant(30, 4, 20, 26, 1, 16), variant(31, 4, 26, 32, 1, 8),
  variant(32, 4, 32, 38, 21, 8), variant(33, 4, 38, 44, 15, 16),
  variant(34, 4, 44, 50, 1, 24),
]);

const byId = new Map(MICROPDF417_VARIANTS.map((entry) => [entry.id, entry]));

// Six run widths, ordered bar-space-bar-space-bar-space.  A RAP is ten
// modules wide; the right RAP has one additional one-module stop bar when
// rendered. Keeping runs rather than bitmap literals makes each invariant
// inspectable and avoids a rendering-specific representation here.
const SIDE_RAP_RUNS = Object.freeze([
  '221311', '311311', '312211', '222211', '213211', '214111', '223111', '313111',
  '322111', '412111', '421111', '331111', '241111', '232111', '231211', '321211',
  '411211', '411121', '411112', '321112', '312112', '311212', '311221', '311131',
  '311122', '311113', '221113', '221122', '221131', '221221', '222121', '312121',
  '321121', '231121', '231112', '222112', '213112', '212212', '212221', '212131',
  '212122', '212113', '211213', '211123', '211132', '211141', '211231', '211222',
  '211312', '211321', '211411', '212311',
]);

const CENTER_RAP_RUNS = Object.freeze([
  '112231', '121231', '122131', '131131', '131221', '132121', '141121', '141211',
  '142111', '133111', '132211', '131311', '122311', '123211', '124111', '115111',
  '114211', '114121', '123121', '123112', '122212', '122221', '121321', '121411',
  '112411', '113311', '113221', '113212', '113122', '122122', '131122', '131113',
  '122113', '113113', '112213', '112222', '112312', '112321', '111421', '111331',
  '111322', '111232', '111223', '111133', '111124', '111214', '112114', '121114',
  '121123', '121132', '112132', '112141',
]);

/** @param {number} value @param {number} offset @returns {number} */
export function microPdf417NextRap(value, offset = 1) {
  if (!Number.isInteger(value) || value < 1 || value > 52) throw new RangeError('MicroPDF417: RAP number must be in 1..52');
  if (!Number.isInteger(offset)) throw new RangeError('MicroPDF417: RAP offset must be an integer');
  return ((value - 1 + offset) % 52 + 52) % 52 + 1;
}

/** @param {number} id @returns {Readonly<typeof MICROPDF417_VARIANTS[number]>} */
export function microPdf417VariantByNumber(id) {
  const entry = byId.get(id);
  if (!entry) throw new RangeError('MicroPDF417: variant must be an integer in 1..34');
  return entry;
}

/**
 * Return the smallest data-region candidate that fits `codewords`.
 * Ties are resolved by width, then height, so selection is deterministic.
 */
export function microPdf417VariantForCapacity(codewords) {
  if (!Number.isInteger(codewords) || codewords < 1) throw new RangeError('MicroPDF417: codeword capacity must be a positive integer');
  const candidates = MICROPDF417_VARIANTS.filter((entry) => entry.dataCodewords >= codewords);
  if (!candidates.length) throw new RangeError('MicroPDF417: payload exceeds the largest symbol data region');
  return candidates.slice().sort((a, b) => a.totalCodewords - b.totalCodewords || a.columns - b.columns || a.rows - b.rows)[0];
}

/** Return the six bar/space run widths for a numbered side or center RAP. */
export function microPdf417RapSequence(number, kind = 'side') {
  if (!Number.isInteger(number) || number < 1 || number > 52) throw new RangeError('MicroPDF417: RAP number must be in 1..52');
  if (kind === 'side') return SIDE_RAP_RUNS[number - 1];
  if (kind === 'center') return CENTER_RAP_RUNS[number - 1];
  throw new RangeError('MicroPDF417: RAP kind must be side or center');
}

/**
 * Resolve all row-address data for a zero-based row within a variant.
 * @returns {{left: number, center: number|null, right: number, cluster: 0|3|6}}
 */
export function microPdf417RowAddress(entry, row) {
  if (!entry || !Number.isInteger(entry.columns) || !Number.isInteger(entry.rows)) throw new TypeError('MicroPDF417: a variant entry is required');
  if (!Number.isInteger(row) || row < 0 || row >= entry.rows) throw new RangeError(`MicroPDF417: row must be in 0..${entry.rows - 1}`);
  const left = microPdf417NextRap(entry.rapStart, row);
  const cluster = /** @type {0|3|6} */ (((left - 1) % 3) * 3);
  if (entry.columns < 3) return { left, center: null, right: microPdf417NextRap(left, entry.rapRotation), cluster };
  const center = microPdf417NextRap(left, entry.rapRotation);
  return { left, center, right: microPdf417NextRap(center, entry.rapRotation), cluster };
}

const validRuns = (runs) => runs.length === 6 && /^[1-9]{6}$/.test(runs) && [...runs].reduce((sum, digit) => sum + Number(digit), 0) === 10;
const oneEdgeShift = (from, to) => [...from].reduce((sum, digit, index) => sum + Math.abs(Number(digit) - Number(to[index])), 0) === 2;

/** Return any table-invariant failures; an empty result means the table is coherent. */
export function validateMicroPdf417Tables() {
  const issues = [];
  if (MICROPDF417_VARIANTS.length !== 34) issues.push('expected 34 variants');
  const ids = new Set();
  const formats = new Set();
  for (const entry of MICROPDF417_VARIANTS) {
    if (ids.has(entry.id)) issues.push(`duplicate variant ${entry.id}`); ids.add(entry.id);
    const format = `${entry.columns}x${entry.rows}`;
    if (formats.has(format)) issues.push(`duplicate format ${format}`); formats.add(format);
    if (entry.totalCodewords !== entry.columns * entry.rows) issues.push(`${format}: total codeword geometry mismatch`);
    if (entry.dataCodewords + entry.eccCodewords !== entry.totalCodewords) issues.push(`${format}: data/ECC capacity mismatch`);
    if (entry.eccCodewords < 7 || entry.eccCodewords > 50) issues.push(`${format}: invalid ECC length`);
    if (entry.rapStart < 1 || entry.rapStart > 52 || entry.rapRotation < 0 || entry.rapRotation > 51) issues.push(`${format}: invalid RAP assignment`);
    for (let row = 0; row < entry.rows; row++) {
      const address = microPdf417RowAddress(entry, row);
      if (address.cluster !== ((address.left - 1) % 3) * 3) issues.push(`${format}: cluster mismatch at row ${row}`);
      if ((entry.columns < 3) !== (address.center === null)) issues.push(`${format}: center RAP layout mismatch`);
    }
  }
  for (const [kind, runs] of [['side', SIDE_RAP_RUNS], ['center', CENTER_RAP_RUNS]]) {
    if (runs.length !== 52) issues.push(`${kind}: expected 52 RAPs`);
    if (new Set(runs).size !== runs.length) issues.push(`${kind}: duplicate RAP`);
    for (let i = 0; i < runs.length; i++) {
      if (!validRuns(runs[i])) issues.push(`${kind}: invalid RAP ${i + 1}`);
      if (runs.length && !oneEdgeShift(runs[i], runs[(i + 1) % runs.length])) issues.push(`${kind}: RAP ${i + 1} is not adjacent to its successor`);
    }
  }
  return issues;
}
