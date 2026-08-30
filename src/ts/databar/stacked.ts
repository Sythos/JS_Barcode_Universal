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

/** GS1 DataBar Stacked encoder, decoder and clean-raster detector. @module databar/stacked */

import { BitMatrix } from '../core/bit-matrix.js';
import { ChecksumError, EncodeError, FormatError } from '../core/errors.js';
import { decodeDataBar14GTIN, encodeDataBar14GTIN, normalizeGTIN } from './codec.js';
import {
  DATABAR14_CHECKSUM_WEIGHTS,
  DATABAR14_FINDERS,
  dataBar14CharacterWidths,
  dataBar14ValueForWidths,
} from './patterns.js';

const STACKED_MODULES = 50;
const TOP_ROW_MINIMUM = 5;
const BOTTOM_ROW_MINIMUM = 7;
const SEPARATOR_MINIMUM = 1;
const HALF_ELEMENT_COUNT = 23;
const MAX_SYMBOL_DIMENSION = 32_768;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new EncodeError(`GS1 DataBar Stacked ${label} must be a positive integer`);
  }
  return value;
}

function resolveGeometry(options) {
  if (options === undefined) options = {};
  if (!isRecord(options)) throw new TypeError('GS1 DataBar Stacked options must be an object');

  if (options.linkage !== undefined && typeof options.linkage !== 'boolean') {
    throw new TypeError('GS1 DataBar linkage must be a boolean');
  }

  const hasHeight = options.height !== undefined;
  const hasRows = options.topHeight !== undefined
    || options.bottomHeight !== undefined
    || options.separatorHeight !== undefined;
  const hasScale = options.moduleScale !== undefined || options.scale !== undefined;
  if (hasHeight && (hasRows || hasScale)) {
    throw new EncodeError('GS1 DataBar Stacked height cannot be combined with row heights or moduleScale');
  }

  if (hasHeight) {
    const height = positiveInteger(options.height, 'height');
    if (height % 13 !== 0) {
      throw new EncodeError('GS1 DataBar Stacked height must be a multiple of the 13-module profile');
    }
    const scale = height / 13;
    return boundedGeometry(Object.freeze({
      moduleScale: scale,
      topHeight: TOP_ROW_MINIMUM * scale,
      separatorHeight: SEPARATOR_MINIMUM * scale,
      bottomHeight: BOTTOM_ROW_MINIMUM * scale,
    }));
  }

  if (options.moduleScale !== undefined && options.scale !== undefined
    && options.moduleScale !== options.scale) {
    throw new EncodeError('GS1 DataBar Stacked moduleScale and scale disagree');
  }
  const scale = positiveInteger(options.moduleScale ?? options.scale ?? 1, 'moduleScale');
  const requestedTopHeight = positiveInteger(options.topHeight ?? TOP_ROW_MINIMUM, 'topHeight');
  const requestedSeparatorHeight = positiveInteger(options.separatorHeight ?? SEPARATOR_MINIMUM, 'separatorHeight');
  const requestedBottomHeight = positiveInteger(options.bottomHeight ?? BOTTOM_ROW_MINIMUM, 'bottomHeight');
  if (hasScale && hasRows) {
    throw new EncodeError('GS1 DataBar Stacked explicit row heights cannot be combined with moduleScale');
  }
  const topHeight = hasRows ? requestedTopHeight : requestedTopHeight * scale;
  const separatorHeight = hasRows ? requestedSeparatorHeight : requestedSeparatorHeight * scale;
  const bottomHeight = hasRows ? requestedBottomHeight : requestedBottomHeight * scale;
  if (topHeight < TOP_ROW_MINIMUM * scale
    || separatorHeight < SEPARATOR_MINIMUM * scale
    || bottomHeight < BOTTOM_ROW_MINIMUM * scale) {
    throw new EncodeError('GS1 DataBar Stacked row heights are below their normative minima');
  }

  return boundedGeometry(Object.freeze({ moduleScale: scale, topHeight, separatorHeight, bottomHeight }));
}

function boundedGeometry(geometry) {
  const width = STACKED_MODULES * geometry.moduleScale;
  const height = geometry.topHeight + geometry.separatorHeight + geometry.bottomHeight;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)
    || width > MAX_SYMBOL_DIMENSION || height > MAX_SYMBOL_DIMENSION) {
    throw new EncodeError('GS1 DataBar Stacked dimensions exceed the safe matrix limit');
  }
  return geometry;
}

