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
 * SVG output.
 *
 * Dark modules are emitted as a single `<path>` with horizontal runs merged,
 * not as one `<rect>` per module. A version 40 QR symbol has 31329 modules; the
 * naive rendering is a megabyte of XML that browsers choke on, while the merged
 * path is a few kilobytes and draws identically.
 *
 * @module render/svg
 */

import { normalizeOptions } from './options.js';

/**
 * @param {string} value
 * @returns {string}
 */
function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render to an SVG document.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 * @param {import('./options.js').RenderOptions} [options]
 * @returns {string}
 */
export function toSVG(matrix, options = {}) {
  const opts = normalizeOptions(matrix, options);
  const { scale, source, pixelWidth, pixelHeight, rowHeight } = opts;

  let path = '';
  for (let y = 0; y < source.height; y++) {
    let x = 0;
    while (x < source.width) {
      if (!source.get(x, y)) { x++; continue; }
      let run = 1;
      while (x + run < source.width && source.get(x + run, y)) run++;
      // Relative horizontal-vertical path commands: shorter than rects and
      // free of the seams that appear between adjacent rects at some zooms.
      path += `M${x * scale} ${y * rowHeight}h${run * scale}v${rowHeight}h${-run * scale}z`;
      x += run;
    }
  }

  const bg = opts.light === 'none'
    ? ''
    : `<rect width="${pixelWidth}" height="${pixelHeight}" fill="${escapeAttr(opts.light)}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pixelWidth}" height="${pixelHeight}" ` +
    `viewBox="0 0 ${pixelWidth} ${pixelHeight}" shape-rendering="crispEdges">` +
    bg +
    `<path d="${path}" fill="${escapeAttr(opts.dark)}"/>` +
    '</svg>';
}

/**
 * Base64 that works identically in Node and the browser.
 *
 * `btoa` is byte-oriented, so the UTF-8 encoding has to happen first — passing
 * it a string with any character above U+00FF throws.
 *
 * @param {string} text
 * @returns {string}
 */
function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  if (typeof btoa === 'function') return btoa(binary);
  // Node before btoa was global, and non-browser embedders.
  /* eslint-disable-next-line no-undef */
  return Buffer.from(bytes).toString('base64');
}

/**
 * Render to a data URI usable directly as an `<img>` src.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 * @param {import('./options.js').RenderOptions} [options]
 * @returns {string}
 */
export function toSVGDataURI(matrix, options = {}) {
  return 'data:image/svg+xml;base64,' + toBase64(toSVG(matrix, options));
}
