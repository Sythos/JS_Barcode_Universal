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
 * Shared render options, normalised once so every backend agrees.
 *
 * @module render/options
 */

import { BitMatrix } from '../core/bit-matrix.js';

/**
 * @typedef {object} RenderOptions
 * @property {number} [scale] Pixels per module. Default 8.
 * @property {number} [margin] Quiet-zone modules on every side. Default 4.
 * @property {string} [dark] Colour of set modules. Default '#000000'.
 * @property {string} [light] Colour of clear modules, or 'none' for transparent.
 * @property {number} [barHeight] For 1D symbols: total bar height in pixels.
 */

// Keep renderer allocations aligned with the image decoder's resource limits.
const MAX_RENDER_DIMENSION = 16_384;
const MAX_RENDER_PIXELS = 16_777_216;
const MAX_RENDER_SCALE = MAX_RENDER_DIMENSION;
const MAX_RENDER_MARGIN = Math.floor((MAX_RENDER_DIMENSION - 1) / 2);
const MAX_RENDER_BAR_HEIGHT = MAX_RENDER_DIMENSION;

function boundedInteger(value, name, defaultValue, minimum, maximum) {
  const resolved = value ?? defaultValue;
  if (!Number.isSafeInteger(resolved)) {
    throw new RangeError(
      `Render option "${name}" must be a finite safe integer between ${minimum} and ${maximum}, got ${resolved}`
    );
  }
  if (resolved < minimum || resolved > maximum) {
    throw new RangeError(
      `Render option "${name}" must be between ${minimum} and ${maximum}, got ${resolved}`
    );
  }
  return resolved;
}

function validateMatrixDimensions(matrix) {
  if (!matrix || !Number.isSafeInteger(matrix.width) || !Number.isSafeInteger(matrix.height)
    || matrix.width < 1 || matrix.height < 1
    || matrix.width > MAX_RENDER_DIMENSION || matrix.height > MAX_RENDER_DIMENSION) {
    throw new RangeError(
      `Render matrix dimensions must be positive safe integers no larger than ${MAX_RENDER_DIMENSION}`
    );
  }
}

function validatePixelDimensions(width, height) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)
    || width < 1 || height < 1
    || width > MAX_RENDER_DIMENSION || height > MAX_RENDER_DIMENSION) {
    throw new RangeError(
      `Render dimensions must be positive safe integers no larger than ${MAX_RENDER_DIMENSION}`
    );
  }
  const pixels = width * height;
  if (!Number.isSafeInteger(pixels) || pixels > MAX_RENDER_PIXELS) {
    throw new RangeError(
      `Render image contains too many pixels: ${pixels} (maximum ${MAX_RENDER_PIXELS})`
    );
  }
}

/**
 * Expand and pad the matrix, and resolve every dimension.
 *
 * Linear symbols arrive one module tall. They are stretched to `barHeight`
 * *before* the quiet zone is applied, so the margin ends up uniform on all
 * four sides — padding first would leave a quiet zone one module tall against
 * bars a hundred pixels tall, which no scanner would accept.
 *
 * @param {BitMatrix} matrix
 * @param {RenderOptions} options
 */
export function normalizeOptions(matrix, options = {}) {
  validateMatrixDimensions(matrix);
  const scale = boundedInteger(options.scale, 'scale', 8, 1, MAX_RENDER_SCALE);
  const margin = boundedInteger(options.margin, 'margin', 4, 0, MAX_RENDER_MARGIN);
  const dark = options.dark ?? '#000000';
  const light = options.light ?? '#ffffff';
  const barHeight = options.barHeight == null
    ? null
    : boundedInteger(options.barHeight, 'barHeight', 1, 1, MAX_RENDER_BAR_HEIGHT);

  const is1D = matrix.height === 1;
  const targetPixels = is1D
    ? barHeight ?? Math.max(40, Math.round(matrix.width * scale * 0.15))
    : null;
  const rows = is1D ? Math.max(1, Math.round(targetPixels / scale)) : matrix.height;
  const sourceWidth = matrix.width + margin * 2;
  const sourceHeight = rows + margin * 2;
  validatePixelDimensions(sourceWidth * scale, sourceHeight * scale);

  let base = matrix;

  if (is1D) {
    // Default to a bar height that stays scannable: tall enough that a laser
    // crossing at a slight angle still passes through the whole symbol.
    base = new BitMatrix(matrix.width, rows);
    for (let x = 0; x < matrix.width; x++) {
      if (!matrix.get(x, 0)) continue;
      for (let y = 0; y < rows; y++) base.set(x, y);
    }
  }

  const source = margin > 0 ? base.withMargin(margin) : base;

  return {
    scale,
    margin,
    dark,
    light,
    is1D,
    source,
    rowHeight: scale,
    pixelWidth: source.width * scale,
    pixelHeight: source.height * scale,
  };
}

/**
 * Parse a CSS colour into RGBA bytes.
 *
 * Supports the forms a barcode actually needs: #rgb, #rgba, #rrggbb,
 * #rrggbbaa, rgb(), rgba(), plus 'none' and 'transparent'.
 *
 * @param {string} colour
 * @returns {[number, number, number, number]}
 */
export function parseColor(colour) {
  const value = String(colour).trim().toLowerCase();

  if (value === 'none' || value === 'transparent') return [0, 0, 0, 0];
  if (value === 'white') return [255, 255, 255, 255];
  if (value === 'black') return [0, 0, 0, 255];

  if (value[0] === '#') {
    const hex = value.slice(1);
    const expand = (c) => parseInt(c + c, 16);
    if (hex.length === 3) {
      return [expand(hex[0]), expand(hex[1]), expand(hex[2]), 255];
    }
    if (hex.length === 4) {
      return [expand(hex[0]), expand(hex[1]), expand(hex[2]), expand(hex[3])];
    }
    if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
        255,
      ];
    }
    if (hex.length === 8) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
        parseInt(hex.slice(6, 8), 16),
      ];
    }
  }

  const fn = value.match(/^rgba?\(([^)]+)\)$/);
  if (fn) {
    const parts = fn[1].split(/[,/\s]+/).filter(Boolean);
    const channel = (s) => (s.endsWith('%')
      ? Math.round((parseFloat(s) / 100) * 255)
      : Math.round(parseFloat(s)));
    const r = channel(parts[0]);
    const g = channel(parts[1]);
    const b = channel(parts[2]);
    let a = 255;
    if (parts.length > 3) {
      a = parts[3].endsWith('%')
        ? Math.round((parseFloat(parts[3]) / 100) * 255)
        : Math.round(parseFloat(parts[3]) * 255);
    }
    return [r, g, b, a];
  }

  // Unrecognised: fall back to opaque black rather than throwing, so an
  // unusual colour never costs someone a barcode.
  return [0, 0, 0, 255];
}
