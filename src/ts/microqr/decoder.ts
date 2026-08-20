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
 * Micro QR decoder for an already sampled M1-M4 module matrix.
 *
 * @module microqr/decoder
 */

import { ChecksumError, FormatError } from '../core/errors.js';
import { GF256_QR } from '../core/galois-field.js';
import { rsDecode } from '../core/reed-solomon.js';
import {
  microQrBlockLayout,
  microQrDataModuleOrder,
  microQrDecodeFormatInfo,
  microQrFormatInfoPositions,
  microQrMaskBit,
} from './tables.js';

const ALPHANUMERIC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const MODE_NAMES = ['numeric', 'alphanumeric', 'byte', 'kanji'];
const COUNT_BITS = {
  numeric: [0, 3, 4, 5, 6],
  alphanumeric: [0, 0, 3, 4, 5],
  byte: [0, 0, 0, 4, 5],
  kanji: [0, 0, 0, 3, 4],
};

class LimitedBitReader {
  constructor(bytes, limit) {
    this.bytes = bytes;
    this.limit = limit;
    this.offset = 0;
  }

  available() { return this.limit - this.offset; }

  read(count) {
    if (!Number.isInteger(count) || count < 1 || count > 32 || count > this.available()) {
      throw new FormatError(`Micro QR: needed ${count} bits, ${Math.max(0, this.available())} remain`);
    }
    let value = 0;
    for (let i = 0; i < count; i++, this.offset++) {
      value = (value << 1) | ((this.bytes[this.offset >>> 3] >>> (7 - (this.offset & 7))) & 1);
    }
    return value >>> 0;
  }
}

function moduleAt(matrix, x, y, mirrored) {
  return mirrored ? matrix.get(y, x) : matrix.get(x, y);
}

function readFormat(matrix, expectedVersion, mirrored) {
  let bits = 0;
  const positions = microQrFormatInfoPositions(matrix.width);
  for (let i = 0; i < positions.length; i++) {
    const [x, y] = positions[i];
    if (moduleAt(matrix, x, y, mirrored)) bits |= 1 << i;
  }
  const format = microQrDecodeFormatInfo(bits);
  if (!format) throw new FormatError('Micro QR: format information is unreadable');
  if (format.version !== expectedVersion) {
    throw new FormatError(
      `Micro QR: format identifies ${format.version}, but the matrix dimension identifies ${expectedVersion}`,
    );
  }
  return format;
}

function readCodewords(matrix, layout, mask, mirrored) {
  const order = microQrDataModuleOrder(layout.version);
  const data = new Array(layout.dataCodewords).fill(0);
  const ecc = new Array(layout.eccCodewords).fill(0);
  let streamOffset = 0;

  const readBit = () => {
    const x = order[streamOffset * 2];
    const y = order[streamOffset * 2 + 1];
    if (x === undefined || y === undefined) throw new FormatError('Micro QR: encoding region is truncated');
    streamOffset++;
    return moduleAt(matrix, x, y, mirrored) !== microQrMaskBit(mask, x, y) ? 1 : 0;
  };
  const readInto = (target, index, count, highBit = 7) => {
    for (let bit = highBit; bit > highBit - count; bit--) target[index] |= readBit() << bit;
  };

  const fullData = layout.shortDataCodewordBits === 4 ? layout.dataCodewords - 1 : layout.dataCodewords;
  for (let i = 0; i < fullData; i++) readInto(data, i, 8);
  if (layout.shortDataCodewordBits === 4) readInto(data, data.length - 1, 4);
  for (let i = 0; i < ecc.length; i++) readInto(ecc, i, 8);

  if (streamOffset !== order.length / 2) {
    throw new FormatError(`Micro QR: read ${streamOffset} of ${order.length / 2} encoding modules`);
  }
  return data.concat(ecc);
}

function correctCodewords(received, layout) {
  const corrections = rsDecode(received, layout.eccCodewords, GF256_QR, 0);
  if (layout.version === 'M1' && corrections !== 0) {
    throw new ChecksumError('Micro QR: M1 provides error detection only');
  }
  return { data: Uint8Array.from(received.slice(0, layout.dataCodewords)), corrections };
}

