/*!
 * Sythos Barcode Suite v1.0.0
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
 * Zero runtime dependencies.
 */
(function (globalThisRef) {
'use strict';
var __modules = {};
var __cache = {};
function __require(id) {
  if (__cache[id]) return __cache[id];
  var exports = {};
  // Cache before executing so a future cycle would see a partial object rather
  // than recursing forever. The graph is acyclic today; this is a guard rail.
  __cache[id] = exports;
  __modules[id](__require, exports);
  return exports;
}

__modules["core/bit-matrix.js"] = function (__require, __exports) {
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
class BitMatrix {
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

__exports.BitMatrix = BitMatrix;
};

__modules["core/errors.js"] = function (__require, __exports) {
/**
 * Error types.
 *
 * Decoding uses exceptions for control flow internally: a detector that fails
 * on one candidate should be cheap to abandon, and a `try` around a candidate
 * loop reads better than threading `null` through six call frames. The public
 * API converts them to results.
 *
 * @module core/errors
 */

/** Base class so consumers can `catch (e) { if (e instanceof BarcodeError) ... }`. */
class BarcodeError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

/** Input could not be encoded — bad payload, or it does not fit the symbology. */
class EncodeError extends BarcodeError {}

/** No symbol was found in the image. Not an error condition for `decode()`. */
class NotFoundError extends BarcodeError {}

/** A symbol was found, but its geometry or content is malformed. */
class FormatError extends BarcodeError {}

/** A symbol was found and read, but error correction could not repair it. */
class ChecksumError extends BarcodeError {}

__exports.BarcodeError = BarcodeError;
__exports.EncodeError = EncodeError;
__exports.NotFoundError = NotFoundError;
__exports.FormatError = FormatError;
__exports.ChecksumError = ChecksumError;
};

__modules["image/luminance.js"] = function (__require, __exports) {
/**
 * Greyscale conversion — the boundary between "an image" and "our problem".
 *
 * The whole library accepts exactly one image shape: `{ data, width, height }`
 * with `data` in RGBA order. That is what `ImageData` is, so a `<canvas>`, an
 * `OffscreenCanvas`, `createImageBitmap`, sharp, jimp and node-canvas all
 * satisfy it without an adapter. Nothing below this file knows about the DOM,
 * the filesystem, or any image codec.
 *
 * @module image/luminance
 */
const { NotFoundError } = __require("core/errors.js");

/**
 * @typedef {object} ImageLike
 * @property {Uint8ClampedArray | Uint8Array | number[]} data RGBA, 4 bytes per pixel.
 * @property {number} width
 * @property {number} height
 */
class LuminanceSource {
  /**
   * @param {Uint8Array} grey One byte per pixel.
   * @param {number} width
   * @param {number} height
   */
  constructor(grey, width, height) {
    this.grey = grey;
    this.width = width;
    this.height = height;
  }

  /**
   * Build from any ImageData-shaped object.
   *
   * Transparent pixels are composited over white rather than read as black:
   * a PNG barcode with a transparent background is common, and treating alpha
   * as ink turns the entire quiet zone into a solid dark field.
   *
   * @param {ImageLike} image
   * @returns {LuminanceSource}
   */
  static fromImageData(image) {
    const { data, width, height } = image;
    if (!data || !width || !height) {
      throw new NotFoundError('Image must be { data, width, height } with RGBA data');
    }
    if (data.length < width * height * 4) {
      throw new NotFoundError(
        `Image data too short: ${data.length} bytes for ${width}x${height} RGBA ` +
        `(expected ${width * height * 4})`
      );
    }

    const grey = new Uint8Array(width * height);
    for (let i = 0, p = 0; i < grey.length; i++, p += 4) {
      const a = data[p + 3];
      let r = data[p], g = data[p + 1], b = data[p + 2];
      if (a !== 255) {
        // Composite over white.
        const inv = 255 - a;
        r = (r * a + 255 * inv) / 255;
        g = (g * a + 255 * inv) / 255;
        b = (b * a + 255 * inv) / 255;
      }
      // Integer luma approximation of Rec. 601: 0.299/0.587/0.114 scaled by 256.
      grey[i] = (r * 77 + g * 150 + b * 29) >> 8;
    }
    return new LuminanceSource(grey, width, height);
  }

  /**
   * Build directly from single-channel data, skipping conversion.
   *
   * @param {Uint8Array} grey
   * @param {number} width
   * @param {number} height
   * @returns {LuminanceSource}
   */
  static fromGrey(grey, width, height) {
    if (grey.length < width * height) {
      throw new NotFoundError('Greyscale buffer shorter than width * height');
    }
    return new LuminanceSource(grey, width, height);
  }

  /**
   * @param {number} x @param {number} y
   * @returns {number} 0-255.
   */
  get(x, y) {
    return this.grey[y * this.width + x];
  }

  /**
   * @param {number} y
   * @param {Uint8Array} [out]
   * @returns {Uint8Array}
   */
  getRow(y, out) {
    const row = out && out.length >= this.width ? out : new Uint8Array(this.width);
    row.set(this.grey.subarray(y * this.width, (y + 1) * this.width));
    return row;
  }

  /**
   * Rotate 90 degrees clockwise.
   *
   * The 1D readers scan horizontally, so this is how they find vertically
   * oriented barcodes: scan, rotate, scan again.
   *
   * @returns {LuminanceSource}
   */
  rotate90() {
    const { width: w, height: h, grey } = this;
    const out = new Uint8Array(grey.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        out[x * h + (h - 1 - y)] = grey[y * w + x];
      }
    }
    return new LuminanceSource(out, h, w);
  }

  /**
   * Downscale by an integer factor with box averaging.
   *
   * Large camera frames are slow to scan and no more informative than a
   * half-size copy; detectors use this to find candidates cheaply.
   *
   * @param {number} factor
   * @returns {LuminanceSource}
   */
  downscale(factor) {
    const f = Math.max(1, Math.floor(factor));
    if (f === 1) return this;
    const w = Math.floor(this.width / f);
    const h = Math.floor(this.height / f);
    const out = new Uint8Array(w * h);
    const area = f * f;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let dy = 0; dy < f; dy++) {
          const base = (y * f + dy) * this.width + x * f;
          for (let dx = 0; dx < f; dx++) sum += this.grey[base + dx];
        }
        out[y * w + x] = (sum / area) | 0;
      }
    }
    return new LuminanceSource(out, w, h);
  }

  /**
   * Invert. Some symbols are printed light-on-dark, and readers retry inverted
   * when a first pass finds nothing.
   *
   * @returns {LuminanceSource}
   */
  invert() {
    const out = new Uint8Array(this.grey.length);
    for (let i = 0; i < out.length; i++) out[i] = 255 - this.grey[i];
    return new LuminanceSource(out, this.width, this.height);
  }
}

__exports.LuminanceSource = LuminanceSource;
};

__modules["image/binarizer.js"] = function (__require, __exports) {
/**
 * Greyscale to black-and-white.
 *
 * This is the single biggest determinant of whether a reader works on real
 * photographs. Decoding logic is exact and either right or wrong; binarization
 * is a judgement call made a million times per image, and every downstream
 * stage inherits its mistakes. A symbol lost here is lost permanently.
 *
 * Two strategies:
 *
 *   global  — one threshold for the whole image. Fast, and correct for clean
 *             synthetic images: screenshots, generated PNGs, flat scans.
 *   hybrid  — a threshold per 8x8 block, smoothed across neighbours. Handles
 *             the uneven lighting that dominates camera input: shadows,
 *             glare, vignetting, a page curving away from the lens.
 *
 * @module image/binarizer
 */
const { BitMatrix } = __require("core/bit-matrix.js");
const { NotFoundError } = __require("core/errors.js");

/** Side of a block, in pixels. */
const BLOCK = 8;
const BLOCK_SHIFT = 3;

/** Below this spread, a block is treated as uniform rather than as edges. */
const MIN_DYNAMIC_RANGE = 24;

/**
 * One threshold for the entire image, chosen from the luminance histogram.
 *
 * Finds the two strongest peaks — ideally ink and paper — and cuts at the
 * point of lowest population between them, weighted by distance so a narrow
 * secondary peak does not drag the threshold onto a shoulder.
 *
 * @param {import('./luminance.js').LuminanceSource} source
 * @returns {BitMatrix} Set bit = dark module.
 */
function binarizeGlobal(source) {
  const { grey, width, height } = source;
  const buckets = new Int32Array(32);
  for (let i = 0; i < grey.length; i++) buckets[grey[i] >> 3]++;

  const threshold = pickThreshold(buckets);
  const out = new BitMatrix(width, height);
  for (let y = 0; y < height; y++) {
    const base = y * width;
    for (let x = 0; x < width; x++) {
      if (grey[base + x] < threshold) out.set(x, y);
    }
  }
  return out;
}

/**
 * @param {Int32Array} buckets
 * @returns {number} Threshold in 0-255.
 */
function pickThreshold(buckets) {
  const n = buckets.length;

  let firstPeak = 0, firstPeakSize = 0;
  for (let i = 0; i < n; i++) {
    if (buckets[i] > firstPeakSize) {
      firstPeakSize = buckets[i];
      firstPeak = i;
    }
  }

  // Score candidates by population scaled by squared distance from the first
  // peak: the second peak must be both populous and clearly separated.
  let secondPeak = 0, secondScore = 0;
  for (let i = 0; i < n; i++) {
    const d = i - firstPeak;
    const score = buckets[i] * d * d;
    if (score > secondScore) {
      secondScore = score;
      secondPeak = i;
    }
  }

  let low = Math.min(firstPeak, secondPeak);
  let high = Math.max(firstPeak, secondPeak);

  if (high - low <= n >> 4) {
    // Effectively unimodal — a blank region, or an image with no ink. Fall
    // back to the midpoint of the occupied range rather than inventing edges.
    let lo = 0, hi = n - 1;
    while (lo < n && buckets[lo] === 0) lo++;
    while (hi > 0 && buckets[hi] === 0) hi--;
    return (((lo + hi) >> 1) << 3) + 4;
  }

  // Deepest valley between the peaks, biased toward the middle.
  let valley = low, valleyScore = -1;
  for (let i = low + 1; i < high; i++) {
    const fromLow = i - low;
    const fromHigh = high - i;
    const score = fromLow * fromHigh * (firstPeakSize - buckets[i]);
    if (score > valleyScore) {
      valleyScore = score;
      valley = i;
    }
  }
  return (valley << 3) + 4;
}

/**
 * Locally adaptive thresholding.
 *
 * Per 8x8 block: compute min, max and mean. A block with real contrast gets
 * its own mean as the threshold. A block that is flat is ambiguous on its own
 * — solid paper and solid ink look identical from the inside — so it inherits
 * from its neighbourhood, which is what stops large quiet zones from being
 * speckled into noise.
 *
 * Thresholds are then averaged over a 5x5 block window, so lighting gradients
 * are followed smoothly instead of producing visible block seams that the
 * detectors would read as edges.
 *
 * @param {import('./luminance.js').LuminanceSource} source
 * @returns {BitMatrix}
 */
function binarizeHybrid(source) {
  const { grey, width, height } = source;

  // Too small to block up meaningfully; the global pass is strictly better.
  if (width < BLOCK * 5 || height < BLOCK * 5) return binarizeGlobal(source);

  const bw = (width + BLOCK - 1) >> BLOCK_SHIFT;
  const bh = (height + BLOCK - 1) >> BLOCK_SHIFT;
  const means = new Int32Array(bw * bh);
  const ranges = new Int32Array(bw * bh);

  for (let by = 0; by < bh; by++) {
    const y0 = by << BLOCK_SHIFT;
    const y1 = Math.min(y0 + BLOCK, height);
    for (let bx = 0; bx < bw; bx++) {
      const x0 = bx << BLOCK_SHIFT;
      const x1 = Math.min(x0 + BLOCK, width);

      let sum = 0, min = 255, max = 0, count = 0;
      for (let y = y0; y < y1; y++) {
        const base = y * width;
        for (let x = x0; x < x1; x++) {
          const v = grey[base + x];
          sum += v;
          if (v < min) min = v;
          if (v > max) max = v;
          count++;
        }
      }
      const idx = by * bw + bx;
      means[idx] = count ? (sum / count) | 0 : 128;
      ranges[idx] = max - min;
    }
  }

  // Flat blocks adopt a threshold from context. Looking left and up is enough
  // because those neighbours are already resolved, and it makes the pass
  // single-shot rather than iterative.
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const idx = by * bw + bx;
      if (ranges[idx] >= MIN_DYNAMIC_RANGE) continue;

      let inherited = means[idx];
      if (bx > 0 && by > 0) {
        const neighbours = [
          means[idx - 1],
          means[idx - bw],
          means[idx - bw - 1],
        ];
        const avg = (neighbours[0] + neighbours[1] + neighbours[2]) / 3;
        // A flat block darker than its surroundings is ink; lighter is paper.
        // Either way the local minimum is the safer threshold than the mean.
        inherited = Math.min(avg, means[idx]);
      }
      means[idx] = inherited | 0;
    }
  }

  const out = new BitMatrix(width, height);
  const R = 2; // 5x5 block window

  for (let by = 0; by < bh; by++) {
    const y0 = by << BLOCK_SHIFT;
    const y1 = Math.min(y0 + BLOCK, height);
    const byLo = Math.max(0, by - R);
    const byHi = Math.min(bh - 1, by + R);

    for (let bx = 0; bx < bw; bx++) {
      const bxLo = Math.max(0, bx - R);
      const bxHi = Math.min(bw - 1, bx + R);

      let sum = 0, count = 0;
      for (let ny = byLo; ny <= byHi; ny++) {
        for (let nx = bxLo; nx <= bxHi; nx++) {
          sum += means[ny * bw + nx];
          count++;
        }
      }
      const threshold = sum / count;

      const x0 = bx << BLOCK_SHIFT;
      const x1 = Math.min(x0 + BLOCK, width);
      for (let y = y0; y < y1; y++) {
        const base = y * width;
        for (let x = x0; x < x1; x++) {
          if (grey[base + x] < threshold) out.set(x, y);
        }
      }
    }
  }

  return out;
}

/**
 * Binarize with the named strategy.
 *
 * @param {import('./luminance.js').LuminanceSource} source
 * @param {'global' | 'hybrid' | 'auto'} [strategy]
 * @returns {BitMatrix}
 */
function binarize(source, strategy = 'auto') {
  if (!source || !source.grey) throw new NotFoundError('binarize: no luminance source');
  switch (strategy) {
    case 'global': return binarizeGlobal(source);
    case 'hybrid': return binarizeHybrid(source);
    case 'auto':
      // Small images are almost always generated rather than photographed.
      return source.width * source.height < 200 * 200
        ? binarizeGlobal(source)
        : binarizeHybrid(source);
    default:
      throw new NotFoundError(`Unknown binarizer strategy: ${strategy}`);
  }
}

__exports.binarizeGlobal = binarizeGlobal;
__exports.binarizeHybrid = binarizeHybrid;
__exports.binarize = binarize;
};

__modules["oned/patterns.js"] = function (__require, __exports) {
/**
 * Pattern tables for the linear symbologies.
 *
 * Every table here is a published fact about a symbology, expressed in this
 * project's own notation and validated by structural invariants rather than
 * trusted. `validateTables()` at the bottom asserts the properties each
 * symbology guarantees — module counts, wide-element counts, uniqueness — and
 * the test suite runs it. A transcription slip that breaks an invariant fails
 * the build; the invariants are chosen so that most single-character slips do.
 *
 * Two notations appear:
 *
 *   width strings  "212222"  — element widths in modules, bar first, then
 *                              alternating space/bar. Used by Code 128, 93,
 *                              Codabar, ITF, Code 39, Code 11.
 *   module strings "0001101" — one character per module, 1 = dark. Used by
 *                              EAN/UPC, where every element is a whole number
 *                              of modules out of a fixed 7.
 *
 * @module oned/patterns
 */

/* ------------------------------------------------------------------ *
 * EAN / UPC
 * ------------------------------------------------------------------ */

/** Odd-parity ("L") digit patterns, 7 modules each. */
const EAN_L = [
  '0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011',
];

/** Even-parity ("G") patterns: the R pattern reversed. */
const EAN_G = EAN_L.map((p) => [...p].reverse().map((b) => (b === '1' ? '0' : '1')).join(''));

/** Right-hand ("R") patterns: the L pattern complemented. */
const EAN_R = EAN_L.map((p) => [...p].map((b) => (b === '1' ? '0' : '1')).join(''));

/**
 * Which parity set each of the six left-hand EAN-13 digits uses, indexed by
 * the first digit. This is how the thirteenth digit is carried without a
 * thirteenth symbol position.
 */
const EAN13_PARITY = [
  'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL',
];

/** UPC-E parity patterns, indexed by check digit. Used when the number system is 0. */
const UPCE_PARITY = [
  'EEEOOO', 'EEOEOO', 'EEOOEO', 'EEOOOE', 'EOEEOO',
  'EOOEEO', 'EOOOEE', 'EOEOEO', 'EOEOOE', 'EOOEOE',
];
const EAN_START_END = '101';
const EAN_MIDDLE = '01010';
const UPCE_END = '010101';

/* ------------------------------------------------------------------ *
 * Code 39
 * ------------------------------------------------------------------ */

/**
 * Code 39 is "three of nine": nine elements per character, of which exactly
 * three are wide. `n` and `w` below are narrow and wide; elements alternate
 * bar, space, bar, ... starting and ending with a bar.
 */
const CODE39 = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn', '9': 'nnwwnnwnn', 'A': 'wnnnnwnnw', 'B': 'nnwnnwnnw',
  'C': 'wnwnnwnnn', 'D': 'nnnnwwnnw', 'E': 'wnnnwwnnn', 'F': 'nnwnwwnnn',
  'G': 'nnnnnwwnw', 'H': 'wnnnnwwnn', 'I': 'nnwnnwwnn', 'J': 'nnnnwwwnn',
  'K': 'wnnnnnnww', 'L': 'nnwnnnnww', 'M': 'wnwnnnnwn', 'N': 'nnnnwnnww',
  'O': 'wnnnwnnwn', 'P': 'nnwnwnnwn', 'Q': 'nnnnnnwww', 'R': 'wnnnnnwwn',
  'S': 'nnwnnnwwn', 'T': 'nnnnwnwwn', 'U': 'wwnnnnnnw', 'V': 'nwwnnnnnw',
  'W': 'wwwnnnnnn', 'X': 'nwnnwnnnw', 'Y': 'wwnnwnnnn', 'Z': 'nwwnwnnnn',
  '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '$': 'nwnwnwnnn',
  '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn', '*': 'nwnnwnwnn',
};

/** Character set for the optional modulo-43 check digit; '*' is excluded. */
const CODE39_CHECK_SET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%';

/** Two-character escapes giving Code 39 the full ASCII range. */
const CODE39_EXTENDED = (() => {
  const map = new Array(128);
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let i = 0; i < 26; i++) {
    map[i + 1] = '$' + upper[i];               // SOH..SUB
    map[i + 65] = upper[i];                    // A-Z
    map[i + 97] = '+' + upper[i];              // a-z
  }
  for (let i = 0; i < 10; i++) map[i + 48] = String(i);
  map[0] = '%U';
  for (let i = 27; i <= 31; i++) map[i] = '%' + upper[i - 27 + 0]; // ESC..US -> %A..%E
  const symbols = {
    32: ' ', 33: '/A', 34: '/B', 35: '/C', 36: '/D', 37: '/E', 38: '/F',
    39: '/G', 40: '/H', 41: '/I', 42: '/J', 43: '/K', 44: '/L', 45: '-',
    46: '.', 47: '/O', 58: '/Z', 59: '%F', 60: '%G', 61: '%H', 62: '%I',
    63: '%J', 64: '%V', 91: '%K', 92: '%L', 93: '%M', 94: '%N', 95: '%O',
    96: '%W', 123: '%P', 124: '%Q', 125: '%R', 126: '%S', 127: '%T',
  };
  for (const [code, seq] of Object.entries(symbols)) map[Number(code)] = seq;
  return map;
})();

/* ------------------------------------------------------------------ *
 * Code 93
 * ------------------------------------------------------------------ */

/** Nine modules per character across six elements. */
const CODE93 = {
  '0': '131112', '1': '111213', '2': '111312', '3': '111411', '4': '121113',
  '5': '121212', '6': '121311', '7': '111114', '8': '131211', '9': '141111',
  'A': '211113', 'B': '211212', 'C': '211311', 'D': '221112', 'E': '221211',
  'F': '231111', 'G': '112113', 'H': '112212', 'I': '112311', 'J': '122112',
  'K': '132111', 'L': '111123', 'M': '111222', 'N': '111321', 'O': '121122',
  'P': '131121', 'Q': '212112', 'R': '212211', 'S': '211122', 'T': '211221',
  'U': '221121', 'V': '222111', 'W': '112122', 'X': '112221', 'Y': '122121',
  'Z': '123111', '-': '121131', '.': '311112', ' ': '311211', '$': '321111',
  '/': '112131', '+': '113121', '%': '211131',
  // The four shift characters. Their conventional names -- ($) (%) (/) (+) --
  // collide with the literal single-character entries above, so they take
  // distinct multi-character keys. Writing the bare symbols here would create
  // duplicate object keys, which JavaScript collapses silently: the table
  // would end up three entries short, with no error raised anywhere.
  'S$': '121221',
  'S%': '312111',
  'S/': '311121',
  'S+': '122211',
};

/**
 * Symbol values 0..46 in order, as keys into {@link CODE93}. An array rather
 * than a string, because the four shift characters have multi-character keys.
 */
const CODE93_VALUES = [
  ...'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%',
  'S$', 'S%', 'S/', 'S+',
];
const CODE93_START_STOP = '111141';

/* ------------------------------------------------------------------ *
 * Code 128
 * ------------------------------------------------------------------ */

/**
 * All 107 symbol patterns. Eleven modules each across six elements; the stop
 * pattern is the sole exception at thirteen modules across seven.
 *
 * The eleven-module invariant is checked below and catches the overwhelming
 * majority of transcription slips, since almost any single-digit change to a
 * pattern breaks the sum.
 */
const CODE128 = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213',
  '122312', '132212', '221213', '221312', '231212', '112232', '122132',
  '122231', '113222', '123122', '123221', '223211', '221132', '221231',
  '213212', '223112', '312131', '311222', '321122', '321221', '312212',
  '322112', '322211', '212123', '212321', '232121', '111323', '131123',
  '131321', '112313', '132113', '132311', '211313', '231113', '231311',
  '112133', '112331', '132131', '113123', '113321', '133121', '313121',
  '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111',
  '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114',
  '413111', '241112', '134111', '111242', '121142', '121241', '114212',
  '124112', '124211', '411212', '421112', '421211', '212141', '214121',
  '412121', '111143', '111341', '131141', '114113', '114311', '411113',
  '411311', '113141', '114131', '311141', '411131', '211412', '211214',
  '211232', '2331112',
];
const CODE128_START_A = 103;
const CODE128_START_B = 104;
const CODE128_START_C = 105;
const CODE128_STOP = 106;
const CODE128_FNC1 = 102;
const CODE128_FNC2 = 97;
const CODE128_FNC3 = 96;
const CODE128_FNC4_A = 101;
const CODE128_FNC4_B = 100;
const CODE128_SHIFT = 98;
const CODE128_CODE_A = 101;
const CODE128_CODE_B = 100;
const CODE128_CODE_C = 99;

/* ------------------------------------------------------------------ *
 * Interleaved 2 of 5
 * ------------------------------------------------------------------ */

/** Five elements per digit, exactly two of them wide. */
const ITF = [
  'nnwwn', 'wnnnw', 'nwnnw', 'wwnnn', 'nnwnw',
  'wnwnn', 'nwwnn', 'nnnww', 'wnnwn', 'nwnwn',
];

/* ------------------------------------------------------------------ *
 * Codabar
 * ------------------------------------------------------------------ */

/** Seven elements per character. */
const CODABAR = {
  '0': 'nnnnnww', '1': 'nnnnwwn', '2': 'nnnwnnw', '3': 'wwnnnnn',
  '4': 'nnwnnwn', '5': 'wnnnnwn', '6': 'nwnnnnw', '7': 'nwnnwnn',
  '8': 'nwwnnnn', '9': 'wnnwnnn', '-': 'nnnwwnn', '$': 'nnwwnnn',
  ':': 'wnnnwnw', '/': 'wnwnnnw', '.': 'wnwnwnn', '+': 'nnwnwnw',
  'A': 'nnwwnwn', 'B': 'nwnwnnw', 'C': 'nnnwnww', 'D': 'nnnwwwn',
};
const CODABAR_START_STOP = 'ABCD';

/* ------------------------------------------------------------------ *
 * Code 11
 * ------------------------------------------------------------------ */

/** Five elements per character, one or two of them wide. */
const CODE11 = {
  '0': 'nnnnw', '1': 'wnnnw', '2': 'nwnnw', '3': 'wwnnn', '4': 'nnwnw',
  '5': 'wnwnn', '6': 'nwwnn', '7': 'nnnww', '8': 'wnnwn', '9': 'wnnnn',
  '-': 'nnwnn',
};
const CODE11_START_STOP = 'nnwwn';

/* ------------------------------------------------------------------ *
 * MSI / Plessey
 * ------------------------------------------------------------------ */

/** Each bit of a digit becomes a bar pair: 1 is wide-then-narrow, 0 the reverse. */
const MSI_BIT = { 0: '100', 1: '110' };
const MSI_START = '110';
const MSI_STOP = '1001';

/* ------------------------------------------------------------------ *
 * Structural validation
 * ------------------------------------------------------------------ */

/**
 * Assert every invariant these tables are supposed to satisfy.
 *
 * This is the first of the correctness mechanisms described in NOTICE.md:
 * the tables are redundant with the symbology rules, so the rules can check
 * the tables. Called from the test suite; cheap enough to call anywhere.
 *
 * @returns {string[]} Problems found; empty means all invariants hold.
 */
function validateTables() {
  const problems = [];
  const sum = (s) => [...s].reduce((a, c) => a + Number(c), 0);
  const countWide = (s) => [...s].filter((c) => c === 'w').length;

  // --- EAN/UPC: 7 modules per digit; L odd parity; R the complement of L;
  // G the reverse of R. All 30 patterns distinct.
  for (let d = 0; d < 10; d++) {
    for (const [name, table] of [['L', EAN_L], ['G', EAN_G], ['R', EAN_R]]) {
      if (table[d].length !== 7) problems.push(`EAN ${name}${d}: ${table[d].length} modules, expected 7`);
    }
    const darkL = [...EAN_L[d]].filter((c) => c === '1').length;
    if (darkL % 2 === 0) problems.push(`EAN L${d}: even parity, expected odd`);
    const darkG = [...EAN_G[d]].filter((c) => c === '1').length;
    if (darkG % 2 !== 0) problems.push(`EAN G${d}: odd parity, expected even`);
    if (EAN_L[d][0] !== '0' || EAN_L[d][6] !== '1') {
      problems.push(`EAN L${d}: must start with a space and end with a bar`);
    }
  }
  const eanAll = new Set([...EAN_L, ...EAN_G, ...EAN_R]);
  if (eanAll.size !== 30) problems.push(`EAN: ${eanAll.size} distinct patterns, expected 30`);

  // --- EAN-13 parity: first row all-L, every row six characters, all distinct.
  if (EAN13_PARITY[0] !== 'LLLLLL') problems.push('EAN-13 parity[0] must be LLLLLL');
  if (new Set(EAN13_PARITY).size !== 10) problems.push('EAN-13 parity rows are not distinct');
  for (const [i, row] of EAN13_PARITY.entries()) {
    if (row.length !== 6) problems.push(`EAN-13 parity[${i}]: ${row.length} entries, expected 6`);
  }

  // --- Code 39: nine elements, exactly three wide, all patterns distinct.
  for (const [ch, p] of Object.entries(CODE39)) {
    if (p.length !== 9) problems.push(`Code39 '${ch}': ${p.length} elements, expected 9`);
    if (countWide(p) !== 3) problems.push(`Code39 '${ch}': ${countWide(p)} wide, expected 3`);
  }
  if (new Set(Object.values(CODE39)).size !== Object.keys(CODE39).length) {
    problems.push('Code39: duplicate patterns');
  }
  if (CODE39_CHECK_SET.length !== 43) {
    problems.push(`Code39 check set: ${CODE39_CHECK_SET.length} characters, expected 43`);
  }

  // --- Code 93: nine modules across six elements, all patterns distinct.
  for (const [ch, p] of Object.entries(CODE93)) {
    if (p.length !== 6) problems.push(`Code93 '${ch}': ${p.length} elements, expected 6`);
    if (sum(p) !== 9) problems.push(`Code93 '${ch}': ${sum(p)} modules, expected 9`);
  }
  if (new Set(Object.values(CODE93)).size !== Object.keys(CODE93).length) {
    problems.push('Code93: duplicate patterns');
  }
  if (CODE93_VALUES.length !== 47) {
    problems.push(`Code93 values: ${CODE93_VALUES.length}, expected 47`);
  }
  if (Object.keys(CODE93).length !== 47) {
    problems.push(
      `Code93 table: ${Object.keys(CODE93).length} entries, expected 47 ` +
      '(duplicate object keys collapse silently — check the shift characters)'
    );
  }
  if (new Set(CODE93_VALUES).size !== CODE93_VALUES.length) {
    problems.push('Code93: duplicate entries in the value order');
  }
  for (const ch of CODE93_VALUES) {
    if (!CODE93[ch]) problems.push(`Code93: value character '${ch}' has no pattern`);
  }

  // --- Code 128: 107 patterns, 11 modules each, stop 13. All distinct.
  if (CODE128.length !== 107) {
    problems.push(`Code128: ${CODE128.length} patterns, expected 107`);
  }
  for (const [i, p] of CODE128.entries()) {
    const expected = i === CODE128_STOP ? 13 : 11;
    const elements = i === CODE128_STOP ? 7 : 6;
    if (sum(p) !== expected) problems.push(`Code128 [${i}] "${p}": ${sum(p)} modules, expected ${expected}`);
    if (p.length !== elements) problems.push(`Code128 [${i}] "${p}": ${p.length} elements, expected ${elements}`);
    if ([...p].some((c) => c === '0' || Number(c) > 4)) {
      problems.push(`Code128 [${i}] "${p}": element width out of range 1-4`);
    }
  }
  if (new Set(CODE128).size !== CODE128.length) problems.push('Code128: duplicate patterns');

  // --- ITF: five elements, exactly two wide, ten distinct patterns.
  for (const [d, p] of ITF.entries()) {
    if (p.length !== 5) problems.push(`ITF ${d}: ${p.length} elements, expected 5`);
    if (countWide(p) !== 2) problems.push(`ITF ${d}: ${countWide(p)} wide, expected 2`);
  }
  if (new Set(ITF).size !== 10) problems.push('ITF: duplicate patterns');

  // --- Codabar: seven elements, all distinct.
  for (const [ch, p] of Object.entries(CODABAR)) {
    if (p.length !== 7) problems.push(`Codabar '${ch}': ${p.length} elements, expected 7`);
  }
  if (new Set(Object.values(CODABAR)).size !== Object.keys(CODABAR).length) {
    problems.push('Codabar: duplicate patterns');
  }

  // --- Code 11: five elements, all distinct.
  for (const [ch, p] of Object.entries(CODE11)) {
    if (p.length !== 5) problems.push(`Code11 '${ch}': ${p.length} elements, expected 5`);
  }
  if (new Set(Object.values(CODE11)).size !== Object.keys(CODE11).length) {
    problems.push('Code11: duplicate patterns');
  }

  return problems;
}

__exports.EAN_L = EAN_L;
__exports.EAN_G = EAN_G;
__exports.EAN_R = EAN_R;
__exports.EAN13_PARITY = EAN13_PARITY;
__exports.UPCE_PARITY = UPCE_PARITY;
__exports.EAN_START_END = EAN_START_END;
__exports.EAN_MIDDLE = EAN_MIDDLE;
__exports.UPCE_END = UPCE_END;
__exports.CODE39 = CODE39;
__exports.CODE39_CHECK_SET = CODE39_CHECK_SET;
__exports.CODE39_EXTENDED = CODE39_EXTENDED;
__exports.CODE93 = CODE93;
__exports.CODE93_VALUES = CODE93_VALUES;
__exports.CODE93_START_STOP = CODE93_START_STOP;
__exports.CODE128 = CODE128;
__exports.CODE128_START_A = CODE128_START_A;
__exports.CODE128_START_B = CODE128_START_B;
__exports.CODE128_START_C = CODE128_START_C;
__exports.CODE128_STOP = CODE128_STOP;
__exports.CODE128_FNC1 = CODE128_FNC1;
__exports.CODE128_FNC2 = CODE128_FNC2;
__exports.CODE128_FNC3 = CODE128_FNC3;
__exports.CODE128_FNC4_A = CODE128_FNC4_A;
__exports.CODE128_FNC4_B = CODE128_FNC4_B;
__exports.CODE128_SHIFT = CODE128_SHIFT;
__exports.CODE128_CODE_A = CODE128_CODE_A;
__exports.CODE128_CODE_B = CODE128_CODE_B;
__exports.CODE128_CODE_C = CODE128_CODE_C;
__exports.ITF = ITF;
__exports.CODABAR = CODABAR;
__exports.CODABAR_START_STOP = CODABAR_START_STOP;
__exports.CODE11 = CODE11;
__exports.CODE11_START_STOP = CODE11_START_STOP;
__exports.MSI_BIT = MSI_BIT;
__exports.MSI_START = MSI_START;
__exports.MSI_STOP = MSI_STOP;
__exports.validateTables = validateTables;
};

