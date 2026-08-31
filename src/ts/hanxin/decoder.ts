/*!
 * Sythos Barcode Suite
 *
 * MIT License
 *
 * Copyright (c) 2026 Sythos
 * SPDX-FileCopyrightText: 2026 Sythos (https://www.sythos.net)
 * SPDX-License-Identifier: MIT
 *
 * Original work. No code from any other barcode implementation.
 */

/**
 * Strict Han Xin Code decoder for the alignment-free versions 1-3.
 *
 * The reader treats the matrix as untrusted input.  It first validates the
 * fixed corner patterns and both structural-information copies, then checks
 * Reed--Solomon parity and finally parses a complete payload.  A partially
 * readable stream is never returned as a successful result.
 *
 * @module hanxin/decoder
 */

import { BitMatrix } from '../core/bit-matrix.js';
import { BitReader } from '../core/bit-buffer.js';
import { FormatError } from '../core/errors.js';
import { rsDecode } from '../core/reed-solomon.js';
import { GF256_HANXIN } from './tables.js';
import {
  HANXIN_ECC_LEVELS,
  HanXinEccLevel,
  HanXinVersion,
  HANXIN_DATA_MODULES,
  HANXIN_TOTAL_CODEWORDS,
  createHanXinFunctionGrid,
  decodeHanXinFunctionInfo,
  hanXinDataCoordinates,
  hanXinEcLayout,
  hanXinMaskFlip,
  hanXinSize,
} from './tables.js';

export type HanXinRotation = 0 | 90 | 180 | 270;

export interface HanXinDecodeOptions {
  /** Try the listed clockwise orientation, or all right-angle turns. */
  rotation?: HanXinRotation | 'auto';
  /** Select polarity, or try normal then inverted modules. */
  inverted?: boolean | 'auto';
}

export interface HanXinDecodeResult {
  format: 'hanxin';
  text: string;
  bytes: Uint8Array;
  version: HanXinVersion;
  ecc: HanXinEccLevel;
  mask: 0 | 1 | 2 | 3;
  mode: 'numeric' | 'text' | 'byte';
  corrections: number;
  rows: number;
  columns: number;
  inverted: boolean;
  rotation: HanXinRotation;
}

interface PayloadResult {
  text: string;
  bytes: Uint8Array;
  mode: HanXinDecodeResult['mode'];
}

function rotateMatrix(source: BitMatrix, rotation: HanXinRotation): BitMatrix {
  if (rotation === 0) return source;
  const output = new BitMatrix(source.height, source.width);
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    if (!source.get(x, y)) continue;
    if (rotation === 90) output.set(source.height - 1 - y, x);
    else if (rotation === 180) output.set(source.width - 1 - x, source.height - 1 - y);
    else output.set(y, source.width - 1 - x);
  }
  return output;
}

function invertMatrix(source: BitMatrix): BitMatrix {
  const output = source.clone();
  for (let y = 0; y < output.height; y++) for (let x = 0; x < output.width; x++) output.flip(x, y);
  return output;
}

function functionInfoCells(version: HanXinVersion): Set<string> {
  const size = hanXinSize(version);
  const cells = new Set<string>();
  for (let i = 0; i < 9; i++) {
    cells.add(`${i},8`);
    cells.add(`${size - 1 - i},${size - 9}`);
    cells.add(`8,${8 - i}`);
    cells.add(`${size - 9},${size - 9 + i}`);
    cells.add(`${size - 9},${i}`);
    cells.add(`8,${size - 1 - i}`);
    cells.add(`${size - 9 + i},8`);
    cells.add(`${8 - i},${size - 9}`);
  }
  return cells;
}

/** Verify finder patterns, separators and all non-information function cells. */
export function hanXinStructureMatches(matrix: BitMatrix, version: HanXinVersion): boolean {
  const size = hanXinSize(version);
  if (matrix.width !== size || matrix.height !== size) return false;
  const template = createHanXinFunctionGrid(version);
  const info = functionInfoCells(version);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (template.reserved[y * size + x] === 0 || info.has(`${x},${y}`)) continue;
    if (matrix.get(x, y) !== template.matrix.get(x, y)) return false;
  }
  return true;
}

