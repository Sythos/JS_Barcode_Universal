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
 * Linear barcode reading.
 *
 * A linear symbol carries no vertical information, so reading one is a 1D
 * signal problem: take a horizontal slice, measure the run lengths of dark and
 * light, and match those against the symbology's patterns.
 *
 * Two consequences shape everything here:
 *
 *  - **Scan many rows, not one.** Any single row can be crossed by a fold, a
 *    glare highlight or a printing void. Rows are sampled across the height and
 *    the first that decodes cleanly wins.
 *  - **Match ratios, not absolute widths.** The scale is unknown and varies
 *    across the image under perspective, so patterns are compared after
 *    normalising by total width. This is what makes a symbol readable at any
 *    size without being told the module width.
 *
 * @module oned/reader
 */

import { NotFoundError } from '../core/errors.js';
import {
  EAN_L, EAN_G, EAN_R, EAN13_PARITY, UPCE_PARITY,
  CODE39, CODE39_CHECK_SET,
  CODE93, CODE93_VALUES,
  CODE128, CODE128_START_A, CODE128_START_B, CODE128_START_C,
  CODE128_STOP, CODE128_FNC1, CODE128_CODE_A, CODE128_CODE_B, CODE128_CODE_C,
  CODE128_SHIFT,
  ITF, CODABAR, CODABAR_START_STOP,
} from './patterns.js';
import { ean13CheckDigit, upceToUpcaBody } from './writers.js';

/* ------------------------------------------------------------------ *
 * Pattern matching primitives
 * ------------------------------------------------------------------ */

/**
 * Compare measured run lengths against an ideal pattern, scale-independently.
 *
 * Returns a normalised mismatch score, or Infinity when any single element is
 * further out of proportion than `maxIndividual` allows. Rejecting on the
 * worst element as well as the total is what stops a run of noise whose widths
 * happen to average out from being accepted as a character.
 *
 * @param {number[]} counters Measured widths, in pixels.
 * @param {number[]} pattern Ideal widths, in modules.
 * @param {number} maxIndividual Tolerance per element, as a fraction of a module.
 * @returns {number}
 */
export function patternVariance(counters, pattern, maxIndividual) {
  const n = counters.length;
  if (n !== pattern.length) return Infinity;

  let total = 0;
  let patternTotal = 0;
  for (let i = 0; i < n; i++) {
    total += counters[i];
    patternTotal += pattern[i];
  }
  if (total < patternTotal) return Infinity; // fewer pixels than modules

  const unit = total / patternTotal;
  const maxVariance = unit * maxIndividual;

  let variance = 0;
  for (let i = 0; i < n; i++) {
    const expected = pattern[i] * unit;
    const delta = Math.abs(counters[i] - expected);
    if (delta > maxVariance) return Infinity;
    variance += delta;
  }
  return variance / total;
}

/**
 * Measure alternating run lengths starting at `start`.
 *
 * @param {Uint8Array} row One byte per pixel, 1 = dark.
 * @param {number} start
 * @param {number[]} counters Filled in place; its length sets how many runs to read.
 * @returns {boolean} False if the row ended before the runs were filled.
 */
export function recordPattern(row, start, counters) {
  counters.fill(0);
  const end = row.length;
  if (start >= end) return false;

  let isDark = row[start] === 1;
  let index = 0;
  let i = start;

  while (i < end) {
    if ((row[i] === 1) === isDark) {
      counters[index]++;
    } else {
      index++;
      if (index === counters.length) break;
      counters[index] = 1;
      isDark = !isDark;
    }
    i++;
  }

  // The final run may legitimately reach the edge of the image.
  return index === counters.length || (index === counters.length - 1 && i === end);
}

/**
 * Classify run lengths into narrow and wide, for the n/w symbologies.
 *
 * The wide:narrow ratio is not fixed by these formats — it is anywhere from
 * 2:1 to 3:1 and varies with the printer — so the split has to be discovered
 * from the data. Candidate thresholds are tried from the smallest counter
 * upward until exactly the expected number of wide elements falls out.
 *
 * @param {number[]} counters
 * @param {number} expectedWide How many elements must be wide.
 * @returns {number} Bit pattern, MSB = first element wide; -1 if undecidable.
 */
