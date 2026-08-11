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

/** PDF417 high-level text, byte and numeric compaction. @module pdf417/compaction */

import { EncodeError, FormatError } from '../core/errors.js';

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz ';
const MIXED = '0123456789&\r\t,:#-.$/+%*=^';
const PUNCT = ';<>@[\\]_`~!\r\t,:\n-.$/"|*()?{}\'';

function packBase30(values) {
  const out = [];
  for (let i = 0; i < values.length; i += 2) out.push(values[i] * 30 + (i + 1 < values.length ? values[i + 1] : 29));
  return out;
}

/** Compact a value using the PDF417 Text Compaction alphabet. */
export function compactPdf417Text(value) {
  if (typeof value !== 'string') throw new EncodeError('PDF417 text: value must be a string');
  const values = [];
  let submode = 'alpha';
  for (const character of value) {
    const inAlpha = ALPHA.indexOf(character), inLower = LOWER.indexOf(character);
    const inMixed = MIXED.indexOf(character), inPunct = PUNCT.indexOf(character);
    if (submode === 'alpha') {
      if (inAlpha >= 0) values.push(inAlpha);
      else if (inLower >= 0) { values.push(27, inLower); submode = 'lower'; }
      else if (inMixed >= 0 || character === ' ') { values.push(28, character === ' ' ? 26 : inMixed); submode = 'mixed'; }
      else if (inPunct >= 0) values.push(29, inPunct);
      else throw new EncodeError(`PDF417 text: unsupported character ${JSON.stringify(character)}`);
    } else if (submode === 'lower') {
      if (inLower >= 0) values.push(inLower);
      else if (inAlpha >= 0) values.push(27, inAlpha);
      else if (inMixed >= 0 || character === ' ') { values.push(28, character === ' ' ? 26 : inMixed); submode = 'mixed'; }
      else if (inPunct >= 0) values.push(29, inPunct);
      else throw new EncodeError(`PDF417 text: unsupported character ${JSON.stringify(character)}`);
    } else {
      if (inMixed >= 0) values.push(inMixed);
      else if (character === ' ') values.push(26);
      else if (inAlpha >= 0) { values.push(28); submode = 'alpha'; values.push(inAlpha); }
      else if (inLower >= 0) { values.push(27); submode = 'lower'; values.push(inLower); }
      else if (inPunct >= 0) values.push(29, inPunct);
      else throw new EncodeError(`PDF417 text: unsupported character ${JSON.stringify(character)}`);
    }
  }
  return packBase30(values);
}

function asBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (typeof value === 'string') return new TextEncoder().encode(value);
  throw new EncodeError('PDF417 byte: value must be text or a byte array');
}

/** Compact bytes using latch 924 for exact six-byte blocks and 901 otherwise. */
export function compactPdf417Bytes(value) {
  const bytes = asBytes(value);
  const utf8 = typeof value === 'string' && /[^\x00-\x7f]/.test(value);
  const out = utf8 ? [927, 26] : [];
  out.push(bytes.length > 0 && bytes.length % 6 === 0 ? 924 : 901);
  let at = 0;
  while (at + 6 <= bytes.length) {
    let number = 0n;
    for (let i = 0; i < 6; i++) number = (number << 8n) | BigInt(bytes[at++]);
    const group = new Array(5);
    for (let i = 4; i >= 0; i--) { group[i] = Number(number % 900n); number /= 900n; }
    out.push(...group);
  }
  while (at < bytes.length) out.push(bytes[at++]);
  return out;
}

/** Compact decimal digits using latch 902 and groups of at most 44 digits. */
export function compactPdf417Numeric(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new EncodeError('PDF417 numeric: value must contain decimal digits only');
  const out = [902];
  for (let at = 0; at < value.length; at += 44) {
    let number = BigInt(`1${value.slice(at, at + 44)}`);
    const group = [];
    do { group.unshift(Number(number % 900n)); number /= 900n; } while (number > 0n);
    out.push(...group);
  }
  return out;
}

