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
 * GS1 DataBar Limited writer, clean-raster reader and detector.
 *
 * The implementation is deliberately limited to the standalone GTIN element
 * string (01). Composite linkage is represented by the standard linkage flag,
 * but the companion 2D component is outside this module.
 *
 * @module databar/limited
 */

import { BitMatrix } from '../core/bit-matrix.js';
import { ChecksumError, EncodeError, FormatError } from '../core/errors.js';
import { createDetectionCandidate } from '../core/detection-contract.js';
import { decodeDataBarLimitedGTIN, encodeDataBarLimitedGTIN } from './codec.js';
import { dataBarWidths } from './patterns.js';

const SYMBOL_MODULES = 79;
const DATA_CHARACTER_MODULES = 26;
const CHECK_CHARACTER_MODULES = 18;
const DATA_CHARACTER_ELEMENTS = 7;
const CHECK_CHARACTER_ELEMENTS = 6;
const CHECK_CHARACTER_COMBINATIONS = 21;
const MIN_HEIGHT_MODULES = 10;
const MAX_DIMENSION = 32_768;
const MAX_MODULES = 16_777_216;

const GROUPS = Object.freeze([
  Object.freeze({
    first: 0, last: 183_063, gsum: 0,
    oddModules: 17, evenModules: 9,
    oddWidest: 6, evenWidest: 3,
    oddTotal: 6_538, evenTotal: 28,
  }),
  Object.freeze({
    first: 183_064, last: 820_063, gsum: 183_064,
    oddModules: 13, evenModules: 13,
    oddWidest: 5, evenWidest: 4,
    oddTotal: 875, evenTotal: 728,
  }),
  Object.freeze({
    first: 820_064, last: 1_000_775, gsum: 820_064,
    oddModules: 9, evenModules: 17,
    oddWidest: 3, evenWidest: 6,
    oddTotal: 28, evenTotal: 6_454,
  }),
  Object.freeze({
    first: 1_000_776, last: 1_491_020, gsum: 1_000_776,
    oddModules: 15, evenModules: 11,
    oddWidest: 5, evenWidest: 4,
    oddTotal: 2_415, evenTotal: 203,
  }),
  Object.freeze({
    first: 1_491_021, last: 1_979_844, gsum: 1_491_021,
    oddModules: 11, evenModules: 15,
    oddWidest: 4, evenWidest: 5,
    oddTotal: 203, evenTotal: 2_408,
  }),
  Object.freeze({
    first: 1_979_845, last: 1_996_938, gsum: 1_979_845,
    oddModules: 19, evenModules: 7,
    oddWidest: 8, evenWidest: 1,
    oddTotal: 17_094, evenTotal: 1,
  }),
  Object.freeze({
    first: 1_996_939, last: 2_013_570, gsum: 1_996_939,
    oddModules: 7, evenModules: 19,
    oddWidest: 1, evenWidest: 8,
    oddTotal: 1, evenTotal: 16_632,
  }),
]);

const CHECKSUM_WEIGHTS = Object.freeze([
  1, 3, 9, 27, 81, 65, 17, 51, 64, 14, 42, 37, 22, 66,
  20, 60, 2, 6, 18, 54, 73, 41, 34, 13, 39, 28, 84, 74,
]);

/* Annex C sequence values for check values 0 through 88. */
const CHECKSUM_SEQUENCES = Object.freeze([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
  10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
  20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
  30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
  40, 41, 42, 43, 45, 52, 57, 63, 64, 65,
  66, 73, 74, 75, 76, 77, 78, 79, 82, 126,
  127, 128, 129, 130, 132, 141, 142, 143, 144, 145,
  146, 210, 211, 212, 213, 214, 215, 216, 217, 220,
  316, 317, 318, 319, 320, 322, 323, 326, 337,
]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new EncodeError(`GS1 DataBar Limited ${label} must be a positive integer`);
  }
  return value;
}