export function toNarrowWidePattern(counters, expectedWide) {
  const n = counters.length;
  let maxNarrow = 0;

  for (;;) {
    let nextNarrow = Infinity;
    for (let i = 0; i < n; i++) {
      if (counters[i] > maxNarrow && counters[i] < nextNarrow) nextNarrow = counters[i];
    }
    if (nextNarrow === Infinity) return -1;
    maxNarrow = nextNarrow;

    let wideCount = 0;
    let pattern = 0;
    let wideTotal = 0;
    let narrowTotal = 0;
    for (let i = 0; i < n; i++) {
      if (counters[i] > maxNarrow) {
        pattern |= 1 << (n - 1 - i);
        wideCount++;
        wideTotal += counters[i];
      } else {
        narrowTotal += counters[i];
      }
    }

    if (wideCount === expectedWide) {
      // Sanity: a wide element should be clearly wider than a narrow one.
      const narrowCount = n - wideCount;
      if (narrowCount === 0) return -1;
      const avgWide = wideTotal / wideCount;
      const avgNarrow = narrowTotal / narrowCount;
      if (avgWide < avgNarrow * 1.4) return -1;
      return pattern;
    }
    if (wideCount < expectedWide) return -1;
  }
}

/** Convert an 'n'/'w' pattern string to the same bit encoding. */
function nwToBits(pattern) {
  let bits = 0;
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === 'w') bits |= 1 << (pattern.length - 1 - i);
  }
  return bits;
}

/** Convert a digit-width pattern string to a numeric array. */
function widthsToArray(pattern) {
  return [...pattern].map(Number);
}

/** Convert a module string ('0'/'1') to run lengths. */
function modulesToRuns(modules) {
  const runs = [];
  let current = modules[0];
  let count = 0;
  for (const ch of modules) {
    if (ch === current) count++;
    else { runs.push(count); current = ch; count = 1; }
  }
  runs.push(count);
  return runs;
}

/* ------------------------------------------------------------------ *
 * Precomputed lookup structures
 * ------------------------------------------------------------------ */

const EAN_L_RUNS = EAN_L.map(modulesToRuns);
const EAN_G_RUNS = EAN_G.map(modulesToRuns);
const EAN_R_RUNS = EAN_R.map(modulesToRuns);
const CODE128_RUNS = CODE128.map(widthsToArray);
const CODE93_RUNS = Object.fromEntries(
  Object.entries(CODE93).map(([k, v]) => [k, widthsToArray(v)])
);
const CODE39_BITS = Object.fromEntries(
  Object.entries(CODE39).map(([k, v]) => [nwToBits(v), k])
);
const CODABAR_BITS = Object.fromEntries(
  Object.entries(CODABAR).map(([k, v]) => [nwToBits(v), k])
);
const ITF_BITS = Object.fromEntries(ITF.map((v, i) => [nwToBits(v), i]));

/**
 * Shortest ITF payload treated as a real read.
 *
 * ITF is always an even number of digits and real-world payloads are at least
 * six (ITF-6, ITF-14 and the GS1 variants). Accepting two digits meant any
 * pair of matching runs inside an unrelated symbol read as a valid ITF.
 */
const MIN_ITF_DIGITS = 6;

const START_END_PATTERN = [1, 1, 1];
const MIDDLE_PATTERN = [1, 1, 1, 1, 1];
const UPCE_END_PATTERN = [1, 1, 1, 1, 1, 1];

/* ------------------------------------------------------------------ *
 * EAN / UPC
 * ------------------------------------------------------------------ */

/**
 * Decode one EAN/UPC digit, reporting which parity set matched.
 *
 * @param {Uint8Array} row
 * @param {number} start
 * @param {boolean} rightHand True to match only the R set.
 * @returns {{digit: number, even: boolean, end: number} | null}
 */
