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
 * Four-state postal barcode family.
 *
 * The writers below use the public bar-state descriptions of each format and
 * render an eight-module vertical profile. Keeping the state geometry in a
 * shared module makes the reader deliberately strict: a scan must contain the
 * expected start/stop markers, state sequence and checksum before it is
 * promoted to a result.
 *
 * @module oned/postal
 */

import { BitMatrix } from '../core/bit-matrix.js';
import { EncodeError } from '../core/errors.js';

export type PostalFormat = 'postnet' | 'planet' | 'rm4scc' | 'kix' | 'auspost' | 'japanpost' | 'imb';

export interface PostalOptions {
  checkDigit?: boolean;
  customerEncoding?: 'character' | 'numeric';
  custinfoenc?: 'character' | 'numeric';
  profile?: 'camera';
}

export interface PostalDecodeResult {
  format: PostalFormat;
  text: string;
  checkDigit: boolean;
}

/**
 * State geometry used by the postal family in matrix coordinates (Y grows
 * downwards). The one/ two state ordering follows the public postal glyph
 * tables and the orientation emitted by the black-box validation oracle.
 */
const STATE_PROFILES = [
  [3, 5], // tracker
  [3, 8], // lower extension
  [0, 5], // upper extension
  [0, 8], // full
] as const;

/** POSTNET and PLANET use half-height bars aligned to the lower edge. */
const POSTAL_HALF_TOP = [0, 4] as const;
const POSTAL_HALF_BOTTOM = [4, 8] as const;

/** Australia Post's physical state numbering is full/descender/ascender/tracker. */
const AUS_STATE_TO_SEMANTIC = [3, 2, 1, 0] as const;
const AUS_SEMANTIC_TO_STATE = [3, 2, 1, 0] as const;

const POSTNET_PATTERNS = ['55222', '22255', '22525', '22552', '25225', '25252', '25522', '52225', '52252', '52522'];
const PLANET_PATTERNS = ['22555', '55522', '55252', '55225', '52552', '52525', '52255', '25552', '25525', '25255'];
const RM_ALPHABET = 'ZUVWXY501234B6789AHCDEFGNIJKLMTOPQRS';
const RM_PATTERNS = [
  '3300', '2211', '2301', '2310', '3201', '3210', '1122', '0033', '0123', '0132',
  '1023', '1032', '1302', '0213', '0303', '0312', '1203', '1212', '1320', '0231',
  '0321', '0330', '1221', '1230', '3102', '2013', '2103', '2112', '3003', '3012',
  '3120', '2031', '2121', '2130', '3021', '3030',
];
const KIX_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const KIX_PATTERNS = [
  '0033', '0123', '0132', '1023', '1032', '1122', '0213', '0303', '0312', '1203',
  '1212', '1302', '0231', '0321', '0330', '1221', '1230', '1320', '2013', '2103',
  '2112', '3003', '3012', '3102', '2031', '2121', '2130', '3021', '3030', '3120',
  '2211', '2301', '2310', '3201', '3210', '3300',
];
const JAPAN_PATTERNS = [
  '300', '330', '312', '132', '321', '303', '123', '231', '213', '033', '030',
  '120', '102', '210', '012', '201', '021', '003', '333', '31', '13',
];
const JAPAN_ALPHABET = '0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const AUS_PATTERNS = [
  '000', '001', '002', '010', '011', '012', '020', '021', '022', '100', '101', '102',
  '110', '111', '112', '120', '121', '122', '200', '201', '202', '210', '211', '212',
  '220', '221', '222', '300', '301', '302', '310', '311', '312', '320', '321', '322',
  '023', '030', '031', '032', '033', '103', '113', '123', '130', '131', '132', '133',
  '203', '213', '223', '230', '231', '232', '233', '303', '313', '323', '330', '331',
  '332', '333', '003', '013', '00', '01', '02', '10', '11', '12', '20', '21', '22',
  '30', '13', '3',
];
const AUS_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz #';
const AUS_FCC_LENGTHS: Readonly<Record<string, number>> = {
  '11': 37, '45': 37, '59': 52, '62': 67, '87': 37, '92': 37,
};
const AUS_LENGTH_FCC: Readonly<Record<number, string[]>> = Object.entries(AUS_FCC_LENGTHS)
  .reduce((map, [fcc, length]) => {
    (map[length] ??= []).push(fcc);
    return map;
  }, {} as Record<number, string[]>);

const POSTAL_FORMATS: PostalFormat[] = ['postnet', 'planet', 'rm4scc', 'kix', 'auspost', 'japanpost', 'imb'];
const POSTAL_ALIASES: Readonly<Record<string, PostalFormat>> = {
  postnet: 'postnet', 'usps-postnet': 'postnet',
  planet: 'planet', 'usps-planet': 'planet',
  rm4scc: 'rm4scc', royalmail: 'rm4scc', 'royal-mail': 'rm4scc',
  kix: 'kix',
  auspost: 'auspost', 'australia-post': 'auspost', 'australiapost': 'auspost',
  japanpost: 'japanpost', 'japan-post': 'japanpost',
  imb: 'imb', onecode: 'imb', 'usps-onecode': 'imb',
};