/** Compact a single value, selecting text, numeric or byte mode. */
export function compactPdf417(value, options = {}) {
  const mode = options.compaction ?? 'auto';
  if (mode === 'text') return compactPdf417Text(value);
  if (mode === 'byte') return compactPdf417Bytes(value);
  if (mode === 'numeric') return compactPdf417Numeric(value);
  if (mode !== 'auto') throw new EncodeError(`PDF417: unsupported compaction mode ${JSON.stringify(mode)}`);
  if (typeof value === 'string' && /^\d{13,}$/.test(value)) return compactPdf417Numeric(value);
  if (typeof value === 'string') {
    try { return compactPdf417Text(value); } catch (error) { if (!(error instanceof EncodeError)) throw error; }
  }
  return compactPdf417Bytes(value);
}

function assertCodeword(codeword) {
  if (!Number.isInteger(codeword) || codeword < 0 || codeword > 928) throw new FormatError('PDF417: codeword is outside 0..928');
}

function decodeUtf8(bytes, eci) {
  if (eci === 3) return Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  if (eci !== 26) throw new FormatError(`PDF417 ECI: unsupported assignment number ${eci}`);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes)); }
  catch { throw new FormatError('PDF417 byte: invalid UTF-8 sequence'); }
}

function decodeByteSegment(codewords, at, eci, sixOnly = false) {
  const values = [];
  while (at < codewords.length && codewords[at] < 900) values.push(codewords[at++]);
  if (sixOnly && values.length % 5) throw new FormatError('PDF417 byte: 924 segment must contain complete six-byte groups');
  const bytes = [];
  // In 901 mode an encoder can use five terminal literal codewords. The
  // unambiguous groups are therefore the ones followed by another codeword;
  // 924 is available whenever a segment consists exclusively of six-byte groups.
  const groupCount = sixOnly ? values.length / 5 : Math.max(0, Math.floor((values.length - 1) / 5));
  for (let groupAt = 0; groupAt < groupCount * 5; groupAt += 5) {
    let number = 0n;
    for (let i = 0; i < 5; i++) number = number * 900n + BigInt(values[groupAt + i]);
    const group = new Uint8Array(6);
    for (let i = 5; i >= 0; i--) { group[i] = Number(number & 255n); number >>= 8n; }
    if (number !== 0n) throw new FormatError('PDF417 byte: base-900 group exceeds six bytes');
    bytes.push(...group);
  }
  for (let i = groupCount * 5; i < values.length; i++) {
    if (values[i] > 255) throw new FormatError('PDF417 byte: literal tail is outside 0..255');
    bytes.push(values[i]);
  }
  return { at, text: decodeUtf8(bytes, eci), bytes: Uint8Array.from(bytes) };
}

function decodeTextSegment(codewords, at, eci) {
  let mode = 'alpha';
  let output = '';
  let shift = null;
  let shiftedBytes = [];
  const bytes = [];
  const flushShiftedBytes = () => {
    if (shiftedBytes.length) {
      output += decodeUtf8(shiftedBytes, eci);
      bytes.push(...shiftedBytes);
      shiftedBytes = [];
    }
  };
  const emit = (alphabet, value) => {
    if (value < 0 || value >= alphabet.length) throw new FormatError('PDF417 text: invalid submode value');
    output += alphabet[value];
  };
  const process = (value) => {
    if (shift) { emit(shift === 'alpha' ? ALPHA : PUNCT, value); shift = null; return; }
    if (mode === 'alpha') {
      if (value < 26) emit(ALPHA, value);
      else if (value === 26) output += ' ';
      else if (value === 27) mode = 'lower';
      else if (value === 28) mode = 'mixed';
      else if (value === 29) shift = 'punct';
    } else if (mode === 'lower') {
      if (value < 26) emit(LOWER, value);
      else if (value === 26) output += ' ';
      else if (value === 27) shift = 'alpha';
      else if (value === 28) mode = 'mixed';
      else if (value === 29) shift = 'punct';
    } else if (mode === 'mixed') {
      if (value < 25) emit(MIXED, value);
      else if (value === 25) mode = 'punct';
      else if (value === 26) output += ' ';
      else if (value === 27) mode = 'lower';
      else if (value === 28) mode = 'alpha';
      else if (value === 29) shift = 'punct';
    } else {
      if (value < 29) emit(PUNCT, value);
      else if (value === 29) mode = 'alpha';
    }
  };
  while (at < codewords.length) {
    const codeword = codewords[at];
    if (codeword >= 900 && codeword !== 913) break;
    at++;
    if (codeword === 913) {
      if (at >= codewords.length || codewords[at] > 255) throw new FormatError('PDF417 text: invalid byte shift');
      shiftedBytes.push(codewords[at++]);
      continue;
    }
    flushShiftedBytes();
    process(Math.floor(codeword / 30));
    process(codeword % 30);
  }
  flushShiftedBytes();
  return { at, text: output, bytes: Uint8Array.from(bytes) };
}

