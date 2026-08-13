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
 * Decoder for a sampled Aztec symbol.
 *
 * This module deliberately accepts only a square, module-aligned BitMatrix.
 * Locating a bull's-eye in a photograph and perspective sampling are detector
 * concerns. Keeping the two stages apart makes all bit order and ECC rules
 * testable without image-processing noise.
 *
 * Contract with tables.js:
 *   - aztecSymbolForLayers(compact, layers) returns the nominal symbol data;
 *   - aztecWordSizeForLayers(layers) returns 6, 8, 10 or 12;
 *   - aztecFieldForLayers(layers) returns the matching binary Galois field;
 *   - aztecMatrixSize(compact, layers) returns the rendered square size.
 *
 * @module aztec/decoder
 */

import { FormatError } from '../core/errors.js';
import { rsDecode } from '../core/reed-solomon.js';
import {
  aztecLayer as aztecSymbolForLayers,
  wordSizeForLayers as aztecWordSizeForLayers,
  fieldForLayers as aztecFieldForLayers,
  fieldForWordSize,
  aztecSymbolSize as aztecMatrixSize,
} from './tables.js';

const UPPER = ['CTRL_PS', ' ', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'CTRL_LL', 'CTRL_ML', 'CTRL_DL', 'CTRL_BS'];
const LOWER = ['CTRL_PS', ' ', ...'abcdefghijklmnopqrstuvwxyz', 'CTRL_US', 'CTRL_ML', 'CTRL_DL', 'CTRL_BS'];
const MIXED = [
  'CTRL_PS', ' ', '\x01', '\x02', '\x03', '\x04', '\x05', '\x06', '\x07', '\b', '\t', '\n', '\x0b', '\f', '\r', '\x1b',
  '\x1c', '\x1d', '\x1e', '\x1f', '@', '\\', '^', '_', '`', '|', '~', '\x7f', 'CTRL_LL', 'CTRL_UL', 'CTRL_PL', 'CTRL_BS',
];
const PUNCT = ['FLG(n)', '\r', '\r\n', '. ', ', ', ': ', '!', '"', '#', '$', '%', '&', "'", '(', ')', '*', '+', ',', '-', '.', '/', ':', ';', '<', '=', '>', '?', '[', ']', '{', '}', 'CTRL_UL'];
const DIGIT = ['CTRL_PS', ' ', ...'0123456789', ',', '.', 'CTRL_UL'];
const TABLES = { UPPER, LOWER, MIXED, PUNCT, DIGIT };

/** @param {boolean[]} bits @param {number} offset @param {number} count */
function readBits(bits, offset, count) {
  if (offset + count > bits.length) throw new FormatError('Aztec: truncated high-level stream');
  let value = 0;
  for (let i = 0; i < count; i++) value = (value << 1) | (bits[offset + i] ? 1 : 0);
  return value;
}

/** @param {number} value @param {number} count @param {boolean[]} out */
function appendBits(value, count, out) {
  for (let i = count - 1; i >= 0; i--) out.push(((value >>> i) & 1) !== 0);
}

/**
 * Decode an Aztec high-level bit stream to its exact byte payload.
 *
 * Text tables contribute their ISO-8859-1 byte values; Binary Shift appends
 * raw bytes. ECI markers are consumed but intentionally not emitted: callers
 * receive the transported byte payload and may select their own charset.
 *
 * @param {boolean[]} bits
 * @returns {Uint8Array}
 */