function requireText(value: unknown, label: string): string {
  const text = String(value);
  if (text.length === 0) throw new EncodeError(`${label}: payload must not be empty`);
  return text;
}

function requireDigits(value: unknown, label: string): string {
  const text = requireText(value, label);
  if (!/^[0-9]+$/u.test(text)) throw new EncodeError(`${label}: payload must contain only digits`);
  return text;
}

function checkMod10(value: string): number {
  let sum = 0;
  for (const ch of value) sum += Number(ch);
  return (10 - (sum % 10)) % 10;
}

function appendOrValidateCheck(value: unknown, lengths: readonly number[], label: string, options: PostalOptions): { body: string; check: number } {
  const text = requireDigits(value, label);
  if (lengths.includes(text.length)) {
    const check = checkMod10(text);
    return { body: text, check };
  }
  if (options.checkDigit === true && lengths.some((length) => text.length === length + 1)) {
    const body = text.slice(0, -1);
    const expected = checkMod10(body);
    if (Number(text[text.length - 1]) !== expected) {
      throw new EncodeError(`${label}: invalid check digit, expected ${expected}`);
    }
    return { body, check: expected };
  }
  throw new EncodeError(`${label}: payload must be ${lengths.join(', ')} digits, excluding the check digit`);
}

/** Convert semantic states into an 8-module-tall matrix with one light module between bars. */
function statesToMatrix(states: readonly number[], australia = false, halfHeight = false): BitMatrix {
  if (states.length < 1 || states.length > 5000) throw new EncodeError('Postal symbol is too large');
  const matrix = new BitMatrix(states.length * 2 - 1, 8);
  for (let i = 0; i < states.length; i++) {
    if (halfHeight && states[i] !== 0 && states[i] !== 3) {
      throw new EncodeError('Postal five-state symbol contains an invalid bar state');
    }
    if (halfHeight) {
      const profile = states[i] === 3 ? STATE_PROFILES[3] : POSTAL_HALF_BOTTOM;
      const x = i * 2;
      for (let y = profile[0]; y < profile[1]; y++) matrix.set(x, y);
      continue;
    }
    const state = australia ? AUS_STATE_TO_SEMANTIC[states[i]] : states[i];
    const profile = STATE_PROFILES[state];
    if (!profile) throw new EncodeError('Postal state is outside the four-state range');
    const x = i * 2;
    for (let y = profile[0]; y < profile[1]; y++) matrix.set(x, y);
  }
  return matrix;
}

function fiveStatePattern(pattern: string): number[] {
  return [...pattern].map((ch) => ch === '5' ? 3 : 0);
}

function fourStatePattern(pattern: string): number[] {
  return [...pattern].map(Number);
}

/** Encode USPS POSTNET. Accepts 5, 9 or 11 body digits and appends Mod-10. */
export function encodePostnet(value: string, options: PostalOptions = {}): BitMatrix {
  const { body, check } = appendOrValidateCheck(value, [5, 9, 11], 'POSTNET', options);
  const states = [3, ...[...body].flatMap((ch) => fiveStatePattern(POSTNET_PATTERNS[Number(ch)])), ...fiveStatePattern(POSTNET_PATTERNS[check]), 3];
  return statesToMatrix(states, false, true);
}

/** Encode USPS PLANET. Accepts 11 or 13 body digits and appends Mod-10. */
export function encodePlanet(value: string, options: PostalOptions = {}): BitMatrix {
  const { body, check } = appendOrValidateCheck(value, [11, 13], 'PLANET', options);
  const states = [3, ...[...body].flatMap((ch) => fiveStatePattern(PLANET_PATTERNS[Number(ch)])), ...fiveStatePattern(PLANET_PATTERNS[check]), 3];
  return statesToMatrix(states, false, true);
}

function rmCheckDigit(body: string): string {
  let row = 0;
  let column = 0;
  for (const ch of body) {
    const index = RM_ALPHABET.indexOf(ch);
    if (index < 0) throw new EncodeError('RM4SCC: payload must contain capital letters and digits');
    row += Math.floor(index / 6);
    column += index % 6;
  }
  return RM_ALPHABET[(row % 6) * 6 + (column % 6)];
}