function decodeEANDigit(row, start, rightHand) {
  const counters = [0, 0, 0, 0];
  if (!recordPattern(row, start, counters)) return null;
  const width = counters[0] + counters[1] + counters[2] + counters[3];

  let best = null;
  let bestVariance = 0.48; // reject anything worse than this

  const consider = (runs, digit, even) => {
    const v = patternVariance(counters, runs, 0.7);
    if (v < bestVariance) {
      bestVariance = v;
      best = { digit, even, end: start + width };
    }
  };

  for (let d = 0; d < 10; d++) {
    if (rightHand) {
      consider(EAN_R_RUNS[d], d, false);
    } else {
      consider(EAN_L_RUNS[d], d, false);
      consider(EAN_G_RUNS[d], d, true);
    }
  }
  return best;
}

/**
 * @param {Uint8Array} row
 * @returns {{format: string, text: string} | null}
 */
function decodeEANFamily(row) {
  const guard = findGuard(row, 0, START_END_PATTERN, false);
  if (!guard) return null;

  let offset = guard.end;
  const digits = [];
  let parityBits = 0;

  // Six left-hand digits, recording parity as we go.
  for (let i = 0; i < 6; i++) {
    const d = decodeEANDigit(row, offset, false);
    if (!d) return null;
    digits.push(d.digit);
    if (d.even) parityBits |= 1 << (5 - i);
    offset = d.end;
  }

  // EAN-8 has no even-parity digits and a middle guard at a different offset;
  // try the 13-digit reading first, then fall back.
  const middle = matchAt(row, offset, MIDDLE_PATTERN);
  if (middle) {
    offset = middle.end;
    for (let i = 0; i < 6; i++) {
      const d = decodeEANDigit(row, offset, true);
      if (!d) return null;
      digits.push(d.digit);
      offset = d.end;
    }
    if (!matchAt(row, offset, START_END_PATTERN)) return null;

    const parityStr = [];
    for (let i = 0; i < 6; i++) parityStr.push((parityBits >> (5 - i)) & 1 ? 'G' : 'L');
    const first = EAN13_PARITY.indexOf(parityStr.join(''));
    if (first < 0) return null;

    const text = String(first) + digits.join('');
    if (Number(text[12]) !== ean13CheckDigit(text.slice(0, 12))) return null;

    // A leading zero means this was printed as UPC-A.
    return first === 0
      ? { format: 'upca', text: text.slice(1) }
      : { format: 'ean13', text };
  }

  return null;
}

/**
 * EAN-8: four left digits, middle guard, four right digits.
 *
 * @param {Uint8Array} row
 * @returns {{format: string, text: string} | null}
 */
function decodeEAN8(row) {
  const guard = findGuard(row, 0, START_END_PATTERN, false);
  if (!guard) return null;

  let offset = guard.end;
  const digits = [];
  for (let i = 0; i < 4; i++) {
    const d = decodeEANDigit(row, offset, false);
    if (!d || d.even) return null; // EAN-8 left digits are all odd parity
    digits.push(d.digit);
    offset = d.end;
  }

  const middle = matchAt(row, offset, MIDDLE_PATTERN);
  if (!middle) return null;
  offset = middle.end;

  for (let i = 0; i < 4; i++) {
    const d = decodeEANDigit(row, offset, true);
    if (!d) return null;
    digits.push(d.digit);
    offset = d.end;
  }
  if (!matchAt(row, offset, START_END_PATTERN)) return null;

  const text = digits.join('');
  if (Number(text[7]) !== ean13CheckDigit(text.slice(0, 7))) return null;
  return { format: 'ean8', text };
}

/**
 * UPC-E: six digits, parity-encoded, terminated by a six-element guard.
 *
 * @param {Uint8Array} row
 * @returns {{format: string, text: string} | null}
 */