export function decodeHighLevelBits(bits) {
  const output = [];
  let latch = 'UPPER';
  let shift = 'UPPER';
  let offset = 0;

  while (offset < bits.length) {
    if (shift === 'BINARY') {
      if (offset + 5 > bits.length) break; // legal trailing pad
      let length = readBits(bits, offset, 5);
      offset += 5;
      if (length === 0) {
        if (offset + 11 > bits.length) throw new FormatError('Aztec: truncated Binary Shift length');
        length = readBits(bits, offset, 11) + 31;
        offset += 11;
      }
      if (offset + length * 8 > bits.length) throw new FormatError('Aztec: truncated Binary Shift data');
      for (let i = 0; i < length; i++) {
        output.push(readBits(bits, offset, 8));
        offset += 8;
      }
      shift = latch;
      continue;
    }

    const size = shift === 'DIGIT' ? 4 : 5;
    if (offset + size > bits.length) break; // trailing pad after unstuffing
    const code = readBits(bits, offset, size);
    offset += size;
    const table = TABLES[shift];
    const token = table[code];
    if (token === undefined) throw new FormatError(`Aztec: invalid ${shift} code ${code}`);

    if (token === 'FLG(n)') {
      if (offset + 3 > bits.length) throw new FormatError('Aztec: truncated FLG(n)');
      const count = readBits(bits, offset, 3);
      offset += 3;
      if (count === 0) output.push(0x1d); // FNC1 / GS
      else if (count <= 6) {
        // ECI assignment number, encoded as count decimal digits. It changes
        // interpretation, not the wire bytes, so consume it without output.
        for (let i = 0; i < count; i++) {
          if (offset + 4 > bits.length) throw new FormatError('Aztec: truncated ECI');
          const digit = readBits(bits, offset, 4);
          offset += 4;
          if (digit < 2 || digit > 11) throw new FormatError('Aztec: invalid ECI digit');
        }
      } else {
        throw new FormatError(`Aztec: unsupported FLG(${count})`);
      }
      shift = latch;
      continue;
    }

    if (token.startsWith('CTRL_')) {
      const targetCode = token.slice(5, -1);
      const latchMode = token.endsWith('L');
      const target = ({ P: 'PUNCT', L: 'LOWER', M: 'MIXED', D: 'DIGIT', U: 'UPPER', B: 'BINARY' })[targetCode];
      if (!target) throw new FormatError(`Aztec: invalid control ${token}`);
      shift = target;
      if (latchMode) latch = shift;
      continue;
    }

    for (let i = 0; i < token.length; i++) output.push(token.charCodeAt(i));
    shift = latch;
  }
  return Uint8Array.from(output);
}

/** @param {boolean} compact @param {number} layers */
function alignmentMap(compact, layers) {
  const baseSize = (compact ? 11 : 14) + layers * 4;
  if (compact) return Array.from({ length: baseSize }, (_, i) => i);
  const size = aztecMatrixSize(layers, false);
  const map = new Array(baseSize);
  const baseCenter = baseSize >> 1;
  const center = size >> 1;
  for (let i = 0; i < baseCenter; i++) {
    const offset = i + Math.floor(i / 15);
    map[baseCenter - i - 1] = center - offset - 1;
    map[baseCenter + i] = center + offset + 1;
  }
  return map;
}

/**
 * Read the four sides of the parameter message. The order mirrors the
 * clockwise write order and is independent of the data spiral.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 * @param {boolean} compact
 * @returns {boolean[]}
 */
function readModeBits(matrix, compact) {
  const center = matrix.width >> 1;
  const side = compact ? 7 : 10;
  const offset = compact ? 5 : 7;
  // Full symbols skip the reference grid line through the bull's-eye. This
  // exact sequence is also used by drawModeMessage() in encoder.js.
  const positions = Array.from(
    { length: side },
    (_, i) => compact ? center - 3 + i : center - 5 + i + Math.floor(i / 5),
  );
  const bits = [];
  for (let i = 0; i < side; i++) bits.push(matrix.get(positions[i], center - offset));
  for (let i = 0; i < side; i++) bits.push(matrix.get(center + offset, positions[i]));
  for (let i = 0; i < side; i++) bits.push(matrix.get(positions[side - 1 - i], center + offset));
  for (let i = 0; i < side; i++) bits.push(matrix.get(center - offset, positions[side - 1 - i]));
  return bits;
}

/** @param {boolean[]} bits @param {boolean} compact */
function decodeModeMessage(bits, compact) {
  const total = compact ? 7 : 10;
  const dataWords = compact ? 2 : 4;
  const words = new Array(total);
  for (let i = 0; i < total; i++) words[i] = readBits(bits, i * 4, 4);
  const corrections = rsDecode(words, total - dataWords, fieldForWordSize(4), 1);
  let data = 0;
  for (let i = 0; i < dataWords; i++) data = (data << 4) | words[i];
  const layers = compact ? (data >>> 6) + 1 : (data >>> 11) + 1;
  const dataCodewords = compact ? (data & 0x3f) + 1 : (data & 0x7ff) + 1;
  return { layers, dataCodewords, corrections };
}

/** @param {boolean} compact @param {number} layers */
function totalBitsInLayers(compact, layers) {
  return ((compact ? 88 : 112) + 16 * layers) * layers;
}