/** Encode Royal Mail 4-State Customer Code (RM4SCC). */
export function encodeRM4SCC(value: string, options: PostalOptions = {}): BitMatrix {
  let text = requireText(value, 'RM4SCC');
  if (text.length > 500) throw new EncodeError('RM4SCC: payload is limited to 500 characters');
  if (options.checkDigit === true) {
    if (text.length < 2) throw new EncodeError('RM4SCC: a checked payload needs a body and check character');
    const supplied = text.slice(-1);
    text = text.slice(0, -1);
    if (rmCheckDigit(text) !== supplied) throw new EncodeError(`RM4SCC: invalid check character, expected ${rmCheckDigit(text)}`);
  }
  const check = rmCheckDigit(text);
  const states = [2];
  for (const ch of text) {
    const index = RM_ALPHABET.indexOf(ch);
    if (index < 0) throw new EncodeError('RM4SCC: payload must contain capital letters and digits');
    states.push(...fourStatePattern(RM_PATTERNS[index]));
  }
  states.push(...fourStatePattern(RM_PATTERNS[RM_ALPHABET.indexOf(check)]), 3);
  return statesToMatrix(states);
}

/** Encode KIX (the Dutch postal four-state alphabet). */
export function encodeKIX(value: string): BitMatrix {
  const text = requireText(value, 'KIX').toUpperCase();
  if (text.length > 500) throw new EncodeError('KIX: payload is limited to 500 characters');
  const states: number[] = [];
  for (const ch of text) {
    const index = KIX_ALPHABET.indexOf(ch);
    if (index < 0) throw new EncodeError('KIX: payload must contain capital letters and digits');
    states.push(...fourStatePattern(KIX_PATTERNS[index]));
  }
  return statesToMatrix(states);
}

function japanDataValues(value: string): number[] {
  const text = requireText(value, 'Japan Post').toUpperCase();
  const values: number[] = [];
  for (const ch of text) {
    const index = JAPAN_ALPHABET.indexOf(ch);
    if (index < 0) throw new EncodeError('Japan Post: payload must contain digits, capital letters and dash');
    if (index <= 10) values.push(index);
    else {
      values.push(Math.floor((index - 1) / 10) + 10, (index - 1) % 10);
    }
  }
  if (values.length > 20) throw new EncodeError('Japan Post: payload expands to more than 20 data groups');
  return values;
}

/** Encode Japan Post. The check and padding groups are generated automatically. */
export function encodeJapanPost(value: string): BitMatrix {
  const values = japanDataValues(value);
  let checksum = 0;
  const data = [...values];
  while (data.length < 20) data.push(14);
  for (const item of data) checksum += item;
  const check = 19 - (checksum % 19);
  const states = [...fourStatePattern('31')];
  for (const item of data) states.push(...fourStatePattern(JAPAN_PATTERNS[item]));
  states.push(...fourStatePattern(JAPAN_PATTERNS[check]), ...fourStatePattern('13'));
  return statesToMatrix(states);
}

function gf64Multiply(a: number, b: number): number {
  let result = 0;
  let left = a & 63;
  let right = b & 63;
  while (right !== 0) {
    if (right & 1) result ^= left;
    left <<= 1;
    if (left & 64) left ^= 0x43;
    right >>>= 1;
  }
  return result & 63;
}

function gf64Alpha(power: number): number {
  let value = 1;
  for (let i = 0; i < power; i++) value = gf64Multiply(value, 2);
  return value;
}

function gf64Generator(): number[] {
  let polynomial = [1];
  for (let rootIndex = 1; rootIndex <= 4; rootIndex++) {
    const root = gf64Alpha(rootIndex);
    const next = new Array(polynomial.length + 1).fill(0);
    for (let i = 0; i < polynomial.length; i++) {
      next[i] ^= gf64Multiply(polynomial[i], root);
      next[i + 1] ^= polynomial[i];
    }
    polynomial = next;
  }
  return polynomial;
}

const AUS_RS_GENERATOR = gf64Generator();

function australiaCodeword(states: readonly number[], offset: number): number {
  return (states[offset] * 16) + (states[offset + 1] * 4) + states[offset + 2];
}

function australiaParity(data: readonly number[]): number[] {
  const dataCount = data.length;
  const codewords = new Array(dataCount + 4).fill(0);
  for (let i = 0; i < dataCount; i++) codewords[dataCount + 3 - i] = data[i];
  for (let offset = dataCount - 1; offset >= 0; offset--) {
    const factor = codewords[offset + 4];
    for (let coefficient = 0; coefficient < 5; coefficient++) {
      codewords[offset + coefficient] ^= gf64Multiply(factor, AUS_RS_GENERATOR[coefficient]);
    }
  }
  return codewords;
}

function australiaSymbolLength(fcc: string): number {
  const length = AUS_FCC_LENGTHS[fcc];
  if (!length) throw new EncodeError('Australia Post: FCC must be 11, 45, 59, 62, 87 or 92');
  return length;
}