function decodeUPCE(row) {
  const guard = findGuard(row, 0, START_END_PATTERN, false);
  if (!guard) return null;

  let offset = guard.end;
  const digits = [];
  let parityBits = 0;
  for (let i = 0; i < 6; i++) {
    const d = decodeEANDigit(row, offset, false);
    if (!d) return null;
    digits.push(d.digit);
    if (d.even) parityBits |= 1 << (5 - i);
    offset = d.end;
  }

  // Six digits and then the end guard, in that order and nothing between. The
  // EAN readers above match their trailing guard; this one used to stop at the
  // last digit, which let it report a symbol it had never seen the end of.
  if (!matchAt(row, offset, UPCE_END_PATTERN)) return null;

  const parityStr = [];
  for (let i = 0; i < 6; i++) parityStr.push((parityBits >> (5 - i)) & 1 ? 'E' : 'O');
  const check = UPCE_PARITY.indexOf(parityStr.join(''));
  if (check < 0) return null;

  // The parity pattern carries the check digit and nothing else, so on its own
  // it says nothing about the six digits it was read alongside: any run whose
  // parities happen to spell one of the ten patterns would be accepted. What
  // ties the two together is the check digit itself — expand the body to the
  // UPC-A it stands for and confirm the digits produce the check digit the
  // parity claimed. Six digits scraped out of a neighbouring symbol pass the
  // parity test one time in ten and this one almost never.
  const body = digits.join('');
  if (ean13CheckDigit(upceToUpcaBody(0, body)) !== check) return null;

  return { format: 'upce', text: '0' + body + String(check) };
}

/* ------------------------------------------------------------------ *
 * Guard finding
 * ------------------------------------------------------------------ */

/**
 * Scan forward for the first place a pattern matches, starting on a dark run.
 *
 * @param {Uint8Array} row
 * @param {number} from
 * @param {number[]} pattern
 * @param {boolean} startsLight
 * @returns {{start: number, end: number} | null}
 */
function findGuard(row, from, pattern, startsLight) {
  const counters = new Array(pattern.length).fill(0);
  const width = row.length;
  let index = 0;
  let isDark = !startsLight;
  let i = from;

  // Skip any leading run of the wrong colour.
  while (i < width && (row[i] === 1) !== isDark) i++;

  let patternStart = i;
  counters.fill(0);

  while (i < width) {
    if ((row[i] === 1) === isDark) {
      counters[index]++;
    } else {
      if (index === pattern.length - 1) {
        if (patternVariance(counters, pattern, 0.7) < 0.5) {
          return { start: patternStart, end: i };
        }
        // Slide the window forward by two runs and keep looking.
        patternStart += counters[0] + counters[1];
        for (let k = 2; k < pattern.length; k++) counters[k - 2] = counters[k];
        counters[pattern.length - 2] = 0;
        counters[pattern.length - 1] = 0;
        index--;
      } else {
        index++;
      }
      counters[index] = 1;
      isDark = !isDark;
    }
    i++;
  }
  return null;
}

/**
 * Match a pattern at an exact position.
 *
 * @param {Uint8Array} row
 * @param {number} start
 * @param {number[]} pattern
 * @returns {{end: number} | null}
 */
function matchAt(row, start, pattern) {
  const counters = new Array(pattern.length).fill(0);
  if (!recordPattern(row, start, counters)) return null;
  if (patternVariance(counters, pattern, 0.7) >= 0.5) return null;
  let width = 0;
  for (const c of counters) width += c;
  return { end: start + width };
}

/* ------------------------------------------------------------------ *
 * Code 128
 * ------------------------------------------------------------------ */

/**
 * @param {Uint8Array} row
 * @returns {{format: string, text: string} | null}
 */