function strictGTIN14(value) {
  const text = String(value);
  if (!/^\d+$/.test(text)) throw new TypeError('GTIN must contain only decimal digits');
  if (text.length !== 14) {
    throw new RangeError('GS1 DataBar Stacked requires a 14-digit GTIN including its check digit');
  }
  return normalizeGTIN(text);
}

function finderIndexes(characters) {
  const widths = characters.map((value, index) =>
    dataBar14CharacterWidths(value, index === 0 || index === 3 ? 'outside' : 'inside'));
  let checksum = 0;
  const weightOffsets = [0, 8, 24, 16];
  for (let character = 0; character < 4; character++) {
    for (let element = 0; element < 8; element++) {
      checksum += widths[character][element]
        * DATABAR14_CHECKSUM_WEIGHTS[weightOffsets[character] + element];
    }
  }
  checksum %= 79;
  if (checksum >= 8) checksum++;
  if (checksum >= 72) checksum++;
  return { widths, checksum, left: Math.floor(checksum / 9), right: checksum % 9 };
}

function linearWidths(compacted) {
  const check = finderIndexes(compacted.physicalCharacters);
  const widths = [1, 1];
  widths.push(...check.widths[0]);
  widths.push(...DATABAR14_FINDERS[check.left]);
  widths.push(...check.widths[1].slice().reverse());
  widths.push(...check.widths[2]);
  widths.push(...DATABAR14_FINDERS[check.right].slice().reverse());
  widths.push(...check.widths[3].slice().reverse());
  widths.push(1, 1);
  if (widths.length !== 46 || widths.reduce((sum, width) => sum + width, 0) !== 96) {
    throw new EncodeError('GS1 DataBar Stacked internal element geometry is invalid');
  }
  return { widths, checksum: check.checksum, left: check.left, right: check.right };
}

function writeRuns(row, start, dark, widths) {
  let cursor = start;
  let colour = dark;
  for (const width of widths) {
    if (!Number.isInteger(width) || width < 1 || cursor + width > row.length) {
      throw new EncodeError('GS1 DataBar Stacked row geometry exceeds 50 modules');
    }
    if (colour) {
      for (let x = cursor; x < cursor + width; x++) row[x] = true;
    }
    cursor += width;
    colour = !colour;
  }
  return { cursor, dark: colour };
}

function rowBits(widths, half) {
  const row = new Array(STACKED_MODULES).fill(false);
  if (half === 'top') {
    const written = writeRuns(row, 0, false, widths.slice(0, HALF_ELEMENT_COUNT));
    if (written.cursor !== 48) throw new EncodeError('GS1 DataBar Stacked top row is not 50 modules wide');
    row[48] = true;
  } else {
    row[0] = true;
    const written = writeRuns(row, 2, true, widths.slice(HALF_ELEMENT_COUNT));
    if (written.cursor !== STACKED_MODULES) throw new EncodeError('GS1 DataBar Stacked bottom row is not 50 modules wide');
  }
  return row;
}

function separatorBits(top, bottom) {
  const separator = new Array(STACKED_MODULES).fill(false);
  for (let x = 1; x < 46; x++) {
    if (top[x] === bottom[x]) {
      if (!top[x]) separator[x] = true;
    } else if (!separator[x - 1]) {
      separator[x] = true;
    }
  }
  // The four modules at both outside edges remain quiet in the separator.
  for (let x = 0; x < 4; x++) separator[x] = false;
  for (let x = 46; x < STACKED_MODULES; x++) separator[x] = false;
  return separator;
}

function paintRow(matrix, y, height, bits, scale) {
  for (let x = 0; x < bits.length; x++) {
    if (bits[x]) matrix.setRegion(x * scale, y, scale, height);
  }
}

/**
 * Encode a checked 14-digit GTIN as GS1 DataBar Stacked.
 *
 * The default matrix is 50 by 13 modules: a five-module top row, one-module
 * separator, and seven-module bottom row. `moduleScale` (or `scale`) produces
 * an integer nearest-neighbour raster. Explicit row heights are accepted when
 * they satisfy the same minima and are already expressed in output modules.
 */