/** Encode Australia Post 4-state symbols, including FCC/DPID and optional customer data. */
export function encodeAustraliaPost(value: string, options: PostalOptions = {}): BitMatrix {
  const text = requireText(value, 'Australia Post');
  if (text.length < 10) throw new EncodeError('Australia Post: payload must contain an FCC and eight-digit DPID');
  const fcc = text.slice(0, 2);
  const length = australiaSymbolLength(fcc);
  if (!/^\d{8}$/u.test(text.slice(2, 10))) throw new EncodeError('Australia Post: DPID must be eight digits');
  const encoding = options.customerEncoding ?? options.custinfoenc ?? 'character';
  if (encoding !== 'character' && encoding !== 'numeric') throw new EncodeError('Australia Post: customerEncoding must be character or numeric');
  const customer = text.slice(10);
  const customerStates: number[] = [];
  if (encoding === 'numeric') {
    if (!/^\d*$/u.test(customer)) throw new EncodeError('Australia Post: numeric customer data must contain digits');
    for (const ch of customer) customerStates.push(...[...AUS_PATTERNS[64 + Number(ch)]].map(Number));
  } else {
    for (const ch of customer) {
      const index = AUS_ALPHABET.indexOf(ch);
      if (index < 0) throw new EncodeError('Australia Post: customer data contains an unsupported character');
      customerStates.push(...[...AUS_PATTERNS[index]].map(Number));
    }
  }
  const dataStateLength = length - 16;
  if (customerStates.length > dataStateLength - 20) throw new EncodeError('Australia Post: customer data does not fit the FCC symbol');
  const states: number[] = [1, 3];
  // Australia Post encodes the two FCC digits and the eight DPID digits as
  // ten two-state digit pairs. The FCC therefore participates in the symbol
  // geometry as well as selecting the symbol length.
  for (const ch of text.slice(0, 10)) states.push(...[...AUS_PATTERNS[64 + Number(ch)]].map(Number));
  states.push(...customerStates);
  while (states.length < dataStateLength + 2) states.push(3);

  const dataWords: number[] = [];
  for (let offset = 2; offset <= length - 16; offset += 3) dataWords.push(australiaCodeword(states, offset));
  const codewords = australiaParity(dataWords);
  const checkStates: number[] = [];
  for (let i = 0; i < 4; i++) checkStates.push(...codewords[3 - i].toString(4).padStart(3, '0').split('').map(Number));
  states.push(...checkStates, 1, 3);
  if (states.length !== length) throw new EncodeError('Australia Post: internal symbol geometry mismatch');
  return statesToMatrix(states, true);
}

function reverse13(mask: number): number {
  let value = 0;
  for (let i = 0; i < 13; i++) value = (value << 1) | ((mask >>> i) & 1);
  return value;
}

function popcount(mask: number): number {
  let count = 0;
  for (let value = mask; value !== 0; value >>>= 1) count += value & 1;
  return count;
}

/** Generate the USPS OneCode combinatorial table in its normative order. */
function combinationTable(weight: number): number[] {
  const values: number[] = [];
  const palindromes: number[] = [];
  for (let mask = 0; mask < 8192; mask++) {
    if (popcount(mask) !== weight) continue;
    const reversed = reverse13(mask);
    if (mask < reversed) values.push(mask, reversed);
    else if (mask === reversed) palindromes.push(mask);
  }
  palindromes.sort((a, b) => b - a);
  values.push(...palindromes);
  return values;
}

const IMB_TAB513 = combinationTable(5);
const IMB_TAB213 = combinationTable(2);
const IMB_TAB513_INDEX = new Map(IMB_TAB513.map((mask, index) => [mask, index]));
const IMB_TAB213_INDEX = new Map(IMB_TAB213.map((mask, index) => [mask, index + 1287]));

// USPS OneCode's 65-bar placement order. It is a public normative placement
// mapping represented as an independent Sythos array; no implementation code
// is copied from an external encoder.
const IMB_BAR_MAP = [
  7, 2, 4, 3, 1, 10, 0, 0, 9, 12, 2, 8, 5, 5, 6, 11, 8, 9, 3, 1,
  0, 1, 5, 12, 2, 5, 1, 8, 4, 4, 9, 11, 6, 3, 8, 10, 3, 9, 7, 6,
  5, 11, 1, 4, 8, 5, 2, 12, 9, 10, 0, 2, 7, 1, 6, 7, 3, 6, 4, 9,
  0, 3, 8, 6, 6, 4, 2, 7, 1, 1, 9, 9, 7, 10, 5, 2, 4, 0, 3, 8,
  6, 2, 0, 4, 8, 11, 1, 0, 9, 8, 3, 12, 2, 6, 7, 7, 5, 1, 4, 10,
  1, 12, 6, 9, 7, 3, 8, 0, 5, 8, 9, 7, 4, 6, 2, 10, 3, 4, 0, 5,
  8, 4, 5, 7, 7, 11, 1, 9, 6, 0, 9, 6, 0, 6, 4, 8, 2, 1, 3, 2,
  5, 9, 8, 12, 4, 11, 6, 1, 9, 5, 7, 4, 3, 3, 1, 2, 0, 7, 2, 0,
  1, 3, 4, 1, 6, 10, 3, 5, 8, 7, 9, 4, 2, 11, 5, 6, 0, 8, 7, 12,
  4, 2, 8, 1, 5, 10, 3, 0, 9, 3, 0, 9, 6, 5, 2, 4, 7, 8, 1, 7,
  5, 0, 4, 5, 2, 3, 0, 10, 6, 12, 9, 2, 3, 11, 1, 6, 8, 8, 7, 9,
  5, 4, 0, 11, 1, 5, 2, 2, 9, 1, 4, 12, 8, 3, 6, 6, 7, 0, 3, 7,
  4, 7, 7, 5, 0, 12, 1, 11, 2, 9, 9, 0, 6, 8, 5, 3, 3, 10, 8, 2,
];