function decodeCode128(row) {
  // Locate whichever start symbol appears first.
  let start = null;
  for (const startCode of [CODE128_START_A, CODE128_START_B, CODE128_START_C]) {
    const found = findGuard(row, 0, CODE128_RUNS[startCode], false);
    if (found && (!start || found.start < start.found.start)) {
      start = { code: startCode, found };
    }
  }
  if (!start) return null;

  // Read every symbol up to the stop pattern first, and only then interpret
  // them. The symbol immediately before the stop is the checksum, and it is
  // indistinguishable from data while scanning — interpreting as we go would
  // append it to the text (a Code C checksum of 70 arrives as the digits
  // "70"). Collecting first makes dropping it exact rather than a guess.
  const values = [];
  let offset = start.found.end;
  const counters = new Array(6).fill(0);
  const stopCounters = new Array(7).fill(0);

  for (;;) {
    // The stop pattern has seven elements, so it must be tried before the
    // six-element symbol set or its first six would match something.
    if (recordPattern(row, offset, stopCounters) &&
        patternVariance(stopCounters, CODE128_RUNS[CODE128_STOP], 0.7) < 0.38) {
      break;
    }

    if (!recordPattern(row, offset, counters)) return null;

    let best = -1;
    let bestVariance = 0.4;
    for (let c = 0; c < CODE128_RUNS.length - 1; c++) {
      const v = patternVariance(counters, CODE128_RUNS[c], 0.7);
      if (v < bestVariance) { bestVariance = v; best = c; }
    }
    if (best < 0) return null;

    let width = 0;
    for (const c of counters) width += c;
    offset += width;
    values.push(best);

    if (values.length > 256) return null; // runaway scan
  }

  // Start symbol, data, checksum, stop. Anything shorter is not a symbol.
  if (values.length < 2) return null;

  const checksum = values[values.length - 1];
  const dataValues = values.slice(0, -1);

  // Verify the checksum rather than trusting the scan. Without this a run of
  // noise that happens to match valid patterns decodes to plausible garbage,
  // which is far worse than reporting nothing.
  let sum = start.code;
  for (let i = 0; i < dataValues.length; i++) sum += dataValues[i] * (i + 1);
  if (sum % 103 !== checksum) return null;

  let mode = start.code === CODE128_START_A ? 'A'
    : start.code === CODE128_START_B ? 'B' : 'C';
  let shifted = null;
  let text = '';

  for (const value of dataValues) {
    const active = shifted || mode;
    shifted = null;

    if (value === CODE128_CODE_A && mode !== 'A') { mode = 'A'; continue; }
    if (value === CODE128_CODE_B && mode !== 'B') { mode = 'B'; continue; }
    if (value === CODE128_CODE_C) { mode = 'C'; continue; }
    if (value === CODE128_SHIFT) { shifted = mode === 'A' ? 'B' : 'A'; continue; }
    if (value === CODE128_FNC1) { continue; }
    if (value >= 96 && value <= 102) { continue; } // other function characters

    if (active === 'C') {
      text += String(value).padStart(2, '0');
    } else if (active === 'A') {
      text += value < 64 ? String.fromCharCode(value + 32) : String.fromCharCode(value - 64);
    } else {
      text += String.fromCharCode(value + 32);
    }
  }

  if (text.length === 0) return null;
  return { format: 'code128', text };
}

/* ------------------------------------------------------------------ *
 * Code 39
 * ------------------------------------------------------------------ */

/**
 * @param {Uint8Array} row
 * @param {object} options
 * @returns {{format: string, text: string} | null}
 */
function decodeCode39(row, options = {}) {
  const counters = new Array(9).fill(0);
  let offset = 0;

  // Find the '*' start character.
  const startBits = nwToBits(CODE39['*']);
  let found = false;
  while (offset < row.length) {
    while (offset < row.length && row[offset] !== 1) offset++;
    if (offset >= row.length) break;
    if (recordPattern(row, offset, counters)) {
      if (toNarrowWidePattern(counters, 3) === startBits) { found = true; break; }
    }
    // Advance past this dark run and the following light run.
    while (offset < row.length && row[offset] === 1) offset++;
    while (offset < row.length && row[offset] === 0) offset++;
  }
  if (!found) return null;

  let width = 0;
  for (const c of counters) width += c;
  offset += width;

  let text = '';
  for (;;) {
    // Skip the inter-character gap.
    while (offset < row.length && row[offset] === 0) offset++;
    if (offset >= row.length) return null;
    if (!recordPattern(row, offset, counters)) return null;

    const bits = toNarrowWidePattern(counters, 3);
    const ch = CODE39_BITS[bits];
    if (ch === undefined) return null;

    let w = 0;
    for (const c of counters) w += c;
    offset += w;

    if (ch === '*') break;
    text += ch;
    if (text.length > 80) return null;
  }

  if (text.length === 0) return null;

  if (options.checkDigit) {
    const expected = text[text.length - 1];
    const body = text.slice(0, -1);
    let sum = 0;
    for (const ch of body) sum += CODE39_CHECK_SET.indexOf(ch);
    if (CODE39_CHECK_SET[sum % 43] !== expected) return null;
    text = body;
  }

  return { format: 'code39', text };
}

/* ------------------------------------------------------------------ *
 * Code 93
 * ------------------------------------------------------------------ */