function checkedGeometry(options) {
  if (options === undefined) options = {};
  if (!isRecord(options)) throw new TypeError('GS1 DataBar Limited options must be an object');
  if (options.linkage !== undefined && typeof options.linkage !== 'boolean') {
    throw new TypeError('GS1 DataBar linkage must be a boolean');
  }
  if (options.moduleScale !== undefined && options.scale !== undefined
    && options.moduleScale !== options.scale) {
    throw new EncodeError('GS1 DataBar Limited moduleScale and scale disagree');
  }
  const scale = positiveInteger(options.moduleScale ?? options.scale ?? 1, 'moduleScale');
  const height = positiveInteger(options.height ?? MIN_HEIGHT_MODULES * scale, 'height');
  if (height < MIN_HEIGHT_MODULES * scale) {
    throw new EncodeError('GS1 DataBar Limited height is below the normative 10-module minimum');
  }
  const width = SYMBOL_MODULES * scale;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_MODULES) {
    throw new EncodeError('GS1 DataBar Limited dimensions exceed the safe matrix limit');
  }
  return Object.freeze({ scale, height, width, linkage: options.linkage === true });
}

function combinations(n, r) {
  if (n < r || r < 0) return 0;
  if (r === 0 || n === r) return 1;
  const k = Math.min(r, n - r);
  let result = 1;
  for (let i = 1; i <= k; i++) result = result * (n - k + i) / i;
  return result;
}

function candidateCount(remaining, bar, width, elements, maximumWidth, noNarrow, narrowMask) {
  let count = combinations(remaining - width - 1, elements - bar - 2);
  if (noNarrow && narrowMask === 0
    && remaining - width - (elements - bar - 1) >= elements - bar - 1) {
    count -= combinations(remaining - width - (elements - bar), elements - bar - 2);
  }
  if (elements - bar - 1 > 1) {
    let tooWide = 0;
    for (let last = remaining - width - (elements - bar - 2); last > maximumWidth; last--) {
      tooWide += combinations(remaining - width - last - 1, elements - bar - 3);
    }
    count -= tooWide * (elements - 1 - bar);
  } else if (remaining - width > maximumWidth) {
    count--;
  }
  return count;
}

function unrankWidths(rank, modules, elements, maximumWidth, noNarrow) {
  return dataBarWidths(rank, modules, elements, maximumWidth, noNarrow);
}

function rankWidths(widths, modules, elements, maximumWidth, noNarrow) {
  if (!Array.isArray(widths) || widths.length !== elements
    || widths.some((width) => !Number.isSafeInteger(width) || width < 1 || width > maximumWidth)
    || widths.reduce((sum, width) => sum + width, 0) !== modules) {
    throw new FormatError('GS1 DataBar Limited subset widths are invalid');
  }

  let rank = 0;
  let remaining = modules;
  let narrowMask = 0;
  for (let bar = 0; bar < elements - 1; bar++) {
    const selected = widths[bar];
    for (let width = 1; width < selected; width++) {
      if (width === 1) narrowMask |= 1 << bar;
      rank += candidateCount(remaining, bar, width, elements, maximumWidth, noNarrow, narrowMask);
      narrowMask &= ~(1 << bar);
    }
    if (selected === 1) narrowMask |= 1 << bar;
    else narrowMask &= ~(1 << bar);
    remaining -= selected;
  }
  if (widths[elements - 1] !== remaining) {
    throw new FormatError('GS1 DataBar Limited subset rank is not canonical');
  }
  const canonical = unrankWidths(rank, modules, elements, maximumWidth, noNarrow);
  if (canonical.some((width, index) => width !== widths[index])) {
    throw new FormatError('GS1 DataBar Limited subset width sequence is not canonical');
  }
  return rank;
}

function groupForValue(value) {
  const group = GROUPS.find((entry) => value >= entry.first && value <= entry.last);
  if (!group) throw new RangeError('GS1 DataBar Limited character value is out of range');
  return group;
}

function dataCharacterWidths(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > GROUPS.at(-1).last) {
    throw new RangeError('GS1 DataBar Limited character value is out of range');
  }
  const group = groupForValue(value);
  const offset = value - group.gsum;
  const oddRank = Math.floor(offset / group.evenTotal);
  const evenRank = offset % group.evenTotal;
  const odd = unrankWidths(oddRank, group.oddModules, DATA_CHARACTER_ELEMENTS, group.oddWidest, false);
  const even = unrankWidths(evenRank, group.evenModules, DATA_CHARACTER_ELEMENTS, group.evenWidest, true);
  const widths = [];
  for (let index = 0; index < DATA_CHARACTER_ELEMENTS; index++) widths.push(odd[index], even[index]);
  if (widths.reduce((sum, width) => sum + width, 0) !== DATA_CHARACTER_MODULES) {
    throw new EncodeError('GS1 DataBar Limited data character width total is invalid');
  }
  return widths;
}