function bigIntBytes(value: bigint): number[] {
  const bytes = new Array(13).fill(0);
  let remaining = value;
  for (let i = 12; i >= 0; i--) {
    bytes[i] = Number(remaining & 255n);
    remaining >>= 8n;
  }
  if (remaining !== 0n) throw new EncodeError('USPS IMb: payload exceeds the 13-byte binary envelope');
  return bytes;
}

function imbBinaryValue(text: string): bigint {
  const length = text.length;
  const start = length === 20 ? 0n : length === 25 ? 1n : length === 29 ? 100001n : 1000010001n;
  const suffix = BigInt(text.slice(20) || '0');
  let value = (start + suffix) * 10n + BigInt(text.charCodeAt(0) - 48);
  value = value * 5n + BigInt(text.charCodeAt(1) - 48);
  for (let i = 2; i < 20; i++) value = value * 10n + BigInt(text.charCodeAt(i) - 48);
  return value;
}

function imbFcs(bytes: readonly number[]): number {
  let fcs = 2047;
  let data = bytes[0] << 5;
  for (let i = 0; i < 6; i++) {
    fcs = ((fcs << 1) ^ (((fcs ^ data) & 1024) !== 0 ? 3893 : 0)) & 2047;
    data <<= 1;
  }
  for (let index = 1; index <= 12; index++) {
    data = bytes[index] << 3;
    for (let i = 0; i < 8; i++) {
      fcs = ((fcs << 1) ^ (((fcs ^ data) & 1024) !== 0 ? 3893 : 0)) & 2047;
      data <<= 1;
    }
  }
  return fcs;
}

/** Encode USPS Intelligent Mail Barcode (OneCode), for all four legal lengths. */
export function encodeIMB(value: string): BitMatrix {
  const text = requireDigits(value, 'USPS IMb');
  if (![20, 25, 29, 31].includes(text.length)) throw new EncodeError('USPS IMb: payload must be 20, 25, 29 or 31 digits');
  let binary = imbBinaryValue(text);
  const bytes = bigIntBytes(binary);
  const fcs = imbFcs(bytes);
  const codewords = new Array(10).fill(0);
  for (let index = 9; index >= 0; index--) {
    const base = index === 9 ? 636n : 1365n;
    codewords[index] = Number(binary % base);
    binary /= base;
  }
  codewords[9] *= 2;
  if ((fcs & 1024) !== 0) codewords[0] += 659;
  const chars = codewords.map((word) => {
    const character = word <= 1286 ? IMB_TAB513[word] : IMB_TAB213[word - 1287];
    if (character === undefined) throw new EncodeError('USPS IMb: codeword is outside the OneCode character tables');
    return character;
  });
  for (let index = 9; index >= 0; index--) if ((fcs & (1 << index)) !== 0) chars[index] ^= 8191;
  const states = new Array<number>(65);
  // The bar map maps pairs of bits to each physical bar. Each pair is decoded
  // independently so the emitted 65-state sequence is explicit and auditable.
  for (let index = 0; index < 65; index++) {
    const dec = (chars[IMB_BAR_MAP[index * 4]] & (1 << IMB_BAR_MAP[index * 4 + 1])) !== 0;
    const asc = (chars[IMB_BAR_MAP[index * 4 + 2]] & (1 << IMB_BAR_MAP[index * 4 + 3])) !== 0;
    // Physical state 1 is the top extension (the `dec` bit), while state 2
    // is the bottom extension (the `asc` bit) in matrix coordinates.
    states[index] = (dec ? 1 : 0) | (asc ? 2 : 0);
  }
  return statesToMatrix(states);
}

function patternKey(states: readonly number[], offset: number, length: number): string {
  return states.slice(offset, offset + length).join('');
}

function decodePostnetStates(states: readonly number[]): PostalDecodeResult | null {
  const bodyLength = (states.length - 7) / 5;
  if (![5, 9, 11].includes(bodyLength) || states[0] !== 3 || states[states.length - 1] !== 3) return null;
  const body: string[] = [];
  for (let i = 0; i < bodyLength; i++) {
    const key = states.slice(1 + i * 5, 6 + i * 5).map((state) => state === 3 ? '5' : state === 0 || state === 4 || state === 5 ? '2' : '?').join('');
    const digit = POSTNET_PATTERNS.indexOf(key);
    if (digit < 0) return null;
    body.push(String(digit));
  }
  const checkKey = states.slice(1 + bodyLength * 5, 6 + bodyLength * 5).map((state) => state === 3 ? '5' : state === 0 || state === 4 || state === 5 ? '2' : '?').join('');
  const check = POSTNET_PATTERNS.indexOf(checkKey);
  if (check < 0 || check !== checkMod10(body.join(''))) return null;
  return { format: 'postnet', text: body.join(''), checkDigit: true };
}