export function encodeDataBar14Stacked(value, options = {}) {
  const gtin = strictGTIN14(value);
  const geometry = resolveGeometry(options);
  const compacted = encodeDataBar14GTIN(gtin, { linkage: options.linkage });
  const pattern = linearWidths(compacted);
  const top = rowBits(pattern.widths, 'top');
  const bottom = rowBits(pattern.widths, 'bottom');
  const separator = separatorBits(top, bottom);
  const width = STACKED_MODULES * geometry.moduleScale;
  const matrix = new BitMatrix(width, geometry.topHeight + geometry.separatorHeight + geometry.bottomHeight);
  paintRow(matrix, 0, geometry.topHeight, top, geometry.moduleScale);
  paintRow(matrix, geometry.topHeight + geometry.separatorHeight, geometry.bottomHeight, bottom, geometry.moduleScale);
  paintRow(matrix, geometry.topHeight, geometry.separatorHeight, separator, geometry.moduleScale);
  matrix.databar = Object.freeze({
    variant: 'stacked',
    gtin: compacted.gtin,
    linkage: compacted.linkage,
    checksum: pattern.checksum,
    rows: 2,
    modulesPerRow: STACKED_MODULES,
    moduleScale: geometry.moduleScale,
    topHeight: geometry.topHeight,
    separatorHeight: geometry.separatorHeight,
    bottomHeight: geometry.bottomHeight,
  });
  return matrix;
}

function requireMatrix(matrix) {
  if (!matrix || !Number.isInteger(matrix.width) || !Number.isInteger(matrix.height)
    || matrix.width < 1 || matrix.height < 1 || typeof matrix.get !== 'function') {
    throw new TypeError('GS1 DataBar Stacked decoder expects a BitMatrix-like value');
  }
}

function logicalRows(matrix) {
  requireMatrix(matrix);
  if (matrix.width % STACKED_MODULES !== 0) {
    throw new FormatError('GS1 DataBar Stacked matrix width must be a positive multiple of 50 modules');
  }
  const scale = matrix.width / STACKED_MODULES;
  if (!Number.isSafeInteger(scale) || scale < 1) {
    throw new FormatError('GS1 DataBar Stacked horizontal module scale is invalid');
  }

  const rows = [];
  for (let y = 0; y < matrix.height; y++) {
    const bits = new Array(STACKED_MODULES);
    for (let x = 0; x < STACKED_MODULES; x++) {
      const value = Boolean(matrix.get(x * scale + Math.floor(scale / 2), y));
      // A clean integer-scaled raster must not contain a transition inside a
      // horizontal module. This rejects silently aliased or partial symbols.
      for (let dx = 0; dx < scale; dx++) {
        if (Boolean(matrix.get(x * scale + dx, y)) !== value) {
          throw new FormatError('GS1 DataBar Stacked horizontal modules are not integer-scaled');
        }
      }
      bits[x] = value;
    }
    rows.push({ bits, scale });
  }
  return rows;
}

function rowKind(bits) {
  if (!bits[0] && bits[1]) return 'top';
  if (bits[0] && !bits[1]) return 'bottom';
  if (!bits[0] && !bits[1] && !bits[2] && !bits[3]) return 'separator';
  return 'invalid';
}

function equalBits(left, right) {
  for (let x = 0; x < STACKED_MODULES; x++) if (left[x] !== right[x]) return false;
  return true;
}

function runs(bits) {
  const result = [];
  let dark = bits[0];
  let width = 0;
  for (const bit of bits) {
    if (bit === dark) width++;
    else {
      result.push({ dark, width });
      dark = bit;
      width = 1;
    }
  }
  result.push({ dark, width });
  return result;
}