__modules["oned/writers.js"] = function (__require, __exports) {
/**
 * Linear barcode writers.
 *
 * Every writer returns a `BitMatrix` one module tall. Height is a rendering
 * decision, not an encoding one — a linear symbol carries no information
 * vertically, which is exactly why it survives a laser line that crosses it
 * anywhere. The renderers stretch it via the `barHeight` option.
 *
 * @module oned/writers
 */
const { BitMatrix } = __require("core/bit-matrix.js");
const { EncodeError } = __require("core/errors.js");
const { EAN_L, EAN_G, EAN_R, EAN13_PARITY, UPCE_PARITY, EAN_START_END, EAN_MIDDLE, UPCE_END, CODE39, CODE39_CHECK_SET, CODE39_EXTENDED, CODE93, CODE93_VALUES, CODE93_START_STOP, CODE128, CODE128_START_B, CODE128_START_C, CODE128_STOP, CODE128_FNC1, CODE128_CODE_A, CODE128_CODE_B, CODE128_CODE_C, ITF, CODABAR, CODABAR_START_STOP, CODE11, CODE11_START_STOP, MSI_BIT, MSI_START, MSI_STOP } = __require("oned/patterns.js");

/* ------------------------------------------------------------------ *
 * Shared helpers
 * ------------------------------------------------------------------ */

/**
 * Expand an n/w width pattern into a module string, starting with a bar.
 *
 * @param {string} pattern Characters 'n' and 'w'.
 * @param {number} [wide] Modules per wide element.
 * @returns {string} Module string, '1' = dark.
 */
function expandNarrowWide(pattern, wide = 3) {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const width = pattern[i] === 'w' ? wide : 1;
    out += (i % 2 === 0 ? '1' : '0').repeat(width);
  }
  return out;
}

/**
 * Expand a digit-width pattern into a module string, starting with a bar.
 *
 * @param {string} pattern Characters '1'..'4'.
 * @returns {string}
 */
function expandWidths(pattern) {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    out += (i % 2 === 0 ? '1' : '0').repeat(Number(pattern[i]));
  }
  return out;
}

/**
 * @param {string} modules
 * @returns {BitMatrix} One row tall.
 */
function toMatrix(modules) {
  const m = new BitMatrix(modules.length, 1);
  for (let x = 0; x < modules.length; x++) {
    if (modules[x] === '1') m.set(x, 0);
  }
  return m;
}

/**
 * @param {string} value
 * @param {string} format
 */
function requireDigits(value, format) {
  if (!/^[0-9]+$/.test(value)) {
    throw new EncodeError(`${format}: payload must be digits only, got "${value}"`);
  }
}

/**
 * Modulo-10 check digit for the EAN/UPC family.
 *
 * Weights alternate 3 and 1, with the digit immediately left of the check
 * position weighted 3. Anchoring from the right rather than the left makes one
 * routine correct for EAN-8, EAN-13 and UPC-A alike, despite their different
 * payload lengths.
 *
 * @param {string} payload Digits, excluding the check digit.
 * @returns {number}
 */
function ean13CheckDigit(payload) {
  let sum = 0;
  for (let i = 0; i < payload.length; i++) {
    const fromRight = payload.length - 1 - i;
    sum += Number(payload[i]) * (fromRight % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

/* ------------------------------------------------------------------ *
 * EAN / UPC
 * ------------------------------------------------------------------ */

/**
 * EAN-13. Accepts 12 digits (check digit appended) or 13 (verified).
 *
 * @param {string} value
 * @returns {BitMatrix}
 */
function encodeEAN13(value) {
  requireDigits(value, 'EAN-13');
  let digits = value;
  if (digits.length === 12) {
    digits += String(ean13CheckDigit(digits));
  } else if (digits.length === 13) {
    const expected = ean13CheckDigit(digits.slice(0, 12));
    if (Number(digits[12]) !== expected) {
      throw new EncodeError(`EAN-13: check digit is ${digits[12]}, expected ${expected}`);
    }
  } else {
    throw new EncodeError(`EAN-13: needs 12 or 13 digits, got ${digits.length}`);
  }

  const parity = EAN13_PARITY[Number(digits[0])];
  let modules = EAN_START_END;
  for (let i = 0; i < 6; i++) {
    const d = Number(digits[i + 1]);
    modules += parity[i] === 'L' ? EAN_L[d] : EAN_G[d];
  }
  modules += EAN_MIDDLE;
  for (let i = 7; i < 13; i++) modules += EAN_R[Number(digits[i])];
  modules += EAN_START_END;

  return toMatrix(modules);
}

/**
 * EAN-8. Accepts 7 digits (check digit appended) or 8 (verified).
 *
 * @param {string} value
 * @returns {BitMatrix}
 */
function encodeEAN8(value) {
  requireDigits(value, 'EAN-8');
  let digits = value;
  if (digits.length === 7) {
    digits += String(ean13CheckDigit(digits));
  } else if (digits.length === 8) {
    const expected = ean13CheckDigit(digits.slice(0, 7));
    if (Number(digits[7]) !== expected) {
      throw new EncodeError(`EAN-8: check digit is ${digits[7]}, expected ${expected}`);
    }
  } else {
    throw new EncodeError(`EAN-8: needs 7 or 8 digits, got ${digits.length}`);
  }

  let modules = EAN_START_END;
  for (let i = 0; i < 4; i++) modules += EAN_L[Number(digits[i])];
  modules += EAN_MIDDLE;
  for (let i = 4; i < 8; i++) modules += EAN_R[Number(digits[i])];
  modules += EAN_START_END;

  return toMatrix(modules);
}

/**
 * ISBN, as its printed EAN-13 ("Bookland") symbol.
 *
 * ISBN is not a separate symbology — an ISBN barcode *is* an EAN-13 carrying a
 * 978 or 979 prefix. What ISBN adds is its own numbering rules, and those are
 * worth enforcing here: an ISBN-10 uses a modulo-**11** check digit, in which
 * the value ten is written `X`. That is a different calculation from the
 * modulo-10 check the EAN symbol will carry. Passing an ISBN-10 straight
 * through would produce a perfectly scannable symbol encoding the wrong
 * number, so the two checks are kept distinct and the digit is recomputed.
 *
 * Accepts ISBN-10 or ISBN-13, with or without hyphens and spaces.
 *
 * @param {string} value
 * @returns {BitMatrix}
 */
function encodeISBN(value) {
  const cleaned = String(value).replace(/[\s-]/g, '').toUpperCase();

  if (/^[0-9]{9}[0-9X]$/.test(cleaned)) {
    // ISBN-10: verify its modulo-11 check, then convert to the 978 form.
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += Number(cleaned[i]) * (10 - i);
    sum += cleaned[9] === 'X' ? 10 : Number(cleaned[9]);
    if (sum % 11 !== 0) {
      throw new EncodeError(`ISBN-10: check digit "${cleaned[9]}" fails the modulo-11 test`);
    }
    // The check digit does not carry over — encodeEAN13 computes the new one.
    return encodeEAN13('978' + cleaned.slice(0, 9));
  }

  if (/^[0-9]{12,13}$/.test(cleaned)) {
    const prefix = cleaned.slice(0, 3);
    if (prefix !== '978' && prefix !== '979') {
      throw new EncodeError(`ISBN-13 must begin with 978 or 979, got ${prefix}`);
    }
    // encodeEAN13 appends the check digit at 12, or verifies it at 13.
    return encodeEAN13(cleaned);
  }

  throw new EncodeError(
    `ISBN: expected 10 or 13 digits, hyphens optional — got "${value}"`
  );
}

/**
 * UPC-A. Structurally an EAN-13 whose first digit is zero.
 *
 * @param {string} value 11 or 12 digits.
 * @returns {BitMatrix}
 */
function encodeUPCA(value) {
  requireDigits(value, 'UPC-A');
  if (value.length !== 11 && value.length !== 12) {
    throw new EncodeError(`UPC-A: needs 11 or 12 digits, got ${value.length}`);
  }
  return encodeEAN13('0' + value);
}

/**
 * Expand a UPC-E body to the 11 digits preceding the check digit.
 *
 * @param {number} system Number system, 0 or 1.
 * @param {string} body 6 digits.
 * @returns {string} 11 digits.
 */
function upceToUpcaBody(system, body) {
  const d = body;
  const last = Number(d[5]);
  let middle;
  if (last <= 2) {
    middle = d.slice(0, 2) + String(last) + '0000' + d.slice(2, 5);
  } else if (last === 3) {
    middle = d.slice(0, 3) + '00000' + d.slice(3, 5);
  } else if (last === 4) {
    middle = d.slice(0, 4) + '00000' + d[4];
  } else {
    middle = d.slice(0, 5) + '0000' + String(last);
  }
  return String(system) + middle;
}

/**
 * UPC-E, the zero-suppressed form of UPC-A.
 *
 * @param {string} value 6 digits (system 0 assumed), 7 (system + body), or 8 (with check).
 * @returns {BitMatrix}
 */
function encodeUPCE(value) {
  requireDigits(value, 'UPC-E');

  let system, body, check;
  if (value.length === 6) {
    system = 0;
    body = value;
    check = ean13CheckDigit(upceToUpcaBody(0, body));
  } else if (value.length === 7) {
    system = Number(value[0]);
    body = value.slice(1);
    check = ean13CheckDigit(upceToUpcaBody(system, body));
  } else if (value.length === 8) {
    system = Number(value[0]);
    body = value.slice(1, 7);
    check = Number(value[7]);
  } else {
    throw new EncodeError(`UPC-E: needs 6, 7 or 8 digits, got ${value.length}`);
  }

  if (system !== 0 && system !== 1) {
    throw new EncodeError(`UPC-E: number system must be 0 or 1, got ${system}`);
  }

  const parity = UPCE_PARITY[check];
  let modules = EAN_START_END;
  for (let i = 0; i < 6; i++) {
    const d = Number(body[i]);
    // Number system 1 inverts the entire parity pattern relative to system 0.
    const even = system === 0 ? parity[i] === 'E' : parity[i] === 'O';
    modules += even ? EAN_G[d] : EAN_L[d];
  }
  modules += UPCE_END;

  return toMatrix(modules);
}

/* ------------------------------------------------------------------ *
 * Code 39
 * ------------------------------------------------------------------ */

/**
 * Code 39.
 *
 * @param {string} value
 * @param {object} [options]
 * @param {boolean} [options.checkDigit] Append the modulo-43 check character.
 * @param {boolean} [options.fullAscii] Escape characters outside the native set.
 * @param {number} [options.wideRatio] Wide-to-narrow ratio, 2 or 3.
 * @returns {BitMatrix}
 */
function encodeCode39(value, options = {}) {
  const { checkDigit = false, fullAscii = false, wideRatio = 3 } = options;
  if (wideRatio < 2 || wideRatio > 3) {
    throw new EncodeError(`Code 39: wide ratio must be 2 or 3, got ${wideRatio}`);
  }

  let text = value;
  if (fullAscii) {
    text = '';
    for (const ch of value) {
      const code = ch.charCodeAt(0);
      if (code > 127) throw new EncodeError(`Code 39: '${ch}' is outside ASCII`);
      text += CODE39_EXTENDED[code];
    }
  }

  for (const ch of text) {
    if (ch === '*') {
      throw new EncodeError("Code 39: '*' is reserved as the start/stop character");
    }
    if (!CODE39[ch]) {
      throw new EncodeError(
        `Code 39: character '${ch}' is not encodable` +
        (fullAscii ? '' : ' — try the fullAscii option')
      );
    }
  }

  let payload = text;
  if (checkDigit) {
    let sum = 0;
    for (const ch of text) sum += CODE39_CHECK_SET.indexOf(ch);
    payload += CODE39_CHECK_SET[sum % 43];
  }

  // Characters are separated by a narrow inter-character gap.
  const parts = ['*', ...payload, '*'].map((ch) => expandNarrowWide(CODE39[ch], wideRatio));
  return toMatrix(parts.join('0'));
}

/* ------------------------------------------------------------------ *
 * Code 93
 * ------------------------------------------------------------------ */

/**
 * Code 93, always with its two mandatory check characters.
 *
 * @param {string} value
 * @returns {BitMatrix}
 */
function encodeCode93(value) {
  const values = [];
  for (const ch of value) {
    const idx = CODE93_VALUES.indexOf(ch);
    if (idx < 0) throw new EncodeError(`Code 93: character '${ch}' is not encodable`);
    values.push(idx);
  }

  // Check character C weights the payload 1..20 from the right; K then repeats
  // the exercise over the payload plus C, weighted 1..15.
  const weighted = (data, maxWeight) => {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const weight = ((data.length - 1 - i) % maxWeight) + 1;
      sum += weight * data[i];
    }
    return sum % 47;
  };

  values.push(weighted(values, 20));
  values.push(weighted(values, 15));

  let modules = expandWidths(CODE93_START_STOP);
  for (const v of values) modules += expandWidths(CODE93[CODE93_VALUES[v]]);
  modules += expandWidths(CODE93_START_STOP);
  modules += '1'; // termination bar

  return toMatrix(modules);
}

/* ------------------------------------------------------------------ *
 * Code 128
 * ------------------------------------------------------------------ */

/** Set B maps printable ASCII starting at space to symbol value 0. */
const CODE128_B_OFFSET = 32;

/**
 * Code 128, with automatic code-set selection.
 *
 * The heuristic: switch into set C when enough consecutive digits are present
 * to repay the switch symbol — four at the start or end of the payload, six in
 * the middle, since C packs two digits per symbol. An encoder that never
 * switches produces a valid but needlessly wide symbol.
 *
 * @param {string} value
 * @param {object} [options]
 * @param {boolean} [options.gs1] Emit a leading FNC1, making this GS1-128.
 * @returns {BitMatrix}
 */
function encodeCode128(value, options = {}) {
  const { gs1 = false } = options;
  for (const ch of value) {
    if (ch.charCodeAt(0) > 127) {
      throw new EncodeError(`Code 128: '${ch}' is outside ASCII`);
    }
  }

  /** Length of the digit run starting at i. */
  const digitRun = (i) => {
    let n = 0;
    while (i + n < value.length && value[i + n] >= '0' && value[i + n] <= '9') n++;
    return n;
  };

  const codes = [];
  let mode;
  let i = 0;

  const startRun = digitRun(0);
  if (startRun >= 4 && startRun % 2 === 0) {
    codes.push(CODE128_START_C);
    mode = 'C';
  } else {
    codes.push(CODE128_START_B);
    mode = 'B';
  }
  if (gs1) codes.push(CODE128_FNC1);

  while (i < value.length) {
    const run = digitRun(i);
    const atEnd = i + run === value.length;
    const worthC = run >= 6 || (i === 0 && run >= 4) || (atEnd && run >= 4);

    if (mode !== 'C' && worthC && run >= 2) {
      codes.push(CODE128_CODE_C);
      mode = 'C';
      continue;
    }

    if (mode === 'C') {
      if (run >= 2) {
        codes.push(Number(value.substr(i, 2)));
        i += 2;
        continue;
      }
      codes.push(CODE128_CODE_B);
      mode = 'B';
      continue;
    }

    const code = value.charCodeAt(i);
    if (code < 32) {
      // Control characters live in set A only.
      if (mode !== 'A') {
        codes.push(CODE128_CODE_A);
        mode = 'A';
        continue;
      }
      codes.push(code + 64);
    } else {
      if (mode === 'A' && code >= 96) {
        codes.push(CODE128_CODE_B);
        mode = 'B';
        continue;
      }
      codes.push(code - CODE128_B_OFFSET);
    }
    i++;
  }

  // Checksum: the start value plus each symbol weighted by its position.
  let sum = codes[0];
  for (let k = 1; k < codes.length; k++) sum += codes[k] * k;
  codes.push(sum % 103);
  codes.push(CODE128_STOP);

  let modules = '';
  for (const c of codes) modules += expandWidths(CODE128[c]);

  return toMatrix(modules);
}

/* ------------------------------------------------------------------ *
 * Interleaved 2 of 5
 * ------------------------------------------------------------------ */

/**
 * Interleaved 2 of 5.
 *
 * Digits are encoded in pairs: the first supplies the bars, the second the
 * spaces between them. That interleaving is where the density comes from, and
 * why the payload length must be even.
 *
 * @param {string} value
 * @param {object} [options]
 * @param {boolean} [options.checkDigit] Append a modulo-10 check digit.
 * @param {number} [options.wideRatio]
 * @returns {BitMatrix}
 */
function encodeITF(value, options = {}) {
  const { checkDigit = false, wideRatio = 3 } = options;
  requireDigits(value, 'ITF');

  let digits = value;
  if (checkDigit) digits += String(ean13CheckDigit(digits));
  // A leading zero pads to an even length without changing the value.
  if (digits.length % 2 !== 0) digits = '0' + digits;

  let modules = '1010'; // start: four narrow elements

  for (let i = 0; i < digits.length; i += 2) {
    const bars = ITF[Number(digits[i])];
    const spaces = ITF[Number(digits[i + 1])];
    for (let k = 0; k < 5; k++) {
      modules += '1'.repeat(bars[k] === 'w' ? wideRatio : 1);
      modules += '0'.repeat(spaces[k] === 'w' ? wideRatio : 1);
    }
  }

  // Stop: wide bar, narrow space, narrow bar.
  modules += '1'.repeat(wideRatio) + '0' + '1';
  return toMatrix(modules);
}

/**
 * ITF-14, the shipping-container form: exactly 14 digits.
 *
 * @param {string} value 13 or 14 digits.
 * @returns {BitMatrix}
 */
function encodeITF14(value) {
  requireDigits(value, 'ITF-14');
  let digits = value;
  if (digits.length === 13) {
    digits += String(ean13CheckDigit(digits));
  } else if (digits.length !== 14) {
    throw new EncodeError(`ITF-14: needs 13 or 14 digits, got ${digits.length}`);
  }
  return encodeITF(digits);
}

/* ------------------------------------------------------------------ *
 * Codabar
 * ------------------------------------------------------------------ */

/**
 * Codabar.
 *
 * @param {string} value Optionally already wrapped in start/stop characters A-D.
 * @param {object} [options]
 * @param {string} [options.start] One of A, B, C, D.
 * @param {string} [options.stop]
 * @param {number} [options.wideRatio]
 * @returns {BitMatrix}
 */
function encodeCodabar(value, options = {}) {
  const { wideRatio = 3 } = options;
  let text = value.toUpperCase();
  let start = (options.start || '').toUpperCase();
  let stop = (options.stop || '').toUpperCase();

  // Accept the common convention of embedding the guards in the payload.
  if (!start && text.length >= 2 &&
      CODABAR_START_STOP.includes(text[0]) &&
      CODABAR_START_STOP.includes(text[text.length - 1])) {
    start = text[0];
    stop = text[text.length - 1];
    text = text.slice(1, -1);
  }
  if (!start) start = 'A';
  if (!stop) stop = 'A';

  if (!CODABAR_START_STOP.includes(start) || !CODABAR_START_STOP.includes(stop)) {
    throw new EncodeError('Codabar: start and stop characters must be A, B, C or D');
  }
  for (const ch of text) {
    if (!CODABAR[ch] || CODABAR_START_STOP.includes(ch)) {
      throw new EncodeError(`Codabar: character '${ch}' is not encodable in the payload`);
    }
  }

  const parts = [start, ...text, stop].map((ch) => expandNarrowWide(CODABAR[ch], wideRatio));
  return toMatrix(parts.join('0'));
}

/* ------------------------------------------------------------------ *
 * Code 11
 * ------------------------------------------------------------------ */

/** Code 11 character values, in order. */
const CODE11_CHARSET = '0123456789-';

/**
 * Code 11, digits and hyphen.
 *
 * @param {string} value
 * @param {object} [options]
 * @param {boolean} [options.checkDigit] Append check character C, plus K when long.
 * @param {number} [options.wideRatio]
 * @returns {BitMatrix}
 */
function encodeCode11(value, options = {}) {
  const { checkDigit = true, wideRatio = 3 } = options;

  for (const ch of value) {
    if (!CODE11_CHARSET.includes(ch)) {
      throw new EncodeError(`Code 11: character '${ch}' is not encodable`);
    }
  }

  let payload = value;
  if (checkDigit) {
    const weighted = (text, maxWeight) => {
      let sum = 0;
      for (let i = 0; i < text.length; i++) {
        const weight = ((text.length - 1 - i) % maxWeight) + 1;
        sum += weight * CODE11_CHARSET.indexOf(text[i]);
      }
      return sum;
    };
    payload += CODE11_CHARSET[weighted(payload, 10) % 11];
    // The second check character is conventionally added only to longer payloads.
    if (value.length >= 10) payload += CODE11_CHARSET[weighted(payload, 9) % 11];
  }

  const parts = [
    expandNarrowWide(CODE11_START_STOP, wideRatio),
    ...[...payload].map((ch) => expandNarrowWide(CODE11[ch], wideRatio)),
    expandNarrowWide(CODE11_START_STOP, wideRatio),
  ];
  return toMatrix(parts.join('0'));
}

/* ------------------------------------------------------------------ *
 * MSI / Plessey
 * ------------------------------------------------------------------ */

/**
 * MSI Plessey.
 *
 * @param {string} value Digits.
 * @param {object} [options]
 * @param {boolean} [options.checkDigit] Append the Luhn modulo-10 check digit.
 * @returns {BitMatrix}
 */
function encodeMSI(value, options = {}) {
  const { checkDigit = false } = options;
  requireDigits(value, 'MSI');

  let digits = value;
  if (checkDigit) {
    // Luhn: the odd-positioned digits, read as one number, are doubled.
    let odd = '';
    for (let i = digits.length - 1; i >= 0; i -= 2) odd = digits[i] + odd;
    const doubled = String(Number(odd) * 2);
    let sum = 0;
    for (const ch of doubled) sum += Number(ch);
    for (let i = digits.length - 2; i >= 0; i -= 2) sum += Number(digits[i]);
    digits += String((10 - (sum % 10)) % 10);
  }

  let modules = MSI_START;
  for (const ch of digits) {
    const bits = Number(ch).toString(2).padStart(4, '0');
    for (const b of bits) modules += MSI_BIT[b];
  }
  modules += MSI_STOP;

  return toMatrix(modules);
}

/* ------------------------------------------------------------------ *
 * Pharmacode
 * ------------------------------------------------------------------ */

/**
 * Pharmacode, one-track.
 *
 * Unusual among linear symbologies: it encodes an integer directly in a
 * bijective base-2 representation rather than digit by digit, and carries no
 * check digit at all — its only redundancy is the narrow legal value range.
 *
 * @param {number | string} value 3 to 131070.
 * @returns {BitMatrix}
 */
function encodePharmacode(value) {
  let n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isInteger(n) || n < 3 || n > 131070) {
    throw new EncodeError(`Pharmacode: value must be an integer in 3..131070, got ${value}`);
  }

  const bars = [];
  while (n > 0) {
    if (n % 2 === 0) {
      bars.push('111'); // wide
      n = n / 2 - 1;
    } else {
      bars.push('1');   // narrow
      n = (n - 1) / 2;
    }
  }
  bars.reverse();

  return toMatrix(bars.join('0'));
}

__exports.ean13CheckDigit = ean13CheckDigit;
__exports.encodeEAN13 = encodeEAN13;
__exports.encodeEAN8 = encodeEAN8;
__exports.encodeISBN = encodeISBN;
__exports.encodeUPCA = encodeUPCA;
__exports.upceToUpcaBody = upceToUpcaBody;
__exports.encodeUPCE = encodeUPCE;
__exports.encodeCode39 = encodeCode39;
__exports.encodeCode93 = encodeCode93;
__exports.encodeCode128 = encodeCode128;
__exports.encodeITF = encodeITF;
__exports.encodeITF14 = encodeITF14;
__exports.encodeCodabar = encodeCodabar;
__exports.encodeCode11 = encodeCode11;
__exports.encodeMSI = encodeMSI;
__exports.encodePharmacode = encodePharmacode;
};