function dataCharacterValue(widths) {
  if (!Array.isArray(widths) || widths.length !== DATA_CHARACTER_ELEMENTS * 2) {
    throw new FormatError('GS1 DataBar Limited data character must contain 14 elements');
  }
  const odd = widths.filter((_, index) => (index & 1) === 0);
  const even = widths.filter((_, index) => (index & 1) === 1);
  const oddModules = odd.reduce((sum, width) => sum + width, 0);
  const group = GROUPS.find((entry) => entry.oddModules === oddModules
    && entry.evenModules === even.reduce((sum, width) => sum + width, 0));
  if (!group) throw new FormatError('GS1 DataBar Limited data character module totals are invalid');
  const oddRank = rankWidths(odd, group.oddModules, DATA_CHARACTER_ELEMENTS, group.oddWidest, false);
  const evenRank = rankWidths(even, group.evenModules, DATA_CHARACTER_ELEMENTS, group.evenWidest, true);
  const value = group.gsum + oddRank * group.evenTotal + evenRank;
  if (value < group.first || value > group.last) {
    throw new FormatError('GS1 DataBar Limited data character value is out of range');
  }
  return value;
}

function checksumForWidths(left, right) {
  let checksum = 0;
  for (let index = 0; index < DATA_CHARACTER_ELEMENTS * 2; index++) {
    checksum += CHECKSUM_WEIGHTS[index] * left[index];
    checksum += CHECKSUM_WEIGHTS[index + DATA_CHARACTER_ELEMENTS * 2] * right[index];
  }
  return checksum % 89;
}

function checksumWidths(checksum) {
  if (!Number.isInteger(checksum) || checksum < 0 || checksum >= CHECKSUM_SEQUENCES.length) {
    throw new RangeError('GS1 DataBar Limited checksum is out of range');
  }
  const sequence = CHECKSUM_SEQUENCES[checksum];
  const spaces = unrankWidths(Math.floor(sequence / CHECK_CHARACTER_COMBINATIONS), 8,
    CHECK_CHARACTER_ELEMENTS, 3, true);
  const bars = unrankWidths(sequence % CHECK_CHARACTER_COMBINATIONS, 8,
    CHECK_CHARACTER_ELEMENTS, 3, true);
  return Object.freeze([
    ...spaces.flatMap((width, index) => [width, bars[index]]),
    1, 1,
  ]);
}

const CHECKSUM_PATTERNS = Object.freeze(Array.from(
  { length: CHECKSUM_SEQUENCES.length }, (_, checksum) => checksumWidths(checksum),
));
const CHECKSUM_PATTERN_VALUES = new Map(
  CHECKSUM_PATTERNS.map((widths, checksum) => [widths.join(','), checksum]),
);

function paintRuns(widths, height, scale) {
  const matrix = new BitMatrix(SYMBOL_MODULES * scale, height);
  let cursor = 0;
  let dark = false;
  for (const width of widths) {
    if (dark) matrix.setRegion(cursor * scale, 0, width * scale, height);
    cursor += width;
    dark = !dark;
  }
  if (cursor !== SYMBOL_MODULES) throw new EncodeError('GS1 DataBar Limited symbol width is invalid');
  return matrix;
}

/**
 * Encode a checked GTIN as GS1 DataBar Limited.
 *
 * The accepted GTIN forms are the same as the shared DataBar codec: GTIN-8,
 * GTIN-12, GTIN-13 and GTIN-14, normalized to fourteen digits. The indicator
 * digit must be zero or one. The returned matrix is 79 modules wide and at
 * least 10 modules high.
 */
export function encodeDataBarLimited(value, options = {}) {
  const geometry = checkedGeometry(options);
  const compacted = encodeDataBarLimitedGTIN(value, { linkage: geometry.linkage });
  const left = dataCharacterWidths(compacted.left);
  const right = dataCharacterWidths(compacted.right);
  const checksum = checksumForWidths(left, right);
  const widths = [1, 1, ...left, ...checksumWidths(checksum), ...right, 1, 1, 5];
  const matrix = paintRuns(widths, geometry.height, geometry.scale);
  matrix.databar = Object.freeze({
    variant: 'limited',
    gtin: compacted.gtin,
    linkage: compacted.linkage,
    checksum,
    modules: SYMBOL_MODULES,
    moduleScale: geometry.scale,
    height: geometry.height,
  });
  return matrix;
}