function decodeNumericSegment(codewords, at) {
  let output = '';
  while (at < codewords.length && codewords[at] < 900) {
    const end = Math.min(at + 15, codewords.length);
    let number = 0n;
    for (; at < end && codewords[at] < 900; at++) number = number * 900n + BigInt(codewords[at]);
    const decimal = number.toString();
    if (!decimal.startsWith('1')) throw new FormatError('PDF417 numeric: missing leading sentinel');
    output += decimal.slice(1);
  }
  return { at, text: output, bytes: new Uint8Array(0) };
}

/**
 * Decode PDF417 compaction while preserving raw Byte Compaction and byte-shift
 * payloads. Text and Numeric Compaction do not manufacture bytes: their text
 * is available on each segment, while `bytes` contains only octets carried by
 * modes that encode octets explicitly.
 */
export function decodePdf417CompactionDetailed(codewords) {
  if (!Array.isArray(codewords) && !ArrayBuffer.isView(codewords)) throw new FormatError('PDF417: codewords must be an array');
  for (const codeword of codewords) assertCodeword(codeword);
  let at = 0;
  // ISO/IEC 8859-1 is the PDF417 default; UTF-8 is selected explicitly with ECI 26.
  let eci = 3;
  let output = '';
  const bytes = [];
  const segments = [];
  while (at < codewords.length) {
    const codeword = codewords[at];
    if (codeword < 900 || codeword === 900 || codeword === 913) {
      const start = at;
      const latch = codeword === 900 ? codeword : null;
      if (latch !== null) at++;
      const segment = decodeTextSegment(codewords, at, eci);
      at = segment.at;
      output += segment.text;
      bytes.push(...segment.bytes);
      if (segment.text.length || segment.bytes.length) segments.push({ mode: 'text', text: segment.text, bytes: segment.bytes, eci, latch, codewordStart: start, codewordEnd: at });
      continue;
    }
    const start = at;
    at++;
    if (codeword === 901) {
      const segment = decodeByteSegment(codewords, at, eci);
      at = segment.at;
      output += segment.text;
      bytes.push(...segment.bytes);
      segments.push({ mode: 'byte', text: segment.text, bytes: segment.bytes, eci, latch: codeword, codewordStart: start, codewordEnd: at });
    } else if (codeword === 924) {
      const segment = decodeByteSegment(codewords, at, eci, true);
      at = segment.at;
      output += segment.text;
      bytes.push(...segment.bytes);
      segments.push({ mode: 'byte', text: segment.text, bytes: segment.bytes, eci, latch: codeword, codewordStart: start, codewordEnd: at });
    } else if (codeword === 902) {
      const segment = decodeNumericSegment(codewords, at);
      at = segment.at;
      output += segment.text;
      segments.push({ mode: 'numeric', text: segment.text, bytes: segment.bytes, eci, latch: codeword, codewordStart: start, codewordEnd: at });
    } else if (codeword === 927) {
      if (at >= codewords.length || codewords[at] > 899) throw new FormatError('PDF417 ECI: missing assignment number');
      eci = codewords[at++];
    } else {
      throw new FormatError(`PDF417: unsupported compaction codeword ${codeword}`);
    }
  }
  return { text: output, bytes: Uint8Array.from(bytes), segments };
}

/** Decode PDF417 Text, Byte, Numeric and UTF-8 ECI compaction segments in source order. */
export function decodePdf417Compaction(codewords) {
  return decodePdf417CompactionDetailed(codewords).text;
}