__modules["oned/reader.js"] = function (__require, __exports) {
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
const { NotFoundError } = __require("core/errors.js");
const { EAN_L, EAN_G, EAN_R, EAN13_PARITY, UPCE_PARITY, CODE39, CODE39_CHECK_SET, CODE93, CODE93_VALUES, CODE128, CODE128_START_A, CODE128_START_B, CODE128_START_C, CODE128_STOP, CODE128_FNC1, CODE128_CODE_A, CODE128_CODE_B, CODE128_CODE_C, CODE128_SHIFT, ITF, CODABAR, CODABAR_START_STOP } = __require("oned/patterns.js");
const { ean13CheckDigit, upceToUpcaBody } = __require("oned/writers.js");

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
function patternVariance(counters, pattern, maxIndividual) {
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
function recordPattern(row, start, counters) {
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
function toNarrowWidePattern(counters, expectedWide) {
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
function decodeOneD(image, options = {}) {
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
function decodeOneDStrict(image, options) {
  const results = decodeOneD(image, options);
  if (results.length === 0) throw new NotFoundError('No linear barcode found');
  return results[0];
}

__exports.patternVariance = patternVariance;
__exports.recordPattern = recordPattern;
__exports.toNarrowWidePattern = toNarrowWidePattern;
__exports.decodeOneD = decodeOneD;
__exports.decodeOneDStrict = decodeOneDStrict;
};

__modules["oned/index.js"] = function (__require, __exports) {
/**
 * Linear symbologies.
 *
 * @module oned
 */const __reexport0 = __require("oned/writers.js"); __exports.encodeEAN13 = __reexport0.encodeEAN13; __exports.encodeEAN8 = __reexport0.encodeEAN8; __exports.encodeUPCA = __reexport0.encodeUPCA; __exports.encodeUPCE = __reexport0.encodeUPCE; __exports.encodeISBN = __reexport0.encodeISBN; __exports.encodeCode39 = __reexport0.encodeCode39; __exports.encodeCode93 = __reexport0.encodeCode93; __exports.encodeCode128 = __reexport0.encodeCode128; __exports.encodeITF = __reexport0.encodeITF; __exports.encodeITF14 = __reexport0.encodeITF14; __exports.encodeCodabar = __reexport0.encodeCodabar; __exports.encodeCode11 = __reexport0.encodeCode11; __exports.encodeMSI = __reexport0.encodeMSI; __exports.encodePharmacode = __reexport0.encodePharmacode; __exports.ean13CheckDigit = __reexport0.ean13CheckDigit;const __reexport1 = __require("oned/reader.js"); __exports.decodeOneD = __reexport1.decodeOneD; __exports.decodeOneDStrict = __reexport1.decodeOneDStrict; __exports.patternVariance = __reexport1.patternVariance; __exports.recordPattern = __reexport1.recordPattern; __exports.toNarrowWidePattern = __reexport1.toNarrowWidePattern;const __reexport2 = __require("oned/patterns.js"); __exports.validateTables = __reexport2.validateTables;const { encodeEAN13, encodeEAN8, encodeUPCA, encodeUPCE, encodeISBN, encodeCode39, encodeCode93, encodeCode128, encodeITF, encodeITF14, encodeCodabar, encodeCode11, encodeMSI, encodePharmacode } = __require("oned/writers.js");

/**
 * Writers by format id, for the top-level `encode()` dispatcher.
 *
 * `readable` marks the formats this suite can also decode. Writing is a table
 * lookup and easy to support broadly; reading needs a detector per symbology,
 * so the two lists legitimately differ and the API says so rather than
 * failing at runtime.
 *
 * @type {Record<string, {encode: Function, readable: boolean, label: string}>}
 */const ONED_FORMATS = {
  ean13: { encode: encodeEAN13, readable: true, label: 'EAN-13' },
  ean8: { encode: encodeEAN8, readable: true, label: 'EAN-8' },
  upca: { encode: encodeUPCA, readable: true, label: 'UPC-A' },
  isbn: { encode: encodeISBN, readable: true, label: 'ISBN (Bookland EAN-13)' },
  upce: { encode: encodeUPCE, readable: true, label: 'UPC-E' },
  code128: { encode: encodeCode128, readable: true, label: 'Code 128' },
  gs1128: {
    encode: (v, o) => encodeCode128(v, { ...o, gs1: true }),
    readable: true,
    label: 'GS1-128',
  },
  code39: { encode: encodeCode39, readable: true, label: 'Code 39' },
  code93: { encode: encodeCode93, readable: true, label: 'Code 93' },
  itf: { encode: encodeITF, readable: true, label: 'ITF (Interleaved 2 of 5)' },
  itf14: { encode: encodeITF14, readable: true, label: 'ITF-14' },
  codabar: { encode: encodeCodabar, readable: true, label: 'Codabar' },
  code11: { encode: encodeCode11, readable: false, label: 'Code 11' },
  msi: { encode: encodeMSI, readable: false, label: 'MSI Plessey' },
  pharmacode: { encode: encodePharmacode, readable: false, label: 'Pharmacode' },
};

__exports.ONED_FORMATS = ONED_FORMATS;
};

__modules["core/galois-field.js"] = function (__require, __exports) {
/**
 * Finite field arithmetic.
 *
 * One class serves every field this suite needs:
 *
 *   GF(2^4)   Aztec, small layer counts
 *   GF(2^6)   Aztec
 *   GF(2^8)   QR Code, Data Matrix, Aztec
 *   GF(2^10)  Aztec
 *   GF(2^12)  Aztec
 *   GF(929)   PDF417  <- a PRIME field, not a binary one
 *
 * ## The prime-field trap
 *
 * Multiplication unifies cleanly: exp/log tables work for the multiplicative
 * group of any finite field. Addition does NOT.
 *
 *   binary GF(2^m):  a + b  ==  a - b  ==  a XOR b      (self-inverse)
 *   prime  GF(p):    a + b  ==  (a+b) % p
 *                    a - b  ==  (a-b+p) % p             (NOT self-inverse)
 *
 * So `add`, `sub` and `neg` are methods on the field, never inlined. Any code
 * that writes a bare `^` for field arithmetic works perfectly for every binary
 * field and silently corrupts PDF417 — the failure is invisible until a real
 * scanner rejects the symbol. Route every operation through the field object.
 *
 * @module core/galois-field
 */
class GaloisField {
  /**
   * @param {object} opts
   * @param {number} opts.size      Field order: 2^m for binary, p for prime.
   * @param {boolean} [opts.prime]  True for a prime field (mod arithmetic).
   * @param {number} [opts.primitive] Primitive polynomial, binary fields only.
   * @param {number} [opts.generator] Multiplicative generator. Defaults to 2
   *   for binary fields (x), and must be given explicitly for prime fields.
   * @param {string} [opts.name]
   */
  constructor({ size, prime = false, primitive = 0, generator = 2, name = '' }) {
    this.size = size;
    this.prime = prime;
    this.primitive = primitive;
    this.generator = generator;
    this.name = name || (prime ? `GF(${size})` : `GF(2^${Math.log2(size)})`);

    /** Multiplicative order: every non-zero element is generator^i for some i < order. */
    this.order = size - 1;

    const exp = new Int32Array(this.order * 2);
    const log = new Int32Array(size).fill(-1);

    let x = 1;
    for (let i = 0; i < this.order; i++) {
      exp[i] = x;
      log[x] = i;
      if (prime) {
        x = (x * generator) % size;
      } else {
        x <<= 1;
        if (x >= size) x ^= primitive;
      }
    }
    // Wrapped copy lets mul() skip a modulo on the common path.
    for (let i = 0; i < this.order; i++) exp[this.order + i] = exp[i];

    // A short cycle still returns to 1 after `order` steps whenever its length
    // divides `order`, so "did we end at 1" does not detect a bad generator.
    // The reliable test is coverage: a true generator visits every non-zero
    // element exactly once, leaving no -1 in the log table.
    for (let v = 1; v < size; v++) {
      if (log[v] === -1) {
        throw new Error(
          `${this.name}: generator ${generator} does not generate the ` +
          `multiplicative group (element ${v} is unreachable). ` +
          (prime ? 'Choose a primitive root.' : 'Check the primitive polynomial.')
        );
      }
    }

    this.expTable = exp;
    this.logTable = log;
  }

  /** Additive identity is 0 and multiplicative identity is 1 in every field here. */
  get zero() { return 0; }
  get one() { return 1; }

  /**
   * a + b.
   * @param {number} a @param {number} b @returns {number}
   */
  add(a, b) {
    return this.prime ? (a + b) % this.size : a ^ b;
  }

  /**
   * a - b. Distinct from add() in prime fields — see the module note.
   * @param {number} a @param {number} b @returns {number}
   */
  sub(a, b) {
    return this.prime ? (a - b + this.size) % this.size : a ^ b;
  }

  /**
   * -a.
   * @param {number} a @returns {number}
   */
  neg(a) {
    return this.prime ? (this.size - a) % this.size : a;
  }

  /**
   * a * b.
   * @param {number} a @param {number} b @returns {number}
   */
  mul(a, b) {
    if (a === 0 || b === 0) return 0;
    return this.expTable[this.logTable[a] + this.logTable[b]];
  }

  /**
   * a / b.
   * @param {number} a @param {number} b @returns {number}
   */
  div(a, b) {
    if (b === 0) throw new Error(`${this.name}: division by zero`);
    if (a === 0) return 0;
    return this.expTable[this.logTable[a] - this.logTable[b] + this.order];
  }

  /**
   * 1 / a.
   * @param {number} a @returns {number}
   */
  inv(a) {
    if (a === 0) throw new Error(`${this.name}: zero has no inverse`);
    return this.expTable[this.order - this.logTable[a]];
  }

  /**
   * generator^i, for any integer i (negative included).
   * @param {number} i @returns {number}
   */
  exp(i) {
    let k = i % this.order;
    if (k < 0) k += this.order;
    return this.expTable[k];
  }

  /**
   * Discrete log base generator.
   * @param {number} a @returns {number}
   */
  log(a) {
    if (a === 0) throw new Error(`${this.name}: log of zero`);
    return this.logTable[a];
  }
}

/** QR Code, Data Matrix uses its own — see below. x^8 + x^4 + x^3 + x^2 + 1 */
const GF256_QR = new GaloisField({ size: 256, primitive: 0x011d, name: 'GF(256)/QR' });

/** Data Matrix ECC200. x^8 + x^5 + x^3 + x^2 + 1 */
const GF256_DM = new GaloisField({ size: 256, primitive: 0x012d, name: 'GF(256)/DataMatrix' });

/** PDF417. Prime field; 3 is a primitive root modulo 929. */
const GF929 = new GaloisField({ size: 929, prime: true, generator: 3, name: 'GF(929)' });

/** Aztec, by layer count. */
const GF16 = new GaloisField({ size: 16, primitive: 0x13, name: 'GF(16)' });
const GF64 = new GaloisField({ size: 64, primitive: 0x43, name: 'GF(64)' });
const GF1024 = new GaloisField({ size: 1024, primitive: 0x409, name: 'GF(1024)' });
const GF4096 = new GaloisField({ size: 4096, primitive: 0x1069, name: 'GF(4096)' });

__exports.GaloisField = GaloisField;
__exports.GF256_QR = GF256_QR;
__exports.GF256_DM = GF256_DM;
__exports.GF929 = GF929;
__exports.GF16 = GF16;
__exports.GF64 = GF64;
__exports.GF1024 = GF1024;
__exports.GF4096 = GF4096;
};

__modules["core/reed-solomon.js"] = function (__require, __exports) {
/**
 * Reed-Solomon encoding and decoding over an arbitrary finite field.
 *
 * Systematic encoding: the output is the message followed by parity symbols,
 * so the data is readable without decoding when the symbol is undamaged.
 *
 * Decoding is syndromes -> Berlekamp-Massey -> Chien search -> Forney.
 * It corrects up to floor(eccLen / 2) symbol errors at unknown positions.
 *
 * Every arithmetic operation routes through the field object. There is
 * deliberately not a single bare `^` in this file: XOR is correct for binary
 * fields and wrong for GF(929), and the resulting bug is invisible to any test
 * that only exercises QR or Data Matrix. See core/galois-field.js.
 *
 * Polynomial convention in this module: **coefficient index 0 is the highest
 * degree**, matching the wire order of a codeword. The decoder converts to
 * degree-ascending internally where the algorithms are stated that way.
 *
 * @module core/reed-solomon
 */
const { ChecksumError } = __require("core/errors.js");

/**
 * Build the generator polynomial for `eccLen` parity symbols.
 *
 *   g(x) = product over i of (x - a^(base + i)),  i = 0 .. eccLen-1
 *
 * `base` is 0 for QR and Aztec; 1 for Data Matrix and PDF417.
 *
 * @param {number} eccLen
 * @param {import('./galois-field.js').GaloisField} field
 * @param {number} [base]
 * @returns {number[]} Monic, degree-descending, length eccLen + 1.
 */
function generatorPoly(eccLen, field, base = 0) {
  let g = [1];
  for (let i = 0; i < eccLen; i++) {
    const root = field.exp(base + i);
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      // g[j]*x lands at next[j]; g[j]*(-root) lands at next[j+1].
      next[j] = field.add(next[j], g[j]);
      next[j + 1] = field.sub(next[j + 1], field.mul(g[j], root));
    }
    g = next;
  }
  return g;
}

const generatorCache = new Map();

/**
 * Cached {@link generatorPoly}. Encoding the same format repeatedly is the
 * common case and rebuilding the polynomial each time is pure waste.
 *
 * @param {number} eccLen
 * @param {import('./galois-field.js').GaloisField} field
 * @param {number} [base]
 * @returns {number[]}
 */
function cachedGenerator(eccLen, field, base) {
  const key = `${field.name}|${eccLen}|${base}`;
  let g = generatorCache.get(key);
  if (!g) {
    g = generatorPoly(eccLen, field, base);
    generatorCache.set(key, g);
  }
  return g;
}

/**
 * Compute `eccLen` parity symbols for `data`.
 *
 * @param {ArrayLike<number>} data
 * @param {number} eccLen
 * @param {import('./galois-field.js').GaloisField} field
 * @param {number} [base]
 * @returns {number[]} The parity symbols alone, length eccLen.
 */
function rsEncode(data, eccLen, field, base = 0) {
  if (eccLen <= 0) return [];
  const gen = cachedGenerator(eccLen, field, base);
  const res = new Array(data.length + eccLen).fill(0);
  for (let i = 0; i < data.length; i++) res[i] = data[i];

  // Synthetic division by a monic divisor: the leading coefficient is
  // annihilated each step and its multiple subtracted from the tail.
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef === 0) continue;
    for (let j = 1; j <= eccLen; j++) {
      res[i + j] = field.sub(res[i + j], field.mul(gen[j], coef));
    }
  }

  const remainder = res.slice(data.length);

  // The codeword is data(x)*x^eccLen MINUS the remainder, so the parity
  // symbols are the negated remainder. In a binary field negation is the
  // identity and this is invisible; in GF(929) omitting it produces a
  // codeword that is not divisible by the generator, and every symbol fails
  // to decode. Exactly the class of bug the field abstraction exists to stop.
  if (field.prime) {
    for (let i = 0; i < remainder.length; i++) remainder[i] = field.neg(remainder[i]);
  }
  return remainder;
}

/**
 * Evaluate a degree-descending polynomial at x (Horner).
 *
 * @param {ArrayLike<number>} poly
 * @param {number} x
 * @param {import('./galois-field.js').GaloisField} field
 * @returns {number}
 */
function evalPoly(poly, x, field) {
  let acc = 0;
  for (let i = 0; i < poly.length; i++) {
    acc = field.add(field.mul(acc, x), poly[i]);
  }
  return acc;
}

/**
 * Correct errors in a received codeword, in place.
 *
 * @param {number[]} received Data followed by parity, degree-descending.
 * @param {number} eccLen
 * @param {import('./galois-field.js').GaloisField} field
 * @param {number} [base]
 * @returns {number} Number of symbols corrected.
 * @throws {ChecksumError} If the damage exceeds the correction capacity.
 */
function rsDecode(received, eccLen, field, base = 0) {
  const n = received.length;

  // --- Syndromes. S[i] = R(a^(base+i)); all zero means an intact codeword.
  const syn = new Array(eccLen).fill(0);
  let damaged = false;
  for (let i = 0; i < eccLen; i++) {
    const s = evalPoly(received, field.exp(base + i), field);
    syn[i] = s;
    if (s !== 0) damaged = true;
  }
  if (!damaged) return 0;

  // --- Berlekamp-Massey. Degree-ascending here: lambda[k] is the coefficient
  // of x^k, which is how the recurrence is naturally stated.
  const lambda = new Array(eccLen + 1).fill(0);
  const prev = new Array(eccLen + 1).fill(0);
  const tmp = new Array(eccLen + 1).fill(0);
  lambda[0] = 1;
  prev[0] = 1;
  let errCount = 0;   // current LFSR length
  let shift = 1;      // steps since `prev` was last updated
  let lastDisc = 1;   // discrepancy at that update

  for (let step = 0; step < eccLen; step++) {
    let disc = syn[step];
    for (let i = 1; i <= errCount; i++) {
      disc = field.add(disc, field.mul(lambda[i], syn[step - i]));
    }

    if (disc === 0) {
      shift++;
      continue;
    }

    const scale = field.div(disc, lastDisc);
    tmp.fill(0);
    for (let i = 0; i <= eccLen; i++) tmp[i] = lambda[i];

    for (let i = 0; i + shift <= eccLen; i++) {
      if (prev[i] === 0) continue;
      lambda[i + shift] = field.sub(lambda[i + shift], field.mul(scale, prev[i]));
    }

    if (2 * errCount <= step) {
      errCount = step + 1 - errCount;
      for (let i = 0; i <= eccLen; i++) prev[i] = tmp[i];
      lastDisc = disc;
      shift = 1;
    } else {
      shift++;
    }
  }

  if (errCount === 0 || errCount > eccLen / 2) {
    throw new ChecksumError(
      `Reed-Solomon: ${errCount} errors exceeds correction capacity ` +
      `${Math.floor(eccLen / 2)} (${field.name})`
    );
  }

  // --- Chien search. Position p (counted from the low-order end) is in error
  // when lambda(a^-p) == 0.
  const positions = [];
  for (let p = 0; p < n; p++) {
    const xInv = field.exp(-p);
    let acc = 0;
    let term = 1;
    for (let i = 0; i <= errCount; i++) {
      acc = field.add(acc, field.mul(lambda[i], term));
      term = field.mul(term, xInv);
    }
    if (acc === 0) positions.push(p);
  }

  if (positions.length !== errCount) {
    throw new ChecksumError(
      `Reed-Solomon: located ${positions.length} of ${errCount} error positions`
    );
  }

  // --- Error evaluator. omega(x) = [S(x) * lambda(x)] mod x^eccLen,
  // with S degree-ascending.
  const omega = new Array(eccLen).fill(0);
  for (let i = 0; i < eccLen; i++) {
    let acc = 0;
    for (let j = 0; j <= i && j <= errCount; j++) {
      acc = field.add(acc, field.mul(lambda[j], syn[i - j]));
    }
    omega[i] = acc;
  }

  // --- Forney. For an error at position p, with X = a^p:
  //   magnitude = -X^(1-base) * omega(X^-1) / lambda'(X^-1)
  // The sign is a no-op in binary fields and load-bearing in GF(929).
  let corrected = 0;
  for (const p of positions) {
    const xInv = field.exp(-p);

    let num = 0;
    let term = 1;
    for (let i = 0; i < eccLen; i++) {
      num = field.add(num, field.mul(omega[i], term));
      term = field.mul(term, xInv);
    }

    // Formal derivative: only odd-index terms survive in a binary field, but
    // in a prime field every term contributes with an integer multiplier.
    let den = 0;
    term = 1;
    for (let i = 1; i <= errCount; i++) {
      if (field.prime) {
        // i * lambda[i] * x^(i-1), where `i` is repeated addition.
        let mult = 0;
        const t = field.mul(lambda[i], term);
        for (let k = 0; k < i; k++) mult = field.add(mult, t);
        den = field.add(den, mult);
      } else if (i % 2 === 1) {
        den = field.add(den, field.mul(lambda[i], term));
      }
      term = field.mul(term, xInv);
    }

    if (den === 0) {
      throw new ChecksumError('Reed-Solomon: singular error locator derivative');
    }

    let magnitude = field.div(num, den);
    // X^(1-base): one factor of X when base is 0, none when base is 1.
    if (base === 0) magnitude = field.mul(magnitude, field.exp(p));
    else if (base !== 1) magnitude = field.mul(magnitude, field.exp(p * (1 - base)));
    magnitude = field.neg(magnitude);

    const idx = n - 1 - p;
    received[idx] = field.sub(received[idx], magnitude);
    corrected++;
  }

  // Verify: a genuine correction zeroes every syndrome. Without this check,
  // damage beyond capacity can produce a plausible-looking wrong answer.
  for (let i = 0; i < eccLen; i++) {
    if (evalPoly(received, field.exp(base + i), field) !== 0) {
      throw new ChecksumError('Reed-Solomon: correction failed verification');
    }
  }

  return corrected;
}

__exports.generatorPoly = generatorPoly;
__exports.rsEncode = rsEncode;
__exports.rsDecode = rsDecode;
};

__modules["datamatrix/tables.js"] = function (__require, __exports) {
/**
 * Data Matrix ECC 200 symbol parameters.
 *
 * Width and height include finder borders. `regionWidth` and `regionHeight`
 * describe the usable modules inside one data region. The last three columns
 * make the Reed-Solomon block split explicit instead of hiding the 144x144
 * exception in encoder control flow.
 *
 * @module datamatrix/tables
 */

function symbol(width, height, dataRegionWidth, dataRegionHeight, dataCodewords, errorCodewords, dataBlockLengths) {
  const blockCount = dataBlockLengths.length;
  return Object.freeze({
    width, height, rows: height, columns: width,
    // Region dimensions include their one-module finder border on each side;
    // dataRegion* expose the inner placement lattice explicitly.
    regionWidth: dataRegionWidth + 2, regionHeight: dataRegionHeight + 2,
    dataRegionWidth, dataRegionHeight,
    dataRegionRows: dataRegionHeight, dataRegionColumns: dataRegionWidth,
    dataCodewords, errorCodewords, blockCount,
    eccPerBlock: errorCodewords / blockCount,
    dataBlockLengths: Object.freeze(dataBlockLengths),
  });
}

/** Classic ISO/IEC 16022 ECC 200 symbols; DMRE is deliberately excluded. */
const DATAMATRIX_SYMBOLS = Object.freeze([
  symbol(10, 10, 8, 8, 3, 5, [3]),
  symbol(12, 12, 10, 10, 5, 7, [5]),
  symbol(14, 14, 12, 12, 8, 10, [8]),
  symbol(16, 16, 14, 14, 12, 12, [12]),
  symbol(18, 18, 16, 16, 18, 14, [18]),
  symbol(20, 20, 18, 18, 22, 18, [22]),
  symbol(22, 22, 20, 20, 30, 20, [30]),
  symbol(24, 24, 22, 22, 36, 24, [36]),
  symbol(26, 26, 24, 24, 44, 28, [44]),
  symbol(32, 32, 14, 14, 62, 36, [62]),
  symbol(36, 36, 16, 16, 86, 42, [86]),
  symbol(40, 40, 18, 18, 114, 48, [114]),
  symbol(44, 44, 20, 20, 144, 56, [144]),
  symbol(48, 48, 22, 22, 174, 68, [174]),
  symbol(52, 52, 24, 24, 204, 84, [102, 102]),
  symbol(64, 64, 14, 14, 280, 112, [140, 140]),
  symbol(72, 72, 16, 16, 368, 144, [92, 92, 92, 92]),
  symbol(80, 80, 18, 18, 456, 192, [114, 114, 114, 114]),
  symbol(88, 88, 20, 20, 576, 224, [144, 144, 144, 144]),
  symbol(96, 96, 22, 22, 696, 272, [174, 174, 174, 174]),
  symbol(104, 104, 24, 24, 816, 336, [136, 136, 136, 136, 136, 136]),
  symbol(120, 120, 18, 18, 1050, 408, [175, 175, 175, 175, 175, 175]),
  symbol(132, 132, 20, 20, 1304, 496, [163, 163, 163, 163, 163, 163, 163, 163]),
  symbol(144, 144, 22, 22, 1558, 620, [156, 156, 156, 156, 156, 156, 156, 156, 155, 155]),
  symbol(18, 8, 16, 6, 5, 7, [5]),
  symbol(32, 8, 14, 6, 10, 11, [10]),
  symbol(26, 12, 24, 10, 16, 14, [16]),
  symbol(36, 12, 16, 10, 22, 18, [22]),
  symbol(36, 16, 16, 14, 32, 24, [32]),
  symbol(48, 16, 22, 14, 49, 28, [49]),
]);

/** Compatibility alias. */
const SYMBOLS = DATAMATRIX_SYMBOLS;

/** Return the smallest permitted symbol that holds `count` data codewords. */
function symbolForDataCodewords(count, shape = 'any') {
  for (const s of DATAMATRIX_SYMBOLS) {
    const rectangular = s.width !== s.height;
    if ((shape === 'square' && rectangular) || (shape === 'rectangular' && !rectangular)) continue;
    if (count <= s.dataCodewords) return s;
  }
  throw new RangeError(`Data Matrix: ${count} data codewords do not fit an ECC 200 ${shape} symbol`);
}

/** Check redundant geometry and block identities in the static table. */
function validateDataMatrixTables() {
  const issues = [];
  for (const s of DATAMATRIX_SYMBOLS) {
    const regionsX = s.width / s.regionWidth;
    const regionsY = s.height / s.regionHeight;
    if (!Number.isInteger(regionsX) || !Number.isInteger(regionsY)) issues.push(`${s.width}x${s.height}: non-integral regions`);
    const modules = regionsX * regionsY * s.dataRegionWidth * s.dataRegionHeight;
    // Annex F reserves four terminal modules on a few lattice dimensions.
    // They are set to dark after codeword placement and do not carry data.
    const unused = modules - (s.dataCodewords + s.errorCodewords) * 8;
    if (unused !== 0 && unused !== 4) issues.push(`${s.width}x${s.height}: geometry/codeword mismatch`);
    if (s.dataBlockLengths.reduce((a, b) => a + b, 0) !== s.dataCodewords) issues.push(`${s.width}x${s.height}: data block mismatch`);
    if (s.eccPerBlock * s.blockCount !== s.errorCodewords) issues.push(`${s.width}x${s.height}: ecc block mismatch`);
  }
  return issues;
}

/** Compatibility alias. */
const validateTables = validateDataMatrixTables;

__exports.DATAMATRIX_SYMBOLS = DATAMATRIX_SYMBOLS;
__exports.SYMBOLS = SYMBOLS;
__exports.symbolForDataCodewords = symbolForDataCodewords;
__exports.validateDataMatrixTables = validateDataMatrixTables;
__exports.validateTables = validateTables;
};

__modules["datamatrix/encoder.js"] = function (__require, __exports) {
/** Data Matrix ECC 200 encoder: ASCII/Base256, RS interleaving and Annex F placement. */
const { BitMatrix } = __require("core/bit-matrix.js");
const { EncodeError } = __require("core/errors.js");
const { GF256_DM } = __require("core/galois-field.js");
const { rsEncode } = __require("core/reed-solomon.js");
const { symbolForDataCodewords } = __require("datamatrix/tables.js");

function asciiCodewords(text) {
  const out = [];
  for (let i = 0; i < text.length;) {
    const a = text.charCodeAt(i);
    if (a > 255) throw new EncodeError('Data Matrix ASCII: characters must fit ISO-8859-1; use Base256 for UTF-8');
    if (i + 1 < text.length) {
      const b = text.charCodeAt(i + 1);
      if (a >= 48 && a <= 57 && b >= 48 && b <= 57) { out.push(130 + (a - 48) * 10 + b - 48); i += 2; continue; }
    }
    if (a <= 127) out.push(a + 1);
    else out.push(235, a - 127);
    i++;
  }
  return out;
}

function bytesFor(value) {
  if (value instanceof Uint8Array) return value;
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (typeof value !== 'string') throw new EncodeError('Data Matrix: value must be a string or byte array');
  return new TextEncoder().encode(value);
}

function randomize255(value, position) {
  const pseudo = (149 * position) % 255 + 1;
  return value + pseudo <= 255 ? value + pseudo : value + pseudo - 256;
}

function base256Codewords(value, prefixLength = 0) {
  const bytes = bytesFor(value);
  if (bytes.length > 1555) throw new EncodeError('Data Matrix Base256: payload exceeds ECC 200 capacity');
  const out = [231];
  if (bytes.length <= 249) out.push(bytes.length);
  else out.push(Math.floor(bytes.length / 250) + 249, bytes.length % 250);
  // Base256 randomization uses the absolute 1-based codeword position in the
  // symbol. A leading GS1 FNC1 therefore shifts every randomized codeword.
  for (let i = 1; i < out.length; i++) out[i] = randomize255(out[i], prefixLength + i + 1);
  for (const b of bytes) out.push(randomize255(b, prefixLength + out.length + 1));
  return out;
}

function pad(data, capacity) {
  const out = data.slice();
  if (out.length < capacity) out.push(129);
  while (out.length < capacity) {
    const position = out.length + 1;
    const pseudo = (149 * position) % 253 + 1;
    const v = 129 + pseudo;
    out.push(v <= 254 ? v : v - 254);
  }
  return out;
}

function interleave(data, symbol) {
  const blocks = symbol.dataBlockLengths.map((length) => ({ data: new Array(length), ecc: null }));
  let at = 0;
  const longest = Math.max(...symbol.dataBlockLengths);
  // Data codewords are dealt across the RS blocks by column. Splitting the
  // stream into consecutive chunks and then interleaving those chunks looks
  // self-consistent to a decoder doing the same inverse operation, but it is
  // not ECC 200's wire order once a symbol has multiple blocks.
  for (let i = 0; i < longest; i++) {
    for (const block of blocks) if (i < block.data.length) block.data[i] = data[at++];
  }
  for (const block of blocks) {
    // ECC 200 starts its generator roots at alpha^1 (generator base 1).
    block.ecc = rsEncode(block.data, symbol.eccPerBlock, GF256_DM, 1);
  }

  const out = [];
  for (let i = 0; i < longest; i++) for (const b of blocks) if (i < b.data.length) out.push(b.data[i]);
  // The 144x144 symbol has eight long and two short data blocks. Its parity
  // interleave begins with the first short block; deriving the rotation from
  // the declarative lengths keeps that exception out of a size-specific test.
  const eccOffset = blocks.findIndex((block) => block.data.length < longest);
  const rotation = eccOffset < 0 ? 0 : eccOffset;
  for (let i = 0; i < symbol.eccPerBlock; i++) {
    for (let b = 0; b < blocks.length; b++) out.push(blocks[(b + rotation) % blocks.length].ecc[i]);
  }
  return out;
}

function place(codewords, rows, cols) {
  const cells = new Int8Array(rows * cols).fill(-1);
  const bit = (row, col, pos, n) => {
    if (row < 0) { row += rows; col += 4 - ((rows + 4) % 8); }
    if (col < 0) { col += cols; row += 4 - ((cols + 4) % 8); }
    cells[row * cols + col] = (codewords[pos] >>> (8 - n)) & 1;
  };
  const utah = (r, c, p) => { bit(r - 2, c - 2, p, 1); bit(r - 2, c - 1, p, 2); bit(r - 1, c - 2, p, 3); bit(r - 1, c - 1, p, 4); bit(r - 1, c, p, 5); bit(r, c - 2, p, 6); bit(r, c - 1, p, 7); bit(r, c, p, 8); };
  const corner1 = (p) => { bit(rows - 1, 0, p, 1); bit(rows - 1, 1, p, 2); bit(rows - 1, 2, p, 3); bit(0, cols - 2, p, 4); bit(0, cols - 1, p, 5); bit(1, cols - 1, p, 6); bit(2, cols - 1, p, 7); bit(3, cols - 1, p, 8); };
  const corner2 = (p) => { bit(rows - 3, 0, p, 1); bit(rows - 2, 0, p, 2); bit(rows - 1, 0, p, 3); bit(0, cols - 4, p, 4); bit(0, cols - 3, p, 5); bit(0, cols - 2, p, 6); bit(0, cols - 1, p, 7); bit(1, cols - 1, p, 8); };
  const corner3 = (p) => { bit(rows - 3, 0, p, 1); bit(rows - 2, 0, p, 2); bit(rows - 1, 0, p, 3); bit(0, cols - 2, p, 4); bit(0, cols - 1, p, 5); bit(1, cols - 1, p, 6); bit(2, cols - 1, p, 7); bit(3, cols - 1, p, 8); };
  const corner4 = (p) => { bit(rows - 1, 0, p, 1); bit(rows - 1, cols - 1, p, 2); bit(0, cols - 3, p, 3); bit(0, cols - 2, p, 4); bit(0, cols - 1, p, 5); bit(1, cols - 3, p, 6); bit(1, cols - 2, p, 7); bit(1, cols - 1, p, 8); };
  let row = 4, col = 0, pos = 0;
  do {
    if (row === rows && col === 0) corner1(pos++);
    if (row === rows - 2 && col === 0 && cols % 4 !== 0) corner2(pos++);
    if (row === rows - 2 && col === 0 && cols % 8 === 4) corner3(pos++);
    if (row === rows + 4 && col === 2 && cols % 8 === 0) corner4(pos++);
    do { if (row < rows && col >= 0 && cells[row * cols + col] < 0) utah(row, col, pos++); row -= 2; col += 2; } while (row >= 0 && col < cols);
    row += 1; col += 3;
    do { if (row >= 0 && col < cols && cells[row * cols + col] < 0) utah(row, col, pos++); row += 2; col -= 2; } while (row < rows && col >= 0);
    row += 3; col += 1;
  } while (row < rows || col < cols);
  if (cells[cells.length - 1] < 0) { cells[cells.length - 1] = 1; cells[cells.length - cols - 2] = 1; }
  if (pos !== codewords.length) throw new EncodeError(`Data Matrix: placement consumed ${pos} of ${codewords.length} codewords`);
  return cells;
}

function buildMatrix(codewords, symbol) {
  const regionCols = symbol.width / symbol.regionWidth;
  const regionRows = symbol.height / symbol.regionHeight;
  const dataWidth = symbol.dataRegionColumns;
  const dataHeight = symbol.dataRegionRows;
  const data = place(codewords, regionRows * dataHeight, regionCols * dataWidth);
  const matrix = new BitMatrix(symbol.width, symbol.height);
  for (let ry = 0; ry < regionRows; ry++) for (let rx = 0; rx < regionCols; rx++) {
    const x0 = rx * symbol.regionWidth, y0 = ry * symbol.regionHeight;
    for (let x = 0; x < symbol.regionWidth; x++) { if ((x & 1) === 0) matrix.set(x0 + x, y0); matrix.set(x0 + x, y0 + dataHeight + 1); }
    // The top and right timing borders are complementary: top-left is dark,
    // top-right is light, and the solid bottom-right corner remains dark.
    for (let y = 0; y < symbol.regionHeight; y++) { matrix.set(x0, y0 + y); if ((y & 1) === 1) matrix.set(x0 + dataWidth + 1, y0 + y); }
    for (let y = 0; y < dataHeight; y++) for (let x = 0; x < dataWidth; x++) if (data[(ry * dataHeight + y) * (regionCols * dataWidth) + rx * dataWidth + x]) matrix.set(x0 + 1 + x, y0 + 1 + y);
  }
  return matrix;
}

/** Encode a string (ASCII mode) or byte payload (Base256) into Data Matrix ECC 200. */
function encodeDataMatrix(value, options = {}) {
  const encoding = options.encoding ?? (value instanceof Uint8Array ? 'base256' : 'ascii');
  let raw;
  if (encoding === 'ascii') {
    if (typeof value !== 'string') throw new EncodeError('Data Matrix ASCII: value must be a string');
    raw = asciiCodewords(value);
  } else if (encoding === 'base256') raw = base256Codewords(value, options.gs1 === true ? 1 : 0);
  else throw new EncodeError(`Data Matrix: unsupported encoding "${encoding}"`);
  // GS1 DataMatrix is ECC 200 with FNC1 in the first codeword position.
  if (options.gs1 === true) raw.unshift(232);
  const shape = options.shape ?? 'any';
  if (shape !== 'any' && shape !== 'square' && shape !== 'rectangular') throw new EncodeError(`Data Matrix: invalid shape "${shape}"`);
  const symbol = symbolForDataCodewords(raw.length, shape);
  if (!symbol) throw new EncodeError(`Data Matrix: ${raw.length} data codewords do not fit an ECC 200 ${shape} symbol`);
  return buildMatrix(interleave(pad(raw, symbol.dataCodewords), symbol), symbol);
}

/** Encode already compacted ASCII/Base256 codewords, primarily for conformance tests. */
function encodeDataMatrixCodewords(codewords, options = {}) {
  if (!Array.isArray(codewords) && !(codewords instanceof Uint8Array)) throw new EncodeError('Data Matrix: codewords must be an array');
  for (const c of codewords) if (!Number.isInteger(c) || c < 0 || c > 255) throw new EncodeError('Data Matrix: codewords must be bytes');
  const symbol = symbolForDataCodewords(codewords.length, options.shape ?? 'any');
  if (!symbol) throw new EncodeError('Data Matrix: codewords do not fit ECC 200');
  return buildMatrix(interleave(pad(Array.from(codewords), symbol.dataCodewords), symbol), symbol);
}

__exports.encodeDataMatrix = encodeDataMatrix;
__exports.encodeDataMatrixCodewords = encodeDataMatrixCodewords;
};

__modules["datamatrix/decoder.js"] = function (__require, __exports) {
/**
 * Data Matrix ECC 200 decoder for an already sampled symbol.
 *
 * The detector owns locating, perspective correction and orientation. This
 * module starts with the complete, upright symbol including its finder borders.
 * The table entry is deliberately read through a small normalizer so table data
 * remains declarative: it needs total rows/columns, one data-region's rows and
 * columns, data/ECC codeword counts, and either a block count or data block
 * lengths. The standard 144x144 uneven data blocks are supported.
 *
 * @module datamatrix/decoder
 */
const { ChecksumError, FormatError } = __require("core/errors.js");
const { GF256_DM } = __require("core/galois-field.js");
const { rsDecode } = __require("core/reed-solomon.js");
const { SYMBOLS } = __require("datamatrix/tables.js");

const CW_PAD = 129;
const CW_BASE256 = 231;

/** @param {object} entry @param {...string} names @returns {number | undefined} */
function numberField(entry, ...names) {
  for (const name of names) if (Number.isInteger(entry[name])) return entry[name];
  return undefined;
}

/** Normalize the public table entry into the decoder's geometry contract. */
function layoutFor(width, height) {
  const entry = SYMBOLS.find((s) =>
    numberField(s, 'columns', 'cols', 'matrixColumns', 'width') === width &&
    numberField(s, 'rows', 'matrixRows', 'height') === height);
  if (!entry) throw new FormatError(`Data Matrix: ${width}x${height} is not an ECC 200 symbol size`);

  const regionRows = numberField(entry, 'dataRegionRows', 'regionRows') ??
    (numberField(entry, 'regionHeight') ? numberField(entry, 'regionHeight') - 2 : undefined);
  const regionCols = numberField(entry, 'dataRegionColumns', 'dataRegionCols', 'regionColumns') ??
    (numberField(entry, 'regionWidth') ? numberField(entry, 'regionWidth') - 2 : undefined);
  const dataCount = numberField(entry, 'dataCodewords', 'dataCapacity');
  const eccCount = numberField(entry, 'errorCodewords', 'eccCodewords');
  const blockCount = numberField(entry, 'interleavedBlocks', 'interleavedBlockCount', 'blockCount', 'rsBlocks') || 1;
  if (!regionRows || !regionCols || dataCount === undefined || eccCount === undefined ||
      height % (regionRows + 2) || width % (regionCols + 2) || eccCount % blockCount) {
    throw new FormatError(`Data Matrix: invalid table layout for ${width}x${height}`);
  }

  const rows = height / (regionRows + 2);
  const cols = width / (regionCols + 2);
  const blockData = Array.isArray(entry.blockDataCodewords) ? entry.blockDataCodewords.slice() :
    Array.isArray(entry.dataCodewordsPerBlock) ? entry.dataCodewordsPerBlock.slice() : null;
  let dataLengths;
  if (blockData) {
    dataLengths = blockData;
  } else {
    // The sole uneven ECC 200 distribution is 144x144: its first eight of ten
    // blocks contain one extra data codeword. This derives it instead of hiding
    // a magic size check in the deinterleaver.
    const short = Math.floor(dataCount / blockCount);
    dataLengths = new Array(blockCount).fill(short);
    for (let i = 0; i < dataCount % blockCount; i++) dataLengths[i]++;
  }
  if (dataLengths.length !== blockCount || dataLengths.reduce((a, b) => a + b, 0) !== dataCount) {
    throw new FormatError(`Data Matrix: inconsistent block layout for ${width}x${height}`);
  }
  return { entry, regionRows, regionCols, regionRowCount: rows, regionColCount: cols,
    dataRows: rows * regionRows, dataCols: cols * regionCols, dataCount, eccCount,
    blockCount, eccPerBlock: eccCount / blockCount, dataLengths };
}

/** Remove the L/finders from every data region, retaining only placement modules. */
function extractDataModules(matrix, layout) {
  const data = new Uint8Array(layout.dataRows * layout.dataCols);
  for (let regionY = 0; regionY < layout.regionRowCount; regionY++) {
    for (let regionX = 0; regionX < layout.regionColCount; regionX++) {
      const sourceX = regionX * (layout.regionCols + 2) + 1;
      const sourceY = regionY * (layout.regionRows + 2) + 1;
      for (let y = 0; y < layout.regionRows; y++) {
        const targetY = regionY * layout.regionRows + y;
        for (let x = 0; x < layout.regionCols; x++) {
          data[targetY * layout.dataCols + regionX * layout.regionCols + x] =
            matrix.get(sourceX + x, sourceY + y) ? 1 : 0;
        }
      }
    }
  }
  return data;
}

/** Read placement codewords using the ECC 200 Utah sweep (the inverse writer path). */
function readPlacement(modules, rows, cols, count) {
  const seen = new Uint8Array(rows * cols);
  const out = new Uint8Array(count);
  const get = (row, col) => modules[row * cols + col] !== 0;
  const module = (row, col) => {
    if (row < 0) { row += rows; col += 4 - ((rows + 4) % 8); }
    if (col < 0) { col += cols; row += 4 - ((cols + 4) % 8); }
    if (row < 0 || row >= rows || col < 0 || col >= cols) {
      throw new FormatError('Data Matrix: placement coordinate escaped data region');
    }
    seen[row * cols + col] = 1;
    return get(row, col) ? 1 : 0;
  };
  const bits = (coords) => coords.reduce((value, p) => (value << 1) | module(p[0], p[1]), 0);
  const utah = (row, col) => bits([[row - 2, col - 2], [row - 2, col - 1], [row - 1, col - 2], [row - 1, col - 1],
    [row - 1, col], [row, col - 2], [row, col - 1], [row, col]]);
  const corner1 = () => bits([[rows - 1, 0], [rows - 1, 1], [rows - 1, 2], [0, cols - 2], [0, cols - 1], [1, cols - 1], [2, cols - 1], [3, cols - 1]]);
  const corner2 = () => bits([[rows - 3, 0], [rows - 2, 0], [rows - 1, 0], [0, cols - 4], [0, cols - 3], [0, cols - 2], [0, cols - 1], [1, cols - 1]]);
  const corner3 = () => bits([[rows - 3, 0], [rows - 2, 0], [rows - 1, 0], [0, cols - 2], [0, cols - 1], [1, cols - 1], [2, cols - 1], [3, cols - 1]]);
  const corner4 = () => bits([[rows - 1, 0], [rows - 1, cols - 1], [0, cols - 3], [0, cols - 2], [0, cols - 1], [1, cols - 3], [1, cols - 2], [1, cols - 1]]);

  let row = 4, col = 0, n = 0;
  const put = (value) => { if (n < count) out[n++] = value; };
  do {
    if (row === rows && col === 0) put(corner1());
    if (row === rows - 2 && col === 0 && cols % 4 !== 0) put(corner2());
    if (row === rows - 2 && col === 0 && cols % 8 === 4) put(corner3());
    if (row === rows + 4 && col === 2 && cols % 8 === 0) put(corner4());
    do { if (row < rows && col >= 0 && !seen[row * cols + col]) put(utah(row, col)); row -= 2; col += 2; } while (row >= 0 && col < cols);
    row += 1; col += 3;
    do { if (row >= 0 && col < cols && !seen[row * cols + col]) put(utah(row, col)); row += 2; col -= 2; } while (row < rows && col >= 0);
    row += 3; col += 1;
  } while (row < rows || col < cols);
  if (n !== count) throw new FormatError(`Data Matrix: placement yielded ${n}, expected ${count} codewords`);
  return out;
}

/** Restore RS blocks, correct them, then concatenate their data portions. */
function deinterleaveAndCorrect(codewords, layout) {
  if (codewords.length !== layout.dataCount + layout.eccCount) throw new FormatError('Data Matrix: codeword count mismatch');
  const blocks = layout.dataLengths.map((len) => new Uint8Array(len + layout.eccPerBlock));
  // Data codewords arrive in their original stream order. ECC 200 deals that
  // stream round-robin across the RS blocks, so the inverse is determined by
  // the wire index rather than by splitting it into consecutive block-sized
  // chunks. For 144x144, indices 1550..1557 naturally land in the eight long
  // blocks while the two short blocks remain at 155 data codewords.
  for (let i = 0; i < layout.dataCount; i++) {
    blocks[i % layout.blockCount][Math.floor(i / layout.blockCount)] = codewords[i];
  }

  // Parity normally begins with block zero. The uneven 144x144 layout rotates
  // the parity wire order to begin with its first short block; derive the same
  // mapping from the declarative lengths instead of keying it to dimensions.
  const longest = Math.max(...layout.dataLengths);
  const firstShort = layout.dataLengths.findIndex((length) => length < longest);
  const rotation = firstShort < 0 ? 0 : firstShort;
  let at = layout.dataCount;
  for (let i = 0; i < layout.eccPerBlock; i++) {
    for (let slot = 0; slot < layout.blockCount; slot++) {
      const block = (slot + rotation) % layout.blockCount;
      blocks[block][layout.dataLengths[block] + i] = codewords[at++];
    }
  }

  let corrections = 0;
  const data = new Uint8Array(layout.dataCount);
  for (let b = 0; b < blocks.length; b++) {
    corrections += rsDecode(blocks[b], layout.eccPerBlock, GF256_DM, 1);
  }
  // Rebuild the original high-level codeword stream after correction. Keeping
  // this in wire-index order is essential: concatenating block data passes
  // single-block round trips but scrambles every multi-block payload.
  for (let i = 0; i < layout.dataCount; i++) {
    data[i] = blocks[i % layout.blockCount][Math.floor(i / layout.blockCount)];
  }
  return { data, corrections };
}

function unrandomize(value, position) {
  const pseudo = ((149 * position) % 255) + 1;
  return value - pseudo >= 0 ? value - pseudo : value - pseudo + 256;
}

/** Decode ASCII plus Base 256, preserving semantic bytes alongside text. */
function parseData(data) {
  let text = '';
  const bytes = [];
  let upperShift = false;
  let gs1 = false;
  for (let i = 0; i < data.length;) {
    const cw = data[i++];
    if (cw === CW_PAD) break;
    if (cw <= 128) {
      const value = cw - 1 + (upperShift ? 128 : 0);
      upperShift = false;
      text += String.fromCharCode(value); bytes.push(value); continue;
    }
    if (cw <= 229) {
      const pair = cw - 130;
      const digits = String(pair).padStart(2, '0'); text += digits; bytes.push(digits.charCodeAt(0), digits.charCodeAt(1)); continue;
    }
    if (cw === 232) {
      if (i === 1) gs1 = true;
      else { text += '\x1d'; bytes.push(29); }
      continue;
    }
    if (cw === 235) { upperShift = true; continue; }
    if (cw === CW_BASE256) {
      if (i >= data.length) throw new FormatError('Data Matrix: Base 256 length is missing');
      let length = unrandomize(data[i], i + 1); i++;
      if (length === 0) length = data.length - i;
      else if (length >= 250) {
        if (i >= data.length) throw new FormatError('Data Matrix: Base 256 extended length is missing');
        length = 250 * (length - 249) + unrandomize(data[i], i + 1); i++;
      }
      if (i + length > data.length) throw new FormatError('Data Matrix: Base 256 segment exceeds data capacity');
      const segment = new Uint8Array(length);
      for (let n = 0; n < length; n++, i++) segment[n] = unrandomize(data[i], i + 1);
      bytes.push(...segment);
      for (let n = 0; n < segment.length; n++) text += String.fromCharCode(segment[n]);
      continue;
    }
    throw new FormatError(`Data Matrix: unsupported encoding codeword ${cw}`);
  }
  return { text, bytes: Uint8Array.from(bytes), gs1 };
}

/**
 * Decode an upright, sampled Data Matrix ECC 200 symbol.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix Full symbol, no quiet zone.
 * @returns {{text: string, bytes: Uint8Array, correctedErrors: number, symbol: object}}
 */
function decodeDataMatrix(matrix) {
  if (!matrix || !Number.isInteger(matrix.width) || !Number.isInteger(matrix.height)) throw new FormatError('Data Matrix: no matrix supplied');
  const layout = layoutFor(matrix.width, matrix.height);
  const placement = readPlacement(extractDataModules(matrix, layout), layout.dataRows, layout.dataCols, layout.dataCount + layout.eccCount);
  const { data, corrections } = deinterleaveAndCorrect(placement, layout);
  const result = parseData(data);
  return { ...result, corrections, correctedErrors: corrections, symbol: layout.entry };
}
__exports.ChecksumError = ChecksumError;

__exports.decodeDataMatrix = decodeDataMatrix;
};

__modules["image/perspective.js"] = function (__require, __exports) {
/**
 * Projective (perspective) transforms.
 *
 * A 2D symbol photographed off-axis is not a rotated square — it is a
 * quadrilateral with converging edges. Correcting that needs a full projective
 * map, not an affine one; an affine approximation reads the near edge of a
 * tilted symbol correctly and drifts a module or more by the far edge.
 *
 * The map is a 3x3 homogeneous matrix. Points are transformed as
 * (x, y, 1) * M, then divided through by the resulting w.
 *
 * @module image/perspective
 */
class PerspectiveTransform {
  /* eslint-disable-next-line max-params */
  constructor(a11, a21, a31, a12, a22, a32, a13, a23, a33) {
    this.a11 = a11; this.a21 = a21; this.a31 = a31;
    this.a12 = a12; this.a22 = a22; this.a32 = a32;
    this.a13 = a13; this.a23 = a23; this.a33 = a33;
  }

  /**
   * Transform points in place.
   *
   * @param {Float32Array | number[]} points Interleaved [x0, y0, x1, y1, ...].
   * @returns {Float32Array | number[]} The same array.
   */
  transform(points) {
    const { a11, a21, a31, a12, a22, a32, a13, a23, a33 } = this;
    for (let i = 0; i < points.length; i += 2) {
      const x = points[i];
      const y = points[i + 1];
      const w = a13 * x + a23 * y + a33;
      points[i] = (a11 * x + a21 * y + a31) / w;
      points[i + 1] = (a12 * x + a22 * y + a32) / w;
    }
    return points;
  }

  /**
   * Transform a single point.
   *
   * @param {number} x @param {number} y
   * @returns {{x: number, y: number}}
   */
  transformPoint(x, y) {
    const w = this.a13 * x + this.a23 * y + this.a33;
    return {
      x: (this.a11 * x + this.a21 * y + this.a31) / w,
      y: (this.a12 * x + this.a22 * y + this.a32) / w,
    };
  }

  /**
   * Map the unit square — (0,0), (1,0), (1,1), (0,1) — onto an arbitrary quad.
   *
   * Corners are given in that same order, i.e. going around the quad, not
   * as opposite pairs.
   *
   * @returns {PerspectiveTransform}
   */
  /* eslint-disable-next-line max-params */
  static squareToQuad(x0, y0, x1, y1, x2, y2, x3, y3) {
    const dx3 = x0 - x1 + x2 - x3;
    const dy3 = y0 - y1 + y2 - y3;

    if (dx3 === 0 && dy3 === 0) {
      // The quad is a parallelogram, so the map is affine and the projective
      // terms vanish. Worth special-casing: it is the common case for flat
      // scans, and the general solution divides by zero here.
      return new PerspectiveTransform(
        x1 - x0, x2 - x1, x0,
        y1 - y0, y2 - y1, y0,
        0, 0, 1
      );
    }

    const dx1 = x1 - x2;
    const dx2 = x3 - x2;
    const dy1 = y1 - y2;
    const dy2 = y3 - y2;
    const denominator = dx1 * dy2 - dx2 * dy1;
    const a13 = (dx3 * dy2 - dx2 * dy3) / denominator;
    const a23 = (dx1 * dy3 - dx3 * dy1) / denominator;

    return new PerspectiveTransform(
      x1 - x0 + a13 * x1, x3 - x0 + a23 * x3, x0,
      y1 - y0 + a13 * y1, y3 - y0 + a23 * y3, y0,
      a13, a23, 1
    );
  }

  /**
   * Map an arbitrary quad onto the unit square — the inverse of
   * {@link squareToQuad}, via the adjugate.
   *
   * @returns {PerspectiveTransform}
   */
  /* eslint-disable-next-line max-params */
  static quadToSquare(x0, y0, x1, y1, x2, y2, x3, y3) {
    return PerspectiveTransform.squareToQuad(x0, y0, x1, y1, x2, y2, x3, y3).inverse();
  }

  /**
   * Map one quad onto another, corner for corner.
   *
   * This is what turns four detected finder corners into a sampling grid:
   * compose "detected quad -> unit square" with "unit square -> ideal grid".
   *
   * @returns {PerspectiveTransform}
   */
  /* eslint-disable-next-line max-params */
  static quadToQuad(
    sx0, sy0, sx1, sy1, sx2, sy2, sx3, sy3,
    dx0, dy0, dx1, dy1, dx2, dy2, dx3, dy3
  ) {
    const toSquare = PerspectiveTransform.quadToSquare(sx0, sy0, sx1, sy1, sx2, sy2, sx3, sy3);
    const toQuad = PerspectiveTransform.squareToQuad(dx0, dy0, dx1, dy1, dx2, dy2, dx3, dy3);
    return toSquare.times(toQuad);
  }

  /**
   * Adjugate — the inverse up to a scale factor, which is irrelevant in
   * homogeneous coordinates because the division by w cancels it.
   *
   * @returns {PerspectiveTransform}
   */
  inverse() {
    const { a11, a21, a31, a12, a22, a32, a13, a23, a33 } = this;
    return new PerspectiveTransform(
      a22 * a33 - a23 * a32,
      a23 * a31 - a21 * a33,
      a21 * a32 - a22 * a31,
      a13 * a32 - a12 * a33,
      a11 * a33 - a13 * a31,
      a12 * a31 - a11 * a32,
      a12 * a23 - a13 * a22,
      a13 * a21 - a11 * a23,
      a11 * a22 - a12 * a21
    );
  }

  /**
   * Matrix product: apply `this` first, then `other`.
   *
   * @param {PerspectiveTransform} other
   * @returns {PerspectiveTransform}
   */
  times(other) {
    const { a11, a21, a31, a12, a22, a32, a13, a23, a33 } = this;
    const o = other;
    return new PerspectiveTransform(
      o.a11 * a11 + o.a21 * a12 + o.a31 * a13,
      o.a11 * a21 + o.a21 * a22 + o.a31 * a23,
      o.a11 * a31 + o.a21 * a32 + o.a31 * a33,
      o.a12 * a11 + o.a22 * a12 + o.a32 * a13,
      o.a12 * a21 + o.a22 * a22 + o.a32 * a23,
      o.a12 * a31 + o.a22 * a32 + o.a32 * a33,
      o.a13 * a11 + o.a23 * a12 + o.a33 * a13,
      o.a13 * a21 + o.a23 * a22 + o.a33 * a23,
      o.a13 * a31 + o.a23 * a32 + o.a33 * a33
    );
  }
}

__exports.PerspectiveTransform = PerspectiveTransform;
};

__modules["image/grid-sampler.js"] = function (__require, __exports) {
/**
 * Resample a distorted symbol in the image into an upright module grid.
 *
 * Given a transform that maps grid coordinates to image coordinates, this
 * samples the centre of every module. Sampling centres rather than averaging
 * whole cells is deliberate: module edges are where blur and bleed live, and
 * including them turns a marginal symbol into an unreadable one.
 *
 * @module image/grid-sampler
 */
const { BitMatrix } = __require("core/bit-matrix.js");
const { NotFoundError } = __require("core/errors.js");
const { PerspectiveTransform } = __require("image/perspective.js");

/**
 * Sample a `dimension` x `dimension` grid (or `width` x `height`).
 *
 * @param {BitMatrix} image Binarized source image.
 * @param {number} width Modules across.
 * @param {number} height Modules down.
 * @param {PerspectiveTransform} transform Grid space -> image space.
 * @returns {BitMatrix}
 * @throws {NotFoundError} If the grid falls outside the image.
 */
function sampleGrid(image, width, height, transform) {
  const out = new BitMatrix(width, height);
  const points = new Float32Array(width * 2);

  for (let y = 0; y < height; y++) {
    // Module centres: offset by half a module in both axes.
    const gridY = y + 0.5;
    for (let x = 0; x < width; x++) {
      points[x * 2] = x + 0.5;
      points[x * 2 + 1] = gridY;
    }
    transform.transform(points);

    for (let x = 0; x < width; x++) {
      const px = points[x * 2] | 0;
      const py = points[x * 2 + 1] | 0;
      if (px < 0 || py < 0 || px >= image.width || py >= image.height) {
        throw new NotFoundError(
          `Sampling grid escapes the image at module (${x}, ${y})`
        );
      }
      if (image.get(px, py)) out.set(x, y);
    }
  }

  return out;
}

/**
 * Sample with a 3x3 majority vote per module.
 *
 * Slower, and worth it when a single-point sample lands on a speck of noise or
 * a JPEG artefact. Readers fall back to this after a clean sample fails to
 * decode, rather than paying for it on every attempt.
 *
 * @param {BitMatrix} image
 * @param {number} width
 * @param {number} height
 * @param {PerspectiveTransform} transform
 * @returns {BitMatrix}
 */
function sampleGridVoting(image, width, height, transform) {
  const out = new BitMatrix(width, height);

  // Spacing between module centres, measured in image pixels, so the vote
  // spreads across the module rather than a fixed pixel radius that would be
  // meaningless at a different scale.
  const p0 = transform.transformPoint(0.5, 0.5);
  const p1 = transform.transformPoint(1.5, 0.5);
  const p2 = transform.transformPoint(0.5, 1.5);
  const stepX = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  const stepY = Math.hypot(p2.x - p0.x, p2.y - p0.y);
  const rx = Math.max(1, Math.round(stepX / 4));
  const ry = Math.max(1, Math.round(stepY / 4));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = transform.transformPoint(x + 0.5, y + 0.5);
      const cx = c.x | 0;
      const cy = c.y | 0;
      if (cx < 0 || cy < 0 || cx >= image.width || cy >= image.height) {
        throw new NotFoundError(
          `Sampling grid escapes the image at module (${x}, ${y})`
        );
      }

      let dark = 0;
      let total = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const sx = cx + dx * rx;
          const sy = cy + dy * ry;
          if (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height) continue;
          total++;
          if (image.get(sx, sy)) dark++;
        }
      }
      if (total > 0 && dark * 2 > total) out.set(x, y);
    }
  }

  return out;
}

