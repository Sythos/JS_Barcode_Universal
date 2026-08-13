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

import { BitMatrix } from '../core/bit-matrix.js';
import { BitWriter } from '../core/bit-buffer.js';
import { EncodeError } from '../core/errors.js';
import { GF256_QR } from '../core/galois-field.js';
import { rsEncode } from '../core/reed-solomon.js';
import {
  ECC_LEVELS,
  ECC_LEVEL_BITS,
  MAX_VERSION,
  MIN_VERSION,
  MODE,
  VERSION_INFO_MIN,
  alignmentCentres,
  blockLayout,
  countBits,
  dataBitCapacity,
  dataModuleOrder,
  formatInfoPositions,
  maskBit,
  versionSize,
} from './tables.js';

/** Alphanumeric mode character set; a character's index is its encoded value. */
export const ALPHANUMERIC_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

/** ECI designator for UTF-8. */
export const ECI_UTF8 = 26;

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
export function sjisToThirteenBits(sjis) {
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
export function formatInfoBits(ecc, mask) {
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
export function versionInfoBits(version) {
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
export function maskPenalty(m) {
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
export function encodeQR(text, options = {}) {
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