function decodePlanetStates(states: readonly number[]): PostalDecodeResult | null {
  const bodyLength = (states.length - 7) / 5;
  if (![11, 13].includes(bodyLength) || states[0] !== 3 || states[states.length - 1] !== 3) return null;
  const body: string[] = [];
  const toKey = (offset: number) => states.slice(offset, offset + 5).map((state) => state === 3 ? '5' : state === 0 || state === 4 || state === 5 ? '2' : '?').join('');
  for (let i = 0; i < bodyLength; i++) {
    const digit = PLANET_PATTERNS.indexOf(toKey(1 + i * 5));
    if (digit < 0) return null;
    body.push(String(digit));
  }
  const check = PLANET_PATTERNS.indexOf(toKey(1 + bodyLength * 5));
  if (check < 0 || check !== checkMod10(body.join(''))) return null;
  return { format: 'planet', text: body.join(''), checkDigit: true };
}

function decodeRMStates(states: readonly number[]): PostalDecodeResult | null {
  if (states.length < 10 || states[0] !== 2 || states[states.length - 1] !== 3 || (states.length - 6) % 4 !== 0) return null;
  const bodyLength = (states.length - 6) / 4;
  if (bodyLength < 1 || bodyLength > 500) return null;
  const body: string[] = [];
  for (let i = 0; i < bodyLength; i++) {
    const index = RM_PATTERNS.indexOf(patternKey(states, 1 + i * 4, 4));
    if (index < 0) return null;
    body.push(RM_ALPHABET[index]);
  }
  const checkIndex = RM_PATTERNS.indexOf(patternKey(states, 1 + bodyLength * 4, 4));
  if (checkIndex < 0 || RM_ALPHABET[checkIndex] !== rmCheckDigit(body.join(''))) return null;
  return { format: 'rm4scc', text: body.join(''), checkDigit: true };
}

function decodeKIXStates(states: readonly number[]): PostalDecodeResult | null {
  if (states.length < 4 || states.length % 4 !== 0 || states.length > 2000) return null;
  const text: string[] = [];
  for (let i = 0; i < states.length; i += 4) {
    const index = KIX_PATTERNS.indexOf(patternKey(states, i, 4));
    if (index < 0) return null;
    text.push(KIX_ALPHABET[index]);
  }
  return { format: 'kix', text: text.join(''), checkDigit: false };
}

function decodeJapanStates(states: readonly number[]): PostalDecodeResult | null {
  if (states.length !== 67 || patternKey(states, 0, 2) !== '31' || patternKey(states, 65, 2) !== '13') return null;
  const values: number[] = [];
  for (let i = 0; i < 20; i++) {
    const value = JAPAN_PATTERNS.indexOf(patternKey(states, 2 + i * 3, 3));
    if (value < 0 || value > 20) return null;
    values.push(value);
  }
  const check = JAPAN_PATTERNS.indexOf(patternKey(states, 62, 3));
  if (check < 1 || check > 19) return null;
  let sum = 0;
  for (const value of values) sum += value;
  if (19 - (sum % 19) !== check) return null;
  const text: string[] = [];
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (value === 14) {
      if (values.slice(i).some((item) => item !== 14)) return null;
      break;
    }
    if (value >= 11 && value <= 13) {
      const digit = values[++i];
      if (digit > 9) return null;
      const index = (value - 10) * 10 + digit + 1;
      if (!JAPAN_ALPHABET[index]) return null;
      text.push(JAPAN_ALPHABET[index]);
    } else if (value >= 0 && value <= 10) {
      text.push(JAPAN_ALPHABET[value]);
    } else return null;
  }
  return { format: 'japanpost', text: text.join(''), checkDigit: true };
}