/**
 * Extract raw, stuffed codeword bits in logical ring order.
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 * @param {boolean} compact @param {number} layers
 * @returns {boolean[]}
 */
function extractBits(matrix, compact, layers) {
  const baseSize = (compact ? 11 : 14) + layers * 4;
  const map = alignmentMap(compact, layers);
  const raw = new Array(totalBitsInLayers(compact, layers));
  let offset = 0;
  for (let layer = 0; layer < layers; layer++) {
    const rowSize = (layers - layer) * 4 + (compact ? 9 : 12);
    for (let j = 0; j < rowSize; j++) {
      const col = j * 2;
      for (let k = 0; k < 2; k++) {
        raw[offset + col + k] = matrix.get(map[layer * 2 + k], map[layer * 2 + j]);
        raw[offset + rowSize * 2 + col + k] = matrix.get(map[layer * 2 + j], map[baseSize - 1 - layer * 2 - k]);
        raw[offset + rowSize * 4 + col + k] = matrix.get(map[baseSize - 1 - layer * 2 - k], map[baseSize - 1 - layer * 2 - j]);
        raw[offset + rowSize * 6 + col + k] = matrix.get(map[baseSize - 1 - layer * 2 - j], map[layer * 2 + k]);
      }
    }
    offset += rowSize * 8;
  }
  return raw;
}

/** @param {boolean[]} raw @param {number} layers @param {number} dataCodewords */
function correctAndUnstuff(raw, layers, dataCodewords) {
  const wordSize = aztecWordSizeForLayers(layers);
  const totalWords = Math.floor(raw.length / wordSize);
  if (dataCodewords <= 0 || dataCodewords > totalWords) throw new FormatError('Aztec: invalid data word count');
  const start = raw.length % wordSize;
  const words = new Array(totalWords);
  for (let i = 0; i < totalWords; i++) words[i] = readBits(raw, start + i * wordSize, wordSize);
  const corrections = rsDecode(words, totalWords - dataCodewords, aztecFieldForLayers(layers), 1);
  const mask = (1 << wordSize) - 1;
  const corrected = [];
  for (let i = 0; i < dataCodewords; i++) {
    const word = words[i];
    if (word === 0 || word === mask) throw new FormatError('Aztec: invalid stuffed codeword');
    if (word === 1 || word === mask - 1) {
      for (let j = 0; j < wordSize - 1; j++) corrected.push(word === mask - 1);
    } else {
      appendBits(word, wordSize, corrected);
    }
  }
  return { bits: corrected, corrections };
}

/** @param {Uint8Array} bytes */
function bytesToText(bytes) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return new TextDecoder('latin1').decode(bytes); }
}

/**
 * Decode a square Aztec symbol with one bit per module and no quiet zone.
 * The matrix must already be oriented with the mode message at the top.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 * @returns {{text: string, bytes: Uint8Array, compact: boolean, layers: number, corrections: number, eccPercent: number}}
 */
export function decodeAztec(matrix) {
  if (!matrix || matrix.width !== matrix.height) throw new FormatError('Aztec: expected a square BitMatrix');
  let compact;
  let mode;
  // Compact and full dimensions are disjoint; trying both also makes malformed
  // candidate handling deterministic for the future image detector.
  for (const candidate of [true, false]) {
    try {
      const value = decodeModeMessage(readModeBits(matrix, candidate), candidate);
      if (value.layers < 1 || value.layers > (candidate ? 4 : 32)) continue;
      if (aztecMatrixSize(value.layers, candidate) !== matrix.width) continue;
      compact = candidate;
      mode = value;
      break;
    } catch { /* Try the other family. */ }
  }
  if (compact === undefined || !mode) throw new FormatError('Aztec: invalid mode message or dimensions');
  // Ensure the declared layer data agrees with the table module, so a future
  // tables refactor cannot silently make decoder capacity calculations stale.
  aztecSymbolForLayers(mode.layers, compact);
  const raw = extractBits(matrix, compact, mode.layers);
  const payload = correctAndUnstuff(raw, mode.layers, mode.dataCodewords);
  const bytes = decodeHighLevelBits(payload.bits);
  const totalWords = Math.floor(raw.length / aztecWordSizeForLayers(mode.layers));
  return {
    text: bytesToText(bytes),
    bytes,
    compact,
    layers: mode.layers,
    corrections: mode.corrections + payload.corrections,
    eccPercent: Math.round(((totalWords - mode.dataCodewords) * 100) / totalWords),
  };
}