function extractWidths(rows) {
  if (!rows.length) throw new FormatError('GS1 DataBar Stacked has no rows');
  const scale = rows[0].scale;
  const kinds = rows.map(({ bits }) => rowKind(bits));
  if (kinds.some((kind) => kind === 'invalid')) {
    throw new FormatError('GS1 DataBar Stacked row guard pattern is invalid');
  }

  let topEnd = 0;
  while (topEnd < kinds.length && kinds[topEnd] === 'top') topEnd++;
  let separatorEnd = topEnd;
  while (separatorEnd < kinds.length && kinds[separatorEnd] === 'separator') separatorEnd++;
  if (topEnd < 1 || separatorEnd === topEnd || separatorEnd >= kinds.length) {
    throw new FormatError('GS1 DataBar Stacked requires top, separator and bottom rows');
  }
  if (kinds.slice(separatorEnd).some((kind) => kind !== 'bottom')) {
    throw new FormatError('GS1 DataBar Stacked rows are out of order');
  }

  const topHeight = topEnd;
  const separatorHeight = separatorEnd - topEnd;
  const bottomHeight = kinds.length - separatorEnd;
  if (topHeight < TOP_ROW_MINIMUM * scale
    || separatorHeight < SEPARATOR_MINIMUM * scale
    || bottomHeight < BOTTOM_ROW_MINIMUM * scale) {
    throw new FormatError('GS1 DataBar Stacked row heights are below their normative minima');
  }

  const top = rows[0].bits;
  const bottom = rows[separatorEnd].bits;
  for (let y = 1; y < topEnd; y++) {
    if (!equalBits(top, rows[y].bits)) throw new FormatError('GS1 DataBar Stacked top row is inconsistent');
  }
  for (let y = topEnd; y < separatorEnd; y++) {
    if (!equalBits(rows[topEnd].bits, rows[y].bits)) {
      throw new FormatError('GS1 DataBar Stacked separator rows are inconsistent');
    }
  }
  for (let y = separatorEnd + 1; y < rows.length; y++) {
    if (!equalBits(bottom, rows[y].bits)) throw new FormatError('GS1 DataBar Stacked bottom row is inconsistent');
  }

  const expectedSeparator = separatorBits(top, bottom);
  if (!equalBits(expectedSeparator, rows[topEnd].bits)) {
    throw new FormatError('GS1 DataBar Stacked separator pattern is invalid');
  }

  const topRuns = runs(top);
  const bottomRuns = runs(bottom);
  if (topRuns.length !== 25 || bottomRuns.length !== 25) {
    throw new FormatError('GS1 DataBar Stacked element count is invalid');
  }
  if (topRuns[0].dark || topRuns[0].width !== 1
    || !topRuns[23].dark || topRuns[23].width !== 1
    || topRuns[24].dark || topRuns[24].width !== 1) {
    throw new FormatError('GS1 DataBar Stacked top guard pattern is invalid');
  }
  if (!bottomRuns[0].dark || bottomRuns[0].width !== 1
    || bottomRuns[1].dark || bottomRuns[1].width !== 1
    || !bottomRuns[24].dark || bottomRuns[24].width !== 1) {
    throw new FormatError('GS1 DataBar Stacked bottom guard pattern is invalid');
  }

  const widths = [
    ...topRuns.slice(0, HALF_ELEMENT_COUNT).map((run) => run.width),
    ...bottomRuns.slice(2).map((run) => run.width),
  ];
  if (widths.length !== 46 || widths.reduce((sum, width) => sum + width, 0) !== 96) {
    throw new FormatError('GS1 DataBar Stacked linear element geometry is invalid');
  }
  return { widths, scale, topHeight, separatorHeight, bottomHeight };
}

function finderIndex(widths) {
  const key = widths.join(',');
  return DATABAR14_FINDERS.findIndex((candidate) => candidate.join(',') === key);
}

function expectedChecksum(widths) {
  const offsets = [0, 8, 24, 16];
  let checksum = 0;
  for (let character = 0; character < 4; character++) {
    for (let element = 0; element < 8; element++) {
      checksum += widths[character][element]
        * DATABAR14_CHECKSUM_WEIGHTS[offsets[character] + element];
    }
  }
  checksum %= 79;
  if (checksum >= 8) checksum++;
  if (checksum >= 72) checksum++;
  return checksum;
}

