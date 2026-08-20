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

import { BitMatrix } from '../core/bit-matrix.js';
import { BitWriter } from '../core/bit-buffer.js';
import { EncodeError } from '../core/errors.js';
import { GF256_QR } from '../core/galois-field.js';
import { rsEncode } from '../core/reed-solomon.js';
import {
  FORMAT_MASK_FINDER, FORMAT_MASK_SUB, dataBitCapacity, dataModuleOrder, formatBits,
  functionModules, maskBit, versionForSize, versionInfo,
} from './tables.js';

export const ALPHANUMERIC_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const MODE = Object.freeze({ TERMINATOR: 0, NUMERIC: 1, ALPHANUMERIC: 2, BYTE: 3, KANJI: 4, FNC1: 5, FNC1_SECOND: 6, ECI: 7 });

function utf8Bytes(text) { return new TextEncoder().encode(text); }
function latin1Bytes(text) { const out = new Uint8Array(text.length); for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); if (c > 255) throw new EncodeError('rMQR: text is not ISO-8859-1'); out[i] = c; } return out; }
function isAlpha(text) { for (const ch of text) if (ALPHANUMERIC_CHARS.indexOf(ch) < 0) return false; return true; }
function isNumeric(text) { return /^[0-9]*$/.test(text); }

let sjisMap;
function getSjisMap() {
  if (sjisMap !== undefined) return sjisMap;
  try {
    const decoder = new TextDecoder('shift_jis', { fatal: true });
    if (decoder.decode(new Uint8Array([0x82, 0xa0])) !== 'あ') return (sjisMap = null);
    const map = new Map(); const buf = new Uint8Array(2);
    for (const [lo, hi] of [[0x8140, 0x9ffc], [0xe040, 0xebbf]]) for (let sjis = lo; sjis <= hi; sjis++) {
      const trail = sjis & 255; if (trail < 0x40 || trail === 0x7f || trail > 0xfc) continue;
      buf[0] = sjis >> 8; buf[1] = trail; let text; try { text = decoder.decode(buf); } catch { continue; }
      if (Array.from(text).length === 1 && !map.has(text)) map.set(text, sjis);
    }
    return (sjisMap = map);
  } catch { return (sjisMap = null); }
}
function kanjiValue(ch) {
  const sjis = getSjisMap()?.get(ch); if (sjis === undefined) return -1;
  let v; if (sjis >= 0x8140 && sjis <= 0x9ffc) v = sjis - 0x8140; else if (sjis >= 0xe040 && sjis <= 0xebbf) v = sjis - 0xc140; else return -1;
  return ((v >> 8) * 0xc0) + (v & 0xff);
}

function chooseMode(text, requested) {
  if (requested === 'numeric' || requested === 'alphanumeric' || requested === 'byte' || requested === 'kanji') return requested;
  if (isNumeric(text)) return 'numeric';
  if (isAlpha(text)) return 'alphanumeric';
  return 'byte';
}

function modeBits(mode) { return MODE[mode.toUpperCase()] ?? MODE.BYTE; }
function charCount(mode, text, bytes) { return mode === 'byte' ? bytes.length : mode === 'kanji' ? Array.from(text).length : text.length; }
function payloadBits(mode, text, bytes) {
  if (mode === 'numeric') { let n = 0; for (let i = 0; i < text.length; i += 3) n += text.length - i >= 3 ? 10 : text.length - i === 2 ? 7 : 4; return n; }
  if (mode === 'alphanumeric') return Math.floor(text.length / 2) * 11 + (text.length & 1 ? 6 : 0);
  if (mode === 'kanji') return Array.from(text).length * 13;
  return bytes.length * 8;
}

function putEci(writer, assignment) {
  writer.put(MODE.ECI, 3);
  if (assignment <= 127) writer.put(assignment, 8);
  else if (assignment <= 16383) writer.put(0x8000 | assignment, 16);
  else if (assignment <= 999999) writer.put(0xc00000 | assignment, 24);
  else throw new EncodeError(`rMQR: invalid ECI assignment ${assignment}`);
}