function requireMatrix(matrix) {
  if (!matrix || !Number.isInteger(matrix.width) || !Number.isInteger(matrix.height)
    || matrix.width < 1 || matrix.height < 1 || typeof matrix.get !== 'function') {
    throw new TypeError('GS1 DataBar Limited decoder expects a BitMatrix-like value');
  }
}

function sampledRuns(matrix) {
  requireMatrix(matrix);
  if (matrix.width % SYMBOL_MODULES !== 0) {
    throw new FormatError('GS1 DataBar Limited matrix width must be a multiple of 79 modules');
  }
  const scale = matrix.width / SYMBOL_MODULES;
  if (!Number.isSafeInteger(scale) || scale < 1 || matrix.height < MIN_HEIGHT_MODULES * scale) {
    throw new FormatError('GS1 DataBar Limited matrix scale or height is invalid');
  }
  const y = Math.floor(matrix.height / 2);
  const bits = [];
  for (let x = 0; x < SYMBOL_MODULES; x++) {
    const value = Boolean(matrix.get(x * scale + Math.floor(scale / 2), y));
    for (let dx = 0; dx < scale; dx++) {
      if (Boolean(matrix.get(x * scale + dx, y)) !== value) {
        throw new FormatError('GS1 DataBar Limited horizontal modules are not integer-scaled');
      }
    }
    bits.push(value);
  }
  // Limited is a single-row linear symbol: a clean raster must repeat the
  // same module pattern through its complete height. Sampling only one row
  // would otherwise accept a partially erased bar above or below that row.
  for (let row = 0; row < matrix.height; row++) {
    for (let x = 0; x < SYMBOL_MODULES; x++) {
      const expected = bits[x];
      for (let dx = 0; dx < scale; dx++) {
        if (Boolean(matrix.get(x * scale + dx, row)) !== expected) {
          throw new FormatError('GS1 DataBar Limited rows are inconsistent');
        }
      }
    }
  }
  const runs = [];
  let dark = bits[0];
  let width = 0;
  for (const bit of bits) {
    if (bit === dark) width++;
    else {
      runs.push({ dark, width });
      dark = bit;
      width = 1;
    }
  }
  runs.push({ dark, width });
  if (runs.length !== 47) {
    throw new FormatError('GS1 DataBar Limited element count is invalid');
  }
  const expected = [1, 1, 1, 1, 5];
  if (runs[0].dark || runs[0].width !== expected[0]
    || !runs[1].dark || runs[1].width !== expected[1]
    || runs[44].dark || runs[44].width !== expected[2]
    || !runs[45].dark || runs[45].width !== expected[3]
    || runs[46].dark || runs[46].width !== expected[4]) {
    throw new FormatError('GS1 DataBar Limited guard pattern is invalid');
  }
  return { runs, scale };
}

/** Decode a clean or integer-scaled GS1 DataBar Limited matrix. */
export function decodeDataBarLimited(matrix) {
  const { runs, scale } = sampledRuns(matrix);
  const leftWidths = runs.slice(2, 16).map(({ width }) => width);
  const checkWidths = runs.slice(16, 30).map(({ width }) => width);
  const rightWidths = runs.slice(30, 44).map(({ width }) => width);
  const checksum = CHECKSUM_PATTERN_VALUES.get(checkWidths.join(','));
  if (checksum === undefined) {
    throw new FormatError('GS1 DataBar Limited check character is invalid');
  }
  const expectedChecksum = checksumForWidths(leftWidths, rightWidths);
  if (checksum !== expectedChecksum) {
    throw new ChecksumError('GS1 DataBar Limited checksum mismatch');
  }
  const left = dataCharacterValue(leftWidths);
  const right = dataCharacterValue(rightWidths);
  const decoded = decodeDataBarLimitedGTIN({ left, right });
  const element = Object.freeze({ ai: '01', value: decoded.gtin, fixed: true });
  return Object.freeze({
    format: 'databar-limited',
    variant: 'limited',
    text: decoded.gtin,
    gtin: decoded.gtin,
    gs1: true,
    linkage: decoded.linkage,
    checksum,
    checksumValid: true,
    moduleScale: scale,
    height: matrix.height,
    symbologyIdentifier: ']e0',
    elements: Object.freeze([element]),
  });
}