function decodeAustraliaStates(states: readonly number[], options: PostalOptions): PostalDecodeResult | null {
  if (states.length < 37 || !AUS_LENGTH_FCC[states.length] || patternKey(states, 0, 2) !== '20' || patternKey(states, states.length - 2, 2) !== '20') return null;
  const codes = states.map((state) => AUS_SEMANTIC_TO_STATE[state]);
  const headerDigits: string[] = [];
  for (let i = 0; i < 10; i++) {
    const index = AUS_PATTERNS.indexOf(patternKey(codes, 2 + i * 2, 2));
    if (index < 64 || index > 73) return null;
    headerDigits.push(String(index - 64));
  }
  const fccCandidates = AUS_LENGTH_FCC[states.length];
  const matchingFCC = fccCandidates.filter((fcc) => fcc === headerDigits.slice(0, 2).join(''));
  if (matchingFCC.length === 0) return null;
  const dataWords: number[] = [];
  for (let offset = 2; offset <= states.length - 16; offset += 3) dataWords.push(australiaCodeword(codes, offset));
  const expected = australiaParity(dataWords);
  const checkWords: number[] = [];
  for (let i = 0; i < 4; i++) {
    const value = Number.parseInt(patternKey(codes, states.length - 14 + i * 3, 3), 4);
    if (!Number.isInteger(value) || value > 63) return null;
    checkWords.push(value);
  }
  if (checkWords[0] !== expected[3] || checkWords[1] !== expected[2] || checkWords[2] !== expected[1] || checkWords[3] !== expected[0]) return null;
  const customerEnd = states.length - 14;
  const customerStates = codes.slice(22, customerEnd);
  const requestedEncoding = options.customerEncoding ?? options.custinfoenc;
  const encodings = requestedEncoding
    ? [requestedEncoding]
    : ['character', 'numeric'];
  for (const encoding of encodings) {
    const customer: string[] = [];
    let offset = 0;
    let valid = true;
    while (offset < customerStates.length) {
      if (customerStates.slice(offset).every((state) => state === 3)) break;
      const width = encoding === 'numeric' ? 2 : 3;
      if (offset + width > customerStates.length) { valid = false; break; }
      const pattern = customerStates.slice(offset, offset + width).join('');
      const index = AUS_PATTERNS.indexOf(pattern);
      if (encoding === 'numeric') {
        if (index < 64 || index > 73) { valid = false; break; }
        customer.push(String(index - 64));
      } else {
        if (index < 0 || index > 63) { valid = false; break; }
        customer.push(AUS_ALPHABET[index]);
      }
      offset += width;
    }
    if (valid) return { format: 'auspost', text: `${matchingFCC[0]}${headerDigits.slice(2).join('')}${customer.join('')}`, checkDigit: true };
  }
  return null;
}

function decodeIMBStates(states: readonly number[]): PostalDecodeResult | null {
  if (states.length !== 65) return null;
  const chars = new Array(10).fill(0);
  for (let index = 0; index < 65; index++) {
    const dec = (states[index] & 1) !== 0;
    const asc = (states[index] & 2) !== 0;
    const bit0 = 1 << IMB_BAR_MAP[index * 4 + 1];
    const bit1 = 1 << IMB_BAR_MAP[index * 4 + 3];
    const char0 = IMB_BAR_MAP[index * 4];
    const char1 = IMB_BAR_MAP[index * 4 + 2];
    if (dec) chars[char0] |= bit0;
    if (asc) chars[char1] |= bit1;
  }
  for (let fcs = 0; fcs < 2048; fcs++) {
    const decodedChars = chars.map((character, index) => (fcs & (1 << index)) !== 0 ? character ^ 8191 : character);
    const codewords = decodedChars.map((character) => IMB_TAB513_INDEX.get(character) ?? IMB_TAB213_INDEX.get(character) ?? -1);
    if (codewords.some((word) => word < 0)) continue;
    if ((fcs & 1024) !== 0) {
      codewords[0] -= 659;
      if (codewords[0] < 0) continue;
    }
    if ((codewords[9] & 1) !== 0) continue;
    codewords[9] /= 2;
    let binary = 0n;
    for (let i = 0; i < 9; i++) binary = binary * 1365n + BigInt(codewords[i]);
    binary = binary * 636n + BigInt(codewords[9]);
    let bytes: number[];
    try {
      bytes = bigIntBytes(binary);
    } catch {
      continue;
    }
    if (imbFcs(bytes) !== fcs) continue;
    const tail = (binary % 1000000000000000000n).toString().padStart(18, '0');
    const prefix = binary / 1000000000000000000n;
    const second = Number(prefix % 5n);
    const quotient = prefix / 5n;
    const first = Number(quotient % 10n);
    const intermediate = quotient / 10n;
    for (const length of [20, 25, 29, 31]) {
      const start = length === 20 ? 0n : length === 25 ? 1n : length === 29 ? 100001n : 1000010001n;
      const suffixValue = intermediate - start;
      if (suffixValue < 0n) continue;
      const suffixLength = length - 20;
      const suffix = suffixLength === 0 ? '' : suffixValue.toString().padStart(suffixLength, '0');
      if (suffix.length !== length - 20) continue;
      const text = `${first}${second}${tail}${suffix}`;
      if (text.length !== length) continue;
      try {
        if (imbFcs(bigIntBytes(imbBinaryValue(text))) !== fcs) continue;
      } catch {
        continue;
      }
      return { format: 'imb', text, checkDigit: true };
    }
  }
  return null;
}

interface PostalBars { states: number[]; unit: number; bounds: { x: number; y: number; width: number; height: number }; }

