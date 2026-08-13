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
 * A 2D bit grid — the common currency of this library.
 *
 * Every writer produces one; every reader consumes one; every renderer draws
 * one. Keeping it as the single interchange type is what lets formats and
 * output targets stay independent of each other.
 *
 * Storage is row-packed into a Uint32Array: one allocation, cache-friendly row
 * scans, and cheap whole-row operations for the 1D readers.
 *
 * Convention: a set bit is a DARK module (ink). This matches how symbols are
 * described in every specification, and renderers invert as needed.
 *
 * @module core/bit-matrix
 */

export class BitMatrix {
  /**
   * @param {number} width
   * @param {number} height
   */
  constructor(width, height = width) {
    if (width < 1 || height < 1) {
      throw new Error(`BitMatrix: dimensions must be positive, got ${width}x${height}`);
    }
    this.width = width;
    this.height = height;
    this.rowWords = Math.ceil(width / 32);
    this.bits = new Uint32Array(this.rowWords * height);
  }

  /**
   * @param {number} x @param {number} y
   * @returns {boolean} True if the module is dark.
   */
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    return ((this.bits[y * this.rowWords + (x >>> 5)] >>> (x & 31)) & 1) === 1;
  }

  /** @param {number} x @param {number} y */
  set(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.bits[y * this.rowWords + (x >>> 5)] |= 1 << (x & 31);
  }

  /** @param {number} x @param {number} y */
  unset(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.bits[y * this.rowWords + (x >>> 5)] &= ~(1 << (x & 31));
  }

  /** @param {number} x @param {number} y */
  flip(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.bits[y * this.rowWords + (x >>> 5)] ^= 1 << (x & 31);
  }

  /**
   * @param {number} x @param {number} y @param {boolean} value
   */
  setValue(x, y, value) {
    if (value) this.set(x, y);
    else this.unset(x, y);
  }

  /** Fill a rectangle. @param {number} x @param {number} y @param {number} w @param {number} h */
  setRegion(x, y, w, h) {
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) this.set(i, j);
    }
  }

  clear() {
    this.bits.fill(0);
  }

  /** @returns {BitMatrix} */
  clone() {
    const m = new BitMatrix(this.width, this.height);
    m.bits.set(this.bits);
    return m;
  }

  /**
   * Copy row `y` into a reusable array, avoiding an allocation per row in the
   * 1D scanning loops which run this thousands of times per image.
   *
   * @param {number} y
   * @param {Uint8Array} [out]
   * @returns {Uint8Array}
   */
  getRow(y, out) {
    const row = out && out.length >= this.width ? out : new Uint8Array(this.width);
    const base = y * this.rowWords;
    for (let x = 0; x < this.width; x++) {
      row[x] = (this.bits[base + (x >>> 5)] >>> (x & 31)) & 1;
    }
    return row;
  }

  /**
   * Add a uniform light border. Symbols need a quiet zone to be scannable at
   * all, so this is applied by default when rendering.
   *
   * @param {number} size Modules of margin on every side.
   * @returns {BitMatrix}
   */
  withMargin(size) {
    if (size <= 0) return this.clone();
    const m = new BitMatrix(this.width + size * 2, this.height + size * 2);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.get(x, y)) m.set(x + size, y + size);
      }
    }
    return m;
  }

  /**
   * Nearest-neighbour upscale. Integer factors only — a barcode resampled with
   * interpolation stops being readable.
   *
   * @param {number} factor
   * @returns {BitMatrix}
   */
  scale(factor) {
    const f = Math.max(1, Math.floor(factor));
    if (f === 1) return this.clone();
    const m = new BitMatrix(this.width * f, this.height * f);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.get(x, y)) m.setRegion(x * f, y * f, f, f);
      }
    }
    return m;
  }

  /**
   * Bounding box of the dark modules, or null if the matrix is empty.
   * @returns {{x: number, y: number, width: number, height: number} | null}
   */
  getBounds() {
    let minX = this.width, minY = this.height, maxX = -1, maxY = -1;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.get(x, y)) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  }

  /**
   * Rotate 180 degrees, in place. Cheaper than re-detecting when a reader
   * discovers a symbol is upside down.
   */
  rotate180() {
    const w = this.width, h = this.height;
    for (let y = 0; y < Math.ceil(h / 2); y++) {
      for (let x = 0; x < w; x++) {
        const oy = h - 1 - y, ox = w - 1 - x;
        if (y === oy && x >= ox) break;
        const a = this.get(x, y);
        const b = this.get(ox, oy);
        this.setValue(x, y, b);
        this.setValue(ox, oy, a);
      }
    }
  }

  /**
   * Build from a string of '1'/'X'/'#' (dark) and anything else (light),
   * newline-separated. Test fixtures are far more legible this way.
   *
   * @param {string} text
   * @returns {BitMatrix}
   */
  static parse(text) {
    const lines = text.trim().split('\n').map((l) => l.trim()).filter((l) => l.length);
    const height = lines.length;
    const width = Math.max(...lines.map((l) => l.length));
    const m = new BitMatrix(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < lines[y].length; x++) {
        const c = lines[y][x];
        if (c === '1' || c === 'X' || c === 'x' || c === '#') m.set(x, y);
      }
    }
    return m;
  }

  /**
   * @param {string} [dark] @param {string} [light]
   * @returns {string}
   */
  toString(dark = '##', light = '  ') {
    const rows = [];
    for (let y = 0; y < this.height; y++) {
      let s = '';
      for (let x = 0; x < this.width; x++) s += this.get(x, y) ? dark : light;
      rows.push(s);
    }
    return rows.join('\n');
  }
}