/**
 * Build the transform for a symbol whose four corners are known, and sample it.
 *
 * Corners are in reading order: top-left, top-right, bottom-right, bottom-left.
 *
 * @param {BitMatrix} image
 * @param {number} dimension Modules per side.
 * @param {Array<{x: number, y: number}>} corners
 * @param {boolean} [voting]
 * @returns {BitMatrix}
 */
function sampleQuad(image, dimension, corners, voting = false) {
  if (corners.length !== 4) throw new NotFoundError('sampleQuad needs exactly 4 corners');
  const [tl, tr, br, bl] = corners;
  const d = dimension;

  const transform = PerspectiveTransform.quadToQuad(
    0, 0, d, 0, d, d, 0, d,
    tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y
  );

  return voting
    ? sampleGridVoting(image, d, d, transform)
    : sampleGrid(image, d, d, transform);
}

__exports.sampleGrid = sampleGrid;
__exports.sampleGridVoting = sampleGridVoting;
__exports.sampleQuad = sampleQuad;
};

__modules["datamatrix/detector.js"] = function (__require, __exports) {
/**
 * Data Matrix ECC 200 detection in a binarized image.
 *
 * An ECC 200 symbol is distinguished by two neighbouring solid finder borders
 * (the L) and two alternating clock borders.  The detector first finds dark
 * connected components, then scores every legal ECC 200 size and every
 * quarter-turn of the component's bounding quadrilateral against those four
 * borders.  This deliberately verifies the complete border rather than merely
 * looking for an L: ordinary text and table rules produce L shapes often.
 *
 * The resulting quadrilateral is sampled back into the canonical orientation:
 * solid borders at left and bottom.  It is intentionally independent of the
 * payload decoder, so geometry can be used by callers that need the matrix.
 *
 * @module datamatrix/detector
 */
const { NotFoundError } = __require("core/errors.js");
const { sampleGrid, sampleQuad } = __require("image/grid-sampler.js");
const { PerspectiveTransform } = __require("image/perspective.js");
const { decodeDataMatrix } = __require("datamatrix/decoder.js");

// ECC 200 dimensions.  DMRE is deliberately not included: it uses a separate
// size table and is not part of the original ECC 200 family implemented here.
const SIZES = [
  [10, 10], [12, 12], [14, 14], [16, 16], [18, 18], [20, 20], [22, 22], [24, 24], [26, 26],
  [32, 32], [36, 36], [40, 40], [44, 44], [48, 48], [52, 52], [64, 64], [72, 72], [80, 80],
  [88, 88], [96, 96], [104, 104], [120, 120], [132, 132], [144, 144],
  [18, 8], [32, 8], [26, 12], [36, 12], [36, 16], [48, 16],
];

/** @typedef {{x:number, y:number}} Point */
/** @typedef {{corners: Point[], dimension: number, width: number, height: number, moduleSize: number, matrix: import('../core/bit-matrix.js').BitMatrix}} Detection */

function dark(image, x, y) {
  return image.get(Math.max(0, Math.min(image.width - 1, Math.round(x))),
    Math.max(0, Math.min(image.height - 1, Math.round(y))));
}

/** Return components which are large enough to plausibly contain a symbol. */
function components(image) {
  const seen = new Uint8Array(image.width * image.height);
  const out = [];
  const push = (x, y, xs, ys) => { xs.push(x); ys.push(y); };
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    const start = y * image.width + x;
    if (seen[start] || !image.get(x, y)) continue;
    const xs = [x], ys = [y]; seen[start] = 1;
    let head = 0, minX = x, maxX = x, minY = y, maxY = y;
    while (head < xs.length) {
      const px = xs[head], py = ys[head++];
      if (px < minX) minX = px; if (px > maxX) maxX = px;
      if (py < minY) minY = py; if (py > maxY) maxY = py;
      for (const [nx, ny] of [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]]) {
        if (nx < 0 || ny < 0 || nx >= image.width || ny >= image.height) continue;
        const at = ny * image.width + nx;
        if (!seen[at] && image.get(nx, ny)) { seen[at] = 1; push(nx, ny, xs, ys); }
      }
    }
    if (maxX - minX >= 7 && maxY - minY >= 7) out.push({ minX, minY, maxX, maxY, pixels: xs.length });
  }
  return out.sort((a, b) => b.pixels - a.pixels).slice(0, 40);
}

/** Sample a physical edge at module centres. */
function edge(image, a, b, count) {
  const values = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    values.push(dark(image, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t));
  }
  return values;
}

function solidScore(values) {
  let n = 0; for (const value of values) if (value) n++;
  return n / values.length;
}

function clockScore(values, startsDark) {
  let n = 0;
  for (let i = 0; i < values.length; i++) if (values[i] === ((i & 1) === 0 ? startsDark : !startsDark)) n++;
  return n / values.length;
}

/** Count light/dark changes along a physical edge at approximately one-pixel intervals. */
function edgeTransitions(image, a, b) {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
  let previous = dark(image, a.x, a.y);
  let changes = 0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const value = dark(image, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
    if (value !== previous) changes++;
    previous = value;
  }
  return changes;
}

/** Reject a smaller harmonic whose module-centre samples happen to alternate. */
function transitionCountFits(observed, modules) {
  const expected = modules - 1;
  const tolerance = Math.max(2, Math.floor(expected * 0.08));
  return Math.abs(observed - expected) <= tolerance;
}

function sample(image, width, height, corners, voting) {
  if (width === height) return sampleQuad(image, width, corners, voting);
  const [tl, tr, br, bl] = corners;
  const transform = PerspectiveTransform.quadToQuad(0, 0, width, 0, width, height, 0, height,
    tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y);
  return sampleGrid(image, width, height, transform);
}

/**
 * Find Data Matrix symbols in a binarized image.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} binaryImage Set bit = dark.
 * @returns {Detection | null} The strongest candidate, or null when absent.
 */
function detectDataMatrix(binaryImage) {
  if (!binaryImage || !binaryImage.width || !binaryImage.height) {
    throw new NotFoundError('detectDataMatrix: no image supplied');
  }
  const detections = [];
  const used = new Set();
  for (const box of components(binaryImage)) {
    const base = [
      { x: box.minX, y: box.minY }, { x: box.maxX + 1, y: box.minY },
      { x: box.maxX + 1, y: box.maxY + 1 }, { x: box.minX, y: box.maxY + 1 },
    ];
    // Profile the actual ink, rather than the outer sampling quadrilateral:
    // its far x/y boundary lies one pixel beyond the last dark pixel.
    const ink = [
      { x: box.minX, y: box.minY }, { x: box.maxX, y: box.minY },
      { x: box.maxX, y: box.maxY }, { x: box.minX, y: box.maxY },
    ];
    for (const [w, h] of SIZES) for (let turn = 0; turn < 4; turn++) {
      // A 90 degree turn swaps physical width and height.
      const physicalW = (turn & 1) ? h : w, physicalH = (turn & 1) ? w : h;
      const pitchX = (box.maxX - box.minX + 1) / physicalW;
      const pitchY = (box.maxY - box.minY + 1) / physicalH;
      if (Math.min(pitchX, pitchY) < 1 || Math.abs(pitchX - pitchY) > Math.max(pitchX, pitchY) * 0.22) continue;
      const corners = base.slice(turn).concat(base.slice(0, turn));
      const profile = ink.slice(turn).concat(ink.slice(0, turn));
      // Canonical edge order: top clock, right clock, bottom solid, left solid.
      const top = edge(binaryImage, profile[0], profile[1], w);
      const right = edge(binaryImage, profile[1], profile[2], h);
      const bottom = edge(binaryImage, profile[2], profile[3], w);
      const left = edge(binaryImage, profile[3], profile[0], h);
      // Sampling only the proposed module centres aliases exact harmonics: an
      // 80-module clock border, for example, can look like a perfect 16-module
      // border.  Count transitions at image-pixel resolution as an independent
      // dimension measurement before accepting the candidate.
      if (!transitionCountFits(edgeTransitions(binaryImage, profile[0], profile[1]), w) ||
          !transitionCountFits(edgeTransitions(binaryImage, profile[1], profile[2]), h)) continue;
      // The top clock starts dark at the solid left border.  The right clock is
      // anchored dark at the solid bottom border instead, so its top phase
      // depends on the symbol height (all ECC 200 heights are even and
      // therefore start light).
      const score = (clockScore(top, true) + clockScore(right, (h & 1) === 1) +
        solidScore(bottom) + solidScore(left)) / 4;
      if (score < 0.88) continue;
      const key = `${box.minX},${box.minY},${box.maxX},${box.maxY}`;
      if (used.has(key)) continue;
      let matrix;
      try { matrix = sample(binaryImage, w, h, corners, false); } catch (e) { continue; }
      used.add(key);
      detections.push({ corners, dimension: w === h ? w : 0, width: w, height: h,
        moduleSize: (pitchX + pitchY) / 2, matrix, score });
    }
  }
  detections.sort((a, b) => b.score - a.score || b.moduleSize - a.moduleSize);
  return detections[0] ?? null;
}

/**
 * Detect and decode Data Matrix symbols.  Detection failure is normal for an
 * image without a symbol, so candidates that cannot decode are skipped.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} binaryImage
 * @returns {(import('./decoder.js').DecodeResult & {corners: Point[]}) | null}
 */
function detectAndDecodeDataMatrix(binaryImage) {
  let detection;
  try { detection = detectDataMatrix(binaryImage); } catch (e) { return null; }
  if (!detection) return null;
  for (const voting of [false, true]) {
    let matrix = detection.matrix;
    try { if (voting) matrix = sample(binaryImage, detection.width, detection.height, detection.corners, true); } catch (e) { continue; }
    try { return Object.assign({ corners: detection.corners }, decodeDataMatrix(matrix)); }
    catch (e) { /* A geometric candidate is not necessarily a symbol. */ }
  }
  return null;
}

__exports.detectDataMatrix = detectDataMatrix;
__exports.detectAndDecodeDataMatrix = detectAndDecodeDataMatrix;
};

__modules["datamatrix/index.js"] = function (__require, __exports) {
/** Data Matrix ECC 200 entry points. @module datamatrix */
const __reexport0 = __require("datamatrix/encoder.js"); __exports.encodeDataMatrix = __reexport0.encodeDataMatrix; __exports.encodeDataMatrixCodewords = __reexport0.encodeDataMatrixCodewords;
const __reexport1 = __require("datamatrix/decoder.js"); __exports.decodeDataMatrix = __reexport1.decodeDataMatrix;
const __reexport2 = __require("datamatrix/detector.js"); __exports.detectDataMatrix = __reexport2.detectDataMatrix; __exports.detectAndDecodeDataMatrix = __reexport2.detectAndDecodeDataMatrix;
const __reexport3 = __require("datamatrix/tables.js"); __exports.DATAMATRIX_SYMBOLS = __reexport3.DATAMATRIX_SYMBOLS; __exports.SYMBOLS = __reexport3.SYMBOLS; __exports.symbolForDataCodewords = __reexport3.symbolForDataCodewords; __exports.validateDataMatrixTables = __reexport3.validateDataMatrixTables; __exports.validateTables = __reexport3.validateTables;


};

__modules["core/bit-buffer.js"] = function (__require, __exports) {
/**
 * Bit-level writing and reading, MSB-first.
 *
 * Every 2D symbology serialises its payload as a bitstream that does not
 * respect byte boundaries — QR alone mixes 4-bit mode indicators, 10-bit
 * character-count fields and 11-bit alphanumeric pairs. These two classes are
 * the write and read halves of that.
 *
 * @module core/bit-buffer
 */
const { FormatError } = __require("core/errors.js");

/** Growable MSB-first bit writer. */
class BitWriter {
  constructor() {
    /** @type {number[]} Packed bytes; the last one may be partially filled. */
    this.bytes = [];
    this.bitLength = 0;
  }

  /** @returns {number} Bits written so far. */
  get length() {
    return this.bitLength;
  }

  /**
   * Append the low `count` bits of `value`, most significant first.
   *
   * @param {number} value
   * @param {number} count
   */
  put(value, count) {
    for (let i = count - 1; i >= 0; i--) {
      this.putBit(((value >>> i) & 1) === 1);
    }
  }

  /** @param {boolean} bit */
  putBit(bit) {
    const idx = this.bitLength >>> 3;
    if (this.bytes.length <= idx) this.bytes.push(0);
    if (bit) this.bytes[idx] |= 0x80 >>> (this.bitLength & 7);
    this.bitLength++;
  }

  /** @param {ArrayLike<number>} data */
  putBytes(data) {
    for (let i = 0; i < data.length; i++) this.put(data[i], 8);
  }

  /** Pad with zero bits until the length is a multiple of 8. */
  padToByte() {
    while (this.bitLength & 7) this.putBit(false);
  }

  /**
   * @returns {Uint8Array} Byte view; trailing bits of the final byte are zero.
   */
  toBytes() {
    return Uint8Array.from(this.bytes);
  }

  /** @returns {string} Debug view, e.g. "0100 0011 0101". */
  toString() {
    let s = '';
    for (let i = 0; i < this.bitLength; i++) {
      if (i && i % 4 === 0) s += ' ';
      s += (this.bytes[i >>> 3] >>> (7 - (i & 7))) & 1;
    }
    return s;
  }
}

/** MSB-first bit reader over a byte array. */
class BitReader {
  /** @param {ArrayLike<number>} bytes */
  constructor(bytes) {
    this.bytes = bytes;
    this.byteOffset = 0;
    this.bitOffset = 0;
  }

  /** @returns {number} Bits not yet consumed. */
  available() {
    return 8 * (this.bytes.length - this.byteOffset) - this.bitOffset;
  }

  /**
   * Read `count` bits (1..32) as an unsigned integer, most significant first.
   *
   * @param {number} count
   * @returns {number}
   * @throws {FormatError} If the stream is exhausted.
   */
  read(count) {
    if (count < 1 || count > 32) {
      throw new FormatError(`BitReader: cannot read ${count} bits`);
    }
    if (count > this.available()) {
      throw new FormatError(
        `BitReader: needed ${count} bits, ${this.available()} remain`
      );
    }

    let result = 0;
    let remaining = count;

    // Finish the partially consumed byte first, then take whole bytes.
    if (this.bitOffset > 0) {
      const inCurrent = 8 - this.bitOffset;
      const take = Math.min(remaining, inCurrent);
      const shift = inCurrent - take;
      const mask = (0xff >> this.bitOffset) & ~((1 << shift) - 1);
      result = (this.bytes[this.byteOffset] & mask) >> shift;
      remaining -= take;
      this.bitOffset += take;
      if (this.bitOffset === 8) {
        this.bitOffset = 0;
        this.byteOffset++;
      }
    }

    while (remaining >= 8) {
      result = (result << 8) | (this.bytes[this.byteOffset] & 0xff);
      this.byteOffset++;
      remaining -= 8;
    }

    if (remaining > 0) {
      const shift = 8 - remaining;
      const mask = ~((1 << shift) - 1) & 0xff;
      result = (result << remaining) | ((this.bytes[this.byteOffset] & mask) >> shift);
      this.bitOffset += remaining;
    }

    return result >>> 0;
  }

  /** @returns {boolean} */
  readBit() {
    return this.read(1) === 1;
  }
}

__exports.BitWriter = BitWriter;
__exports.BitReader = BitReader;
};

__modules["qr/tables.js"] = function (__require, __exports) {
/**
 * QR Code structural tables.
 *
 * The design principle here is that as little as possible is *recalled* and as
 * much as possible is *derived*, because a barcode table is the one place where
 * a single mistyped digit produces a symbol that looks perfect and scans as
 * garbage — or, worse, scans correctly for the payload you tested and fails for
 * the payload your user sends.
 *
 * So:
 *
 *   - Symbol size, function-pattern layout and total codeword capacity are
 *     computed from geometry. Nothing is tabulated that the module grid already
 *     knows.
 *   - Alignment centres come from the spec's spacing rule, not a 40-row table.
 *   - The group-1 / group-2 block split is arithmetic, not data.
 *
 * That leaves exactly three recalled numbers per (version, level): the error
 * correction codewords per block, the block count, and the total data codeword
 * count. Those three are deliberately redundant — they must satisfy
 *
 *     blocks * eccPerBlock + totalDataCodewords === geometricTotalCodewords(v)
 *
 * for all 160 combinations, where the right-hand side is counted off the module
 * grid. Any single typo on either side breaks the identity. {@link validateTables}
 * enforces it, and the test suite asserts it returns no problems.
 *
 * @module qr/tables
 */
const { BitMatrix } = __require("core/bit-matrix.js");

/** Error correction levels, weakest to strongest. */
const ECC_LEVELS = ['L', 'M', 'Q', 'H'];

/**
 * Two-bit level indicator used in the format information.
 * Note this is *not* the L/M/Q/H ordering — the spec assigns them out of order.
 */
const ECC_LEVEL_BITS = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };

/** Inverse of {@link ECC_LEVEL_BITS}, indexed by the 2-bit value. */
const ECC_LEVEL_BY_BITS = ['M', 'L', 'H', 'Q'];
const MIN_VERSION = 1;
const MAX_VERSION = 40;

/** Version at and above which an 18-bit version information block is carried. */
const VERSION_INFO_MIN = 7;

/** Mode indicator nibbles. */
const MODE = {
  TERMINATOR: 0x0,
  NUMERIC: 0x1,
  ALPHANUMERIC: 0x2,
  STRUCTURED_APPEND: 0x3,
  BYTE: 0x4,
  FNC1_FIRST: 0x5,
  ECI: 0x7,
  KANJI: 0x8,
  FNC1_SECOND: 0x9,
};

/**
 * Character count indicator width, in bits, by mode and version band.
 *
 * The bands are versions 1-9, 10-26 and 27-40. They are the reason segment
 * selection and version selection are mutually dependent: widening the count
 * field can push a payload over a version boundary, which widens it again.
 */
const COUNT_BITS = {
  [MODE.NUMERIC]: [10, 12, 14],
  [MODE.ALPHANUMERIC]: [9, 11, 13],
  [MODE.BYTE]: [8, 16, 16],
  [MODE.KANJI]: [8, 10, 12],
};

/**
 * @param {number} version 1-40
 * @returns {number} Modules per side.
 */
function versionSize(version) {
  return 17 + 4 * version;
}

/**
 * Bits in the character count indicator.
 *
 * @param {number} mode One of {@link MODE}.
 * @param {number} version
 * @returns {number}
 */
function countBits(mode, version) {
  const widths = COUNT_BITS[mode];
  if (!widths) return 0;
  if (version <= 9) return widths[0];
  if (version <= 26) return widths[1];
  return widths[2];
}

/**
 * Centre coordinates of the alignment patterns for a version.
 *
 * The spec's rule: the first centre is always 6 and the last is always
 * `size - 7`; the count grows by one every seven versions; and the centres are
 * evenly spaced with the *first* gap absorbing the rounding slack. Expressing
 * that as arithmetic rather than a 40-row table means there is no table to
 * mistype, and {@link validateTables} can then assert the shape of the result.
 *
 * @param {number} version
 * @returns {number[]} Ascending centres. Empty for version 1.
 */
