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

/** Data Matrix ECC 200 encoder: ASCII/Base256, RS interleaving and Annex F placement. */
import { BitMatrix } from '../core/bit-matrix.js';
import { EncodeError } from '../core/errors.js';
import { GF256_DM } from '../core/galois-field.js';
import { rsEncode } from '../core/reed-solomon.js';
import { symbolForDataCodewords } from './tables.js';

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
export function encodeDataMatrix(value, options = {}) {
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
export function encodeDataMatrixCodewords(codewords, options = {}) {
  if (!Array.isArray(codewords) && !(codewords instanceof Uint8Array)) throw new EncodeError('Data Matrix: codewords must be an array');
  for (const c of codewords) if (!Number.isInteger(c) || c < 0 || c > 255) throw new EncodeError('Data Matrix: codewords must be bytes');
  const symbol = symbolForDataCodewords(codewords.length, options.shape ?? 'any');
  if (!symbol) throw new EncodeError('Data Matrix: codewords do not fit ECC 200');
  return buildMatrix(interleave(pad(Array.from(codewords), symbol.dataCodewords), symbol), symbol);
}