/** Extract bars and four-state profiles from a binarized raster. */
function classifyBars(image: BitMatrix): PostalBars | null {
  if (image.width < 3 || image.height < 4 || image.width > 20000 || image.height > 20000) return null;
  const projection: number[] = [];
  for (let x = 0; x < image.width; x++) {
    let dark = false;
    for (let y = 0; y < image.height; y++) if (image.get(x, y)) { dark = true; break; }
    if (dark) projection.push(x);
  }
  if (projection.length === 0) return null;
  const runs: Array<{ start: number; end: number }> = [];
  let start = projection[0];
  let previous = start;
  for (let i = 1; i < projection.length; i++) {
    const x = projection[i];
    if (x !== previous + 1) { runs.push({ start, end: previous + 1 }); start = x; }
    previous = x;
  }
  runs.push({ start, end: previous + 1 });
  if (runs.length < 5) return null;
  const widths = runs.map((run) => run.end - run.start).sort((a, b) => a - b);
  const unit = widths[widths.length >> 1];
  if (!Number.isFinite(unit) || unit <= 0) return null;
  const barBounds: Array<{ top: number; bottom: number }> = [];
  let minY = image.height;
  let maxY = 0;
  for (const run of runs) {
    let top = image.height;
    let bottom = 0;
    for (let x = run.start; x < run.end; x++) {
      for (let y = 0; y < image.height; y++) {
        if (!image.get(x, y)) continue;
        if (y < top) top = y;
        if (y + 1 > bottom) bottom = y + 1;
      }
    }
    if (top === image.height) return null;
    minY = Math.min(minY, top); maxY = Math.max(maxY, bottom);
    barBounds.push({ top, bottom });
  }
  if (maxY <= minY) return null;
  // Renderers are free to choose a horizontal module width and a different
  // vertical bar height (BWIPP, for example, uses a 1.75:1 ratio). Infer the
  // vertical module from the observed symbol extent instead of reusing the
  // horizontal run width, otherwise a full-height bar can look like a
  // tracker in a compact postal raster.
  const centre = (minY + maxY) / 2;
  const verticalUnit = (maxY - minY) / 8;
  const states: number[] = [];
  const profiles = [...STATE_PROFILES, POSTAL_HALF_TOP, POSTAL_HALF_BOTTOM];
  for (const { top, bottom } of barBounds) {
    let best = -1;
    let bestScore = Infinity;
    for (let state = 0; state < profiles.length; state++) {
      const profile = profiles[state];
      const expectedTop = centre + (profile[0] - 4) * verticalUnit;
      const expectedBottom = centre + (profile[1] - 4) * verticalUnit;
      const score = Math.abs(top - expectedTop) + Math.abs(bottom - expectedBottom);
      if (score < bestScore) { bestScore = score; best = state; }
    }
    if (best < 0 || bestScore > Math.max(verticalUnit * 2.4, 1.5)) return null;
    states.push(best);
  }
  return { states, unit, bounds: { x: runs[0].start, y: minY, width: runs[runs.length - 1].end - runs[0].start, height: maxY - minY } };
}

function canonicalFormat(value: string): PostalFormat | null {
  return POSTAL_ALIASES[String(value).toLowerCase()] ?? null;
}

/** Decode a postal raster, returning only structurally complete symbols. */
export function decodePostal(image: BitMatrix, options: PostalOptions & { formats?: string[] } = {}): PostalDecodeResult[] {
  const bars = classifyBars(image);
  if (!bars) return [];
  const requested = options.formats?.map(canonicalFormat).filter((format): format is PostalFormat => format !== null);
  const formats = options.formats ? [...new Set(requested)] : POSTAL_FORMATS;
  if (options.profile === 'camera') {
    const leftQuiet = bars.bounds.x >= bars.unit * 2;
    const rightQuiet = image.width - (bars.bounds.x + bars.bounds.width) >= bars.unit * 2;
    if (!leftQuiet || !rightQuiet) return [];
  }
  const candidates: PostalDecodeResult[] = [];
  const orientations = [bars.states, [...bars.states].reverse()];
  for (const states of orientations) {
    for (const format of formats) {
      let result: PostalDecodeResult | null = null;
      if (format === 'postnet') result = decodePostnetStates(states);
      else if (format === 'planet') result = decodePlanetStates(states);
      else if (format === 'rm4scc') result = decodeRMStates(states);
      else if (format === 'kix') result = decodeKIXStates(states);
      else if (format === 'auspost') result = decodeAustraliaStates(states, options);
      else if (format === 'japanpost') result = decodeJapanStates(states);
      else if (format === 'imb') result = decodeIMBStates(states);
      if (result && !candidates.some((item) => item.format === result?.format && item.text === result?.text)) candidates.push(result);
    }
    // KIX and IMb have no directional guard. Once the native orientation has
    // produced a validated result, the reversed pass would only add a second
    // spelling of the same physical symbol.
    if (candidates.length > 0) break;
  }
  return candidates;
}

export { POSTAL_FORMATS, POSTAL_ALIASES, STATE_PROFILES };