/**
 * @param {Uint8Array} row
 * @returns {{format: string, text: string} | null}
 */
function decodeCode93(row) {
  const startRuns = widthsToArray('111141');
  const start = findGuard(row, 0, startRuns, false);
  if (!start) return null;

  let offset = start.end;
  const counters = new Array(6).fill(0);
  const values = [];

  for (;;) {
    if (!recordPattern(row, offset, counters)) return null;

    let best = -1;
    let bestVariance = 0.38;
    for (let v = 0; v < CODE93_VALUES.length; v++) {
      const runs = CODE93_RUNS[CODE93_VALUES[v]];
      const variance = patternVariance(counters, runs, 0.7);
      if (variance < bestVariance) { bestVariance = variance; best = v; }
    }

    const stopVariance = patternVariance(counters, startRuns, 0.7);
    if (stopVariance < bestVariance) break;
    if (best < 0) return null;

    values.push(best);
    let w = 0;
    for (const c of counters) w += c;
    offset += w;
    if (values.length > 90) return null;
  }

  if (values.length < 3) return null;

  // Verify both check characters before trusting anything.
  const weighted = (data, maxWeight) => {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const weight = ((data.length - 1 - i) % maxWeight) + 1;
      sum += weight * data[i];
    }
    return sum % 47;
  };
  const k = values.pop();
  const c = values.pop();
  if (weighted(values, 20) !== c) return null;
  if (weighted([...values, c], 15) !== k) return null;

  let text = '';
  for (const v of values) {
    const key = CODE93_VALUES[v];
    if (key.length > 1) return null; // shift characters not expanded here
    text += key;
  }
  return { format: 'code93', text };
}

/* ------------------------------------------------------------------ *
 * ITF
 * ------------------------------------------------------------------ */

/**
 * @param {Uint8Array} row
 * @returns {{format: string, text: string} | null}
 */
function decodeITF(row) {
  const start = findGuard(row, 0, [1, 1, 1, 1], false);
  if (!start) return null;

  let offset = start.end;
  const digits = [];
  const barCounters = new Array(5).fill(0);
  const spaceCounters = new Array(5).fill(0);
  const pair = new Array(10).fill(0);

  for (;;) {
    if (!recordPattern(row, offset, pair)) break;

    // De-interleave: even indices are bars, odd are spaces.
    for (let k = 0; k < 5; k++) {
      barCounters[k] = pair[k * 2];
      spaceCounters[k] = pair[k * 2 + 1];
    }

    const barBits = toNarrowWidePattern(barCounters, 2);
    const spaceBits = toNarrowWidePattern(spaceCounters, 2);
    const a = ITF_BITS[barBits];
    const b = ITF_BITS[spaceBits];
    if (a === undefined || b === undefined) break;

    digits.push(a, b);
    let w = 0;
    for (const c of pair) w += c;
    offset += w;
    if (digits.length > 40) break;
  }

  // ITF carries no mandatory checksum, so structure is the only defence
  // against a false positive — and without these two checks there is none.
  //
  // The loop above stops as soon as a pair fails to match, which happens both
  // at the genuine end of a symbol and in the middle of unrelated bars. Two
  // digits scraped out of a Code 39 or UPC-A symbol matched the digit patterns
  // often enough to be reported as a real ITF read, so `decode()` returned a
  // phantom result alongside the true one.
  if (digits.length < MIN_ITF_DIGITS) return null;

  // Require the run to end on the actual stop pattern: wide bar, narrow space,
  // narrow bar. A fragment that merely ran out of matching pairs has no stop
  // pattern after it and is rejected here.
  const stop = new Array(3).fill(0);
  if (!recordPattern(row, offset, stop)) return null;
  if (toNarrowWidePattern(stop, 1) !== 0b100) return null;

  return { format: 'itf', text: digits.join('') };
}

/* ------------------------------------------------------------------ *
 * Codabar
 * ------------------------------------------------------------------ */

/**
 * @param {Uint8Array} row
 * @returns {{format: string, text: string} | null}
 */