function alignmentCoordinates(version) {
  if (version < 2) return [];

  const size = versionSize(version);
  const count = Math.floor(version / 7) + 2;
  const last = size - 7;

  // Spacing is rounded up to an even number of modules so every centre lands on
  // the same parity as the timing pattern, which is what keeps the patterns
  // aligned with the module grid rather than straddling it.
  const step = Math.ceil((size - 13) / (2 * count - 2)) * 2;

  const coords = [6];
  // Walk backwards from the final centre so the slack lands in the first gap.
  for (let i = count - 1; i >= 1; i--) coords.push(last - (count - 1 - i) * step);
  coords.sort((a, b) => a - b);
  return coords;
}

/**
 * Centres of the alignment patterns actually drawn, as [x, y] pairs.
 *
 * The three combinations that would sit on top of a finder pattern are omitted.
 *
 * @param {number} version
 * @returns {Array<[number, number]>}
 */
function alignmentCentres(version) {
  const coords = alignmentCoordinates(version);
  if (coords.length === 0) return [];

  const size = versionSize(version);
  const lo = 6;
  const hi = size - 7;
  const out = [];
  for (let i = 0; i < coords.length; i++) {
    for (let j = 0; j < coords.length; j++) {
      const x = coords[j];
      const y = coords[i];
      // Skip the three finder corners.
      if (x === lo && y === lo) continue;
      if (x === lo && y === hi) continue;
      if (x === hi && y === lo) continue;
      out.push([x, y]);
    }
  }
  return out;
}

const reservedCache = new Map();

/**
 * Map of modules that carry function patterns rather than payload.
 *
 * A set bit means "reserved": finder, separator, timing, alignment, format
 * information, the dark module, and the version information blocks. This is the
 * single source of truth used by the encoder to skip modules while laying out
 * the bitstream, by the decoder to read them back in the same order, and by
 * {@link geometricTotalCodewords} to count what is left.
 *
 * Deriving capacity this way rather than by hand arithmetic is what makes the
 * awkward cases free: an alignment pattern that overlaps the timing pattern is
 * counted once because it is the same set of modules, not because anyone
 * remembered to subtract five.
 *
 * @param {number} version
 * @returns {BitMatrix} Shared, cached — treat as immutable.
 */
function reservedModules(version) {
  const cached = reservedCache.get(version);
  if (cached) return cached;

  const size = versionSize(version);
  const m = new BitMatrix(size, size);

  // Finder patterns with their separators: an 8x8 reserved block at each of
  // three corners (7x7 pattern plus a one-module light border on the inner
  // sides, which the corner blocks absorb).
  m.setRegion(0, 0, 8, 8);
  m.setRegion(size - 8, 0, 8, 8);
  m.setRegion(0, size - 8, 8, 8);

  // Timing patterns, spanning the gap between the separators.
  for (let i = 8; i < size - 8; i++) {
    m.set(i, 6);
    m.set(6, i);
  }

  // Alignment patterns, 5x5 each.
  const centres = alignmentCentres(version);
  for (let i = 0; i < centres.length; i++) {
    m.setRegion(centres[i][0] - 2, centres[i][1] - 2, 5, 5);
  }

  // Format information: two copies plus the dark module. The copies partly
  // fall inside the 8x8 finder blocks already reserved; setting them again is
  // harmless and keeps the intent explicit.
  const [copyA, copyB] = formatInfoPositions(size);
  for (let i = 0; i < 15; i++) {
    m.set(copyA[i][0], copyA[i][1]);
    m.set(copyB[i][0], copyB[i][1]);
  }
  m.set(8, size - 8); // dark module

  // Version information, two 6x3 blocks.
  if (version >= VERSION_INFO_MIN) {
    m.setRegion(size - 11, 0, 3, 6);
    m.setRegion(0, size - 11, 6, 3);
  }

  reservedCache.set(version, m);
  return m;
}

/**
 * Module positions of the two format information copies.
 *
 * Index `i` in each array is bit `i` of the 15-bit format value, bit 0 being
 * the least significant.
 *
 * CAVEAT WORTH READING: the *direction* of this numbering is the one thing in
 * this file that a round-trip test cannot falsify. Encoder and decoder share
 * these tables, so a mirrored layout would pass every test in the suite and
 * fail only against a real scanner. The layout below is the standard one; both
 * sides deliberately consume this single definition so there is no second place
 * for the convention to drift.
 *
 * @param {number} size Modules per side.
 * @returns {[Array<[number, number]>, Array<[number, number]>]} [copyA, copyB]
 */
function formatInfoPositions(size) {
  /** @type {Array<[number, number]>} */
  const a = [];
  /** @type {Array<[number, number]>} */
  const b = [];

  for (let i = 0; i < 15; i++) {
    // Copy A wraps the top-left finder: down column 8, then left along row 8,
    // stepping over the two timing modules.
    if (i < 6) a.push([8, i]);
    else if (i === 6) a.push([8, 7]);
    else if (i === 7) a.push([8, 8]);
    else if (i === 8) a.push([7, 8]);
    else a.push([14 - i, 8]);

    // Copy B is split: the low bits run right-to-left along row 8 beside the
    // top-right finder, the high bits run bottom-up beside the bottom-left one.
    if (i < 8) b.push([size - 1 - i, 8]);
    else b.push([8, size - 15 + i]);
  }

  return [a, b];
}

/**
 * Modules available to data and error correction, counted off the grid.
 *
 * @param {number} version
 * @returns {number}
 */
function freeModuleCount(version) {
  const reserved = reservedModules(version);
  const size = versionSize(version);
  let free = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!reserved.get(x, y)) free++;
    }
  }
  return free;
}

/**
 * Total codewords (data + error correction) a version holds.
 *
 * Geometric, not tabulated — this is the reference the ECC table is checked
 * against.
 *
 * @param {number} version
 * @returns {number}
 */
function geometricTotalCodewords(version) {
  return Math.floor(freeModuleCount(version) / 8);
}

/**
 * Bits left over after the last whole codeword, written as zeroes.
 *
 * @param {number} version
 * @returns {number} 0, 3, 4 or 7.
 */
function remainderBits(version) {
  return freeModuleCount(version) % 8;
}

const orderCache = new Map();

/**
 * Module positions in bitstream order, as interleaved x, y pairs.
 *
 * The layout walks two-module-wide columns from the bottom-right corner
 * leftward, alternating upward and downward, right module of the pair before
 * the left, skipping the vertical timing column and every reserved module.
 *
 * Encoder and decoder both consume this one function. That is not tidiness: a
 * placement order that disagrees between the two would still round-trip
 * perfectly within this library while producing symbols no scanner can read.
 * There is only one order because there is only one implementation of it.
 *
 * @param {number} version
 * @returns {Int32Array} Shared, cached — treat as immutable. Length is
 *   `2 * freeModuleCount(version)`.
 */
function dataModuleOrder(version) {
  const cached = orderCache.get(version);
  if (cached) return cached;

  const size = versionSize(version);
  const reserved = reservedModules(version);
  const out = new Int32Array(freeModuleCount(version) * 2);
  let n = 0;

  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    // Column 6 is the vertical timing pattern. Stepping over it shifts the
    // whole remaining schedule left by one, so the loop variable itself has to
    // move — adjusting only the current pair would visit column 4 twice and
    // column 0 never, which is self-consistent between encoder and decoder and
    // therefore invisible to a round-trip test.
    if (col === 6) col--;
    for (let i = 0; i < size; i++) {
      const y = upward ? size - 1 - i : i;
      for (let c = 0; c < 2; c++) {
        const x = col - c;
        if (reserved.get(x, y)) continue;
        out[n++] = x;
        out[n++] = y;
      }
    }
    upward = !upward;
  }

  orderCache.set(version, out);
  return out;
}

/**
 * The eight data mask predicates.
 *
 * A true result means the module at (x, y) is inverted. Masks apply to payload
 * modules only; function patterns are laid down after masking and are never
 * touched.
 *
 * @param {number} mask 0-7
 * @param {number} x Column.
 * @param {number} y Row.
 * @returns {boolean}
 */
function maskBit(mask, x, y) {
  switch (mask) {
    case 0: return ((y + x) & 1) === 0;
    case 1: return (y & 1) === 0;
    case 2: return x % 3 === 0;
    case 3: return (y + x) % 3 === 0;
    case 4: return (((y >> 1) + Math.floor(x / 3)) & 1) === 0;
    case 5: return ((y * x) & 1) + ((y * x) % 3) === 0;
    case 6: return ((((y * x) & 1) + ((y * x) % 3)) & 1) === 0;
    case 7: return ((((y + x) & 1) + ((y * x) % 3)) & 1) === 0;
    default:
      throw new RangeError(`QR: mask must be 0-7, got ${mask}`);
  }
}

/**
 * Error correction parameters, indexed `[version - 1]` then by level.
 *
 * Each entry is `[eccCodewordsPerBlock, blockCount, totalDataCodewords]`.
 *
 * The third number is redundant with the first two given the geometric
 * capacity, and that is the entire point: it turns a silent typo into a loud
 * failure. See the module note.
 *
 * @type {Array<{L: number[], M: number[], Q: number[], H: number[]}>}
 */
const ECC_TABLE = [
  /*  1 */ { L: [7, 1, 19], M: [10, 1, 16], Q: [13, 1, 13], H: [17, 1, 9] },
  /*  2 */ { L: [10, 1, 34], M: [16, 1, 28], Q: [22, 1, 22], H: [28, 1, 16] },
  /*  3 */ { L: [15, 1, 55], M: [26, 1, 44], Q: [18, 2, 34], H: [22, 2, 26] },
  /*  4 */ { L: [20, 1, 80], M: [18, 2, 64], Q: [26, 2, 48], H: [16, 4, 36] },
  /*  5 */ { L: [26, 1, 108], M: [24, 2, 86], Q: [18, 4, 62], H: [22, 4, 46] },
  /*  6 */ { L: [18, 2, 136], M: [16, 4, 108], Q: [24, 4, 76], H: [28, 4, 60] },
  /*  7 */ { L: [20, 2, 156], M: [18, 4, 124], Q: [18, 6, 88], H: [26, 5, 66] },
  /*  8 */ { L: [24, 2, 194], M: [22, 4, 154], Q: [22, 6, 110], H: [26, 6, 86] },
  /*  9 */ { L: [30, 2, 232], M: [22, 5, 182], Q: [20, 8, 132], H: [24, 8, 100] },
  /* 10 */ { L: [18, 4, 274], M: [26, 5, 216], Q: [24, 8, 154], H: [28, 8, 122] },
  /* 11 */ { L: [20, 4, 324], M: [30, 5, 254], Q: [28, 8, 180], H: [24, 11, 140] },
  /* 12 */ { L: [24, 4, 370], M: [22, 8, 290], Q: [26, 10, 206], H: [28, 11, 158] },
  /* 13 */ { L: [26, 4, 428], M: [22, 9, 334], Q: [24, 12, 244], H: [22, 16, 180] },
  /* 14 */ { L: [30, 4, 461], M: [24, 9, 365], Q: [20, 16, 261], H: [24, 16, 197] },
  /* 15 */ { L: [22, 6, 523], M: [24, 10, 415], Q: [30, 12, 295], H: [24, 18, 223] },
  /* 16 */ { L: [24, 6, 589], M: [28, 10, 453], Q: [24, 17, 325], H: [30, 16, 253] },
  /* 17 */ { L: [28, 6, 647], M: [28, 11, 507], Q: [28, 16, 367], H: [28, 19, 283] },
  /* 18 */ { L: [30, 6, 721], M: [26, 13, 563], Q: [28, 18, 397], H: [28, 21, 313] },
  /* 19 */ { L: [28, 7, 795], M: [26, 14, 627], Q: [26, 21, 445], H: [26, 25, 341] },
  /* 20 */ { L: [28, 8, 861], M: [26, 16, 669], Q: [30, 20, 485], H: [28, 25, 385] },
  /* 21 */ { L: [28, 8, 932], M: [26, 17, 714], Q: [28, 23, 512], H: [30, 25, 406] },
  /* 22 */ { L: [28, 9, 1006], M: [28, 17, 782], Q: [30, 23, 568], H: [24, 34, 442] },
  /* 23 */ { L: [30, 9, 1094], M: [28, 18, 860], Q: [30, 25, 614], H: [30, 30, 464] },
  /* 24 */ { L: [30, 10, 1174], M: [28, 20, 914], Q: [30, 27, 664], H: [30, 32, 514] },
  /* 25 */ { L: [26, 12, 1276], M: [28, 21, 1000], Q: [30, 29, 718], H: [30, 35, 538] },
  /* 26 */ { L: [28, 12, 1370], M: [28, 23, 1062], Q: [28, 34, 754], H: [30, 37, 596] },
  /* 27 */ { L: [30, 12, 1468], M: [28, 25, 1128], Q: [30, 34, 808], H: [30, 40, 628] },
  /* 28 */ { L: [30, 13, 1531], M: [28, 26, 1193], Q: [30, 35, 871], H: [30, 42, 661] },
  /* 29 */ { L: [30, 14, 1631], M: [28, 28, 1267], Q: [30, 38, 911], H: [30, 45, 701] },
  /* 30 */ { L: [30, 15, 1735], M: [28, 29, 1373], Q: [30, 40, 985], H: [30, 48, 745] },
  /* 31 */ { L: [30, 16, 1843], M: [28, 31, 1455], Q: [30, 43, 1033], H: [30, 51, 793] },
  /* 32 */ { L: [30, 17, 1955], M: [28, 33, 1541], Q: [30, 45, 1115], H: [30, 54, 845] },
  /* 33 */ { L: [30, 18, 2071], M: [28, 35, 1631], Q: [30, 48, 1171], H: [30, 57, 901] },
  /* 34 */ { L: [30, 19, 2191], M: [28, 37, 1725], Q: [30, 51, 1231], H: [30, 60, 961] },
  /* 35 */ { L: [30, 19, 2306], M: [28, 38, 1812], Q: [30, 53, 1286], H: [30, 63, 986] },
  /* 36 */ { L: [30, 20, 2434], M: [28, 40, 1914], Q: [30, 56, 1354], H: [30, 66, 1054] },
  /* 37 */ { L: [30, 21, 2566], M: [28, 43, 1992], Q: [30, 59, 1426], H: [30, 70, 1096] },
  /* 38 */ { L: [30, 22, 2702], M: [28, 45, 2102], Q: [30, 62, 1502], H: [30, 74, 1142] },
  /* 39 */ { L: [30, 24, 2812], M: [28, 47, 2216], Q: [30, 65, 1582], H: [30, 77, 1222] },
  /* 40 */ { L: [30, 25, 2956], M: [28, 49, 2334], Q: [30, 68, 1666], H: [30, 81, 1276] },
];

/**
 * @typedef {object} BlockLayout
 * @property {number} version
 * @property {string} ecc
 * @property {number} totalCodewords    Data + error correction.
 * @property {number} totalDataCodewords
 * @property {number} eccPerBlock
 * @property {number} blockCount
 * @property {number} group1Blocks      Blocks holding the smaller data count.
 * @property {number} group1DataCount
 * @property {number} group2Blocks      Blocks holding one extra data codeword.
 * @property {number} group2DataCount
 * @property {number} remainderBits
 */

/**
 * Block structure for a (version, level).
 *
 * The group split is derived: the spec distributes the remainder of
 * `data / blocks` one codeword at a time into the *trailing* blocks, so the
 * short blocks come first. That is arithmetic, and tabulating it would only
 * create somewhere else for a typo to hide.
 *
 * @param {number} version
 * @param {string} ecc 'L' | 'M' | 'Q' | 'H'
 * @returns {BlockLayout}
 */
function blockLayout(version, ecc) {
  if (version < MIN_VERSION || version > MAX_VERSION || (version | 0) !== version) {
    throw new RangeError(`QR: version must be an integer 1-40, got ${version}`);
  }
  const entry = ECC_TABLE[version - 1][ecc];
  if (!entry) throw new RangeError(`QR: unknown error correction level "${ecc}"`);

  const eccPerBlock = entry[0];
  const blockCount = entry[1];
  const totalDataCodewords = entry[2];

  const base = Math.floor(totalDataCodewords / blockCount);
  const extra = totalDataCodewords % blockCount;

  return {
    version,
    ecc,
    totalCodewords: totalDataCodewords + eccPerBlock * blockCount,
    totalDataCodewords,
    eccPerBlock,
    blockCount,
    group1Blocks: blockCount - extra,
    group1DataCount: base,
    group2Blocks: extra,
    group2DataCount: base + 1,
    remainderBits: remainderBits(version),
  };
}

/**
 * Data capacity in codewords.
 *
 * @param {number} version
 * @param {string} ecc
 * @returns {number}
 */
function dataCodewords(version, ecc) {
  return ECC_TABLE[version - 1][ecc][2];
}

/**
 * Data capacity in bits.
 *
 * @param {number} version
 * @param {string} ecc
 * @returns {number}
 */
function dataBitCapacity(version, ecc) {
  return dataCodewords(version, ecc) * 8;
}

/** Error correction codewords per block are drawn from this set and no other. */
const VALID_ECC_PER_BLOCK = [7, 10, 13, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30];

/**
 * Remainder bits by version band, from the spec. Independent of anything the
 * ECC table says, so it validates the *geometry* — chiefly the alignment
 * pattern spacing rule, which is otherwise only checked by its own shape.
 *
 * @param {number} version
 * @returns {number}
 */
function expectedRemainderBits(version) {
  if (version === 1) return 0;
  if (version <= 6) return 7;
  if (version <= 13) return 0;
  if (version <= 20) return 3;
  if (version <= 27) return 4;
  if (version <= 34) return 3;
  return 0;
}

/**
 * Self-check every table in this file.
 *
 * The load-bearing assertion is the capacity identity across all 160
 * (version, level) combinations, but a pair of compensating typos could in
 * principle slip past it, so the surrounding checks each constrain a different
 * axis: monotonicity, the closed set of ECC block sizes, the field size limit,
 * and the shape of the alignment coordinate sequence.
 *
 * @returns {string[]} Human-readable problems; empty means everything holds.
 */
function validateTables() {
  const problems = [];

  for (let version = MIN_VERSION; version <= MAX_VERSION; version++) {
    const size = versionSize(version);
    const total = geometricTotalCodewords(version);

    // --- Geometry ------------------------------------------------------
    const rem = remainderBits(version);
    if (rem !== expectedRemainderBits(version)) {
      problems.push(
        `v${version}: remainder bits ${rem}, expected ${expectedRemainderBits(version)} ` +
        `(free modules ${freeModuleCount(version)}) — check the alignment spacing rule`
      );
    }

    // --- Placement order ----------------------------------------------
    // Every free module must be visited exactly once. A placement order that
    // skips one module and visits another twice is still perfectly
    // self-consistent — the encoder writes and the decoder reads the same
    // wrong sequence — so a round-trip test cannot see it. What it does is
    // silently burn error correction budget on every symbol produced. This is
    // the only check that catches it.
    const order = dataModuleOrder(version);
    const free = freeModuleCount(version);
    if (order.length !== free * 2) {
      problems.push(
        `v${version}: placement order visits ${order.length / 2} modules, expected ${free}`
      );
    } else {
      const seen = new Uint8Array(size * size);
      let duplicates = 0;
      let reservedHits = 0;
      const reserved = reservedModules(version);
      for (let p = 0; p < order.length; p += 2) {
        const x = order[p];
        const y = order[p + 1];
        if (reserved.get(x, y)) reservedHits++;
        if (seen[y * size + x]++) duplicates++;
      }
      if (duplicates > 0) {
        problems.push(`v${version}: placement order visits ${duplicates} modules more than once`);
      }
      if (reservedHits > 0) {
        problems.push(`v${version}: placement order includes ${reservedHits} function modules`);
      }
    }

    // --- Alignment coordinates ----------------------------------------
    const coords = alignmentCoordinates(version);
    if (version === 1) {
      if (coords.length !== 0) problems.push(`v1: expected no alignment coordinates, got ${coords.length}`);
    } else {
      const expectedCount = Math.floor(version / 7) + 2;
      if (coords.length !== expectedCount) {
        problems.push(`v${version}: ${coords.length} alignment coordinates, expected ${expectedCount}`);
      }
      if (coords[0] !== 6) {
        problems.push(`v${version}: first alignment coordinate ${coords[0]}, expected 6`);
      }
      if (coords[coords.length - 1] !== size - 7) {
        problems.push(
          `v${version}: last alignment coordinate ${coords[coords.length - 1]}, expected ${size - 7}`
        );
      }
      for (let i = 1; i < coords.length; i++) {
        if (coords[i] <= coords[i - 1]) {
          problems.push(`v${version}: alignment coordinates not strictly increasing at index ${i}`);
        }
      }
      if (coords.length >= 3) {
        // Every gap after the first must be identical, and the first gap must
        // not exceed it — the slack is absorbed at the start, never the end.
        const step = coords[2] - coords[1];
        for (let i = 3; i < coords.length; i++) {
          if (coords[i] - coords[i - 1] !== step) {
            problems.push(
              `v${version}: alignment gap ${coords[i] - coords[i - 1]} at index ${i}, expected ${step}`
            );
          }
        }
        if (coords[1] - coords[0] > step) {
          problems.push(
            `v${version}: first alignment gap ${coords[1] - coords[0]} exceeds step ${step}`
          );
        }
        if (step % 2 !== 0) {
          problems.push(`v${version}: alignment step ${step} is odd`);
        }
      }
    }

    // --- Error correction table ---------------------------------------
    for (let l = 0; l < ECC_LEVELS.length; l++) {
      const ecc = ECC_LEVELS[l];
      const layout = blockLayout(version, ecc);
      const tag = `v${version}-${ecc}`;

      // THE identity. Everything else is a supporting check.
      if (layout.totalCodewords !== total) {
        problems.push(
          `${tag}: ${layout.blockCount} blocks x ${layout.eccPerBlock} ECC + ` +
          `${layout.totalDataCodewords} data = ${layout.totalCodewords} codewords, ` +
          `but the grid holds ${total}`
        );
      }

      if (VALID_ECC_PER_BLOCK.indexOf(layout.eccPerBlock) === -1) {
        problems.push(`${tag}: ${layout.eccPerBlock} ECC codewords per block is not a valid value`);
      }
      if (layout.blockCount < 1) {
        problems.push(`${tag}: block count ${layout.blockCount}`);
      }
      if (layout.group1DataCount < 1) {
        problems.push(`${tag}: ${layout.totalDataCodewords} data codewords across ${layout.blockCount} blocks`);
      }
      if (layout.group1Blocks + layout.group2Blocks !== layout.blockCount) {
        problems.push(`${tag}: group split does not sum to the block count`);
      }
      if (
        layout.group1Blocks * layout.group1DataCount +
        layout.group2Blocks * layout.group2DataCount !== layout.totalDataCodewords
      ) {
        problems.push(`${tag}: group sizes do not sum to the data codeword count`);
      }
      // Reed-Solomon over GF(256) cannot address a codeword longer than 255.
      if (layout.group2DataCount + layout.eccPerBlock > 255) {
        problems.push(
          `${tag}: block length ${layout.group2DataCount + layout.eccPerBlock} exceeds GF(256)`
        );
      }

      // Stronger correction must cost capacity, never gain it.
      if (l > 0) {
        const weaker = dataCodewords(version, ECC_LEVELS[l - 1]);
        if (layout.totalDataCodewords >= weaker) {
          problems.push(
            `${tag}: ${layout.totalDataCodewords} data codewords is not less than ` +
            `${ECC_LEVELS[l - 1]}'s ${weaker}`
          );
        }
      }

      // Capacity must grow with version.
      if (version > MIN_VERSION) {
        const smaller = dataCodewords(version - 1, ecc);
        if (layout.totalDataCodewords <= smaller) {
          problems.push(
            `${tag}: ${layout.totalDataCodewords} data codewords is not more than ` +
            `v${version - 1}-${ecc}'s ${smaller}`
          );
        }
      }
    }
  }

  return problems;
}

__exports.ECC_LEVELS = ECC_LEVELS;
__exports.ECC_LEVEL_BITS = ECC_LEVEL_BITS;
__exports.ECC_LEVEL_BY_BITS = ECC_LEVEL_BY_BITS;
__exports.MIN_VERSION = MIN_VERSION;
__exports.MAX_VERSION = MAX_VERSION;
__exports.VERSION_INFO_MIN = VERSION_INFO_MIN;
__exports.MODE = MODE;
__exports.versionSize = versionSize;
__exports.countBits = countBits;
__exports.alignmentCoordinates = alignmentCoordinates;
__exports.alignmentCentres = alignmentCentres;
__exports.reservedModules = reservedModules;
__exports.formatInfoPositions = formatInfoPositions;
__exports.freeModuleCount = freeModuleCount;
__exports.geometricTotalCodewords = geometricTotalCodewords;
__exports.remainderBits = remainderBits;
__exports.dataModuleOrder = dataModuleOrder;
__exports.maskBit = maskBit;
__exports.blockLayout = blockLayout;
__exports.dataCodewords = dataCodewords;
__exports.dataBitCapacity = dataBitCapacity;
__exports.validateTables = validateTables;
};

__modules["qr/encoder.js"] = function (__require, __exports) {
/**
 * QR Code encoder.
 *
 * Pipeline: analyse the text into mode segments, pick the smallest version that
 * holds them, serialise the bitstream, split it into Reed-Solomon blocks,
 * interleave data and parity, lay the result into the module grid along the
 * zig-zag path, then choose the mask that scores best under the four penalty
 * rules.
 *
 * Segment selection is a shortest-path problem, not a greedy scan. "1234ABCD"
 * is cheaper as one alphanumeric segment than as numeric plus alphanumeric,
 * because a mode switch costs a mode indicator plus a character count field;
 * whether that trade pays depends on run lengths that a left-to-right scan
 * cannot see yet. The dynamic program below weighs it properly.
 *
 * It also has to run *per version band*, because the character count field
 * widens at versions 10 and 27 — so the cheapest segmentation depends on the
 * version, and the smallest sufficient version depends on the segmentation.
 * {@link encodeQR} resolves the circularity by solving each band independently
 * and taking the first version that fits.
 *
 * @module qr/encoder
 */
const { BitMatrix } = __require("core/bit-matrix.js");
const { BitWriter } = __require("core/bit-buffer.js");
const { EncodeError } = __require("core/errors.js");
const { GF256_QR } = __require("core/galois-field.js");
const { rsEncode } = __require("core/reed-solomon.js");
const { ECC_LEVELS, ECC_LEVEL_BITS, MAX_VERSION, MIN_VERSION, MODE, VERSION_INFO_MIN, alignmentCentres, blockLayout, countBits, dataBitCapacity, dataModuleOrder, formatInfoPositions, maskBit, versionSize } = __require("qr/tables.js");

/** Alphanumeric mode character set; a character's index is its encoded value. */
const ALPHANUMERIC_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

/** ECI designator for UTF-8. */
const ECI_UTF8 = 26;

/** BCH(15,5) generator for the format information: x^10+x^8+x^5+x^4+x^2+x+1. */
const FORMAT_GENERATOR = 0x537;

/** Applied to the format information so an all-zero payload is not all-zero. */
const FORMAT_MASK = 0x5412;

/** BCH(18,6) generator for the version information. */
const VERSION_GENERATOR = 0x1f25;

/**
 * @typedef {object} EncodeOptions
 * @property {'L'|'M'|'Q'|'H'} [ecc] Error correction level. Default 'M'.
 * @property {number} [version] Force a version 1-40 instead of the smallest fit.
 * @property {number} [mask] Force a mask 0-7 instead of the best-scoring one.
 * @property {'auto'|'utf-8'|'iso-8859-1'} [charset] Byte mode interpretation.
 *   'auto' uses ISO-8859-1 when the text allows it and UTF-8 with an ECI
 *   header otherwise.
 * @property {boolean} [kanji] Allow kanji mode. Default true; ignored when the
 *   platform cannot supply a Shift_JIS codec.
 */

/* ------------------------------------------------------------------ *
 * Character classification
 * ------------------------------------------------------------------ */

/**
 * @param {string} ch Single code point.
 * @returns {boolean}
 */
function isNumeric(ch) {
  return ch >= '0' && ch <= '9';
}

/**
 * @param {string} ch Single code point.
 * @returns {number} Alphanumeric value, or -1.
 */
function alphanumericValue(ch) {
  return ALPHANUMERIC_CHARS.indexOf(ch);
}

/**
 * UTF-8 length of a code point, without allocating.
 *
 * @param {number} cp
 * @returns {number} 1-4.
 */
function utf8Length(cp) {
  if (cp < 0x80) return 1;
  if (cp < 0x800) return 2;
  if (cp < 0x10000) return 3;
  return 4;
}

/* ------------------------------------------------------------------ *
 * Shift_JIS
 * ------------------------------------------------------------------ */

/**
 * Pack a Shift_JIS double byte into the 13-bit kanji mode value.
 *
 * The two covered ranges are folded onto a single contiguous space by
 * subtracting a different offset from each, then re-basing the low byte to 0xC0
 * values per high byte.
 *
 * @param {number} sjis 16-bit Shift_JIS value.
 * @returns {number} 13-bit value, or -1 if outside the kanji mode ranges.
 */
function sjisToThirteenBits(sjis) {
  // The trail byte must be a real Shift_JIS one. This is not defensive
  // decoration: the packing is only injective while the rebased low byte stays
  // below 0xC0, which holds for trail bytes 0x40-0xFC and fails for anything
  // below 0x40. Accepting those would silently map two inputs to one value.
  const trail = sjis & 0xff;
  if (trail < 0x40 || trail === 0x7f || trail > 0xfc) return -1;

  let v;
  if (sjis >= 0x8140 && sjis <= 0x9ffc) v = sjis - 0x8140;
  else if (sjis >= 0xe040 && sjis <= 0xebbf) v = sjis - 0xc140;
  else return -1;

  const packed = ((v >> 8) * 0xc0) + (v & 0xff);
  return packed > 0x1fff ? -1 : packed;
}

/** @type {Map<string, number> | null} Unicode code point -> Shift_JIS. */
let sjisReverseMap = null;
/** @type {boolean} True once we have tried and know whether it worked. */
let sjisReverseTried = false;

/**
 * Build the Unicode -> Shift_JIS map by inverting the platform's decoder.
 *
 * There is no `TextEncoder` for legacy encodings, so the map is derived by
 * decoding every double byte in the two kanji ranges once and recording what
 * comes back. That is around ten thousand two-byte decodes, done lazily and
 * cached, and only ever paid by text that actually contains kanji.
 *
 * @returns {Map<string, number> | null} Null when the platform has no
 *   Shift_JIS decoder, in which case kanji mode is simply not offered.
 */
function getSjisReverseMap() {
  if (sjisReverseTried) return sjisReverseMap;
  sjisReverseTried = true;

  let decoder;
  try {
    decoder = new TextDecoder('shift_jis', { fatal: true });
    // Some runtimes accept the label and then decode everything to U+FFFD.
    if (decoder.decode(new Uint8Array([0x82, 0xa0])) !== 'あ') return null;
  } catch (e) {
    return null;
  }

  const map = new Map();
  const buf = new Uint8Array(2);
  const ranges = [[0x8140, 0x9ffc], [0xe040, 0xebbf]];

  for (let r = 0; r < ranges.length; r++) {
    for (let sjis = ranges[r][0]; sjis <= ranges[r][1]; sjis++) {
      const lo = sjis & 0xff;
      // Shift_JIS trail bytes never take these values.
      if (lo < 0x40 || lo === 0x7f || lo > 0xfc) continue;
      if (sjisToThirteenBits(sjis) < 0) continue;
      buf[0] = sjis >> 8;
      buf[1] = lo;
      let text;
      try {
        text = decoder.decode(buf);
      } catch (e) {
        continue;
      }
      // Reject anything that did not decode to exactly one code point, and
      // keep the first (lowest) encoding when a character has several.
      if (text.length === 0 || Array.from(text).length !== 1) continue;
      if (!map.has(text)) map.set(text, sjis);
    }
  }

  sjisReverseMap = map;
  return map;
}

/* ------------------------------------------------------------------ *
 * Segment analysis
 * ------------------------------------------------------------------ */

/** Modes considered by the segmentation search, in table order. */
const SEARCH_MODES = [MODE.NUMERIC, MODE.ALPHANUMERIC, MODE.BYTE, MODE.KANJI];

/**
 * Cost unit: one sixth of a bit, so numeric (10 bits per 3 characters) and
 * alphanumeric (11 bits per 2) are both exact integers.
 */
const UNIT = 6;
const COST_NUMERIC = 20;      // 10/3 bits
const COST_ALPHANUMERIC = 33; // 11/2 bits
const COST_KANJI = 78;        // 13 bits
const INFEASIBLE = Number.MAX_SAFE_INTEGER / 4;

/**
 * @typedef {object} CharInfo
 * @property {string[]} points Code points.
 * @property {Uint8Array} numeric
 * @property {Int32Array} alnum Alphanumeric value, or -1.
 * @property {Int32Array} byteLen Bytes this code point costs in byte mode.
 * @property {Int32Array} kanji 13-bit kanji value, or -1.
 * @property {boolean} utf8
 */

/**
 * @param {string} text
 * @param {boolean} utf8
 * @param {boolean} allowKanji
 * @returns {CharInfo}
 */
function classify(text, utf8, allowKanji) {
  const points = Array.from(text);
  const n = points.length;
  const numeric = new Uint8Array(n);
  const alnum = new Int32Array(n);
  const byteLen = new Int32Array(n);
  const kanji = new Int32Array(n);

  const reverse = allowKanji ? getSjisReverseMap() : null;

  for (let i = 0; i < n; i++) {
    const ch = points[i];
    const cp = ch.codePointAt(0);
    numeric[i] = isNumeric(ch) ? 1 : 0;
    alnum[i] = alphanumericValue(ch);
    byteLen[i] = utf8 ? utf8Length(cp) : 1;

    kanji[i] = -1;
    if (reverse) {
      const sjis = reverse.get(ch);
      if (sjis !== undefined) kanji[i] = sjisToThirteenBits(sjis);
    }
  }

  return { points, numeric, alnum, byteLen, kanji, utf8 };
}

/**
 * Cost of one character in a mode, in sixths of a bit.
 *
 * @param {CharInfo} info @param {number} i @param {number} mode
 * @returns {number}
 */
function charCost(info, i, mode) {
  switch (mode) {
    case MODE.NUMERIC: return info.numeric[i] ? COST_NUMERIC : INFEASIBLE;
    case MODE.ALPHANUMERIC: return info.alnum[i] >= 0 ? COST_ALPHANUMERIC : INFEASIBLE;
    case MODE.BYTE: return info.byteLen[i] * 8 * UNIT;
    case MODE.KANJI: return info.kanji[i] >= 0 ? COST_KANJI : INFEASIBLE;
    default: return INFEASIBLE;
  }
}

/**
 * @typedef {object} Segment
 * @property {number} mode
 * @property {number} start Inclusive index into the code point array.
 * @property {number} end Exclusive.
 */

/**
 * Cheapest segmentation for a given version band.
 *
 * Shortest path over (character index, current mode): staying in a mode costs
 * the character, switching costs the character plus a fresh mode indicator and
 * count field.
 *
 * @param {CharInfo} info
 * @param {number} version Any version in the band; only the band matters.
 * @returns {Segment[]}
 */
function segmentize(info, version) {
  const n = info.points.length;
  if (n === 0) return [{ mode: MODE.BYTE, start: 0, end: 0 }];

  const M = SEARCH_MODES.length;
  const header = new Array(M);
  for (let m = 0; m < M; m++) {
    header[m] = (4 + countBits(SEARCH_MODES[m], version)) * UNIT;
  }

  let cost = new Array(M);
  for (let m = 0; m < M; m++) cost[m] = header[m];

  // from[i * M + m] is the mode we were in before character i-1 was appended
  // in mode m. Int8Array is plenty for four modes and keeps this cheap on
  // long payloads.
  const from = new Int8Array((n + 1) * M).fill(-1);

  for (let i = 0; i < n; i++) {
    const next = new Array(M);
    for (let m = 0; m < M; m++) {
      const cc = charCost(info, i, SEARCH_MODES[m]);
      if (cc >= INFEASIBLE) {
        next[m] = INFEASIBLE;
        from[(i + 1) * M + m] = -1;
        continue;
      }

      let bestCost = cost[m];      // stay in this mode
      let bestPrev = m;
      for (let p = 0; p < M; p++) {
        if (p === m) continue;
        const candidate = cost[p] + header[m];
        if (candidate < bestCost) {
          bestCost = candidate;
          bestPrev = p;
        }
      }

      next[m] = bestCost >= INFEASIBLE ? INFEASIBLE : bestCost + cc;
      from[(i + 1) * M + m] = bestPrev;
    }
    cost = next;
  }

  let bestMode = -1;
  let bestCost = INFEASIBLE;
  for (let m = 0; m < M; m++) {
    if (cost[m] < bestCost) {
      bestCost = cost[m];
      bestMode = m;
    }
  }
  if (bestMode < 0) {
    throw new EncodeError('QR: no mode can represent this text');
  }

  // Walk the parent pointers back, collecting mode runs.
  const modeAt = new Int8Array(n);
  let m = bestMode;
  for (let i = n; i > 0; i--) {
    modeAt[i - 1] = m;
    m = from[i * M + m];
  }

  const segments = [];
  let start = 0;
  for (let i = 1; i <= n; i++) {
    if (i === n || modeAt[i] !== modeAt[start]) {
      segments.push({ mode: SEARCH_MODES[modeAt[start]], start, end: i });
      start = i;
    }
  }
  return segments;
}

/**
 * Exact encoded length of a segment.
 *
 * @param {Segment} seg @param {CharInfo} info @param {number} version
 * @returns {number} Bits, including the mode indicator and count field.
 */
function segmentBits(seg, info, version) {
  const n = seg.end - seg.start;
  let payload;
  switch (seg.mode) {
    case MODE.NUMERIC:
      payload = 10 * Math.floor(n / 3) + [0, 4, 7][n % 3];
      break;
    case MODE.ALPHANUMERIC:
      payload = 11 * Math.floor(n / 2) + (n % 2) * 6;
      break;
    case MODE.KANJI:
      payload = 13 * n;
      break;
    default: {
      let bytes = 0;
      for (let i = seg.start; i < seg.end; i++) bytes += info.byteLen[i];
      payload = bytes * 8;
      break;
    }
  }
  return 4 + countBits(seg.mode, version) + payload;
}

/**
 * Character count field value — bytes for byte mode, characters otherwise.
 *
 * @param {Segment} seg @param {CharInfo} info
 * @returns {number}
 */
function segmentCount(seg, info) {
  if (seg.mode !== MODE.BYTE) return seg.end - seg.start;
  let bytes = 0;
  for (let i = seg.start; i < seg.end; i++) bytes += info.byteLen[i];
  return bytes;
}

/* ------------------------------------------------------------------ *
 * Bitstream
 * ------------------------------------------------------------------ */

/**
 * Serialise segments into the data codewords for a version and level.
 *
 * @param {Segment[]} segments @param {CharInfo} info
 * @param {number} version @param {string} ecc @param {boolean} withEci
 * @returns {Uint8Array} Exactly `dataCodewords(version, ecc)` bytes.
 */
function writeBitstream(segments, info, version, ecc, withEci) {
  const writer = new BitWriter();
  const capacity = dataBitCapacity(version, ecc);
  const encoder = info.utf8 ? new TextEncoder() : null;

  if (withEci) {
    writer.put(MODE.ECI, 4);
    writer.put(ECI_UTF8, 8); // single-byte designator form, values 0-127
  }

  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s];
    const count = segmentCount(seg, info);
    const width = countBits(seg.mode, version);
    if (count >= (1 << width)) {
      throw new EncodeError(
        `QR: segment of ${count} does not fit a ${width}-bit count field at version ${version}`
      );
    }

    writer.put(seg.mode, 4);
    writer.put(count, width);

    switch (seg.mode) {
      case MODE.NUMERIC: {
        let i = seg.start;
        while (i + 2 < seg.end) {
          writer.put(
            +info.points[i] * 100 + +info.points[i + 1] * 10 + +info.points[i + 2],
            10
          );
          i += 3;
        }
        const left = seg.end - i;
        if (left === 2) writer.put(+info.points[i] * 10 + +info.points[i + 1], 7);
        else if (left === 1) writer.put(+info.points[i], 4);
        break;
      }

      case MODE.ALPHANUMERIC: {
        let i = seg.start;
        while (i + 1 < seg.end) {
          writer.put(info.alnum[i] * 45 + info.alnum[i + 1], 11);
          i += 2;
        }
        if (i < seg.end) writer.put(info.alnum[i], 6);
        break;
      }

      case MODE.KANJI: {
        for (let i = seg.start; i < seg.end; i++) writer.put(info.kanji[i], 13);
        break;
      }

      default: {
        for (let i = seg.start; i < seg.end; i++) {
          const ch = info.points[i];
          if (encoder) {
            writer.putBytes(encoder.encode(ch));
          } else {
            writer.put(ch.codePointAt(0) & 0xff, 8);
          }
        }
        break;
      }
    }
  }

  if (writer.length > capacity) {
    throw new EncodeError(
      `QR: ${writer.length} bits exceed the ${capacity}-bit capacity of version ${version}-${ecc}`
    );
  }

  // Terminator: up to four zero bits, truncated if the symbol is nearly full.
  const terminator = Math.min(4, capacity - writer.length);
  if (terminator > 0) writer.put(0, terminator);
  writer.padToByte();

  const bytes = writer.toBytes();
  const target = capacity / 8;
  const out = new Uint8Array(target);
  out.set(bytes.subarray(0, Math.min(bytes.length, target)));

  // Pad with the specified alternating filler.
  for (let i = bytes.length; i < target; i++) {
    out[i] = (i - bytes.length) % 2 === 0 ? 0xec : 0x11;
  }
  return out;
}