function inversePicketFence(wire: number[]): number[] {
  const codewords = new Array<number>(wire.length).fill(0);
  let cursor = 0;
  for (let column = 0; column < 13; column++) {
    for (let i = column; i < codewords.length; i += 13) codewords[i] = wire[cursor++];
  }
  if (cursor !== wire.length) throw new FormatError('Han Xin: codeword reordering is inconsistent');
  return codewords;
}

function readCodewords(matrix: BitMatrix, version: HanXinVersion, mask: number): number[] {
  const coordinates = hanXinDataCoordinates(version);
  const total = HANXIN_DATA_MODULES[version - 1];
  const codewordBits = HANXIN_TOTAL_CODEWORDS[version - 1] * 8;
  const wire = new Array<number>(HANXIN_TOTAL_CODEWORDS[version - 1]).fill(0);
  for (let i = 0; i < total; i++) {
    const [x, y] = coordinates[i];
    let dark = matrix.get(x, y);
    if (hanXinMaskFlip(mask, x, y)) dark = !dark;
    if (i < codewordBits) {
      if (dark) wire[i >>> 3] |= 1 << (7 - (i & 7));
    } else if (dark) {
      throw new FormatError('Han Xin: non-zero remainder modules');
    }
  }
  return inversePicketFence(wire);
}

function ensureZeroPadding(reader: BitReader): void {
  while (reader.available() > 0) {
    if (reader.readBit()) throw new FormatError('Han Xin: non-zero data follows the payload terminator');
  }
}

function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function decodeByteText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    // A byte-mode symbol is allowed to carry arbitrary octets.  Preserve
    // every octet losslessly when it is not valid UTF-8.
    return Array.from(bytes, (value) => String.fromCharCode(value)).join('');
  }
}

function decodeNumeric(reader: BitReader): string {
  const groups: number[] = [];
  while (reader.available() >= 10) {
    const value = reader.read(10);
    if (value >= 1021 && value <= 1023) {
      const count = value - 1020;
      if (groups.length === 0) throw new FormatError('Han Xin: numeric payload has no data group');
      const last = groups.pop() as number;
      if (last >= 10 ** count) throw new FormatError('Han Xin: numeric final group has an invalid width');
      return groups.map((group) => String(group).padStart(3, '0')).join('') +
        String(last).padStart(count, '0');
    }
    if (value > 999) throw new FormatError('Han Xin: numeric group is outside the 000-999 range');
    groups.push(value);
    if (groups.length > 2730) throw new FormatError('Han Xin: numeric payload exceeds the supported stream limit');
  }
  throw new FormatError('Han Xin: numeric payload has no complete terminator');
}

function text1Character(value: number): string | null {
  if (value >= 0 && value <= 9) return String.fromCharCode(0x30 + value);
  if (value >= 10 && value <= 35) return String.fromCharCode(0x41 + value - 10);
  if (value >= 36 && value <= 61) return String.fromCharCode(0x61 + value - 36);
  return null;
}

function text2Character(value: number): string | null {
  if (value >= 0 && value <= 27) return String.fromCharCode(value);
  if (value >= 28 && value <= 43) return String.fromCharCode(0x20 + value - 28);
  if (value >= 44 && value <= 50) return String.fromCharCode(0x3a + value - 44);
  if (value >= 51 && value <= 56) return String.fromCharCode(0x5b + value - 51);
  if (value >= 57 && value <= 61) return String.fromCharCode(0x7b + value - 57);
  return null;
}

function decodeText(reader: BitReader): string {
  let submode: 1 | 2 = 1;
  const characters: string[] = [];
  while (reader.available() >= 6) {
    const value = reader.read(6);
    if (value === 63) {
      if (characters.length === 0) throw new FormatError('Han Xin: text payload is empty');
      return characters.join('');
    }
    if (value === 62) {
      submode = submode === 1 ? 2 : 1;
      continue;
    }
    const character = submode === 1 ? text1Character(value) : text2Character(value);
    if (character === null) throw new FormatError(`Han Xin: text value ${value} is not assigned in submode ${submode}`);
    characters.push(character);
    if (characters.length > 8191) throw new FormatError('Han Xin: text payload exceeds the supported stream limit');
  }
  throw new FormatError('Han Xin: text payload has no complete terminator');
}

