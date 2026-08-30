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

/** GS1 DataBar Stacked Omnidirectional writer, reader and clean-raster detector. */

import { BitMatrix } from '../core/bit-matrix.js';
import { ChecksumError, EncodeError, FormatError } from '../core/errors.js';
import { createDetectionCandidate } from '../core/detection-contract.js';
import { decodeDataBar14 } from './decoder.js';
import { encodeDataBar14GTIN } from './codec.js';
import {
  DATABAR14_CHECKSUM_WEIGHTS,
  DATABAR14_FINDERS,
  dataBar14CharacterWidths,
} from './patterns.js';

const ROW_MODULES = 50;
const LINEAR_MODULES = 96;
const MIN_ROW_HEIGHT = 33;
const SEPARATOR_MODULES = 3;
const MAX_DIMENSION = 32_768;
const MAX_MODULES = 16_777_216;

// These two public DataBar separator fragments are the only fixed geometry
// beyond the four symbol characters. They are expressed as module values so
// the same code serves the writer and the strict reader.
const FINDER_SEPARATOR = Object.freeze([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0]);
const FINDER_SEPARATOR_TRIGGER = Object.freeze([1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isSafeDimension(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= MAX_DIMENSION;
}

function isDark(value) {
  return Boolean(value);
}

function normalizedOptions(options, errorType) {
  if (options === undefined) return {};
  if (!isRecord(options)) throw new errorType('GS1 DataBar Stacked Omnidirectional options must be an object');
  return options;
}

function resolveRowHeight(options, errorType) {
  const values = [];
  for (const name of ['rowHeight', 'barHeight', 'height']) {
    if (options[name] !== undefined) {
      if (!Number.isSafeInteger(options[name])) {
        throw new errorType(`GS1 DataBar Stacked Omnidirectional ${name} must be a safe integer`);
      }
      values.push({ name, value: options[name] });
    }
  }
  const rowHeight = values.length === 0 ? MIN_ROW_HEIGHT : values[0].value;
  for (const entry of values) {
    if (entry.value !== rowHeight) {
      throw new errorType('GS1 DataBar Stacked Omnidirectional row height options disagree');
    }
  }
  if (rowHeight < MIN_ROW_HEIGHT || 2 * rowHeight + SEPARATOR_MODULES > MAX_DIMENSION) {
    throw new errorType('GS1 DataBar Stacked Omnidirectional row height is outside the safe range');
  }
  return rowHeight;
}

function validateVariant(options) {
  if (options.variant === undefined) return;
  if (options.variant !== 'stacked-omnidirectional'
    && options.variant !== 'stacked-omni'
    && options.variant !== 'stackedomni') {
    throw new EncodeError('GS1 DataBar physical encoder only supports stacked omnidirectional');
  }
}

function validateSeparatorOption(options, errorType) {
  if (options.separatorModules !== undefined
    && options.separatorModules !== SEPARATOR_MODULES) {
    throw new errorType('GS1 DataBar Stacked Omnidirectional requires a three-module separator');
  }
}

function runsToBits(runs, darkFirst) {
  const bits = [];
  let dark = darkFirst;
  for (const width of runs) {
    if (!Number.isSafeInteger(width) || width < 1) {
      throw new EncodeError('GS1 DataBar Stacked Omnidirectional contains an invalid element width');
    }
    for (let i = 0; i < width; i++) bits.push(dark ? 1 : 0);
    dark = !dark;
  }
  return bits;
}

function checksumAndFinders(characters) {
  const widths = characters.map((value, index) => dataBar14CharacterWidths(
    value,
    index === 0 || index === 3 ? 'outside' : 'inside',
  ));
  const offsets = [0, 8, 24, 16];
  let checksum = 0;
  for (let character = 0; character < widths.length; character++) {
    for (let element = 0; element < widths[character].length; element++) {
      checksum += widths[character][element]
        * DATABAR14_CHECKSUM_WEIGHTS[offsets[character] + element];
    }
  }
  checksum %= 79;
  if (checksum >= 8) checksum++;
  if (checksum >= 72) checksum++;
  return {
    checksum,
    left: Math.floor(checksum / 9),
    right: checksum % 9,
    widths,
  };
}

function separatorRows(top, bottom) {
  if (top.length !== ROW_MODULES || bottom.length !== ROW_MODULES) {
    throw new FormatError('GS1 DataBar Stacked Omnidirectional rows must contain 50 modules');
  }

  // The first separator row follows the top row edge and is forced light at
  // both outer four-module pads. The centre transition follows the edge rule
  // defined for the omnidirectional stacked symbol.
  const first = top.map((value) => 1 - value);
  first.fill(0, 0, 4);
  first.fill(0, 46, 50);
  for (let index = 18; index <= 30; index++) {
    if (top[index] === 0) {
      first[index] = top[index - 1] === 1 ? 1 : 1 - first[index - 1];
    } else {
      first[index] = 0;
    }
  }

  // The middle separator row is a fixed alternating clock pattern with four
  // light modules at each end.
  const second = new Array(ROW_MODULES).fill(0);
  for (let index = 4; index < 46; index++) second[index] = (index - 4) % 2;

  const third = bottom.map((value) => 1 - value);
  third.fill(0, 0, 4);
  third.fill(0, 46, 50);
  for (let index = 19; index <= 31; index++) {
    if (bottom[index] === 0) {
      third[index] = bottom[index - 1] === 1 ? 1 : 1 - third[index - 1];
    } else {
      third[index] = 0;
    }
  }
  let isFinderEdge = true;
  for (let index = 0; index < FINDER_SEPARATOR_TRIGGER.length; index++) {
    if (bottom[index + 19] !== FINDER_SEPARATOR_TRIGGER[index]) {
      isFinderEdge = false;
      break;
    }
  }
  if (isFinderEdge) third.splice(19, FINDER_SEPARATOR.length, ...FINDER_SEPARATOR);

  return [first, second, third];
}

function physicalRows(compacted) {
  const [outerLeft, innerLeft, innerRight, outerRight] = compacted.physicalCharacters;
  const check = checksumAndFinders([outerLeft, innerLeft, innerRight, outerRight]);
  const topRuns = [
    1, 1,
    ...check.widths[0],
    ...DATABAR14_FINDERS[check.left],
    ...check.widths[1].slice().reverse(),
    1, 1,
  ];
  const bottomRuns = [
    1, 1,
    ...check.widths[2],
    ...DATABAR14_FINDERS[check.right].slice().reverse(),
    ...check.widths[3].slice().reverse(),
    1, 1,
  ];
  const top = runsToBits(topRuns, false);
  const bottom = runsToBits(bottomRuns, true);
  if (top.length !== ROW_MODULES || bottom.length !== ROW_MODULES) {
    throw new EncodeError('GS1 DataBar Stacked Omnidirectional row width is not 50 modules');
  }
  return Object.freeze({
    top: Object.freeze(top),
    bottom: Object.freeze(bottom),
    separator: Object.freeze(separatorRows(top, bottom).map((row) => Object.freeze(row))),
    checksum: check.checksum,
  });
}

function setRow(matrix, bits, y) {
  for (let x = 0; x < bits.length; x++) if (bits[x]) matrix.set(x, y);
}

function matrixForRows(rows, rowHeight, compacted) {
  const height = 2 * rowHeight + SEPARATOR_MODULES;
  if (!isSafeDimension(ROW_MODULES) || !isSafeDimension(height)
    || ROW_MODULES > MAX_MODULES / height) {
    throw new EncodeError('GS1 DataBar Stacked Omnidirectional matrix exceeds the safe allocation budget');
  }
  const matrix = new BitMatrix(ROW_MODULES, height);
  for (let y = 0; y < rowHeight; y++) setRow(matrix, rows.top, y);
  for (let separator = 0; separator < SEPARATOR_MODULES; separator++) {
    setRow(matrix, rows.separator[separator], rowHeight + separator);
  }
  for (let y = 0; y < rowHeight; y++) setRow(matrix, rows.bottom, rowHeight + SEPARATOR_MODULES + y);
  matrix.databar = Object.freeze({
    variant: 'stacked-omnidirectional',
    gtin: compacted.gtin,
    linkage: compacted.linkage,
    checksum: rows.checksum,
    rowHeight,
    separatorModules: SEPARATOR_MODULES,
  });
  return matrix;
}

/** Encode a checked GTIN as a GS1 DataBar Stacked Omnidirectional matrix. */
export function encodeDataBarStackedOmnidirectional(value, options = {}) {
  const opts = normalizedOptions(options, TypeError);
  validateVariant(opts);
  validateSeparatorOption(opts, EncodeError);
  const rowHeight = resolveRowHeight(opts, EncodeError);
  if (opts.linkage !== undefined && typeof opts.linkage !== 'boolean') {
    throw new EncodeError('GS1 DataBar linkage must be a boolean');
  }
  const compacted = encodeDataBar14GTIN(value, { linkage: opts.linkage });
  return matrixForRows(physicalRows(compacted), rowHeight, compacted);
}

function checkedMatrix(matrix) {
  if (!isRecord(matrix) || typeof matrix.get !== 'function') {
    throw new TypeError('GS1 DataBar Stacked Omnidirectional decoder expects a BitMatrix-like value');
  }
  if (!isSafeDimension(matrix.width) || !isSafeDimension(matrix.height)
    || matrix.width * matrix.height > MAX_MODULES) {
    throw new FormatError('GS1 DataBar Stacked Omnidirectional matrix dimensions are unsafe');
  }
  if (matrix.width % ROW_MODULES !== 0) {
    throw new FormatError('GS1 DataBar Stacked Omnidirectional matrix width must be a multiple of 50 modules');
  }
  const scale = matrix.width / ROW_MODULES;
  const logicalHeight = matrix.height / scale;
  if (!Number.isSafeInteger(logicalHeight)
    || logicalHeight < 2 * MIN_ROW_HEIGHT + SEPARATOR_MODULES
    || (logicalHeight - SEPARATOR_MODULES) % 2 !== 0) {
    throw new FormatError('GS1 DataBar Stacked Omnidirectional matrix height is invalid');
  }
  const rowHeight = (logicalHeight - SEPARATOR_MODULES) / 2;
  if (rowHeight < MIN_ROW_HEIGHT) {
    throw new FormatError('GS1 DataBar Stacked Omnidirectional row height is below the normative minimum');
  }
  return { scale, rowHeight };
}

function readLogicalRow(matrix, y, scale) {
  const row = new Array(ROW_MODULES);
  const firstY = y * scale;
  for (let x = 0; x < ROW_MODULES; x++) {
    const firstX = x * scale;
    const value = isDark(matrix.get(firstX + Math.floor(scale / 2), firstY + Math.floor(scale / 2))) ? 1 : 0;
    row[x] = value;
    for (let dy = 0; dy < scale; dy++) {
      for (let dx = 0; dx < scale; dx++) {
        const sampled = isDark(matrix.get(firstX + dx, firstY + dy)) ? 1 : 0;
        if (sampled !== value) {
          throw new FormatError('GS1 DataBar Stacked Omnidirectional module contains an internal transition');
        }
      }
    }
  }
  return row;
}

function rowsFromMatrix(matrix, rowHeight, scale) {
  try {
    const top = readLogicalRow(matrix, Math.floor(rowHeight / 2), scale);
    for (let y = 0; y < rowHeight; y++) {
      if (!sameBits(top, readLogicalRow(matrix, y, scale))) {
        throw new FormatError('GS1 DataBar Stacked Omnidirectional top row is inconsistent');
      }
    }
    const bottom = readLogicalRow(matrix, rowHeight + SEPARATOR_MODULES + Math.floor(rowHeight / 2), scale);
    for (let y = 0; y < rowHeight; y++) {
      if (!sameBits(bottom, readLogicalRow(matrix, rowHeight + SEPARATOR_MODULES + y, scale))) {
        throw new FormatError('GS1 DataBar Stacked Omnidirectional bottom row is inconsistent');
      }
    }
    const separator = [
      readLogicalRow(matrix, rowHeight, scale),
      readLogicalRow(matrix, rowHeight + 1, scale),
      readLogicalRow(matrix, rowHeight + 2, scale),
    ];
    return { top, bottom, separator };
  } catch (error) {
    throw new FormatError('GS1 DataBar Stacked Omnidirectional matrix could not be sampled');
  }
}

function sameBits(actual, expected) {
  if (actual.length !== expected.length) return false;
  for (let index = 0; index < actual.length; index++) if (actual[index] !== expected[index]) return false;
  return true;
}

function linearMatrix(top, bottom) {
  // The top row carries the first 48 modules of the linear symbol and the
  // bottom row carries the final 48. Each row contributes two guard modules
  // adjacent to the separator; those four modules are not data and are
  // intentionally omitted here.
  const bits = top.slice(0, 48).concat(bottom.slice(2));
  if (bits.length !== LINEAR_MODULES) {
    throw new FormatError('GS1 DataBar Stacked Omnidirectional rows cannot form a 96-module symbol');
  }
  const matrix = new BitMatrix(LINEAR_MODULES, 1);
  for (let x = 0; x < bits.length; x++) if (bits[x]) matrix.set(x, 0);
  return matrix;
}

function decodedResult(decoded, rows, rowHeight) {
  const element = Object.freeze({ ai: '01', value: decoded.gtin, fixed: true });
  return Object.freeze({
    format: 'databar-stacked-omnidirectional',
    variant: 'stacked-omnidirectional',
    text: decoded.gtin,
    gtin: decoded.gtin,
    gs1: true,
    linkage: decoded.linkage,
    symbologyIdentifier: ']e0',
    checksum: rows.checksum,
    checksumValid: true,
    rows: 2,
    rowHeight,
    separatorModules: SEPARATOR_MODULES,
    elements: Object.freeze([element]),
  });
}

/** Decode a clean, upright GS1 DataBar Stacked Omnidirectional matrix. */
export function decodeDataBarStackedOmnidirectional(matrix, options = {}) {
  const opts = normalizedOptions(options, TypeError);
  validateSeparatorOption(opts, FormatError);
  const geometry = checkedMatrix(matrix);
  const requestedHeight = opts.rowHeight ?? opts.barHeight ?? opts.height;
  if (requestedHeight !== undefined && requestedHeight !== geometry.rowHeight) {
    throw new FormatError('GS1 DataBar Stacked Omnidirectional row height does not match the matrix');
  }
  const sampled = rowsFromMatrix(matrix, geometry.rowHeight, geometry.scale);
  let decoded;
  try {
    decoded = decodeDataBar14(linearMatrix(sampled.top, sampled.bottom));
  } catch (error) {
    if (error instanceof ChecksumError || error instanceof FormatError) throw error;
    throw new FormatError('GS1 DataBar Stacked Omnidirectional payload is invalid');
  }

  const expected = physicalRows(encodeDataBar14GTIN(decoded.gtin, { linkage: decoded.linkage }));
  if (!sameBits(sampled.top, expected.top) || !sameBits(sampled.bottom, expected.bottom)) {
    throw new FormatError('GS1 DataBar Stacked Omnidirectional row structure is invalid');
  }
  for (let row = 0; row < SEPARATOR_MODULES; row++) {
    if (!sameBits(sampled.separator[row], expected.separator[row])) {
      throw new FormatError('GS1 DataBar Stacked Omnidirectional separator is invalid');
    }
  }
  return decodedResult(decoded, expected, geometry.rowHeight);
}

function boundsFor(image) {
  if (typeof image.getBounds === 'function') {
    const bounds = image.getBounds();
    if (bounds === null) return null;
    if (isRecord(bounds)
      && Number.isSafeInteger(bounds.x) && Number.isSafeInteger(bounds.y)
      && Number.isSafeInteger(bounds.width) && Number.isSafeInteger(bounds.height)
      && bounds.x >= 0 && bounds.y >= 0 && bounds.width > 0 && bounds.height > 0
      && bounds.x + bounds.width <= image.width && bounds.y + bounds.height <= image.height
      && bounds.width * bounds.height <= MAX_MODULES) {
      return {
        minX: bounds.x,
        minY: bounds.y,
        maxX: bounds.x + bounds.width - 1,
        maxY: bounds.y + bounds.height - 1,
        width: bounds.width,
        height: bounds.height,
      };
    }
  }

  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (!isDark(image.get(x, y))) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function rotateClockwise(source) {
  const out = new BitMatrix(source.height, source.width);
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (isDark(source.get(x, y))) out.set(source.height - 1 - y, x);
    }
  }
  return out;
}

function sampledCandidate(image, bounds, scale) {
  const logicalHeight = bounds.height / scale;
  const rowHeight = (logicalHeight - SEPARATOR_MODULES) / 2;
  if (!Number.isSafeInteger(scale) || scale < 1
    || !Number.isSafeInteger(logicalHeight)
    || logicalHeight < 2 * MIN_ROW_HEIGHT + SEPARATOR_MODULES
    || (logicalHeight - SEPARATOR_MODULES) % 2 !== 0
    || rowHeight < MIN_ROW_HEIGHT) return null;
  const matrix = new BitMatrix(ROW_MODULES, logicalHeight);
  for (let y = 0; y < logicalHeight; y++) {
    const sampleY = bounds.minY + y * scale + Math.floor(scale / 2);
    for (let x = 0; x < ROW_MODULES; x++) {
      const sampleX = bounds.minX + x * scale + Math.floor(scale / 2);
      if (isDark(image.get(sampleX, sampleY))) matrix.set(x, y);
    }
  }
  return { matrix, rowHeight, scale };
}

function cornersFor(bounds) {
  return [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.minX + bounds.width, y: bounds.minY },
    { x: bounds.minX + bounds.width, y: bounds.minY + bounds.height },
    { x: bounds.minX, y: bounds.minY + bounds.height },
  ];
}

