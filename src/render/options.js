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
  const scale = Math.max(1, Math.floor(options.scale ?? 8));
  const margin = Math.max(0, Math.floor(options.margin ?? 4));
  const dark = options.dark ?? '#000000';
  const light = options.light ?? '#ffffff';
  const barHeight = options.barHeight ?? null;

  let base = matrix;
  const is1D = matrix.height === 1;

  if (is1D) {
    // Default to a bar height that stays scannable: tall enough that a laser
    // crossing at a slight angle still passes through the whole symbol.
    const targetPixels = barHeight ?? Math.max(40, Math.round(matrix.width * scale * 0.15));
    const rows = Math.max(1, Math.round(targetPixels / scale));
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