function makeData(text, v, ecc, options) {
  const requested = options.mode;
  const mode = chooseMode(text, requested);
  const charset = options.charset || (mode === 'byte' && Array.from(text).every((ch) => ch.charCodeAt(0) <= 255) ? 'iso-8859-1' : 'utf-8');
  const bytes = mode === 'byte' ? (charset === 'iso-8859-1' ? latin1Bytes(text) : utf8Bytes(text)) : new Uint8Array();
  const countBits = v.countBits(mode);
  if (!countBits) throw new EncodeError(`rMQR: unsupported mode ${mode}`);
  const writer = new BitWriter();
  if (options.eci !== undefined) putEci(writer, options.eci);
  else if (mode === 'byte' && charset === 'utf-8') putEci(writer, 26);
  writer.put(modeBits(mode), 3); writer.put(charCount(mode, text, bytes), countBits); // header
  if (mode === 'numeric') for (let i = 0; i < text.length; i += 3) { const s = text.slice(i, i + 3); writer.put(Number(s), s.length === 3 ? 10 : s.length === 2 ? 7 : 4); }
  else if (mode === 'alphanumeric') for (let i = 0; i < text.length; i += 2) { const a = ALPHANUMERIC_CHARS.indexOf(text[i]); const b = i + 1 < text.length ? ALPHANUMERIC_CHARS.indexOf(text[i + 1]) : -1; if (a < 0 || (b < 0 && i + 1 < text.length)) throw new EncodeError('rMQR: invalid alphanumeric character'); writer.put(b < 0 ? a : a * 45 + b, b < 0 ? 6 : 11); }
  else if (mode === 'kanji') for (const ch of Array.from(text)) { const value = kanjiValue(ch); if (value < 0) throw new EncodeError(`rMQR: character ${ch} is not encodable in Kanji mode`); writer.put(value, 13); }
  else writer.putBytes(bytes);
  const capacity = dataBitCapacity(v.version, ecc);
  if (writer.length > capacity) throw new EncodeError(`rMQR: payload does not fit ${v.name}-${ecc}`);
  if (writer.length + 3 <= capacity) writer.put(0, 3);
  while (writer.length & 7) writer.putBit(false);
  const dataBytes = v.blockLayout(ecc).totalDataCodewords;
  let pad = 0xec; while (writer.toBytes().length < dataBytes) { writer.put(pad, 8); pad = pad === 0xec ? 0x11 : 0xec; }
  return writer.toBytes();
}

function interleave(data, v, ecc) {
  const layout = v.blockLayout(ecc); const blocks = []; let offset = 0;
  for (const b of layout.blocks) { const d = Array.from(data.slice(offset, offset + b.data)); offset += b.data; blocks.push({ data: d, ecc: rsEncode(d, b.ecc, GF256_QR, 0) }); }
  const out = []; const maxData = Math.max(...blocks.map((b) => b.data.length)); const maxEcc = Math.max(...blocks.map((b) => b.ecc.length));
  for (let i = 0; i < maxData; i++) for (const b of blocks) if (i < b.data.length) out.push(b.data[i]);
  for (let i = 0; i < maxEcc; i++) for (const b of blocks) if (i < b.ecc.length) out.push(b.ecc[i]);
  return Uint8Array.from(out);
}