function decodeCodabar(row) {
  const counters = new Array(7).fill(0);
  let offset = 0;
  let startChar = null;

  while (offset < row.length) {
    while (offset < row.length && row[offset] !== 1) offset++;
    if (offset >= row.length) break;
    if (recordPattern(row, offset, counters)) {
      const bits = toNarrowWidePattern(counters, 3) >= 0
        ? toNarrowWidePattern(counters, 3)
        : toNarrowWidePattern(counters, 2);
      const ch = CODABAR_BITS[bits];
      if (ch && CODABAR_START_STOP.includes(ch)) { startChar = ch; break; }
    }
    while (offset < row.length && row[offset] === 1) offset++;
    while (offset < row.length && row[offset] === 0) offset++;
  }
  if (!startChar) return null;

  let w = 0;
  for (const c of counters) w += c;
  offset += w;

  let text = '';
  for (;;) {
    while (offset < row.length && row[offset] === 0) offset++;
    if (offset >= row.length) return null;
    if (!recordPattern(row, offset, counters)) return null;

    let bits = toNarrowWidePattern(counters, 3);
    let ch = CODABAR_BITS[bits];
    if (ch === undefined) {
      bits = toNarrowWidePattern(counters, 2);
      ch = CODABAR_BITS[bits];
    }
    if (ch === undefined) return null;

    let width = 0;
    for (const c of counters) width += c;
    offset += width;

    if (CODABAR_START_STOP.includes(ch)) break;
    text += ch;
    if (text.length > 60) return null;
  }

  if (text.length === 0) return null;
  return { format: 'codabar', text };
}

/* ------------------------------------------------------------------ *
 * Public entry point
 * ------------------------------------------------------------------ */

/** Decoders in the order they are tried. */
const DECODERS = [
  ['ean13', decodeEANFamily],
  ['upca', decodeEANFamily],
  ['ean8', decodeEAN8],
  ['upce', decodeUPCE],
  ['code128', decodeCode128],
  ['code39', decodeCode39],
  ['code93', decodeCode93],
  ['itf', decodeITF],
  ['codabar', decodeCodabar],
];

/**
 * Read every linear symbol found in a binarized image.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} image Binarized; set bit = dark.
 * @param {object} [options]
 * @param {string[]} [options.formats] Restrict to these format ids.
 * @param {number} [options.rows] How many horizontal slices to try.
 * @param {boolean} [options.tryHarder] Also scan reversed rows, for mirrored symbols.
 * @returns {Array<{format: string, text: string, row: number}>}
 */
export function decodeOneD(image, options = {}) {
  const { formats = null, rows = 15, tryHarder = true } = options;
  const enabled = formats ? new Set(formats) : null;
  const active = DECODERS.filter(([id]) => !enabled || enabled.has(id));
  if (active.length === 0) return [];

  const results = [];
  const seen = new Set();
  const height = image.height;
  const buffer = new Uint8Array(image.width);

  // Sample rows from the middle outward: symbols are usually centred, and the
  // middle of a linear barcode is the part least likely to be clipped.
  const middle = height >> 1;
  const step = Math.max(1, Math.round(height / rows));

  for (let attempt = 0; attempt < rows; attempt++) {
    const delta = Math.ceil(attempt / 2) * step * (attempt % 2 === 0 ? 1 : -1);
    const y = middle + delta;
    if (y < 0 || y >= height) continue;

    const row = image.getRow(y, buffer);

    for (const pass of tryHarder ? [false, true] : [false]) {
      const scan = pass ? Uint8Array.from(row).reverse() : row;

      for (const [id, decoder] of active) {
        let result = null;
        try {
          result = decoder(scan, options);
        } catch {
          result = null; // a malformed candidate is not an error
        }
        if (!result) continue;
        if (enabled && !enabled.has(result.format)) continue;

        const key = `${result.format}:${result.text}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({ ...result, row: y });
        void id;
      }
    }
  }

  return results;
}

/**
 * Convenience wrapper that throws when nothing is found.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} image
 * @param {object} [options]
 * @returns {{format: string, text: string, row: number}}
 */
export function decodeOneDStrict(image, options) {
  const results = decodeOneD(image, options);
  if (results.length === 0) throw new NotFoundError('No linear barcode found');
  return results[0];
}