function decodeKanjiValue(value) {
  const combined = (Math.floor(value / 0xc0) << 8) | (value % 0xc0);
  const sjis = combined + (combined < 0x1f00 ? 0x8140 : 0xc140);
  const bytes = Uint8Array.of(sjis >>> 8, sjis & 0xff);
  try {
    return new TextDecoder('shift_jis', { fatal: true }).decode(bytes);
  } catch {
    throw new FormatError(`Micro QR: invalid Kanji value ${value}`);
  }
}

function parsePayload(data, version, dataBits) {
  const reader = new LimitedBitReader(data, dataBits);
  const modeValue = version === 1 ? 0 : reader.read(version - 1);
  if (modeValue > 3 || (version === 2 && modeValue > 1)) {
    throw new FormatError(`Micro QR: mode indicator ${modeValue} is unavailable in M${version}`);
  }
  const mode = MODE_NAMES[modeValue];
  const countWidth = COUNT_BITS[mode][version];
  if (!countWidth) throw new FormatError(`Micro QR: ${mode} mode is unavailable in M${version}`);
  const count = reader.read(countWidth);
  if (count === 0) throw new FormatError('Micro QR: zero-length data segment');

  let text = '';
  const rawBytes = [];
  if (mode === 'numeric') {
    let remaining = count;
    while (remaining >= 3) {
      const value = reader.read(10);
      if (value >= 1000) throw new FormatError(`Micro QR: invalid numeric triplet ${value}`);
      text += String(value).padStart(3, '0');
      remaining -= 3;
    }
    if (remaining === 2) {
      const value = reader.read(7);
      if (value >= 100) throw new FormatError(`Micro QR: invalid numeric pair ${value}`);
      text += String(value).padStart(2, '0');
    } else if (remaining === 1) {
      const value = reader.read(4);
      if (value >= 10) throw new FormatError(`Micro QR: invalid numeric digit ${value}`);
      text += String(value);
    }
  } else if (mode === 'alphanumeric') {
    let remaining = count;
    while (remaining >= 2) {
      const value = reader.read(11);
      if (value >= 45 * 45) throw new FormatError(`Micro QR: invalid alphanumeric pair ${value}`);
      text += ALPHANUMERIC[Math.floor(value / 45)] + ALPHANUMERIC[value % 45];
      remaining -= 2;
    }
    if (remaining === 1) {
      const value = reader.read(6);
      if (value >= 45) throw new FormatError(`Micro QR: invalid alphanumeric value ${value}`);
      text += ALPHANUMERIC[value];
    }
  } else if (mode === 'byte') {
    for (let i = 0; i < count; i++) {
      const value = reader.read(8);
      rawBytes.push(value);
      text += String.fromCharCode(value);
    }
  } else {
    for (let i = 0; i < count; i++) text += decodeKanjiValue(reader.read(13));
  }
  return { text, bytes: Uint8Array.from(rawBytes), mode };
}

function decodeOrientation(matrix, expectedVersion, mirrored) {
  const format = readFormat(matrix, expectedVersion, mirrored);
  const layout = microQrBlockLayout(format.version, format.ecc);
  const received = readCodewords(matrix, layout, format.mask, mirrored);
  const { data, corrections } = correctCodewords(received, layout);
  const payload = parsePayload(data, Number(format.version.slice(1)), layout.dataBits);
  return {
    text: payload.text,
    bytes: payload.bytes,
    mode: payload.mode,
    version: format.version,
    ecc: format.ecc,
    mask: format.mask,
    corrections,
    formatCorrections: format.correctedBits,
    mirrored,
  };
}

/** Decode a sampled Micro QR Code symbol without its quiet zone. */
export function decodeMicroQR(matrix) {
  if (!matrix || !Number.isInteger(matrix.width) || typeof matrix.get !== 'function') {
    throw new FormatError('Micro QR: no matrix supplied');
  }
  if (matrix.height !== matrix.width) {
    throw new FormatError(`Micro QR: symbol must be square, got ${matrix.width}x${matrix.height}`);
  }
  const version = (matrix.width - 9) / 2;
  if (!Number.isInteger(version) || version < 1 || version > 4) {
    throw new FormatError(`Micro QR: ${matrix.width} modules is not a valid M1-M4 symbol size`);
  }
  const expectedVersion = `M${version}`;
  try {
    return decodeOrientation(matrix, expectedVersion, false);
  } catch (primaryError) {
    try {
      return decodeOrientation(matrix, expectedVersion, true);
    } catch {
      throw primaryError;
    }
  }
}

export { ChecksumError, FormatError };