/**
 * Detect and decode one clean, integer-scaled Stacked Omnidirectional symbol.
 *
 * The detector intentionally accepts only a complete dark bounding box whose
 * dimensions are a legal 50-module symbol. This keeps ordinary one-row
 * DataBar symbols and arbitrary two-row artwork out of the result.
 */
export function detectDataBarStackedOmnidirectional(binaryImage, options = {}) {
  if (!isRecord(binaryImage) || typeof binaryImage.get !== 'function'
    || !isSafeDimension(binaryImage.width) || !isSafeDimension(binaryImage.height)
    || binaryImage.width * binaryImage.height > MAX_MODULES) return null;
  if (!isRecord(options)) return null;

  let oriented = binaryImage;
  let toOriginal = (point) => ({ x: point.x, y: point.y });
  for (let rotation = 0; rotation < 4; rotation++) {
    try {
      const bounds = boundsFor(oriented);
      if (bounds && bounds.width % ROW_MODULES === 0) {
        const scale = bounds.width / ROW_MODULES;
        const candidate = sampledCandidate(oriented, bounds, scale);
        if (candidate) {
          const decoded = decodeDataBarStackedOmnidirectional(candidate.matrix, options);
          const corners = cornersFor(bounds).map((point) => toOriginal(point));
          const geometry = createDetectionCandidate({
            corners,
            moduleSize: scale,
            rotation: rotation * 90,
            matrix: candidate.matrix,
            confidence: 1,
          }, {
            result: decoded,
            quality: {
              quietZone: bounds.minX > 0 && bounds.minY > 0
                && bounds.maxX < oriented.width - 1 && bounds.maxY < oriented.height - 1,
              checksum: true,
              rows: 2,
              consistency: 1,
            },
            score: 1,
          });
          return Object.freeze({
            ...decoded,
            ...geometry,
          });
        }
      }
    } catch (error) {
      // A geometric candidate is not necessarily a valid symbol. Continue
      // with the next orientation without leaking implementation errors.
    }

    const previous = oriented;
    const previousToOriginal = toOriginal;
    try {
      oriented = rotateClockwise(previous);
    } catch (error) {
      return null;
    }
    toOriginal = (point) => previousToOriginal({ x: point.y, y: previous.height - point.x });
  }
  return null;
}

/** Detect-and-decode alias matching the other matrix-format modules. */
export const detectAndDecodeDataBarStackedOmnidirectional = detectDataBarStackedOmnidirectional;

// Short and DataBar-14 spellings keep direct module consumers compatible with
// the naming used by the existing DataBar-14 helpers without widening package
// facades or changing the public index in this focused milestone.
export const encodeDataBarStackedOmni = encodeDataBarStackedOmnidirectional;
export const decodeDataBarStackedOmni = decodeDataBarStackedOmnidirectional;
export const detectDataBarStackedOmni = detectDataBarStackedOmnidirectional;
export const detectAndDecodeDataBarStackedOmni = detectDataBarStackedOmnidirectional;
export const encodeDataBar14StackedOmnidirectional = encodeDataBarStackedOmnidirectional;
export const decodeDataBar14StackedOmnidirectional = decodeDataBarStackedOmnidirectional;
export const detectDataBar14StackedOmnidirectional = detectDataBarStackedOmnidirectional;
export const encodeDataBar14StackedOmni = encodeDataBarStackedOmnidirectional;
export const decodeDataBar14StackedOmni = decodeDataBarStackedOmnidirectional;
export const detectDataBar14StackedOmni = detectDataBarStackedOmnidirectional;