/**
 * Split into blocks, add Reed-Solomon parity, and interleave.
 *
 * Interleaving is what makes the error correction useful against real damage:
 * a scratch that destroys twenty consecutive codewords in the symbol spreads
 * across every block as one or two errors each, well inside what each block can
 * repair on its own.
 *
 * @param {Uint8Array} data @param {import('./tables.js').BlockLayout} layout
 * @returns {Uint8Array}
 */
function interleave(data, layout) {
  const blocks = [];
  let offset = 0;
  for (let b = 0; b < layout.blockCount; b++) {
    const count = b < layout.group1Blocks ? layout.group1DataCount : layout.group2DataCount;
    const chunk = data.subarray(offset, offset + count);
    offset += count;
    blocks.push({ data: chunk, ecc: rsEncode(chunk, layout.eccPerBlock, GF256_QR, 0) });
  }

  const out = new Uint8Array(layout.totalCodewords);
  let n = 0;

  const maxData = layout.group2Blocks > 0 ? layout.group2DataCount : layout.group1DataCount;
  for (let i = 0; i < maxData; i++) {
    for (let b = 0; b < blocks.length; b++) {
      if (i < blocks[b].data.length) out[n++] = blocks[b].data[i];
    }
  }
  for (let i = 0; i < layout.eccPerBlock; i++) {
    for (let b = 0; b < blocks.length; b++) out[n++] = blocks[b].ecc[i];
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * BCH
 * ------------------------------------------------------------------ */

/**
 * @param {number} v
 * @returns {number} Position of the highest set bit, plus one.
 */
function bitLength(v) {
  let n = 0;
  while (v !== 0) {
    n++;
    v >>>= 1;
  }
  return n;
}

/**
 * Remainder of `value` modulo a BCH generator polynomial, over GF(2).
 *
 * @param {number} value @param {number} generator
 * @returns {number}
 */
function bchRemainder(value, generator) {
  const degree = bitLength(generator) - 1;
  let v = value;
  while (bitLength(v) > degree) {
    v ^= generator << (bitLength(v) - degree - 1);
  }
  return v;
}

/**
 * The 15-bit masked format information.
 *
 * @param {string} ecc @param {number} mask
 * @returns {number}
 */
function formatInfoBits(ecc, mask) {
  const level = ECC_LEVEL_BITS[ecc];
  if (level === undefined) throw new EncodeError(`QR: unknown error correction level "${ecc}"`);
  const data = (level << 3) | mask;
  return ((data << 10) | bchRemainder(data << 10, FORMAT_GENERATOR)) ^ FORMAT_MASK;
}

/**
 * The 18-bit version information, for versions 7 and up.
 *
 * @param {number} version
 * @returns {number}
 */
function versionInfoBits(version) {
  return (version << 12) | bchRemainder(version << 12, VERSION_GENERATOR);
}

/* ------------------------------------------------------------------ *
 * Module layout
 * ------------------------------------------------------------------ */

/**
 * Clear a rectangle. The counterpart of `setRegion`, which BitMatrix does not
 * need often enough to carry.
 *
 * @param {BitMatrix} m @param {number} x @param {number} y
 * @param {number} w @param {number} h
 */
function clearRegion(m, x, y, w, h) {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) m.unset(i, j);
  }
}

/**
 * Draw finders, separators, timing, alignment and the dark module.
 *
 * @param {BitMatrix} m @param {number} version
 */
function drawFunctionPatterns(m, version) {
  const size = versionSize(version);

  // Finder patterns: 7x7 dark ring, light ring, 3x3 dark core. Separators are
  // simply left light, which they already are.
  const corners = [[0, 0], [size - 7, 0], [0, size - 7]];
  for (let c = 0; c < corners.length; c++) {
    const [x, y] = corners[c];
    m.setRegion(x, y, 7, 7);
    clearRegion(m, x + 1, y + 1, 5, 5);
    m.setRegion(x + 2, y + 2, 3, 3);
  }

  // Timing patterns: dark on even coordinates, which keeps them in phase with
  // the finder edges they run between.
  for (let i = 8; i < size - 8; i++) {
    if ((i & 1) === 0) {
      m.set(i, 6);
      m.set(6, i);
    }
  }

  // Alignment patterns: 5x5 dark ring, light ring, single dark centre.
  const centres = alignmentCentres(version);
  for (let c = 0; c < centres.length; c++) {
    const [cx, cy] = centres[c];
    m.setRegion(cx - 2, cy - 2, 5, 5);
    clearRegion(m, cx - 1, cy - 1, 3, 3);
    m.set(cx, cy);
  }

  // The dark module, which is always set and carries no information.
  m.set(8, size - 8);
}

/**
 * @param {BitMatrix} m @param {number} version @param {string} ecc @param {number} mask
 */
function drawFormatInfo(m, version, ecc, mask) {
  const size = versionSize(version);
  const bits = formatInfoBits(ecc, mask);
  const [a, b] = formatInfoPositions(size);
  for (let i = 0; i < 15; i++) {
    const on = ((bits >> i) & 1) === 1;
    m.setValue(a[i][0], a[i][1], on);
    m.setValue(b[i][0], b[i][1], on);
  }
}

/**
 * @param {BitMatrix} m @param {number} version
 */
function drawVersionInfo(m, version) {
  if (version < VERSION_INFO_MIN) return;
  const size = versionSize(version);
  const bits = versionInfoBits(version);
  for (let i = 0; i < 18; i++) {
    const on = ((bits >> i) & 1) === 1;
    const major = Math.floor(i / 3);
    const minor = i % 3;
    m.setValue(major, size - 11 + minor, on);   // bottom-left block
    m.setValue(size - 11 + minor, major, on);   // top-right block, transposed
  }
}

/**
 * Lay the interleaved codewords along the zig-zag path, applying the mask.
 *
 * @param {BitMatrix} m @param {number} version @param {Uint8Array} codewords
 * @param {number} mask
 */
function placeData(m, version, codewords, mask) {
  const order = dataModuleOrder(version);
  const available = codewords.length * 8;

  for (let p = 0, bit = 0; p < order.length; p += 2, bit++) {
    const x = order[p];
    const y = order[p + 1];
    // Past the last codeword are the remainder bits, which are always zero.
    let dark = bit < available &&
      ((codewords[bit >> 3] >> (7 - (bit & 7))) & 1) === 1;
    if (maskBit(mask, x, y)) dark = !dark;
    m.setValue(x, y, dark);
  }
}

/* ------------------------------------------------------------------ *
 * Mask scoring
 * ------------------------------------------------------------------ */

/** The 11-module finder-lookalike runs that rule 3 punishes. */
const RULE3_A = 0b10111010000;
const RULE3_B = 0b00001011101;

/**
 * The four penalty rules. Lower is better.
 *
 * These exist to keep a symbol readable: long uniform runs and large blocks
 * confuse the binarizer, finder lookalikes confuse the detector, and a symbol
 * far from half dark loses contrast headroom. Scoring is a heuristic, not a
 * correctness surface — any of the eight masks decodes, because the format
 * information says which one was used.
 *
 * @param {BitMatrix} m
 * @returns {number}
 */
function maskPenalty(m) {
  const size = m.width;
  let penalty = 0;

  // Rule 1: runs of five or more identical modules, per row and per column.
  for (let axis = 0; axis < 2; axis++) {
    for (let a = 0; a < size; a++) {
      let run = 1;
      let prev = axis === 0 ? m.get(0, a) : m.get(a, 0);
      for (let b = 1; b < size; b++) {
        const cur = axis === 0 ? m.get(b, a) : m.get(a, b);
        if (cur === prev) {
          run++;
        } else {
          if (run >= 5) penalty += 3 + (run - 5);
          prev = cur;
          run = 1;
        }
      }
      if (run >= 5) penalty += 3 + (run - 5);
    }
  }

  // Rule 2: every 2x2 block of one colour.
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const v = m.get(x, y);
      if (v === m.get(x + 1, y) && v === m.get(x, y + 1) && v === m.get(x + 1, y + 1)) {
        penalty += 3;
      }
    }
  }

  // Rule 3: the 1:1:3:1:1 finder ratio with four light modules on one side.
  // An 11-module sliding window in each direction catches both orientations.
  for (let axis = 0; axis < 2; axis++) {
    for (let a = 0; a < size; a++) {
      let window = 0;
      for (let b = 0; b < size; b++) {
        const bit = (axis === 0 ? m.get(b, a) : m.get(a, b)) ? 1 : 0;
        window = ((window << 1) | bit) & 0x7ff;
        if (b >= 10 && (window === RULE3_A || window === RULE3_B)) penalty += 40;
      }
    }
  }

  // Rule 4: departure from an even split of dark and light.
  let dark = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (m.get(x, y)) dark++;
    }
  }
  const percent = (dark * 100) / (size * size);
  penalty += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return penalty;
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/**
 * Build the module grid for a version, level, mask and payload.
 *
 * @param {number} version @param {string} ecc @param {number} mask
 * @param {Uint8Array} codewords
 * @returns {BitMatrix}
 */
function buildMatrix(version, ecc, mask, codewords) {
  const m = new BitMatrix(versionSize(version));
  drawFunctionPatterns(m, version);
  placeData(m, version, codewords, mask);
  drawFormatInfo(m, version, ecc, mask);
  drawVersionInfo(m, version);
  return m;
}

/**
 * Encode text as a QR Code.
 *
 * The result carries no quiet zone; callers add one with
 * `matrix.withMargin(4)`. Keeping the margin out of the encoder means the
 * renderer decides it, which is where the decision belongs — a symbol embedded
 * in a design and a symbol printed on a label want different borders.
 *
 * @param {string} text
 * @param {EncodeOptions} [options]
 * @returns {BitMatrix} Set bit = dark module.
 * @throws {EncodeError} If the text does not fit, or the options are invalid.
 */
function encodeQR(text, options = {}) {
  if (typeof text !== 'string') {
    throw new EncodeError('QR: text must be a string');
  }

  const ecc = options.ecc ?? 'M';
  if (ECC_LEVELS.indexOf(ecc) === -1) {
    throw new EncodeError(`QR: error correction level must be L, M, Q or H, got "${ecc}"`);
  }

  const forcedVersion = options.version;
  if (forcedVersion !== undefined) {
    if (!Number.isInteger(forcedVersion) || forcedVersion < MIN_VERSION || forcedVersion > MAX_VERSION) {
      throw new EncodeError(`QR: version must be an integer 1-40, got ${forcedVersion}`);
    }
  }

  const forcedMask = options.mask;
  if (forcedMask !== undefined && (!Number.isInteger(forcedMask) || forcedMask < 0 || forcedMask > 7)) {
    throw new EncodeError(`QR: mask must be an integer 0-7, got ${forcedMask}`);
  }

  // Byte mode interpretation. ISO-8859-1 is the default ECI, so Latin-1 text
  // needs no header; anything else goes out as UTF-8 with ECI 26 announced.
  const charset = options.charset ?? 'auto';
  let utf8;
  if (charset === 'utf-8') utf8 = true;
  else if (charset === 'iso-8859-1') utf8 = false;
  else if (charset === 'auto') utf8 = !isLatin1(text);
  else throw new EncodeError(`QR: unknown charset "${charset}"`);

  if (!utf8 && !isLatin1(text)) {
    throw new EncodeError('QR: text contains characters outside ISO-8859-1');
  }

  const allowKanji = options.kanji !== false;
  const info = classify(text, utf8, allowKanji);

  // Solve each version band once — the count field widths, and therefore the
  // cheapest segmentation, are constant within a band.
  const bands = [[1, 9], [10, 26], [27, 40]];
  let chosen = null;

  for (let b = 0; b < bands.length && !chosen; b++) {
    const [lo, hi] = bands[b];
    if (forcedVersion !== undefined && (forcedVersion < lo || forcedVersion > hi)) continue;

    const segments = segmentize(info, lo);
    const needsEci = utf8 && segments.some((s) => s.mode === MODE.BYTE);

    let bits = needsEci ? 12 : 0; // ECI mode indicator plus one designator byte
    for (let s = 0; s < segments.length; s++) bits += segmentBits(segments[s], info, lo);

    const from = forcedVersion !== undefined ? forcedVersion : lo;
    const to = forcedVersion !== undefined ? forcedVersion : hi;
    for (let v = from; v <= to; v++) {
      if (bits <= dataBitCapacity(v, ecc)) {
        chosen = { version: v, segments, needsEci, bits };
        break;
      }
    }
  }

  if (!chosen) {
    if (forcedVersion !== undefined) {
      throw new EncodeError(
        `QR: text does not fit version ${forcedVersion}-${ecc} ` +
        `(capacity ${dataBitCapacity(forcedVersion, ecc)} bits)`
      );
    }
    throw new EncodeError(
      `QR: text is too long for any version at error correction level ${ecc}`
    );
  }

  const { version, segments, needsEci } = chosen;
  const layout = blockLayout(version, ecc);
  const data = writeBitstream(segments, info, version, ecc, needsEci);
  const codewords = interleave(data, layout);

  if (forcedMask !== undefined) {
    return buildMatrix(version, ecc, forcedMask, codewords);
  }

  let best = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = buildMatrix(version, ecc, mask, codewords);
    const score = maskPenalty(candidate);
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

/**
 * @param {string} text
 * @returns {boolean} True if every code point fits one ISO-8859-1 byte.
 */
function isLatin1(text) {
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 0xff) return false;
  }
  return true;
}

__exports.ALPHANUMERIC_CHARS = ALPHANUMERIC_CHARS;
__exports.ECI_UTF8 = ECI_UTF8;
__exports.sjisToThirteenBits = sjisToThirteenBits;
__exports.formatInfoBits = formatInfoBits;
__exports.versionInfoBits = versionInfoBits;
__exports.maskPenalty = maskPenalty;
__exports.encodeQR = encodeQR;
};

__modules["qr/decoder.js"] = function (__require, __exports) {
/**
 * QR Code decoder.
 *
 * Input is a square {@link BitMatrix} that is exactly the symbol — one bit per
 * module, no quiet zone. Locating and resampling a symbol out of a photograph
 * is the detector's job; this module assumes that has already happened, which
 * keeps the two independently testable.
 *
 * Both BCH-protected fields — format information and version information — are
 * recovered by nearest-neighbour lookup over the full set of legal codewords
 * rather than by running a syndrome decoder. There are only 32 and 34 of them
 * respectively, the minimum distance is known, and a Hamming search is both
 * shorter and easier to be sure of than a second BCH implementation.
 *
 * @module qr/decoder
 */
const { BitReader } = __require("core/bit-buffer.js");
const { ChecksumError, FormatError } = __require("core/errors.js");
const { GF256_QR } = __require("core/galois-field.js");
const { rsDecode } = __require("core/reed-solomon.js");
const { ECC_LEVELS, MAX_VERSION, MIN_VERSION, MODE, VERSION_INFO_MIN, blockLayout, countBits, dataModuleOrder, formatInfoPositions, maskBit, versionSize } = __require("qr/tables.js");
const { ALPHANUMERIC_CHARS, formatInfoBits, versionInfoBits } = __require("qr/encoder.js");

/**
 * Maximum bit errors tolerated when matching a BCH field.
 *
 * Both codes have minimum distance 7 in principle, but the format information
 * is only guaranteed distance 7 across the whole set once masking is applied;
 * accepting three errors is the conventional, safe limit, and a wrong match
 * would be caught downstream by Reed-Solomon anyway.
 */
const BCH_MAX_DISTANCE = 3;

/** Every legal masked format value, with what it means. */
const FORMAT_CODES = (() => {
  const codes = [];
  for (let l = 0; l < ECC_LEVELS.length; l++) {
    for (let mask = 0; mask < 8; mask++) {
      codes.push({ bits: formatInfoBits(ECC_LEVELS[l], mask), ecc: ECC_LEVELS[l], mask });
    }
  }
  return codes;
})();

/** Every legal version information value. */
const VERSION_CODES = (() => {
  const codes = [];
  for (let v = VERSION_INFO_MIN; v <= MAX_VERSION; v++) {
    codes.push({ bits: versionInfoBits(v), version: v });
  }
  return codes;
})();

/**
 * @param {number} a @param {number} b
 * @returns {number} Number of differing bits.
 */
function hammingDistance(a, b) {
  let v = a ^ b;
  let n = 0;
  while (v !== 0) {
    v &= v - 1;
    n++;
  }
  return n;
}

/**
 * Nearest legal codeword, or null when nothing is close enough.
 *
 * @template T
 * @param {number} value
 * @param {Array<T & {bits: number}>} codes
 * @returns {(T & {distance: number}) | null}
 */
function nearestCode(value, codes) {
  let best = null;
  let bestDistance = BCH_MAX_DISTANCE + 1;
  let ambiguous = false;

  for (let i = 0; i < codes.length; i++) {
    const d = hammingDistance(value, codes[i].bits);
    if (d < bestDistance) {
      bestDistance = d;
      best = codes[i];
      ambiguous = false;
    } else if (d === bestDistance) {
      ambiguous = true;
    }
  }

  if (!best || bestDistance > BCH_MAX_DISTANCE || ambiguous) return null;
  return Object.assign({ distance: bestDistance }, best);
}

/**
 * Read a run of module positions as a little-endian bit value.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} m
 * @param {Array<[number, number]>} positions Index i holds bit i.
 * @returns {number}
 */
function readBits(m, positions) {
  let value = 0;
  for (let i = 0; i < positions.length; i++) {
    if (m.get(positions[i][0], positions[i][1])) value |= 1 << i;
  }
  return value;
}

/**
 * Recover the error correction level and mask.
 *
 * Both copies are tried and the cleaner one wins, so a symbol with one corner
 * damaged still reads.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} m
 * @param {number} size
 * @returns {{ecc: string, mask: number}}
 */
function readFormatInfo(m, size) {
  const [a, b] = formatInfoPositions(size);
  const candidates = [nearestCode(readBits(m, a), FORMAT_CODES), nearestCode(readBits(m, b), FORMAT_CODES)];

  let best = null;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (c && (!best || c.distance < best.distance)) best = c;
  }
  if (!best) {
    throw new FormatError('QR: format information is unreadable in both copies');
  }
  return { ecc: best.ecc, mask: best.mask };
}

/**
 * Cross-check the version information against the symbol's dimension.
 *
 * The dimension already determines the version, so this is redundancy rather
 * than information — which is exactly why it is worth reading: a disagreement
 * means the matrix handed to us is not the symbol we think it is.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} m
 * @param {number} size @param {number} fromDimension
 * @returns {number}
 */
function readVersionInfo(m, size, fromDimension) {
  if (fromDimension < VERSION_INFO_MIN) return fromDimension;

  /** @type {Array<[number, number]>} */
  const bottomLeft = [];
  /** @type {Array<[number, number]>} */
  const topRight = [];
  for (let i = 0; i < 18; i++) {
    const major = Math.floor(i / 3);
    const minor = i % 3;
    bottomLeft.push([major, size - 11 + minor]);
    topRight.push([size - 11 + minor, major]);
  }

  const candidates = [
    nearestCode(readBits(m, bottomLeft), VERSION_CODES),
    nearestCode(readBits(m, topRight), VERSION_CODES),
  ];

  let best = null;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (c && (!best || c.distance < best.distance)) best = c;
  }

  // Unreadable version information is survivable; contradictory version
  // information is not.
  if (!best) return fromDimension;
  if (best.version !== fromDimension) {
    throw new FormatError(
      `QR: version information says ${best.version} but the symbol is ` +
      `${size}x${size} modules (version ${fromDimension})`
    );
  }
  return best.version;
}

/**
 * Unmask and read the interleaved codewords out of the module grid.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} m
 * @param {number} version @param {number} mask @param {number} totalCodewords
 * @returns {Uint8Array}
 */
function readCodewords(m, version, mask, totalCodewords) {
  const order = dataModuleOrder(version);
  const out = new Uint8Array(totalCodewords);
  const available = totalCodewords * 8;

  for (let p = 0, bit = 0; p < order.length && bit < available; p += 2, bit++) {
    const x = order[p];
    const y = order[p + 1];
    let dark = m.get(x, y);
    if (maskBit(mask, x, y)) dark = !dark;
    if (dark) out[bit >> 3] |= 0x80 >> (bit & 7);
  }

  return out;
}

/**
 * Undo the block interleaving and repair each block.
 *
 * @param {Uint8Array} codewords
 * @param {import('./tables.js').BlockLayout} layout
 * @returns {{data: Uint8Array, corrections: number}}
 */
function deinterleaveAndCorrect(codewords, layout) {
  const counts = new Array(layout.blockCount);
  for (let b = 0; b < layout.blockCount; b++) {
    counts[b] = b < layout.group1Blocks ? layout.group1DataCount : layout.group2DataCount;
  }

  const blocks = [];
  for (let b = 0; b < layout.blockCount; b++) {
    blocks.push(new Array(counts[b] + layout.eccPerBlock).fill(0));
  }

  let n = 0;
  const maxData = layout.group2Blocks > 0 ? layout.group2DataCount : layout.group1DataCount;
  for (let i = 0; i < maxData; i++) {
    for (let b = 0; b < layout.blockCount; b++) {
      if (i < counts[b]) blocks[b][i] = codewords[n++];
    }
  }
  for (let i = 0; i < layout.eccPerBlock; i++) {
    for (let b = 0; b < layout.blockCount; b++) {
      blocks[b][counts[b] + i] = codewords[n++];
    }
  }

  const data = new Uint8Array(layout.totalDataCodewords);
  let offset = 0;
  let corrections = 0;

  for (let b = 0; b < layout.blockCount; b++) {
    corrections += rsDecode(blocks[b], layout.eccPerBlock, GF256_QR, 0);
    for (let i = 0; i < counts[b]; i++) data[offset + i] = blocks[b][i];
    offset += counts[b];
  }

  return { data, corrections };
}

/* ------------------------------------------------------------------ *
 * Bitstream interpretation
 * ------------------------------------------------------------------ */

/**
 * Unpack a 13-bit kanji value back to Shift_JIS. Inverse of the encoder's
 * `sjisToThirteenBits`; the round-trip is asserted by the test suite.
 *
 * @param {number} value
 * @returns {number} 16-bit Shift_JIS value.
 */
function thirteenBitsToSjis(value) {
  const combined = (Math.floor(value / 0xc0) << 8) | (value % 0xc0);
  return combined + (combined + 0x8140 <= 0x9ffc ? 0x8140 : 0xc140);
}

/** ECI assignment numbers this decoder maps to a concrete codec label. */
const ECI_LABELS = {
  0: 'iso-8859-1',
  1: 'iso-8859-1',
  2: 'iso-8859-1',
  3: 'iso-8859-1',
  4: 'iso-8859-2',
  5: 'iso-8859-3',
  6: 'iso-8859-4',
  7: 'iso-8859-5',
  8: 'iso-8859-6',
  9: 'iso-8859-7',
  10: 'iso-8859-8',
  11: 'iso-8859-9',
  12: 'iso-8859-10',
  13: 'iso-8859-11',
  15: 'iso-8859-13',
  16: 'iso-8859-14',
  17: 'iso-8859-15',
  18: 'iso-8859-16',
  20: 'shift_jis',
  21: 'windows-1250',
  22: 'windows-1251',
  23: 'windows-1252',
  24: 'windows-1256',
  25: 'utf-16be',
  26: 'utf-8',
  27: 'us-ascii',
  28: 'big5',
  29: 'gb18030',
  30: 'euc-kr',
  170: 'us-ascii',
};

/**
 * Turn a byte segment into text.
 *
 * With no ECI in force the interpretation is genuinely ambiguous — the default
 * is ISO-8859-1, but the overwhelming majority of real symbols carry UTF-8
 * without announcing it. So: accept UTF-8 when the bytes are valid UTF-8, and
 * fall back to ISO-8859-1 when they are not. Bytes that are valid under both
 * readings cannot be told apart by anyone, encoder included.
 *
 * @param {Uint8Array} bytes @param {number | null} eci
 * @returns {string}
 */
