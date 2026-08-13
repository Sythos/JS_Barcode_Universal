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

import { BitReader } from '../core/bit-buffer.js';
import { ChecksumError, FormatError } from '../core/errors.js';
import { GF256_QR } from '../core/galois-field.js';
import { rsDecode } from '../core/reed-solomon.js';
import {
  ECC_LEVELS,
  MAX_VERSION,
  MIN_VERSION,
  MODE,
  VERSION_INFO_MIN,
  blockLayout,
  countBits,
  dataModuleOrder,
  formatInfoPositions,
  maskBit,
  versionSize,
} from './tables.js';
import { ALPHANUMERIC_CHARS, formatInfoBits, versionInfoBits } from './encoder.js';

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
export function decodeQR(matrix) {
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

export { ChecksumError };