function decodeByte(reader: BitReader): Uint8Array {
  if (reader.available() < 13) throw new FormatError('Han Xin: byte payload has no complete length field');
  const count = reader.read(13);
  if (count < 1 || count > 8191) throw new FormatError(`Han Xin: byte count ${count} is outside the supported range`);
  if (count * 8 > reader.available()) throw new FormatError('Han Xin: byte payload is truncated');
  const bytes = new Uint8Array(count);
  for (let i = 0; i < count; i++) bytes[i] = reader.read(8);
  return bytes;
}

function parsePayload(data: Uint8Array): PayloadResult {
  const reader = new BitReader(data);
  if (reader.available() < 4) throw new FormatError('Han Xin: payload has no mode indicator');
  const mode = reader.read(4);
  if (mode === 1) {
    const text = decodeNumeric(reader);
    ensureZeroPadding(reader);
    return { text, bytes: utf8Bytes(text), mode: 'numeric' };
  }
  if (mode === 2) {
    const text = decodeText(reader);
    ensureZeroPadding(reader);
    return { text, bytes: utf8Bytes(text), mode: 'text' };
  }
  if (mode === 3) {
    const bytes = decodeByte(reader);
    ensureZeroPadding(reader);
    return { text: decodeByteText(bytes), bytes, mode: 'byte' };
  }
  throw new FormatError(`Han Xin: unsupported mode indicator ${mode}`);
}

function candidateRotations(option: HanXinDecodeOptions['rotation']): HanXinRotation[] {
  if (option === 'auto' || option == null) return [0, 90, 180, 270];
  if (option === 0 || option === 90 || option === 180 || option === 270) return [option];
  throw new FormatError('Han Xin: rotation must be 0, 90, 180, 270 or auto');
}

function candidatePolarities(option: HanXinDecodeOptions['inverted']): boolean[] {
  if (option === 'auto' || option == null) return [false, true];
  if (option === false || option === true) return [option];
  throw new FormatError('Han Xin: inverted must be true, false or auto');
}

/** Decode a verified Han Xin module matrix. */
export function decodeHanXin(matrix: BitMatrix, options: HanXinDecodeOptions = {}): HanXinDecodeResult {
  if (!matrix || !Number.isInteger(matrix.width) || !Number.isInteger(matrix.height)) {
    throw new FormatError('Han Xin: a BitMatrix is required');
  }
  const rotations = candidateRotations(options.rotation);
  const polarities = candidatePolarities(options.inverted);
  let lastError: unknown = null;

  for (const rotation of rotations) {
    const rotated = rotateMatrix(matrix, rotation);
    for (const inverted of polarities) {
      const candidate = inverted ? invertMatrix(rotated) : rotated;
      for (const version of [1, 2, 3] as HanXinVersion[]) {
        if (candidate.width !== hanXinSize(version) || candidate.height !== hanXinSize(version)) continue;
        if (!hanXinStructureMatches(candidate, version)) continue;
        try {
          const info = decodeHanXinFunctionInfo(candidate, version);
          if (!HANXIN_ECC_LEVELS.includes(info.level)) throw new FormatError('Han Xin: invalid error-correction level');
          const codewords = readCodewords(candidate, version, info.mask);
          const layout = hanXinEcLayout(version, info.level);
          const corrections = rsDecode(codewords, layout.eccCodewords, GF256_HANXIN, 1);
          const data = Uint8Array.from(codewords.slice(0, layout.dataCodewords));
          const payload = parsePayload(data);
          return {
            format: 'hanxin',
            text: payload.text,
            bytes: payload.bytes,
            version,
            ecc: info.level,
            mask: info.mask as 0 | 1 | 2 | 3,
            mode: payload.mode,
            corrections: info.corrections + corrections,
            rows: candidate.height,
            columns: candidate.width,
            inverted,
            rotation,
          };
        } catch (error) {
          lastError = error;
        }
      }
    }
  }
  if (lastError instanceof FormatError) throw lastError;
  throw new FormatError('Han Xin: no valid symbol found in the supplied matrix');
}