function crop(source, box) {
  const output = new BitMatrix(box.width, box.height);
  for (let y = 0; y < box.height; y++) {
    for (let x = 0; x < box.width; x++) {
      if (source.get(box.x + x, box.y + y)) output.set(x, y);
    }
  }
  return output;
}

function rotateClockwise(source) {
  const output = new BitMatrix(source.height, source.width);
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (source.get(x, y)) output.set(source.height - 1 - y, x);
    }
  }
  return output;
}

function cornersFor(box) {
  return [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
  ];
}

function canonicalCorners(points) {
  const byRow = [...points].sort((left, right) => left.y - right.y || left.x - right.x);
  const [topLeft, topRight] = byRow.slice(0, 2).sort((left, right) => left.x - right.x);
  const [bottomLeft, bottomRight] = byRow.slice(2).sort((left, right) => left.x - right.x);
  return [topLeft, topRight, bottomRight, bottomLeft];
}

function mapPoint(point, previous) {
  return { x: point.y, y: previous.height - point.x };
}

function validImage(image) {
  return isRecord(image) && typeof image.get === 'function'
    && Number.isSafeInteger(image.width) && Number.isSafeInteger(image.height)
    && image.width > 0 && image.height > 0
    && image.width <= MAX_DIMENSION && image.height <= MAX_DIMENSION
    && image.width * image.height <= MAX_MODULES;
}

/**
 * Detect and decode a complete, dark-on-light Limited symbol in a binary
 * image. The clean detector accepts integer module scaling and quarter turns;
 * perspective, grayscale thresholding and partial symbols are intentionally
 * rejected so a detector never returns a plausible-looking partial value.
 */
export function detectDataBarLimited(binaryImage, options = {}) {
  if (!validImage(binaryImage) || !isRecord(options)) return null;
  let oriented = binaryImage;
  let toOriginal = (point) => ({ x: point.x, y: point.y });

  for (let rotation = 0; rotation < 4; rotation++) {
    const bounds = oriented.getBounds?.();
    if (bounds && bounds.width > 0 && bounds.height > 0) {
      const scale = bounds.width / 73;
      const x = bounds.x - scale;
      if (Number.isSafeInteger(scale) && scale >= 1 && x >= 0
        && x + SYMBOL_MODULES * scale <= oriented.width
        && bounds.height >= MIN_HEIGHT_MODULES * scale) {
        const candidateBox = { x, y: bounds.y, width: SYMBOL_MODULES * scale, height: bounds.height };
        try {
          const matrix = crop(oriented, candidateBox);
          const result = decodeDataBarLimited(matrix);
          const geometry = createDetectionCandidate({
            corners: canonicalCorners(cornersFor(candidateBox).map((point) => toOriginal(point))),
            moduleSize: scale,
            rotation: rotation * 90,
            matrix,
            confidence: 1,
          }, {
            result,
            quality: {
              quietZone: bounds.x > 0 && bounds.y > 0
                && bounds.x + bounds.width < oriented.width
                && bounds.y + bounds.height < oriented.height,
              checksum: true,
              rows: 1,
              consistency: 1,
            },
            score: 1,
          });
          return Object.freeze({ ...result, ...geometry });
        } catch {
          // The complete dark bounds may belong to another linear symbol.
        }
      }
    }

    const previous = oriented;
    const previousToOriginal = toOriginal;
    oriented = rotateClockwise(previous);
    toOriginal = (point) => previousToOriginal(mapPoint(point, previous));
  }
  return null;
}

/** Detect-and-decode alias matching the other DataBar modules. */
export const detectAndDecodeDataBarLimited = detectDataBarLimited;

/**
 * Decode a complete, unscaled binary scanline. This helper is intentionally
 * strict: callers that have only one sampled row must provide a full 79-module
 * symbol and the reader expands it to the normative minimum height.
 */
export function decodeDataBarLimitedScanline(row) {
  if (!row || (typeof row.length !== 'number') || row.length !== SYMBOL_MODULES) return null;
  const matrix = new BitMatrix(SYMBOL_MODULES, MIN_HEIGHT_MODULES);
  for (let x = 0; x < SYMBOL_MODULES; x++) {
    if (row[x]) matrix.setRegion(x, 0, 1, MIN_HEIGHT_MODULES);
  }
  try {
    return decodeDataBarLimited(matrix);
  } catch {
    return null;
  }
}
