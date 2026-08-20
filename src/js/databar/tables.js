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
 * SPDX-License-Identifier: MIT
 *
 * Original work. No code from any other barcode implementation.
 */

/**
 * Static GS1 DataBar facts used by the GTIN compaction codec.
 *
 * The numbers in the DataBar-14 group tables are the public tables in
 * ISO/IEC 24724:2011, clauses 5.2.2 and 5.2.3. They describe values, not a
 * third-party implementation. Pattern construction deliberately belongs in
 * the renderer/encoder layer so this module stays a small, auditable contract.
 *
 * @module databar/tables
 */

const group = (first, last, gsum, oddModules, evenModules, oddWidest, evenWidest, oddTotal, evenTotal) => Object.freeze({
  first, last, gsum, oddModules, evenModules, oddWidest, evenWidest, oddTotal, evenTotal,
});

/** The four GTIN-only layouts sharing the DataBar-14 compaction rules. */
export const DATABAR14_VARIANTS = Object.freeze({
  omnidirectional: Object.freeze({ id: 'omnidirectional', rows: 1, modules: 96, checksumModulus: 79, pointOfSale: true }),
  truncated: Object.freeze({ id: 'truncated', rows: 1, modules: 96, checksumModulus: 79, pointOfSale: false }),
  stacked: Object.freeze({ id: 'stacked', rows: 2, modules: 50, checksumModulus: 79, pointOfSale: false }),
  'stacked-omnidirectional': Object.freeze({ id: 'stacked-omnidirectional', rows: 2, modules: 50, checksumModulus: 79, pointOfSale: true }),
});

/** GS1 DataBar Limited is a distinct two-character symbology. */
export const DATABAR_LIMITED_VARIANT = Object.freeze({
  id: 'limited', rows: 1, checksumModulus: 89, pointOfSale: false,
  permittedIndicatorDigits: Object.freeze([0, 1]),
});

/** (16,4) outside character groups, ISO/IEC 24724:2011 Table 1. */
export const DATABAR14_OUTSIDE_GROUPS = Object.freeze([
  group(0, 160, 0, 12, 4, 8, 1, 161, 1),
  group(161, 960, 161, 10, 6, 6, 3, 80, 10),
  group(961, 2014, 961, 8, 8, 4, 5, 31, 34),
  group(2015, 2714, 2015, 6, 10, 3, 6, 10, 70),
  group(2715, 2840, 2715, 4, 12, 1, 8, 1, 126),
]);

/** (15,4) inside character groups, ISO/IEC 24724:2011 Table 2. */
export const DATABAR14_INSIDE_GROUPS = Object.freeze([
  group(0, 335, 0, 5, 10, 2, 7, 4, 84),
  group(336, 1035, 336, 7, 8, 4, 5, 20, 35),
  group(1036, 1515, 1036, 9, 6, 6, 3, 48, 10),
  group(1516, 1596, 1516, 11, 4, 8, 1, 81, 1),
]);

/** Number of values carried by an inside (15,4) character. */
export const DATABAR14_INSIDE_RADIX = 1597;
/** Number of values carried by one outside/inside character pair. */
export const DATABAR14_PAIR_RADIX = 4537077;
/** Stand-alone and composite DataBar-14 payload domain, including linkage. */
export const DATABAR14_SYMBOL_LIMIT = 20000000000000n;

/** GS1 DataBar Limited divides its 13 data digits into two character values. */
export const DATABAR_LIMITED_PAIR_RADIX = 2013571;
/** Offset that switches a DataBar Limited value from stand-alone to composite. */
export const DATABAR_LIMITED_LINKAGE_OFFSET = 2015133531096n;
/** DataBar Limited carries GTIN values whose first digit is zero or one. */
export const DATABAR_LIMITED_DATA_LIMIT = 2000000000000n;

/** Locate the value group that an outside or inside character belongs to. */
export function dataBar14GroupFor(value, kind) {
  if (!Number.isInteger(value)) throw new TypeError('GS1 DataBar character value must be an integer');
  const groups = kind === 'outside' ? DATABAR14_OUTSIDE_GROUPS
    : kind === 'inside' ? DATABAR14_INSIDE_GROUPS : null;
  if (!groups) throw new RangeError(`Unknown GS1 DataBar character kind "${kind}"`);
  const found = groups.find((entry) => value >= entry.first && value <= entry.last);
  if (!found) throw new RangeError(`GS1 DataBar ${kind} character value ${value} is out of range`);
  return found;
}
/** Check the independently represented table identities. */
export function validateDataBarTables() {
  const problems = [];
  const validateGroups = (name, groups, expectedLast) => {
    let next = 0;
    for (const entry of groups) {
      if (entry.first !== next) problems.push(`${name}: gap before ${entry.first}`);
      if (entry.last < entry.first) problems.push(`${name}: inverted range ${entry.first}-${entry.last}`);
      if (entry.oddTotal * entry.evenTotal !== entry.last - entry.first + 1) {
        problems.push(`${name}: combination count mismatch at ${entry.first}`);
      }
      next = entry.last + 1;
    }
    if (next - 1 !== expectedLast) problems.push(`${name}: final value is ${next - 1}, expected ${expectedLast}`);
  };
  validateGroups('outside', DATABAR14_OUTSIDE_GROUPS, 2840);
  validateGroups('inside', DATABAR14_INSIDE_GROUPS, 1596);
  if (DATABAR14_PAIR_RADIX !== 2841 * DATABAR14_INSIDE_RADIX) problems.push('pair radix mismatch');
  if (DATABAR14_SYMBOL_LIMIT !== 2n * 10000000000000n) problems.push('symbol limit mismatch');
  if (DATABAR_LIMITED_LINKAGE_OFFSET !== BigInt(DATABAR_LIMITED_PAIR_RADIX) * 1000776n) {
    problems.push('limited linkage offset mismatch');
  }
  return problems;
}