/** Decode a clean or integer-scaled GS1 DataBar Stacked matrix. */
export function decodeDataBar14Stacked(matrix) {
  const geometry = extractWidths(logicalRows(matrix));
  const widths = geometry.widths;
  const characters = [
    widths.slice(2, 10),
    widths.slice(15, 23).slice().reverse(),
    widths.slice(23, 31),
    widths.slice(36, 44).slice().reverse(),
  ];
  const leftFinder = finderIndex(widths.slice(10, 15));
  const rightFinder = finderIndex(widths.slice(31, 36).slice().reverse());
  if (leftFinder < 0 || rightFinder < 0) {
    throw new FormatError('GS1 DataBar Stacked finder pattern is invalid');
  }
  const encodedChecksum = leftFinder * 9 + rightFinder;
  if (encodedChecksum !== expectedChecksum(characters)) {
    throw new ChecksumError('GS1 DataBar Stacked checksum mismatch');
  }

  let decoded;
  try {
    decoded = decodeDataBar14GTIN({
      outerLeft: dataBar14ValueForWidths(characters[0], 'outside'),
      innerLeft: dataBar14ValueForWidths(characters[1], 'inside'),
      outerRight: dataBar14ValueForWidths(characters[3], 'outside'),
      innerRight: dataBar14ValueForWidths(characters[2], 'inside'),
    });
  } catch (error) {
    throw new FormatError(`GS1 DataBar Stacked character widths are invalid: ${error.message}`);
  }

  return Object.freeze({
    format: 'databar-stacked',
    variant: 'stacked',
    text: decoded.gtin,
    gtin: decoded.gtin,
    gs1: true,
    linkage: decoded.linkage,
    checksum: encodedChecksum,
    rows: 2,
    topHeight: geometry.topHeight,
    separatorHeight: geometry.separatorHeight,
    bottomHeight: geometry.bottomHeight,
    moduleScale: geometry.scale,
    symbologyIdentifier: ']e0',
    elements: [{ ai: '01', value: decoded.gtin, fixed: true }],
  });
}

function rotateClockwise(source) {
  const out = new BitMatrix(source.height, source.width);
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (source.get(x, y)) out.set(source.height - 1 - y, x);
    }
  }
  return out;
}

function crop(source, box) {
  const out = new BitMatrix(box.width, box.height);
  for (let y = 0; y < box.height; y++) {
    for (let x = 0; x < box.width; x++) {
      if (source.get(box.x + x, box.y + y)) out.set(x, y);
    }
  }
  return out;
}

function cornersFor(box) {
  return [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
  ];
}

function mapRotationPoint(point, source) {
  return { x: point.y, y: source.height - point.x };
}

/**
 * Detect one clean, axis-aligned or quarter-turned DataBar Stacked symbol.
 * The input may contain a light quiet zone and an integer nearest-neighbour
 * scale. Arbitrary perspective and grayscale sampling are outside this API.
 */
export function detectDataBar14Stacked(binaryImage) {
  if (!binaryImage?.width || !binaryImage?.height || typeof binaryImage.get !== 'function') return null;

  let oriented = binaryImage;
  let toOriginal = (point) => ({ x: point.x, y: point.y });
  for (let rotation = 0; rotation < 4; rotation++) {
    const bounds = oriented.getBounds?.();
    if (bounds && Number.isInteger(bounds.width) && Number.isInteger(bounds.height)) {
      const scale = bounds.width / STACKED_MODULES;
      if (Number.isInteger(scale) && scale >= 1) {
        const candidate = crop(oriented, bounds);
        try {
          const result = decodeDataBar14Stacked(candidate);
          const corners = cornersFor(bounds).map(toOriginal);
          return {
            ...result,
            result,
            matrix: candidate,
            corners,
            rotation: rotation * 90,
            moduleSize: scale,
          };
        } catch {
          // The dark bounds may belong to another one-dimensional symbol.
        }
      }
    }

    const previous = oriented;
    const previousToOriginal = toOriginal;
    oriented = rotateClockwise(previous);
    toOriginal = (point) => previousToOriginal(mapRotationPoint(point, previous));
  }
  return null;
}

/** Detect and decode one clean GS1 DataBar Stacked symbol, or return null. */
export function detectAndDecodeDataBar14Stacked(binaryImage) {
  return detectDataBar14Stacked(binaryImage);
}

// Descriptive aliases keep the variant discoverable without changing the
// existing DataBar-14 API surface or its index module.
export const encodeDataBarStacked = encodeDataBar14Stacked;
export const decodeDataBarStacked = decodeDataBar14Stacked;
export const detectDataBarStacked = detectDataBar14Stacked;
export const detectAndDecodeDataBarStacked = detectAndDecodeDataBar14Stacked;
export const encodeGS1DataBarStacked = encodeDataBar14Stacked;
export const decodeGS1DataBarStacked = decodeDataBar14Stacked;
export const detectGS1DataBarStacked = detectDataBar14Stacked;
export const detectAndDecodeGS1DataBarStacked = detectAndDecodeDataBar14Stacked;