function decodeBytes(bytes, eci) {
  if (eci !== null && eci !== undefined) {
    const label = ECI_LABELS[eci];
    if (label) {
      try {
        return new TextDecoder(label).decode(bytes);
      } catch (e) {
        /* Unsupported label on this platform; fall through. */
      }
    }
  } else {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (e) {
      /* Not valid UTF-8; it is Latin-1. */
    }
  }
  return latin1(bytes);
}

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function latin1(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

/**
 * @param {Uint8Array} bytes Shift_JIS double bytes.
 * @returns {string}
 */
function decodeKanji(bytes) {
  try {
    const decoder = new TextDecoder('shift_jis');
    const text = decoder.decode(bytes);
    if (text.indexOf('�') === -1) return text;
  } catch (e) {
    /* No Shift_JIS codec on this platform. */
  }
  // Graceful degradation: the payload is structurally intact but we cannot
  // name the characters, so mark them rather than failing the whole symbol.
  let s = '';
  for (let i = 0; i < bytes.length; i += 2) s += '�';
  return s;
}

/**
 * Read the ECI designator, which is 1, 2 or 3 bytes depending on its leading
 * bits.
 *
 * @param {BitReader} reader
 * @returns {number}
 */
function readEciDesignator(reader) {
  const first = reader.read(8);
  if ((first & 0x80) === 0) return first;
  if ((first & 0xc0) === 0x80) return ((first & 0x3f) << 8) | reader.read(8);
  if ((first & 0xe0) === 0xc0) return ((first & 0x1f) << 16) | reader.read(16);
  throw new FormatError(`QR: malformed ECI designator (first byte 0x${first.toString(16)})`);
}

/**
 * Walk the mode segments and rebuild the payload.
 *
 * @param {Uint8Array} data Corrected data codewords.
 * @param {number} version
 * @returns {{text: string, bytes: Uint8Array}}
 */
function parseSegments(data, version) {
  const reader = new BitReader(data);
  let text = '';
  /** @type {number[]} */
  const rawBytes = [];
  /** @type {number | null} */
  let eci = null;

  // A symbol whose payload ends exactly on a codeword boundary has no room for
  // a terminator, so running out of bits is a normal end, not an error.
  while (reader.available() >= 4) {
    const mode = reader.read(4);
    if (mode === MODE.TERMINATOR) break;

    if (mode === MODE.ECI) {
      eci = readEciDesignator(reader);
      continue;
    }

    if (mode === MODE.FNC1_FIRST) continue;
    if (mode === MODE.FNC1_SECOND) {
      reader.read(8); // application indicator
      continue;
    }
    if (mode === MODE.STRUCTURED_APPEND) {
      reader.read(16); // sequence position, total, parity
      continue;
    }

    const width = countBits(mode, version);
    if (width === 0) {
      throw new FormatError(`QR: unsupported mode indicator 0x${mode.toString(16)}`);
    }
    const count = reader.read(width);

    switch (mode) {
      case MODE.NUMERIC: {
        let i = 0;
        while (i + 3 <= count) {
          const triple = reader.read(10);
          if (triple > 999) throw new FormatError(`QR: numeric triple ${triple} out of range`);
          text += String(triple).padStart(3, '0');
          i += 3;
        }
        if (count - i === 2) {
          const pair = reader.read(7);
          if (pair > 99) throw new FormatError(`QR: numeric pair ${pair} out of range`);
          text += String(pair).padStart(2, '0');
        } else if (count - i === 1) {
          const single = reader.read(4);
          if (single > 9) throw new FormatError(`QR: numeric digit ${single} out of range`);
          text += String(single);
        }
        break;
      }

      case MODE.ALPHANUMERIC: {
        let i = 0;
        while (i + 2 <= count) {
          const pair = reader.read(11);
          if (pair >= 45 * 45) throw new FormatError(`QR: alphanumeric pair ${pair} out of range`);
          text += ALPHANUMERIC_CHARS[Math.floor(pair / 45)] + ALPHANUMERIC_CHARS[pair % 45];
          i += 2;
        }
        if (i < count) {
          const single = reader.read(6);
          if (single >= 45) throw new FormatError(`QR: alphanumeric value ${single} out of range`);
          text += ALPHANUMERIC_CHARS[single];
        }
        break;
      }

      case MODE.BYTE: {
        const bytes = new Uint8Array(count);
        for (let i = 0; i < count; i++) {
          bytes[i] = reader.read(8);
          rawBytes.push(bytes[i]);
        }
        text += decodeBytes(bytes, eci);
        break;
      }

      case MODE.KANJI: {
        const bytes = new Uint8Array(count * 2);
        for (let i = 0; i < count; i++) {
          const sjis = thirteenBitsToSjis(reader.read(13));
          bytes[i * 2] = sjis >> 8;
          bytes[i * 2 + 1] = sjis & 0xff;
        }
        text += decodeKanji(bytes);
        break;
      }

      default:
        throw new FormatError(`QR: unsupported mode indicator 0x${mode.toString(16)}`);
    }
  }

  return { text, bytes: Uint8Array.from(rawBytes) };
}

/**
 * @typedef {object} DecodeResult
 * @property {string} text Decoded payload.
 * @property {Uint8Array} bytes Raw bytes of the byte-mode segments; empty when
 *   the payload used no byte segments.
 * @property {number} version 1-40.
 * @property {string} ecc 'L' | 'M' | 'Q' | 'H'.
 * @property {number} mask 0-7.
 * @property {number} corrections Symbols repaired by Reed-Solomon.
 */

/**
 * Decode a sampled QR Code symbol.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix Square, exactly the
 *   symbol, no quiet zone. Set bit = dark module.
 * @returns {DecodeResult}
 * @throws {FormatError} If the geometry or content is malformed.
 * @throws {ChecksumError} If error correction cannot repair the symbol.
 */
function decodeQR(matrix) {
  if (!matrix || !matrix.width) throw new FormatError('QR: no matrix supplied');

  const size = matrix.width;
  if (matrix.height !== size) {
    throw new FormatError(`QR: symbol must be square, got ${size}x${matrix.height}`);
  }
  if ((size - 17) % 4 !== 0) {
    throw new FormatError(`QR: ${size} modules is not a valid symbol size`);
  }

  const dimensionVersion = (size - 17) / 4;
  if (dimensionVersion < MIN_VERSION || dimensionVersion > MAX_VERSION) {
    throw new FormatError(`QR: ${size} modules implies version ${dimensionVersion}`);
  }

  const { ecc, mask } = readFormatInfo(matrix, size);
  const version = readVersionInfo(matrix, size, dimensionVersion);

  const layout = blockLayout(version, ecc);
  const codewords = readCodewords(matrix, version, mask, layout.totalCodewords);
  const { data, corrections } = deinterleaveAndCorrect(codewords, layout);
  const { text, bytes } = parseSegments(data, version);

  return { text, bytes, version, ecc, mask, corrections };
}
__exports.ChecksumError = ChecksumError;

__exports.decodeQR = decodeQR;
};