function drawFunctions(m, version) {
  const v = versionInfo(version); const fn = functionModules(version); const { width: w, height: h } = v;
  const setIfData = (x, y, on) => { if (!fn.get(x, y)) m.setValue(x, y, on); };
  for (let x = 0; x < w; x++) { m.setValue(x, 0, (x & 1) === 0); m.setValue(x, h - 1, (x & 1) === 0); }
  for (const x of [0, w - 1, ...new Set([...(awaitableAlignment(version))])]) for (let y = 0; y < h; y++) setIfData(x, y, (y & 1) === 0);
  for (const cx of awaitableAlignment(version)) for (const y of [0, 1, h - 2, h - 1]) m.setValue(cx + (y === 0 || y === h - 1 ? 0 : 0), y, false);
  // Alignment patterns (top and bottom).
  for (const cx of awaitableAlignment(version)) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const on = i === 0 || i === 2 || j === 0 || j === 2; m.setValue(cx + j - 1, i, on); m.setValue(cx + j - 1, h - 1 - i, on); }
  // Finder and separator.
  for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) m.setValue(j, i, i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4));
  for (let n = 0; n < 8; n++) { if (n < h) m.setValue(7, n, false); if (h >= 9) m.setValue(n, 7, false); }
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) m.setValue(w - j - 1, h - i - 1, i === 0 || i === 4 || j === 0 || j === 4 || (i === 2 && j === 2));
  m.set(w - 1, 0); m.set(w - 2, 0); m.set(w - 1, 1); if (h >= 11) { m.set(0, h - 1); m.set(1, h - 1); m.set(2, h - 1); m.set(0, h - 2); }
}

// Kept as a local helper so drawFunctions stays independent of mutable tables.
function awaitableAlignment(version) { return ({ 27: [], 43: [21], 59: [19, 39], 77: [25, 51], 99: [23, 49, 75], 139: [27, 55, 83, 111] })[versionInfo(version).width] || []; }

function drawFormat(m, version, ecc) {
  const v = versionInfo(version); let bits = formatBits(version, ecc) ^ FORMAT_MASK_FINDER;
  for (let n = 0; n < 18; n++) m.setValue(8 + Math.floor(n / 5), 1 + (n % 5), ((bits >>> n) & 1) !== 0);
  bits = formatBits(version, ecc) ^ FORMAT_MASK_SUB;
  for (let n = 0; n < 15; n++) m.setValue(v.width - 8 + Math.floor(n / 5), v.height - 6 + (n % 5), ((bits >>> n) & 1) !== 0);
  for (let n = 15; n < 18; n++) m.setValue(v.width - 5 + (n - 15), v.height - 6, ((bits >>> n) & 1) !== 0);
}

function buildMatrix(version, ecc, codewords) {
  const v = versionInfo(version); const m = new BitMatrix(v.width, v.height); drawFunctions(m, version); drawFormat(m, version, ecc);
  const fn = functionModules(version); const order = dataModuleOrder(version); let bit = 0; for (const [x, y] of order) { let on = bit < codewords.length * 8 && ((codewords[bit >>> 3] >>> (7 - (bit & 7))) & 1) !== 0; if (maskBit(x, y)) on = !on; m.setValue(x, y, on); bit++; }
  return m;
}

/** Encode text into a rMQR module matrix. */
export function encodeRMQR(text, options = {}) {
  if (typeof text !== 'string' || text.length === 0) throw new EncodeError('rMQR: text must be a non-empty string');
  const ecc = options.ecc || 'M'; if (ecc !== 'M' && ecc !== 'H') throw new EncodeError('rMQR: ECC must be M or H');
  let forced = options.version; if (typeof forced === 'string') { const match = /^R(\d+)x(\d+)$/i.exec(forced); if (!match) throw new EncodeError(`rMQR: invalid version ${forced}`); const info = versionForSize(Number(match[2]), Number(match[1])); if (!info) throw new EncodeError(`rMQR: unsupported version ${forced}`); forced = info.version; }
  if (forced !== undefined && (!Number.isInteger(forced) || forced < 1 || forced > 32)) throw new EncodeError('rMQR: version must be 1-32');
  const versions = forced ? [forced] : Array.from({ length: 32 }, (_, i) => i + 1);
  let selected = null;
  for (const n of versions) { const v = versionInfo(n); try { const data = makeData(text, v, ecc, options); selected = { v, data }; break; } catch (error) { if (forced) throw error; } }
  if (!selected) throw new EncodeError(`rMQR: text is too long for ECC ${ecc}`);
  const codewords = interleave(selected.data, selected.v, ecc); const matrix = buildMatrix(selected.v.version, ecc, codewords); matrix.rmqr = { version: selected.v.version, name: selected.v.name, ecc }; return matrix;
}

export { MODE };