__modules["qr/detector.js"] = function (__require, __exports) {
/**
 * QR Code detection — finding symbols in a binarized image.
 *
 * The whole thing hangs off one property of the finder pattern: along any line
 * through its centre, in any direction, the dark and light runs are in the
 * ratio 1:1:3:1:1. That is true horizontally, vertically and diagonally, it is
 * scale-independent, and no ordinary printed matter reproduces it by accident.
 * So the search is: scan rows for that ratio, confirm each hit by scanning the
 * column through it, cluster what survives, and look for three clusters
 * arranged in a right isoceles triangle.
 *
 * Three finders give three corners. The fourth is the problem: extrapolating
 * `topRight + bottomLeft - topLeft` assumes the symbol is a parallelogram,
 * which is only true if it was photographed square-on. For version 2 and up the
 * bottom-right alignment pattern pins that corner down properly, which is what
 * makes a tilted symbol readable. When the alignment pattern cannot be found,
 * detection degrades to the parallelogram estimate rather than failing — a
 * slightly wrong corner still decodes on a flat image, and Reed-Solomon absorbs
 * the rest.
 *
 * @module qr/detector
 */
const { NotFoundError } = __require("core/errors.js");
const { PerspectiveTransform } = __require("image/perspective.js");
const { sampleQuad } = __require("image/grid-sampler.js");
const { decodeQR } = __require("qr/decoder.js");

/** Finder pattern run ratios, centre run first in the array's own order. */
const FINDER_RATIOS = [1, 1, 3, 1, 1];

/** Alignment pattern run ratios. */
const ALIGNMENT_RATIOS = [1, 1, 1, 1, 1];

/** Smallest and largest legal symbol dimensions, in modules. */
const MIN_DIMENSION = 21;
const MAX_DIMENSION = 177;

/**
 * Do five alternating runs match the expected ratios?
 *
 * Tolerance is half a module, scaled by the ratio, which is the widest band
 * that still rejects ordinary text and rules while accepting the blur and
 * rounding of a real scan.
 *
 * @param {number[]} counts Five run lengths, dark first.
 * @param {number[]} ratios
 * @returns {number} The implied module size, or 0 if the ratios do not match.
 */
function matchRatios(counts, ratios) {
  let total = 0;
  let units = 0;
  for (let i = 0; i < 5; i++) {
    if (counts[i] === 0) return 0;
    total += counts[i];
    units += ratios[i];
  }
  if (total < units) return 0;

  const moduleSize = total / units;
  const tolerance = moduleSize / 2;
  for (let i = 0; i < 5; i++) {
    if (Math.abs(counts[i] - moduleSize * ratios[i]) > tolerance * ratios[i]) return 0;
  }
  return moduleSize;
}

/**
 * Scan one row for the finder run ratio.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} image
 * @param {number} y
 * @param {number[]} ratios
 * @param {(centreX: number, moduleSize: number) => void} onHit
 */
function scanRow(image, y, ratios, onHit) {
  const width = image.width;
  const counts = [0, 0, 0, 0, 0];
  let state = 0;

  for (let x = 0; x < width; x++) {
    const dark = image.get(x, y);

    // Even states are dark runs, odd states light.
    if (dark === ((state & 1) === 0)) {
      counts[state]++;
      continue;
    }

    // A leading light margin is not part of any pattern.
    if (state === 0 && counts[0] === 0) continue;

    if (state < 4) {
      state++;
      counts[state] = 1;
      continue;
    }

    // Five runs complete, and the sixth has begun.
    const moduleSize = matchRatios(counts, ratios);
    if (moduleSize > 0) {
      onHit(x - counts[4] - counts[3] - counts[2] / 2, moduleSize);
    }

    // Slide the window on by two runs: the trailing dark run of a rejected
    // candidate is often the leading dark run of the real one.
    counts[0] = counts[2];
    counts[1] = counts[3];
    counts[2] = counts[4];
    counts[3] = 1;
    counts[4] = 0;
    state = 3;
  }

  if (state === 4) {
    const moduleSize = matchRatios(counts, ratios);
    if (moduleSize > 0) {
      onHit(width - counts[4] - counts[3] - counts[2] / 2, moduleSize);
    }
  }
}

/**
 * Walk a line through a candidate centre and confirm the ratio holds there too.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} image
 * @param {number} x @param {number} y
 * @param {number} dx @param {number} dy Unit step defining the line.
 * @param {number[]} ratios
 * @param {number} maxRun Guard against running the length of a dark image.
 * @returns {number} Refined centre offset along the line, or NaN.
 */
function crossCheck(image, x, y, dx, dy, ratios, maxRun) {
  const width = image.width;
  const height = image.height;

  /** @returns {boolean | null} Null when the sample falls outside the image. */
  const at = (i) => {
    const px = x + dx * i;
    const py = y + dy * i;
    if (px < 0 || py < 0 || px >= width || py >= height) return null;
    return image.get(px, py);
  };

  if (at(0) !== true) return NaN;

  const counts = [0, 0, 0, 0, 0];
  let i = 0;

  // Forward from the centre: rest of the centre run, then light, then dark.
  while (at(i) === true && counts[2] < maxRun) { counts[2]++; i++; }
  if (at(i) === null) return NaN;
  const centreForward = counts[2];

  while (at(i) === false && counts[3] < maxRun) { counts[3]++; i++; }
  if (at(i) === null || counts[3] === 0) return NaN;

  while (at(i) === true && counts[4] < maxRun) { counts[4]++; i++; }
  if (counts[4] === 0) return NaN;

  // Backward from the centre.
  i = -1;
  while (at(i) === true && counts[2] < maxRun * 2) { counts[2]++; i--; }
  if (at(i) === null) return NaN;
  const centreBackward = counts[2] - centreForward;

  while (at(i) === false && counts[1] < maxRun) { counts[1]++; i--; }
  if (at(i) === null || counts[1] === 0) return NaN;

  while (at(i) === true && counts[0] < maxRun) { counts[0]++; i--; }
  if (counts[0] === 0) return NaN;

  if (matchRatios(counts, ratios) === 0) return NaN;

  // The centre run spans offsets [-centreBackward, centreForward - 1].
  return (centreForward - 1 - centreBackward) / 2;
}

/**
 * @typedef {object} Candidate
 * @property {number} x
 * @property {number} y
 * @property {number} moduleSize
 * @property {number} hits
 */

/**
 * Locate pattern centres of a given run ratio.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} image
 * @param {number[]} ratios
 * @param {number} unitsWide Modules the pattern spans (7 or 5).
 * @param {{x0: number, y0: number, x1: number, y1: number}} [region]
 * @returns {Candidate[]}
 */
function findPatterns(image, ratios, unitsWide, region) {
  /** @type {Candidate[]} */
  const found = [];

  const y0 = region ? Math.max(0, region.y0) : 0;
  const y1 = region ? Math.min(image.height, region.y1) : image.height;

  for (let y = y0; y < y1; y++) {
    scanRow(image, y, ratios, (centreX, moduleSize) => {
      if (region && (centreX < region.x0 || centreX > region.x1)) return;

      const px = Math.floor(centreX);
      const maxRun = Math.ceil(moduleSize * unitsWide);
      const offsetY = crossCheck(image, px, y, 0, 1, ratios, maxRun);
      if (Number.isNaN(offsetY)) return;

      const cy = y + offsetY;
      // Re-check horizontally at the refined row, which both confirms the hit
      // and gives a better x than the original scan line did.
      const offsetX = crossCheck(image, px, Math.round(cy), 1, 0, ratios, maxRun);
      if (Number.isNaN(offsetX)) return;

      const cx = px + offsetX;

      // Merge with an existing centre when they describe the same pattern.
      for (let i = 0; i < found.length; i++) {
        const c = found[i];
        if (
          Math.abs(c.x - cx) <= c.moduleSize &&
          Math.abs(c.y - cy) <= c.moduleSize &&
          Math.abs(c.moduleSize - moduleSize) <= Math.max(1, c.moduleSize / 2)
        ) {
          const n = c.hits + 1;
          c.x = (c.x * c.hits + cx) / n;
          c.y = (c.y * c.hits + cy) / n;
          c.moduleSize = (c.moduleSize * c.hits + moduleSize) / n;
          c.hits = n;
          return;
        }
      }

      found.push({ x: cx, y: cy, moduleSize, hits: 1 });
    });
  }

  return found;
}

/**
 * @param {{x: number, y: number}} a @param {{x: number, y: number}} b
 * @returns {number}
 */
function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Order three finder centres as top-left, top-right, bottom-left.
 *
 * The corner is the centre opposite the longest side. Which of the remaining
 * two is "top right" follows from the sign of the cross product: in image
 * coordinates, with y increasing downward, a symbol the right way round has
 * (topRight - topLeft) x (bottomLeft - topLeft) positive.
 *
 * @param {Candidate[]} three
 * @returns {{tl: Candidate, tr: Candidate, bl: Candidate} | null}
 */
function orientFinders(three) {
  const [a, b, c] = three;
  const ab = distance(a, b);
  const bc = distance(b, c);
  const ca = distance(c, a);

  let tl, p, q, hypotenuse, leg1, leg2;
  if (ab >= bc && ab >= ca) {
    tl = c; p = a; q = b; hypotenuse = ab; leg1 = ca; leg2 = bc;
  } else if (bc >= ab && bc >= ca) {
    tl = a; p = b; q = c; hypotenuse = bc; leg1 = ab; leg2 = ca;
  } else {
    tl = b; p = c; q = a; hypotenuse = ca; leg1 = bc; leg2 = ab;
  }

  if (leg1 === 0 || leg2 === 0) return null;

  // The two legs must be near enough equal, and Pythagoras must hold: this is
  // what rejects three unrelated finder-lookalikes that happen to co-occur.
  const ratio = leg1 / leg2;
  if (ratio < 0.7 || ratio > 1.4) return null;
  const expected = Math.hypot(leg1, leg2);
  if (Math.abs(hypotenuse - expected) > expected * 0.25) return null;

  const cross = (p.x - tl.x) * (q.y - tl.y) - (p.y - tl.y) * (q.x - tl.x);
  return cross >= 0 ? { tl, tr: p, bl: q } : { tl, tr: q, bl: p };
}

/**
 * Snap a measured dimension to a legal symbol size.
 *
 * Every QR dimension is 17 + 4v, so `dimension % 4 === 1`. A measurement one
 * off is rounding; two off means the module size estimate is wrong and the
 * candidate is not worth pursuing.
 *
 * @param {number} raw
 * @returns {number} 0 if it cannot be reconciled.
 */
function snapDimension(raw) {
  let d = Math.round(raw);
  switch (d & 3) {
    case 0: d--; break;
    case 2: d++; break;
    case 3: return 0;
    default: break;
  }
  if (d < MIN_DIMENSION || d > MAX_DIMENSION) return 0;
  return d;
}

/** The alignment pattern, as modules. 1 is dark. */
const ALIGNMENT_MODULES = [
  [1, 1, 1, 1, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 1, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 1, 1, 1, 1],
];

/**
 * Confirm a candidate by reading the 5x5 module block it claims to be.
 *
 * The run-ratio scan alone is not enough here. A finder pattern's 1:1:3:1:1 is
 * rare enough to stand on its own, but an alignment pattern's 1:1:1:1:1 occurs
 * constantly in ordinary data modules, so an unverified match near the expected
 * position is more likely to be payload than pattern — and a false match drags
 * the fourth corner off by several modules, which is worse than having no
 * alignment pattern at all.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} image
 * @param {number} cx @param {number} cy @param {number} moduleSize
 * @returns {boolean}
 */
function verifyAlignment(image, cx, cy, moduleSize) {
  let good = 0;
  for (let j = 0; j < 5; j++) {
    for (let i = 0; i < 5; i++) {
      const px = Math.round(cx + (i - 2) * moduleSize);
      const py = Math.round(cy + (j - 2) * moduleSize);
      if (px < 0 || py < 0 || px >= image.width || py >= image.height) return false;
      if (image.get(px, py) === (ALIGNMENT_MODULES[j][i] === 1)) good++;
    }
  }
  // Allow two modules of slop for blur and sampling, but no more.
  return good >= 23;
}

/**
 * Look for the bottom-right alignment pattern near where the geometry predicts.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} image
 * @param {{x: number, y: number}} expected
 * @param {number} moduleSize
 * @returns {{x: number, y: number} | null}
 */
function findAlignment(image, expected, moduleSize) {
  // Three modules of slack. The parallelogram estimate is good to well under
  // that on any symbol flat enough to decode, and a wider net only admits more
  // data modules as candidates.
  const radius = Math.max(3, Math.ceil(moduleSize * 3));
  const region = {
    x0: expected.x - radius,
    x1: expected.x + radius,
    y0: Math.floor(expected.y - radius),
    y1: Math.ceil(expected.y + radius),
  };

  const found = findPatterns(image, ALIGNMENT_RATIOS, 5, region);

  let best = null;
  let bestDistance = Infinity;
  for (let i = 0; i < found.length; i++) {
    // The alignment pattern is 5 modules across, so its implied module size
    // should agree with the one the finders reported.
    if (found[i].moduleSize > moduleSize * 1.5 || found[i].moduleSize < moduleSize / 1.5) continue;
    if (!verifyAlignment(image, found[i].x, found[i].y, moduleSize)) continue;
    const d = distance(found[i], expected);
    if (d < bestDistance) {
      bestDistance = d;
      best = found[i];
    }
  }

  // Last resort: the pattern is exactly where predicted but its runs were
  // mangled by blur. Reading the modules directly still confirms it.
  if (!best && verifyAlignment(image, expected.x, expected.y, moduleSize)) {
    best = { x: expected.x, y: expected.y };
  }

  return best;
}

/**
 * @typedef {object} Detection
 * @property {Array<{x: number, y: number}>} corners Outer corners of the
 *   symbol, ordered top-left, top-right, bottom-right, bottom-left.
 * @property {number} dimension Modules per side.
 * @property {number} version
 * @property {number} moduleSize Estimated pixels per module.
 * @property {boolean} alignmentFound
 */

/**
 * Find QR Code symbols in a binarized image.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} binaryImage Set bit = dark.
 * @returns {Detection[]} Possibly empty; ordered by descending module size, so
 *   the most prominent symbol comes first.
 */
function detectQR(binaryImage) {
  if (!binaryImage || !binaryImage.width) {
    throw new NotFoundError('detectQR: no image supplied');
  }

  const finders = findPatterns(binaryImage, FINDER_RATIOS, 7);
  // A single stray row hit is noise; a real finder is crossed many times.
  const solid = finders.filter((f) => f.hits >= 2);
  const pool = solid.length >= 3 ? solid : finders;
  if (pool.length < 3) return [];

  // Prefer the largest patterns, and cap the combinatorics on noisy images.
  pool.sort((a, b) => b.moduleSize - a.moduleSize || b.hits - a.hits);
  const limit = Math.min(pool.length, 12);

  /** @type {Detection[]} */
  const detections = [];
  const used = new Set();

  for (let i = 0; i < limit; i++) {
    for (let j = i + 1; j < limit; j++) {
      for (let k = j + 1; k < limit; k++) {
        const three = [pool[i], pool[j], pool[k]];

        // All three finders belong to one symbol, so they share a module size.
        const sizes = three.map((f) => f.moduleSize);
        if (Math.max(...sizes) > Math.min(...sizes) * 1.6) continue;

        const oriented = orientFinders(three);
        if (!oriented) continue;

        const { tl, tr, bl } = oriented;
        const moduleSize = (tl.moduleSize + tr.moduleSize + bl.moduleSize) / 3;
        if (moduleSize <= 0) continue;

        // Centre-to-centre spans dimension - 7 modules.
        const across = (distance(tl, tr) + distance(tl, bl)) / 2;
        const dimension = snapDimension(across / moduleSize + 7);
        if (dimension === 0) continue;

        const version = (dimension - 17) / 4;
        if (version < 1 || version > 40) continue;

        const key = `${Math.round(tl.x)},${Math.round(tl.y)},${dimension}`;
        if (used.has(key)) continue;
        used.add(key);

        detections.push(
          buildDetection(binaryImage, tl, tr, bl, dimension, version, moduleSize)
        );
      }
    }
  }

  detections.sort((a, b) => b.moduleSize - a.moduleSize);
  return detections;
}

/**
 * Turn three finder centres into four symbol corners.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} image
 * @param {Candidate} tl @param {Candidate} tr @param {Candidate} bl
 * @param {number} dimension @param {number} version @param {number} moduleSize
 * @returns {Detection}
 */
function buildDetection(image, tl, tr, bl, dimension, version, moduleSize) {
  const d = dimension;
  // Finder centres sit on module (3, 3) and friends, so at grid coordinate 3.5.
  const gridTl = [3.5, 3.5];
  const gridTr = [d - 3.5, 3.5];
  const gridBl = [3.5, d - 3.5];

  // Parallelogram estimate of the far corner, used both as the search seed for
  // the alignment pattern and as the fallback when it is not there.
  const guess = { x: tr.x + bl.x - tl.x, y: tr.y + bl.y - tl.y };

  /** @type {PerspectiveTransform | null} */
  let transform = null;
  let alignmentFound = false;

  if (version >= 2) {
    // The bottom-right alignment pattern is centred on module (d - 7, d - 7).
    const gridAlign = [d - 6.5, d - 6.5];
    // Where that module lands under the parallelogram assumption.
    const seed = {
      x: tl.x + ((gridAlign[0] - 3.5) / (d - 7)) * (tr.x - tl.x) +
        ((gridAlign[1] - 3.5) / (d - 7)) * (bl.x - tl.x),
      y: tl.y + ((gridAlign[0] - 3.5) / (d - 7)) * (tr.y - tl.y) +
        ((gridAlign[1] - 3.5) / (d - 7)) * (bl.y - tl.y),
    };

    const align = findAlignment(image, seed, moduleSize);
    if (align) {
      alignmentFound = true;
      transform = PerspectiveTransform.quadToQuad(
        gridTl[0], gridTl[1], gridTr[0], gridTr[1], gridAlign[0], gridAlign[1], gridBl[0], gridBl[1],
        tl.x, tl.y, tr.x, tr.y, align.x, align.y, bl.x, bl.y
      );
    }
  }

  const plain = PerspectiveTransform.quadToQuad(
    gridTl[0], gridTl[1], gridTr[0], gridTr[1], d - 3.5, d - 3.5, gridBl[0], gridBl[1],
    tl.x, tl.y, tr.x, tr.y, guess.x, guess.y, bl.x, bl.y
  );

  const corners = cornersOf(transform ?? plain, d);
  // Keep the parallelogram corners as a second opinion whenever an alignment
  // pattern steered the first set. Verification makes a false match unlikely,
  // not impossible, and one extra sampling attempt is far cheaper than losing
  // a symbol to it.
  const altCorners = transform ? cornersOf(plain, d) : null;

  return { corners, altCorners, dimension, version, moduleSize, alignmentFound };
}

/**
 * The four outer corners of the symbol under a grid-to-image transform.
 *
 * @param {PerspectiveTransform} transform @param {number} d
 * @returns {Array<{x: number, y: number}>}
 */
function cornersOf(transform, d) {
  return [
    transform.transformPoint(0, 0),
    transform.transformPoint(d, 0),
    transform.transformPoint(d, d),
    transform.transformPoint(0, d),
  ];
}

/**
 * Find and decode every QR Code in a binarized image.
 *
 * Each candidate gets up to four attempts: a plain centre sample, a 3x3
 * majority vote for noisy input, and both of those rotated 180 degrees. The
 * rotation retry matters because three finders in a right isoceles triangle
 * look identical to the same three rotated half a turn — the orientation is
 * only settled once the format information reads cleanly, which is to say once
 * the decode succeeds.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} binaryImage
 * @returns {Array<import('./decoder.js').DecodeResult & {corners: Array<{x: number, y: number}>}>}
 *   Empty when nothing decodes; never throws for "no symbol here".
 */
function detectAndDecodeQR(binaryImage) {
  let detections;
  try {
    detections = detectQR(binaryImage);
  } catch (e) {
    return [];
  }

  const results = [];
  const seen = new Set();

  for (let i = 0; i < detections.length; i++) {
    const det = detections[i];

    for (let attempt = 0; attempt < 4; attempt++) {
      const voting = attempt === 1 || attempt === 3;
      const rotated = attempt >= 2;

      let matrix;
      try {
        matrix = sampleQuad(binaryImage, det.dimension, det.corners, voting);
      } catch (e) {
        continue;
      }
      if (rotated) matrix.rotate180();

      try {
        const result = decodeQR(matrix);
        // The same symbol can be detected through more than one finder triple.
        const key = `${result.version}|${result.text}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push(Object.assign({ corners: det.corners }, result));
        }
        break;
      } catch (e) {
        /* Try the next sampling strategy. */
      }
    }
  }

  return results;
}

__exports.detectQR = detectQR;
__exports.detectAndDecodeQR = detectAndDecodeQR;
};

__modules["qr/index.js"] = function (__require, __exports) {
/**
 * QR Code, re-exported.
 *
 * `QR_PLACEHOLDER` is deliberately absent: `src/index.js` probes for it to
 * decide whether this build can read and write QR, and its absence is what
 * reports the format as available.
 *
 * @module qr
 */
const __reexport0 = __require("qr/encoder.js"); __exports.encodeQR = __reexport0.encodeQR;
const __reexport1 = __require("qr/decoder.js"); __exports.decodeQR = __reexport1.decodeQR;
const __reexport2 = __require("qr/detector.js"); __exports.detectQR = __reexport2.detectQR; __exports.detectAndDecodeQR = __reexport2.detectAndDecodeQR;
const __reexport3 = __require("qr/tables.js"); __exports.validateTables = __reexport3.validateTables;


};

__modules["render/options.js"] = function (__require, __exports) {
/**
 * Shared render options, normalised once so every backend agrees.
 *
 * @module render/options
 */
const { BitMatrix } = __require("core/bit-matrix.js");

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
function normalizeOptions(matrix, options = {}) {
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
function parseColor(colour) {
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

__exports.normalizeOptions = normalizeOptions;
__exports.parseColor = parseColor;
};

__modules["render/svg.js"] = function (__require, __exports) {
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
const { normalizeOptions } = __require("render/options.js");

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
function toSVG(matrix, options = {}) {
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
function toSVGDataURI(matrix, options = {}) {
  return 'data:image/svg+xml;base64,' + toBase64(toSVG(matrix, options));
}

__exports.toSVG = toSVG;
__exports.toSVGDataURI = toSVGDataURI;
};

__modules["render/image-data.js"] = function (__require, __exports) {
/**
 * Raster output as ImageData, and 2D-canvas drawing.
 *
 * @module render/image-data
 */
const { normalizeOptions, parseColor } = __require("render/options.js");

/**
 * Render to an `ImageData`-shaped object.
 *
 * A plain object rather than a real `ImageData`, so this works in Node and in
 * workers without a DOM. It is accepted directly by `ctx.putImageData` in the
 * browser, and by this library's own reader.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 * @param {import('./options.js').RenderOptions} [options]
 * @returns {{data: Uint8ClampedArray, width: number, height: number}}
 */
function toImageData(matrix, options = {}) {
  const opts = normalizeOptions(matrix, options);
  const { scale, source, pixelWidth, pixelHeight } = opts;

  const dark = parseColor(opts.dark);
  const light = parseColor(opts.light);
  const data = new Uint8ClampedArray(pixelWidth * pixelHeight * 4);

  // Fill one scanline per module row, then copy it `scale` times. Barcodes are
  // wide and repetitive, so this is markedly faster than a per-pixel loop.
  const line = new Uint8ClampedArray(pixelWidth * 4);

  for (let my = 0; my < source.height; my++) {
    for (let mx = 0; mx < source.width; mx++) {
      const colour = source.get(mx, my) ? dark : light;
      const start = mx * scale * 4;
      for (let px = 0; px < scale; px++) {
        const p = start + px * 4;
        line[p] = colour[0];
        line[p + 1] = colour[1];
        line[p + 2] = colour[2];
        line[p + 3] = colour[3];
      }
    }
    for (let py = 0; py < scale; py++) {
      data.set(line, ((my * scale + py) * pixelWidth) * 4);
    }
  }

  return { data, width: pixelWidth, height: pixelHeight };
}

/**
 * Draw into a canvas using its 2D context.
 *
 * This is the universal fallback: every browser that runs JavaScript at all
 * has a 2D context, including every iOS Safari version.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 * @param {HTMLCanvasElement | OffscreenCanvas} canvas
 * @param {import('./options.js').RenderOptions} [options]
 * @returns {boolean} True when it drew.
 */
function toCanvas(matrix, canvas, options = {}) {
  const opts = normalizeOptions(matrix, options);
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  canvas.width = opts.pixelWidth;
  canvas.height = opts.pixelHeight;

  // Draw with fillRect rather than putImageData: it respects the canvas's
  // alpha compositing, so a transparent `light` leaves the page showing
  // through instead of punching a hole.
  const [, , , lightAlpha] = parseColor(opts.light);
  if (lightAlpha > 0) {
    ctx.fillStyle = opts.light;
    ctx.fillRect(0, 0, opts.pixelWidth, opts.pixelHeight);
  } else {
    ctx.clearRect(0, 0, opts.pixelWidth, opts.pixelHeight);
  }

  ctx.fillStyle = opts.dark;
  const { source, scale } = opts;
  for (let y = 0; y < source.height; y++) {
    let x = 0;
    while (x < source.width) {
      if (!source.get(x, y)) { x++; continue; }
      let run = 1;
      while (x + run < source.width && source.get(x + run, y)) run++;
      ctx.fillRect(x * scale, y * scale, run * scale, scale);
      x += run;
    }
  }
  return true;
}

__exports.toImageData = toImageData;
__exports.toCanvas = toCanvas;
};

__modules["render/png.js"] = function (__require, __exports) {
/**
 * PNG output, with no dependencies and no compression library of our own.
 *
 * A barcode is a two-colour image, so this writes a 1-bit palette PNG: eight
 * modules per byte, and a two-entry palette. That is both the smallest and the
 * simplest correct encoding.
 *
 * Compression strategy, in order of preference:
 *
 *   1. `node:zlib` in Node.
 *   2. `CompressionStream('deflate')` in browsers that have it.
 *   3. Stored (uncompressed) deflate blocks, written here.
 *
 * Writing a Huffman coder would be a week of work to save a few kilobytes on
 * an image that is mostly already tiny. The stored-block fallback is about
 * eighty lines and produces a completely valid PNG; the only cost is size, on
 * the minority of platforms that reach it.
 *
 * @module render/png
 */
const { normalizeOptions, parseColor } = __require("render/options.js");

/* ------------------------------------------------------------------ *
 * Checksums
 * ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/**
 * @param {Uint8Array} bytes
 * @returns {number}
 */
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * @param {Uint8Array} bytes
 * @returns {number}
 */
function adler32(bytes) {
  let a = 1;
  let b = 0;
  // 5552 is the largest run that cannot overflow the 32-bit accumulator.
  for (let i = 0; i < bytes.length;) {
    const end = Math.min(i + 5552, bytes.length);
    for (; i < end; i++) {
      a += bytes[i];
      b += a;
    }
    a %= 65521;
    b %= 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/* ------------------------------------------------------------------ *
 * Deflate
 * ------------------------------------------------------------------ */

/**
 * Wrap data in stored (type 00) deflate blocks with a zlib header.
 *
 * A stored block's length field is sixteen bits, so each block caps at 65535
 * bytes and longer data must be split. BFINAL is set on the last block only —
 * getting that wrong yields a stream that decodes correctly for any small
 * image and truncates on the first large one.
 *
 * @param {Uint8Array} data
 * @returns {Uint8Array}
 */
function deflateStored(data) {
  const MAX = 0xffff;
  const blockCount = Math.max(1, Math.ceil(data.length / MAX));
  const out = new Uint8Array(2 + blockCount * 5 + data.length + 4);
  let p = 0;

  // zlib header: deflate, 32K window, no preset dictionary. 0x78 0x01 is a
  // valid FCHECK pair (0x7801 % 31 === 0).
  out[p++] = 0x78;
  out[p++] = 0x01;

  for (let i = 0; i < blockCount; i++) {
    const start = i * MAX;
    const len = Math.min(MAX, data.length - start);
    const isLast = i === blockCount - 1;

    out[p++] = isLast ? 1 : 0;           // BFINAL, BTYPE = 00
    out[p++] = len & 0xff;               // LEN, little endian
    out[p++] = (len >>> 8) & 0xff;
    out[p++] = ~len & 0xff;              // NLEN, one's complement
    out[p++] = (~len >>> 8) & 0xff;

    out.set(data.subarray(start, start + len), p);
    p += len;
  }

  const sum = adler32(data);
  out[p++] = (sum >>> 24) & 0xff;        // adler32, big endian
  out[p++] = (sum >>> 16) & 0xff;
  out[p++] = (sum >>> 8) & 0xff;
  out[p++] = sum & 0xff;

  return out.subarray(0, p);
}

/**
 * Compress with whatever the platform provides, falling back to stored blocks.
 *
 * @param {Uint8Array} data
 * @returns {Promise<Uint8Array>}
 */
async function deflate(data) {
  // Node: zlib is built in, so this is not a dependency.
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
      const zlib = await import('node:zlib');
      return new Uint8Array(zlib.deflateSync(data));
    } catch {
      /* fall through */
    }
  }

  // Browsers: CompressionStream('deflate') emits the zlib format PNG wants.
  if (typeof CompressionStream === 'function') {
    try {
      const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate'));
      const buffer = await new Response(stream).arrayBuffer();
      return new Uint8Array(buffer);
    } catch {
      /* fall through */
    }
  }

  return deflateStored(data);
}

/* ------------------------------------------------------------------ *
 * PNG assembly
 * ------------------------------------------------------------------ */

const SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * @param {string} type Four ASCII characters.
 * @param {Uint8Array} payload
 * @returns {Uint8Array}
 */
function chunk(type, payload) {
  const out = new Uint8Array(12 + payload.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, payload.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(payload, 8);
  // The CRC covers the type and the payload, but not the length.
  view.setUint32(8 + payload.length, crc32(out.subarray(4, 8 + payload.length)));
  return out;
}

/**
 * Render to a PNG file.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 * @param {import('./options.js').RenderOptions} [options]
 * @returns {Promise<Uint8Array>}
 */
async function toPNG(matrix, options = {}) {
  const opts = normalizeOptions(matrix, options);
  const { scale, source, pixelWidth, pixelHeight } = opts;

  const dark = parseColor(opts.dark);
  const light = parseColor(opts.light);

  // --- Scanlines: filter byte 0, then one bit per pixel, MSB leftmost.
  const bytesPerRow = (pixelWidth + 7) >> 3;
  const raw = new Uint8Array((bytesPerRow + 1) * pixelHeight);

  const rowBits = new Uint8Array(bytesPerRow);
  for (let my = 0; my < source.height; my++) {
    rowBits.fill(0);
    for (let mx = 0; mx < source.width; mx++) {
      if (!source.get(mx, my)) continue;
      const from = mx * scale;
      for (let px = from; px < from + scale; px++) {
        rowBits[px >> 3] |= 0x80 >> (px & 7);
      }
    }
    for (let py = 0; py < scale; py++) {
      const offset = (my * scale + py) * (bytesPerRow + 1);
      raw[offset] = 0; // filter type 0 (None)
      raw.set(rowBits, offset + 1);
    }
  }

  // --- Chunks.
  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, pixelWidth);
  ihdrView.setUint32(4, pixelHeight);
  ihdr[8] = 1;   // bit depth
  ihdr[9] = 3;   // colour type 3: palette
  ihdr[10] = 0;  // compression: deflate
  ihdr[11] = 0;  // filter method
  ihdr[12] = 0;  // no interlace

  // Palette index 0 is light (a clear module), index 1 is dark.
  const plte = new Uint8Array([
    light[0], light[1], light[2],
    dark[0], dark[1], dark[2],
  ]);

  const parts = [SIGNATURE, chunk('IHDR', ihdr), chunk('PLTE', plte)];

  // tRNS is only emitted when something is actually translucent, so the common
  // opaque case produces a file every decoder handles identically.
  if (light[3] < 255 || dark[3] < 255) {
    parts.push(chunk('tRNS', new Uint8Array([light[3], dark[3]])));
  }

  parts.push(chunk('IDAT', await deflate(raw)));
  parts.push(chunk('IEND', new Uint8Array(0)));

  let total = 0;
  for (const part of parts) total += part.length;
  const file = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    file.set(part, offset);
    offset += part.length;
  }
  return file;
}

/**
 * Render to a data URI usable as an `<img>` src or a download href.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 * @param {import('./options.js').RenderOptions} [options]
 * @returns {Promise<string>}
 */
async function toPNGDataURI(matrix, options = {}) {
  const bytes = await toPNG(matrix, options);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = typeof btoa === 'function'
    ? btoa(binary)
    /* eslint-disable-next-line no-undef */
    : Buffer.from(bytes).toString('base64');
  return 'data:image/png;base64,' + base64;
}

__exports.deflateStored = deflateStored;
__exports.toPNG = toPNG;
__exports.toPNGDataURI = toPNGDataURI;
};

__modules["render/webgl.js"] = function (__require, __exports) {
/**
 * WebGL2 drawing.
 *
 * The matrix is uploaded as a one-byte-per-module R8 texture and drawn with a
 * fragment shader sampling it at NEAREST. That keeps module edges perfectly
 * sharp at any zoom, which is the property that matters — a barcode resampled
 * with interpolation stops being a barcode.
 *
 * Every entry point is failure-tolerant: no context, a lost context, a driver
 * that rejects the shader — all return false so the caller falls back to the
 * 2D path rather than showing the user nothing.
 *
 * @module render/webgl
 */
const { normalizeOptions, parseColor } = __require("render/options.js");

const VERTEX_SHADER = `#version 300 es
// A single oversized triangle covers the viewport with no vertex buffer:
// three gl_VertexID lookups, no attribute state to set up or leak.
out vec2 vUV;
void main() {
  vec2 pos = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUV = pos;
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;
uniform sampler2D uMatrix;
uniform vec4 uDark;
uniform vec4 uLight;
uniform vec2 uSize;
void main() {
  // Flip Y: texture row 0 is the top of the symbol, but GL's origin is bottom.
  vec2 uv = vec2(vUV.x, 1.0 - vUV.y);
  // Sample at the centre of the module, never on a boundary, so rounding
  // cannot pull a neighbouring module's value in at fractional scales.
  vec2 texel = (floor(uv * uSize) + 0.5) / uSize;
  float v = texture(uMatrix, texel).r;
  fragColor = v > 0.5 ? uDark : uLight;
}`;

/**
 * Is WebGL2 usable here?
 *
 * @returns {boolean}
 */
function isWebGL2Available() {
  try {
    if (typeof document === 'undefined') return false;
    if (typeof WebGL2RenderingContext === 'undefined') return false;
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (!gl) return false;
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {number} type
 * @param {string} source
 * @returns {WebGLShader | null}
 */
function compile(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/**
 * Draw a matrix into a canvas with WebGL2.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 * @param {HTMLCanvasElement | OffscreenCanvas} canvas
 * @param {import('./options.js').RenderOptions} [options]
 * @returns {boolean} True if it drew; false means the caller should fall back.
 */
function renderToCanvasWebGL(matrix, canvas, options = {}) {
  let gl = null;
  let program = null;
  let vs = null;
  let fs = null;
  let texture = null;
  let vao = null;

  try {
    const opts = normalizeOptions(matrix, options);
    const { source, pixelWidth, pixelHeight } = opts;

    gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false });
    if (!gl) return false;

    canvas.width = pixelWidth;
    canvas.height = pixelHeight;

    vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return false;

    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
    gl.useProgram(program);

    // One byte per module. R8 is the narrowest single-channel format WebGL2
    // guarantees as colour-renderable and filterable.
    const pixels = new Uint8Array(source.width * source.height);
    for (let y = 0; y < source.height; y++) {
      for (let x = 0; x < source.width; x++) {
        pixels[y * source.width + x] = source.get(x, y) ? 255 : 0;
      }
    }

    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.R8,
      source.width, source.height, 0,
      gl.RED, gl.UNSIGNED_BYTE, pixels
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const dark = parseColor(opts.dark).map((c) => c / 255);
    const light = parseColor(opts.light).map((c) => c / 255);

    gl.uniform1i(gl.getUniformLocation(program, 'uMatrix'), 0);
    gl.uniform4f(gl.getUniformLocation(program, 'uDark'), dark[0], dark[1], dark[2], dark[3]);
    gl.uniform4f(gl.getUniformLocation(program, 'uLight'), light[0], light[1], light[2], light[3]);
    gl.uniform2f(gl.getUniformLocation(program, 'uSize'), source.width, source.height);

    // WebGL2 still requires a bound VAO even when drawing without attributes.
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    gl.viewport(0, 0, pixelWidth, pixelHeight);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    return true;
  } catch {
    return false;
  } finally {
    // Release eagerly: a page generating many barcodes would otherwise hold
    // every texture until GC caught up, and GL memory is not GC's priority.
    if (gl) {
      try {
        if (vao) gl.deleteVertexArray(vao);
        if (texture) gl.deleteTexture(texture);
        if (program) gl.deleteProgram(program);
        if (vs) gl.deleteShader(vs);
        if (fs) gl.deleteShader(fs);
      } catch {
        /* context already gone */
      }
    }
  }
}

__exports.isWebGL2Available = isWebGL2Available;
__exports.renderToCanvasWebGL = renderToCanvasWebGL;
};

__modules["render/webgpu.js"] = function (__require, __exports) {
/**
 * WebGPU drawing.
 *
 * The same idea as the WebGL2 backend, expressed in WGSL: the matrix is
 * uploaded as a one-byte-per-module `r8unorm` texture and sampled with NEAREST
 * filtering, so module edges stay perfectly sharp at any size. A barcode
 * resampled with interpolation stops being a barcode, which is why the filter
 * choice is not a detail.
 *
 * Every entry point is failure-tolerant: no `navigator.gpu`, no adapter, a
 * device that refuses the shader, a lost device — all return false (or a
 * resolved false) so the caller falls back rather than showing nothing. The
 * functions here are async only because WebGPU's own setup is; nothing about
 * the drawing needs to be.
 *
 * @module render/webgpu
 */
const { normalizeOptions, parseColor } = __require("render/options.js");

/**
 * Vertex and fragment stages in one module, mirroring the WebGL2 pair.
 *
 * The vertex stage builds one oversized triangle from `vertex_index` alone:
 * three positions, no vertex buffer to allocate, bind or release.
 */
const SHADER = `
struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) uv : vec2<f32>,
};

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
  let x = f32((vertexIndex << 1u) & 2u);
  let y = f32(vertexIndex & 2u);
  var result : VertexOutput;
  result.uv = vec2<f32>(x, y);
  result.position = vec4<f32>(x * 2.0 - 1.0, y * 2.0 - 1.0, 0.0, 1.0);
  return result;
}

struct Style {
  dark : vec4<f32>,
  light : vec4<f32>,
  size : vec2<f32>,
};

@group(0) @binding(0) var moduleTexture : texture_2d<f32>;
@group(0) @binding(1) var moduleSampler : sampler;
@group(0) @binding(2) var<uniform> style : Style;

@fragment
fn fragmentMain(@location(0) quadUV : vec2<f32>) -> @location(0) vec4<f32> {
  // Flip Y: texture row 0 is the top of the symbol, but clip space puts +Y at
  // the top, so the interpolated quad coordinate runs the other way.
  let uv = vec2<f32>(quadUV.x, 1.0 - quadUV.y);
  // Sample at the centre of the module, never on a boundary, so rounding
  // cannot pull a neighbouring module's value in at fractional scales.
  let texel = (floor(uv * style.size) + vec2<f32>(0.5, 0.5)) / style.size;
  let v = textureSample(moduleTexture, moduleSampler, texel).r;
  return select(style.light, style.dark, v > 0.5);
}
`;

/**
 * The adapter and device are per-page, not per-barcode.
 *
 * Unlike a WebGL context — which the canvas owns, and which dies with it —
 * a `GPUDevice` is independent of any canvas, and requesting one is slow. A
 * page drawing a table of barcodes would otherwise pay for a full adapter
 * negotiation per symbol, and leak a device per symbol on top, because the
 * device cannot be destroyed while the canvas it configured is still on screen.
 *
 * @type {Promise<any> | null}
 */
let sharedDevice = null;

/**
 * Get the shared device, requesting one on first use.
 *
 * Never rejects: an unusable platform resolves to null.
 *
 * @returns {Promise<any>} The device, or null.
 */
function acquireDevice() {
  if (sharedDevice) return sharedDevice;

  // Hoisted so the `lost` handler below can compare against this exact
  // promise, and never clear a newer one that has replaced it.
  function forget() {
    if (sharedDevice === pending) sharedDevice = null;
  }

  const pending = (async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.gpu) return null;
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        forget();
        return null;
      }
      const device = await adapter.requestDevice();
      if (!device) {
        forget();
        return null;
      }
      // A lost device can never be revived, so drop it and let the next
      // render ask for a fresh one instead of failing forever.
      if (device.lost && typeof device.lost.then === 'function') {
        device.lost.then(forget, forget);
      }
      return device;
    } catch {
      forget();
      return null;
    }
  })();

  sharedDevice = pending;
  return pending;
}

/**
 * Is WebGPU usable here?
 *
 * Resolves false rather than throwing on every unsupported path, including
 * Node, where there is no `navigator.gpu` at all.
 *
 * @returns {Promise<boolean>}
 */
async function isWebGPUAvailable() {
  try {
    if (typeof navigator === 'undefined') return false;
    if (!navigator.gpu || typeof navigator.gpu.requestAdapter !== 'function') return false;
    // An adapter is the real test: `navigator.gpu` exists on machines whose
    // GPU is blocklisted, where every request still comes back null.
    const adapter = await navigator.gpu.requestAdapter();
    return Boolean(adapter);
  } catch {
    return false;
  }
}

/**
 * Did the shader compile?
 *
 * The WGSL analogue of checking `COMPILE_STATUS` in WebGL. Diagnostics are
 * optional in practice, so an implementation that cannot report them is given
 * the benefit of the doubt and the pipeline decides instead.
 *
 * @param {any} module
 * @returns {Promise<boolean>}
 */
async function compiles(module) {
  try {
    const query = module.getCompilationInfo ?? module.compilationInfo;
    if (typeof query !== 'function') return true;
    const info = await query.call(module);
    if (!info || !info.messages) return true;
    for (let i = 0; i < info.messages.length; i++) {
      if (info.messages[i].type === 'error') return false;
    }
    return true;
  } catch {
    return true;
  }
}

/**
 * Draw a matrix into a canvas with WebGPU.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 * @param {HTMLCanvasElement | OffscreenCanvas} canvas
 * @param {import('./options.js').RenderOptions} [options]
 * @returns {Promise<boolean>} True if it drew; false means the caller should
 *   fall back. Note that a canvas whose context has already been taken for
 *   WebGPU cannot then be handed to WebGL2 or 2D, so callers should probe
 *   availability before committing a canvas to this path.
 */
async function renderToCanvasWebGPU(matrix, canvas, options = {}) {
  let device = null;
  let texture = null;
  let uniforms = null;

  try {
    if (typeof navigator === 'undefined' || !navigator.gpu) return false;

    const opts = normalizeOptions(matrix, options);
    const { source, pixelWidth, pixelHeight } = opts;

    device = await acquireDevice();
    if (!device) return false;

    // Oversized symbols are a legitimate failure, not a crash: say so and let
    // the caller fall back to a path with no texture ceiling.
    // 8192 is the floor the specification guarantees, so it is the right
    // assumption when an implementation does not report its limits.
    const maxDimension = (device.limits && device.limits.maxTextureDimension2D) || 8192;
    if (source.width > maxDimension || source.height > maxDimension) return false;

    const context = canvas.getContext('webgpu');
    if (!context) return false;

    canvas.width = pixelWidth;
    canvas.height = pixelHeight;

    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'premultiplied' });

    // One byte per module. r8unorm is the narrowest format every WebGPU
    // implementation is required to support as a sampled texture.
    const pixels = new Uint8Array(source.width * source.height);
    for (let y = 0; y < source.height; y++) {
      for (let x = 0; x < source.width; x++) {
        pixels[y * source.width + x] = source.get(x, y) ? 255 : 0;
      }
    }

    texture = device.createTexture({
      size: { width: source.width, height: source.height, depthOrArrayLayers: 1 },
      format: 'r8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    // `bytesPerRow` needs no 256-byte alignment here — that rule belongs to
    // buffer-to-texture copies, not to writeTexture's linear source data.
    device.queue.writeTexture(
      { texture },
      pixels,
      { offset: 0, bytesPerRow: source.width, rowsPerImage: source.height },
      { width: source.width, height: source.height, depthOrArrayLayers: 1 }
    );

    const sampler = device.createSampler({
      magFilter: 'nearest',
      minFilter: 'nearest',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    // The canvas is configured as premultiplied, so the colours have to be
    // too — otherwise a translucent `light` would come out too bright and a
    // fully transparent one would tint the page behind it.
    const dark = parseColor(opts.dark);
    const light = parseColor(opts.light);
    const premultiplied = (c) => {
      const a = c[3] / 255;
      return [(c[0] / 255) * a, (c[1] / 255) * a, (c[2] / 255) * a, a];
    };
    const darkF = premultiplied(dark);
    const lightF = premultiplied(light);

    // std140-style layout: two vec4 then a vec2, rounded up to the struct's
    // 16-byte alignment. 48 bytes, of which the last 8 are padding.
    const style = new Float32Array(12);
    style.set(darkF, 0);
    style.set(lightF, 4);
    style[8] = source.width;
    style[9] = source.height;

    uniforms = device.createBuffer({
      size: style.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(uniforms, 0, style);

    const shader = device.createShaderModule({ code: SHADER });
    if (!(await compiles(shader))) return false;

    // An error scope is the WGSL analogue of checking LINK_STATUS: a rejected
    // pipeline is reported here instead of surfacing later as a lost device.
    let pipeline = null;
    if (typeof device.pushErrorScope === 'function') {
      device.pushErrorScope('validation');
      pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: shader, entryPoint: 'vertexMain' },
        fragment: { module: shader, entryPoint: 'fragmentMain', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
      });
      const failure = await device.popErrorScope();
      if (failure) return false;
    } else {
      pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: shader, entryPoint: 'vertexMain' },
        fragment: { module: shader, entryPoint: 'fragmentMain', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
      });
    }
    if (!pipeline) return false;

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: texture.createView() },
        { binding: 1, resource: sampler },
        { binding: 2, resource: { buffer: uniforms } },
      ],
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();
    device.queue.submit([encoder.finish()]);

    // Wait for the draw before the `finally` below frees its inputs, so
    // returning true genuinely means the pixels are there.
    if (device.queue && typeof device.queue.onSubmittedWorkDone === 'function') {
      await device.queue.onSubmittedWorkDone();
    }

    return true;
  } catch {
    return false;
  } finally {
    // Release eagerly: a page generating many barcodes would otherwise hold
    // every texture until GC caught up, and GPU memory is not GC's priority.
    // The device itself is deliberately kept — it is shared, and destroying it
    // would blank every canvas already configured with it.
    try {
      if (texture && typeof texture.destroy === 'function') texture.destroy();
      if (uniforms && typeof uniforms.destroy === 'function') uniforms.destroy();
    } catch {
      /* device already gone */
    }
  }
}

__exports.isWebGPUAvailable = isWebGPUAvailable;
__exports.renderToCanvasWebGPU = renderToCanvasWebGPU;
};

__modules["render/index.js"] = function (__require, __exports) {
/**
 * Output backends.
 *
 * ## On GPU acceleration — read this before assuming what it does
 *
 * The WebGL2 and WebGPU backends accelerate **drawing** a barcode, not
 * **computing** one. That distinction is worth stating plainly, because "GPU
 * barcode generation" naturally sounds like the latter.
 *
 * Encoding is sequential integer work: Reed-Solomon polynomial division, mask
 * penalty scoring, bit placement along a zig-zag path. Each step depends on the
 * one before it, which is precisely the shape a GPU cannot exploit. A complete
 * QR encode takes well under a millisecond on the CPU — less time than it takes
 * to dispatch a compute shader and read the result back. Moving it to the GPU
 * would make it slower, not faster, and no amount of engineering changes that.
 *
 * What the GPU genuinely helps with:
 *
 *   - **Drawing** large symbols, or many symbols per frame, straight into a
 *     canvas without a CPU-side pixel buffer.
 *   - **Reading**, where per-frame greyscale conversion and block statistics
 *     over a 1080p or 4K camera image are the real bottleneck and are
 *     embarrassingly parallel.
 *
 * So: encoding stays on the CPU because that is the correct engineering answer,
 * not because of a missing feature.
 *
 * @module render
 */
const __reexport0 = __require("render/svg.js"); __exports.toSVG = __reexport0.toSVG; __exports.toSVGDataURI = __reexport0.toSVGDataURI;
const __reexport1 = __require("render/image-data.js"); __exports.toImageData = __reexport1.toImageData; __exports.toCanvas = __reexport1.toCanvas;
const __reexport2 = __require("render/png.js"); __exports.toPNG = __reexport2.toPNG; __exports.toPNGDataURI = __reexport2.toPNGDataURI; __exports.deflateStored = __reexport2.deflateStored;
const __reexport3 = __require("render/webgl.js"); __exports.isWebGL2Available = __reexport3.isWebGL2Available; __exports.renderToCanvasWebGL = __reexport3.renderToCanvasWebGL;
const __reexport4 = __require("render/webgpu.js"); __exports.isWebGPUAvailable = __reexport4.isWebGPUAvailable; __exports.renderToCanvasWebGPU = __reexport4.renderToCanvasWebGPU;
const __reexport5 = __require("render/options.js"); __exports.normalizeOptions = __reexport5.normalizeOptions; __exports.parseColor = __reexport5.parseColor;
const { toCanvas } = __require("render/image-data.js");
const { isWebGL2Available, renderToCanvasWebGL } = __require("render/webgl.js");
const { isWebGPUAvailable, renderToCanvasWebGPU } = __require("render/webgpu.js");

/**
 * Draw into a canvas using the best backend available.
 *
 * Tries WebGL2, then the 2D context. The 2D path is always available, so this
 * never fails on a browser that can run the library at all — including every
 * version of Safari on iOS.
 *
 * WebGPU is not reachable from here, and cannot be: obtaining an adapter is
 * asynchronous, so a synchronous function can never wait for one. Use
 * `renderToCanvasAutoAsync` to include it. This one stays synchronous because
 * it is the documented signature and callers rely on the returned backend name
 * being available immediately.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 * @param {HTMLCanvasElement | OffscreenCanvas} canvas
 * @param {import('./options.js').RenderOptions & {backend?: 'auto'|'webgl2'|'2d'}} [options]
 * @returns {{backend: 'webgl2' | '2d' | 'none'}}
 */
function renderToCanvasAuto(matrix, canvas, options = {}) {
  const preferred = options.backend ?? 'auto';

  if ((preferred === 'auto' || preferred === 'webgl2') && isWebGL2Available()) {
    if (renderToCanvasWebGL(matrix, canvas, options)) return { backend: 'webgl2' };
  }
  if (toCanvas(matrix, canvas, options)) return { backend: '2d' };
  return { backend: 'none' };
}

/**
 * Draw into a canvas using the best backend available, including WebGPU.
 *
 * Tries WebGPU, then WebGL2, then the 2D context, and returns the name of the
 * one that drew.
 *
 * Each backend is *probed* before the canvas is handed to it. That ordering is
 * deliberate: a canvas can only ever have one kind of context, so committing it
 * to WebGPU and failing afterwards would leave it unable to fall back to
 * WebGL2 or 2D. The probes use throwaway objects of their own, so the caller's
 * canvas is only touched by a backend that is already known to work.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 * @param {HTMLCanvasElement | OffscreenCanvas} canvas
 * @param {import('./options.js').RenderOptions & {backend?: 'auto'|'webgpu'|'webgl2'|'2d'}} [options]
 * @returns {Promise<{backend: 'webgpu' | 'webgl2' | '2d' | 'none'}>}
 */
async function renderToCanvasAutoAsync(matrix, canvas, options = {}) {
  const preferred = options.backend ?? 'auto';

  if (preferred === 'auto' || preferred === 'webgpu') {
    if (await isWebGPUAvailable()) {
      if (await renderToCanvasWebGPU(matrix, canvas, options)) return { backend: 'webgpu' };
    }
  }
  if ((preferred === 'auto' || preferred === 'webgl2') && isWebGL2Available()) {
    if (renderToCanvasWebGL(matrix, canvas, options)) return { backend: 'webgl2' };
  }
  if (toCanvas(matrix, canvas, options)) return { backend: '2d' };
  return { backend: 'none' };
}

__exports.renderToCanvasAuto = renderToCanvasAuto;
__exports.renderToCanvasAutoAsync = renderToCanvasAutoAsync;
};

__modules["index.js"] = function (__require, __exports) {
/**
 * Sythos Barcode Suite — public API.
 *
 * Two functions carry the whole surface:
 *
 *   encode(text, { format })  ->  BitMatrix
 *   decode(image, { formats })  ->  Result[]
 *
 * Everything else is a renderer or a format-specific escape hatch. The core is
 * free of I/O and of any platform assumption: images go in as
 * `{ data, width, height }` with RGBA bytes, which is exactly what `ImageData`
 * is, so a canvas, an `OffscreenCanvas`, sharp, jimp and node-canvas all work
 * without an adapter.
 *
 * @module @sythos/js_barcode_universal
 */
const { BitMatrix } = __require("core/bit-matrix.js");
const { EncodeError, NotFoundError } = __require("core/errors.js");
const { LuminanceSource } = __require("image/luminance.js");
const { binarize } = __require("image/binarizer.js");
const { ONED_FORMATS } = __require("oned/index.js");
const { decodeOneD } = __require("oned/reader.js");
const datamatrix = __require("datamatrix/index.js");
const qr = __require("qr/index.js");
__exports.BitMatrix = BitMatrix;
const __reexport0 = __require("core/errors.js"); __exports.BarcodeError = __reexport0.BarcodeError; __exports.EncodeError = __reexport0.EncodeError; __exports.NotFoundError = __reexport0.NotFoundError; __exports.FormatError = __reexport0.FormatError; __exports.ChecksumError = __reexport0.ChecksumError;
const __reexport1 = __require("image/luminance.js"); __exports.LuminanceSource = __reexport1.LuminanceSource;
const __reexport2 = __require("image/binarizer.js"); __exports.binarize = __reexport2.binarize; __exports.binarizeGlobal = __reexport2.binarizeGlobal; __exports.binarizeHybrid = __reexport2.binarizeHybrid;
Object.assign(__exports, __require("oned/index.js"));
const __reexport3 = __require("render/svg.js"); __exports.toSVG = __reexport3.toSVG; __exports.toSVGDataURI = __reexport3.toSVGDataURI;
const __reexport4 = __require("render/image-data.js"); __exports.toImageData = __reexport4.toImageData; __exports.toCanvas = __reexport4.toCanvas;
const __reexport5 = __require("render/png.js"); __exports.toPNG = __reexport5.toPNG; __exports.toPNGDataURI = __reexport5.toPNGDataURI;
const __reexport6 = __require("render/index.js"); __exports.renderToCanvasAuto = __reexport6.renderToCanvasAuto; __exports.isWebGL2Available = __reexport6.isWebGL2Available;
const __reexport7 = __require("render/index.js"); __exports.renderToCanvasAutoAsync = __reexport7.renderToCanvasAutoAsync; __exports.isWebGPUAvailable = __reexport7.isWebGPUAvailable;
const __reexport8 = __require("qr/index.js"); __exports.encodeQR = __reexport8.encodeQR; __exports.decodeQR = __reexport8.decodeQR; __exports.detectQR = __reexport8.detectQR; __exports.detectAndDecodeQR = __reexport8.detectAndDecodeQR;
const __reexport9 = __require("datamatrix/index.js"); __exports.encodeDataMatrix = __reexport9.encodeDataMatrix; __exports.decodeDataMatrix = __reexport9.decodeDataMatrix; __exports.detectDataMatrix = __reexport9.detectDataMatrix; __exports.detectAndDecodeDataMatrix = __reexport9.detectAndDecodeDataMatrix;

/**
 * @typedef {object} FormatInfo
 * @property {string} id
 * @property {string} label
 * @property {boolean} canWrite
 * @property {boolean} canRead
 * @property {'1D' | '2D'} kind
 */

// Writing and reading a format are separate capabilities that can land at
// different times, so they are reported separately rather than collapsed into
// one "supported" flag that would be wrong in one direction or the other.
//
// Capability is probed rather than declared, so this stays correct whether the
// QR module is the full implementation or a stand-in: a module may opt out
// explicitly with QR_CAN_ENCODE/QR_CAN_DECODE, and is otherwise taken at face
// value.
const qrPresent = qr.QR_PLACEHOLDER !== true;
const qrCanEncode = qrPresent &&
  typeof qr.encodeQR === 'function' && qr.QR_CAN_ENCODE !== false;
const qrCanDecode = qrPresent &&
  typeof qr.detectAndDecodeQR === 'function' && qr.QR_CAN_DECODE !== false;
const dataMatrixCanEncode = typeof datamatrix.encodeDataMatrix === 'function';
const dataMatrixCanDecode = typeof datamatrix.detectAndDecodeDataMatrix === 'function';

/**
 * Every format this build supports.
 *
 * Writing and reading are listed separately on purpose. Writing a symbology is
 * a table lookup; reading one needs a detector that finds it in a photograph,
 * which is far more work. The two lists legitimately differ, and saying so
 * here is better than failing at call time.
 *
 * @returns {FormatInfo[]}
 */
function listFormats() {
  const formats = Object.entries(ONED_FORMATS).map(([id, info]) => ({
    id,
    label: info.label,
    canWrite: true,
    canRead: info.readable,
    kind: /** @type {'1D'} */ ('1D'),
  }));

  formats.push({
    id: 'qr',
    label: 'QR Code',
    canWrite: qrCanEncode,
    canRead: qrCanDecode,
    kind: /** @type {'2D'} */ ('2D'),
  });
  formats.push({
    id: 'datamatrix',
    label: 'Data Matrix ECC 200',
    canWrite: dataMatrixCanEncode,
    canRead: dataMatrixCanDecode,
    kind: /** @type {'2D'} */ ('2D'),
  });

  return formats;
}

/**
 * Encode a payload into a barcode matrix.
 *
 * The result is a `BitMatrix` where a set bit is a dark module, with no quiet
 * zone — the renderers add that, because the right margin depends on the
 * output medium. Linear symbols come back one module tall; height is a
 * rendering decision, not an encoding one.
 *
 * @param {string | number} text
 * @param {object} [options]
 * @param {string} [options.format] Format id. Default 'qr'.
 * @param {'L'|'M'|'Q'|'H'} [options.ecc] QR error-correction level.
 * @param {number} [options.version] QR version, 1-40. Auto if omitted.
 * @param {boolean} [options.checkDigit] Append a check digit, where optional.
 * @param {boolean} [options.fullAscii] Code 39 extended encoding.
 * @param {boolean} [options.gs1] Emit a leading FNC1.
 * @returns {BitMatrix}
 */
function encode(text, options = {}) {
  const format = String(options.format ?? 'qr').toLowerCase();
  const value = typeof text === 'number' ? String(text) : text;

  if (format === 'qr' || format === 'qrcode') {
    return qr.encodeQR(value, options);
  }
  if (format === 'datamatrix' || format === 'data-matrix') {
    return datamatrix.encodeDataMatrix(value, options);
  }

  const entry = ONED_FORMATS[format];
  if (!entry) {
    const known = [...Object.keys(ONED_FORMATS), 'qr', 'datamatrix'].join(', ');
    throw new EncodeError(`Unknown format "${format}". Known formats: ${known}`);
  }
  return entry.encode(value, options);
}

/**
 * @typedef {object} DecodeResult
 * @property {string} text
 * @property {string} format
 * @property {Uint8Array} [bytes] Raw payload, before text decoding.
 * @property {number} [version] QR version.
 * @property {string} [ecc] QR error-correction level.
 */

/**
 * Find and decode every barcode in an image.
 *
 * Returns an array, empty when nothing is found — an image with no barcode is
 * an ordinary outcome for a camera frame, not an error, and throwing would
 * make the common scanning loop a try/catch.
 *
 * @param {{data: Uint8ClampedArray|Uint8Array|number[], width: number, height: number}} image
 * @param {object} [options]
 * @param {string[]} [options.formats] Restrict to these format ids.
 * @param {boolean} [options.tryHarder] Retry inverted and rotated. Default true.
 * @param {'global'|'hybrid'|'auto'} [options.binarizer]
 * @returns {DecodeResult[]}
 */
function decode(image, options = {}) {
  const { formats = null, tryHarder = true, binarizer = 'auto' } = options;
  const want = formats ? new Set(formats.map((f) => f.toLowerCase())) : null;
  const wantQR = !want || want.has('qr') || want.has('qrcode');
  const wantDataMatrix = !want || want.has('datamatrix') || want.has('data-matrix');
  const wantOneD = !want || [...want].some((f) => f in ONED_FORMATS);

  const source = LuminanceSource.fromImageData(image);
  const results = [];

  // Light-on-dark symbols are common on screens and packaging, so a second
  // inverted pass is worth the cost when the first finds nothing.
  const passes = tryHarder ? [source, source.invert()] : [source];

  for (const pass of passes) {
    const bits = binarize(pass, binarizer);

    if (wantQR && qrCanDecode) {
      try {
        for (const found of qr.detectAndDecodeQR(bits)) {
          results.push({ ...found, format: 'qr' });
        }
      } catch {
        /* no QR in this pass */
      }
    }

    if (wantDataMatrix && dataMatrixCanDecode) {
      // Hybrid thresholding can erase the interior of very large, perfectly
      // uniform modules. In auto mode keep the local-threshold attempt, then
      // retry Data Matrix once with the global threshold before giving up.
      const dataMatrixBits = binarizer === 'auto' ? [bits, binarize(pass, 'global')] : [bits];
      for (const candidateBits of dataMatrixBits) {
        try {
          const found = datamatrix.detectAndDecodeDataMatrix(candidateBits);
          if (found) { results.push({ ...found, format: 'datamatrix' }); break; }
        } catch {
          /* no Data Matrix with this threshold */
        }
      }
    }

    if (wantOneD) {
      const oneDFormats = want ? [...want].filter((f) => f in ONED_FORMATS) : null;
      for (const found of decodeOneD(bits, { formats: oneDFormats, tryHarder })) {
        results.push({ text: found.text, format: found.format });
      }
    }

    if (results.length > 0) break;
  }

  // De-duplicate: the same symbol is often read on several scan rows.
  const seen = new Set();
  return results.filter((r) => {
    const key = `${r.format}:${r.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Decode, or throw if nothing is found.
 *
 * @param {{data: Uint8ClampedArray|Uint8Array|number[], width: number, height: number}} image
 * @param {object} [options]
 * @returns {DecodeResult}
 */
function decodeStrict(image, options) {
  const results = decode(image, options);
  if (results.length === 0) throw new NotFoundError('No barcode found in image');
  return results[0];
}

/** Library version, matching package.json. */
const VERSION = '1.0.0';

__exports.listFormats = listFormats;
__exports.encode = encode;
__exports.decode = decode;
__exports.decodeStrict = decodeStrict;
__exports.VERSION = VERSION;
};

var __entry = __require("index.js");
globalThisRef.SythosBarcode = __entry;
if (typeof module === 'object' && module.exports) module.exports = __entry;
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
