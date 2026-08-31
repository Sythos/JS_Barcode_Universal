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

/** Strict DotCode matrix decoder. @module dotcode/decoder */

import { BitMatrix } from '../core/bit-matrix.js';
import { ChecksumError, FormatError } from '../core/errors.js';
import { rsDecode } from '../core/reed-solomon.js';
import {
  DOTCODE_CODEWORD_COUNT,
  DOTCODE_FIELD_SIZE,
  DOTCODE_MASK_STEPS,
  DOTCODE_MAX_DIMENSION,
  DOTCODE_MIN_DIMENSION,
  GF113_DOTCODE,
  dotCodeActivePositions,
  dotCodeCodeword,
  dotCodeCodewordCapacity,
  dotCodeCornerOrder,
  dotCodeDataCapacity,
  dotCodeIsCorner,
  dotCodeIsDataPosition,
} from './tables.js';

export type DotCodeRotation = 0 | 90 | 180 | 270;
export type DotCodePolarity = boolean | 'auto';

export interface DotCodeDecodeOptions {
  /** Try all quarter turns by default. */
  rotation?: DotCodeRotation | 'auto';
  /** Try normal and inverted polarity by default. */
  inverted?: DotCodePolarity;
}

export interface DotCodeDecodeResult {
  readonly format: 'dotcode';
  readonly text: string;
  readonly bytes: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly mask: 0 | 1 | 2 | 3;
  readonly dataCodewords: number;
  readonly errorCodewords: number;
  readonly corrections: number;
  readonly gs1: boolean;
  readonly encoding: 'utf8' | 'latin1';
  readonly rotation: DotCodeRotation;
  readonly inverted: boolean;
}

function checkMatrix(matrix: BitMatrix): void {
  if (!matrix || !Number.isInteger(matrix.width) || !Number.isInteger(matrix.height) || typeof matrix.get !== 'function') {
    throw new FormatError('DotCode: no matrix supplied');
  }
  if (matrix.width < DOTCODE_MIN_DIMENSION || matrix.height < DOTCODE_MIN_DIMENSION ||
      matrix.width > DOTCODE_MAX_DIMENSION || matrix.height > DOTCODE_MAX_DIMENSION) {
    throw new FormatError(`DotCode: dimensions must be in ${DOTCODE_MIN_DIMENSION}..${DOTCODE_MAX_DIMENSION}`);
  }
  if (((matrix.width + matrix.height) & 1) === 0) {
    throw new FormatError('DotCode: width plus height must be odd');
  }
}

function readStream(matrix: BitMatrix): boolean[] {
  const width = matrix.width;
  const height = matrix.height;
  const stream: boolean[] = [];
  const read = (column: number, row: number) => stream.push(matrix.get(column, row));

  // Odd-height symbols are folded horizontally; even-height symbols are
  // folded vertically. The six reserved corners are read last in wire order.
  if (height & 1) {
    for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
      if (!dotCodeIsDataPosition(column, row) || dotCodeIsCorner(column, row, width, height)) continue;
      read(column, height - row - 1);
    }
  } else {
    for (let column = 0; column < width; column++) for (let row = 0; row < height; row++) {
      if (!dotCodeIsDataPosition(column, row) || dotCodeIsCorner(column, row, width, height)) continue;
      read(column, row);
    }
  }
  for (const [column, row] of dotCodeCornerOrder(width, height)) read(column, row);
  const expected = dotCodeActivePositions(width, height);
  if (stream.length !== expected) throw new FormatError('DotCode: matrix fold has an invalid active-position count');
  return stream;
}

function unmaskAndCorrect(stream: readonly boolean[], width: number, height: number) {
  const slots = dotCodeCodewordCapacity(width, height);
  const dataLength = dotCodeDataCapacity(slots);
  if (!dataLength) throw new FormatError('DotCode: dimensions cannot carry data and error correction');
  const errorCodewords = 3 + Math.floor(dataLength / 2);
  const symbolCodewords = dataLength + errorCodewords;
  const usedBits = 2 + symbolCodewords * 9;
  if (usedBits > stream.length) throw new FormatError('DotCode: codeword stream is truncated');
  for (let bit = usedBits; bit < stream.length; bit++) {
    if (!stream[bit]) throw new FormatError('DotCode: padding bits must be dark');
  }

  const wireMask = (stream[0] ? 2 : 0) | (stream[1] ? 1 : 0);
  if (wireMask < 0 || wireMask > 3) throw new FormatError('DotCode: invalid mask bits');
  const received = [wireMask];
  for (let word = 0; word < symbolCodewords; word++) {
    const offset = 2 + word * 9;
    let pattern = 0;
    for (let bit = 0; bit < 9; bit++) pattern = (pattern << 1) | (stream[offset + bit] ? 1 : 0);
    const codeword = dotCodeCodeword(pattern);
    if (codeword < 0 || codeword >= DOTCODE_CODEWORD_COUNT) {
      throw new FormatError(`DotCode: unassigned 5-of-9 pattern 0x${pattern.toString(16)}`);
    }
    received.push(codeword);
  }

  const protectedLength = dataLength + 1;
  const totalLength = protectedLength + errorCodewords;
  const blockCount = Math.ceil(totalLength / (DOTCODE_FIELD_SIZE - 1));
  const corrected = received.slice();
  let corrections = 0;
  for (let block = 0; block < blockCount; block++) {
    const blockData = Math.ceil((protectedLength - block) / blockCount);
    const blockTotal = Math.ceil((totalLength - block) / blockCount);
    const blockEcc = blockTotal - blockData;
    if (blockData < 1 || blockEcc < 1) throw new FormatError('DotCode: invalid interleaved RS block layout');
    const blockValues: number[] = [];
    // The first protected value is the two-bit mask itself, so protected data
    // starts at received[0], exactly as it does in the encoder's wire array.
    for (let index = 0; index < blockData; index++) blockValues.push(received[block + index * blockCount]);
    for (let index = 0; index < blockEcc; index++) {
      // The encoder's wire indexes include the mask at position zero. Data
      // is consequently read at 1+offset, while parity starts at the raw
      // interleaved offset returned by the standard layout.
      const value = received[block + blockData * blockCount + index * blockCount];
      if (value === undefined) throw new FormatError('DotCode: truncated RS parity block');
      blockValues.push(value);
    }
    try {
      corrections += rsDecode(blockValues, blockEcc, GF113_DOTCODE, 1);
    } catch (error) {
      if (error instanceof ChecksumError) throw error;
      throw new ChecksumError('DotCode: Reed-Solomon verification failed');
    }
    for (let index = 0; index < blockData; index++) corrected[block + index * blockCount] = blockValues[index];
  }

  const correctedMask = corrected[0];
  if (!Number.isInteger(correctedMask) || correctedMask < 0 || correctedMask > 3) {
    throw new ChecksumError('DotCode: Reed-Solomon corrected an invalid mask value');
  }
  const correctedMaskValue = correctedMask as 0 | 1 | 2 | 3;
  const step = DOTCODE_MASK_STEPS[correctedMaskValue];
  const data: number[] = [];
  for (let index = 0; index < dataLength; index++) {
    const value = corrected[1 + index];
    const unmapped = (value - step * index) % DOTCODE_FIELD_SIZE;
    data.push((unmapped + DOTCODE_FIELD_SIZE) % DOTCODE_FIELD_SIZE);
  }
  return { data, mask: correctedMaskValue, errorCodewords, corrections };
}

function appendBytes(output: number[], values: number | readonly number[]): void {
  if (typeof values === 'number') output.push(values);
  else output.push(...values);
}

function aCharacter(codeword: number): number {
  if (codeword < 0 || codeword > 95) throw new FormatError('DotCode: invalid Code Set A character');
  return codeword < 64 ? codeword + 32 : codeword - 64;
}

function bCharacter(codeword: number): number {
  if (codeword < 0 || codeword > 95) throw new FormatError('DotCode: invalid Code Set B character');
  return codeword + 32;
}

function bSymbols(codeword: number): number | readonly number[] {
  if (codeword <= 95) return bCharacter(codeword);
  if (codeword === 96) return [13, 10];
  if (codeword === 97) return 9;
  if (codeword === 98) return 28;
  if (codeword === 99) return 29;
  if (codeword === 100) return 30;
  throw new FormatError('DotCode: invalid Code Set B character');
}

function cCharacters(codeword: number): [number, number] {
  if (codeword < 0 || codeword > 99) throw new FormatError('DotCode: invalid Code Set C pair');
  return [48 + Math.floor(codeword / 10), 48 + (codeword % 10)];
}

function binaryDigitsToBytes(words: readonly number[]): number[] {
  if (!words.length || words.length > 6 || words.length === 1) {
    throw new FormatError('DotCode: incomplete binary radix group');
  }
  if (words.some((word) => word < 0 || word > 102)) throw new FormatError('DotCode: binary group contains a control codeword');
  let value = 0;
  for (const word of words) value = value * 103 + word;
  const digitCount = words.length - 1;
  const bytes = new Array<number>(digitCount).fill(0);
  for (let index = digitCount - 1; index >= 0; index--) {
    const digit = value % 259;
    value = Math.floor(value / 259);
    if (digit > 255) throw new FormatError('DotCode: ECI or reserved binary value is not supported');
    bytes[index] = digit;
  }
  if (value !== 0) throw new FormatError('DotCode: binary radix group overflows five base-259 digits');
  return bytes;
}

function decodePayload(data: readonly number[]) {
  const words = data.slice();
  while (words.length && words[words.length - 1] === 106) words.pop();
  if (!words.length) throw new FormatError('DotCode: data contains padding only');

  const bytes: number[] = [];
  let mode: 'A' | 'B' | 'C' | 'X' = 'C';
  let position = 0;
  let lead = true;
  let gs1 = false;
  let binarySeen = false;
  const markData = () => { lead = false; };
  const markControl = () => { if (lead) lead = false; };
  const readWord = (message: string): number => {
    if (position >= words.length) throw new FormatError(`DotCode: ${message} is truncated`);
    return words[position++];
  };
  const readB = (): void => appendBytes(bytes, bSymbols(readWord('Code Set B shift')));
  const readA = (): void => appendBytes(bytes, aCharacter(readWord('Code Set A shift')));
  const readC = (): void => appendBytes(bytes, cCharacters(readWord('Code Set C shift')));
  const readBShift = (count: number): void => { for (let index = 0; index < count; index++) readB(); };
  const readCShift = (count: number): void => {
    for (let index = 0; index < count; index++) {
      const value = readWord('Code Set C shift');
      appendBytes(bytes, cCharacters(value));
    }
  };

  while (position < words.length) {
    const codeword = words[position++];
    if (mode === 'X') {
      const group: number[] = [codeword];
      while (group[group.length - 1] <= 102 && position < words.length && words[position] <= 102) group.push(words[position++]);
      if (group[0] <= 102) {
        // The final short group has 2..5 codewords; a full group has six.
        if (group.length % 6 === 1) {
          // A control follows a complete group and is handled below. This
          // branch is only reached when the symbol ends on one stray value.
          throw new FormatError('DotCode: binary radix group has an invalid length');
        }
        for (let offset = 0; offset < group.length; offset += 6) {
          const size = Math.min(6, group.length - offset);
          if (size === 1) throw new FormatError('DotCode: binary radix group has an invalid length');
          appendBytes(bytes, binaryDigitsToBytes(group.slice(offset, offset + size)));
        }
      }
      // A control codeword interrupts binary mode. The group was collected
      // only from data codewords, so the control remains at `codeword`.
      const control = group[0] > 102 ? group[0] : null;
      if (control === null) continue;
      markControl();
      if (control >= 103 && control <= 108) {
        readCShift(control - 101);
        mode = 'X';
      } else if (control === 109) mode = 'A';
      else if (control === 110) mode = 'B';
      else if (control === 111) mode = 'C';
      else if (control === 112) throw new FormatError('DotCode: structured binary separation is not supported');
      else throw new FormatError('DotCode: unsupported binary control codeword');
      continue;
    }

    if (mode === 'C') {
      if (codeword <= 99) {
        if (lead) gs1 = true;
        appendBytes(bytes, cCharacters(codeword));
        markData();
      } else if (codeword === 100) {
        markControl();
        throw new FormatError('DotCode: Code Set C macro/AI 17 encoding is not supported');
      } else if (codeword === 101) { mode = 'A'; }
      else if (codeword >= 102 && codeword <= 105) { readBShift(codeword - 101); markControl(); }
      else if (codeword === 106) { mode = 'B'; }
      else if (codeword === 107) {
        if (lead) { lead = false; }
        else appendBytes(bytes, 29);
      } else if (codeword === 108 || codeword === 109) {
        markControl();
        throw new FormatError(`DotCode: ${codeword === 108 ? 'FNC2' : 'FNC3'} is not supported`);
      } else if (codeword === 110 || codeword === 111) {
        const shifted = readWord('upper shift');
        const value = codeword === 110 ? shifted + 64 : shifted + 160;
        if ((codeword === 110 && (shifted < 64 || shifted > 95)) || (codeword === 111 && (shifted < 0 || shifted > 95)) || value > 255) {
          throw new FormatError('DotCode: invalid upper-shift operand');
        }
        appendBytes(bytes, value);
        markData();
      } else if (codeword === 112) {
        mode = 'X';
        binarySeen = true;
        markControl();
      } else throw new FormatError(`DotCode: unsupported Code Set C codeword ${codeword}`);
      continue;
    }

    if (mode === 'A') {
      if (codeword <= 95) { appendBytes(bytes, aCharacter(codeword)); markData(); }
      else if (codeword === 96) { appendBytes(bytes, [13, 10]); markData(); }
      else if (codeword >= 97 && codeword <= 101) { readBShift(codeword - 95); markControl(); }
      else if (codeword === 102) mode = 'B';
      else if (codeword >= 103 && codeword <= 105) { readCShift(codeword - 101); markControl(); }
      else if (codeword === 106) mode = 'C';
      else if (codeword === 107) { appendBytes(bytes, lead ? [] : 29); lead = false; }
      else if (codeword === 108 || codeword === 109) {
        markControl();
        throw new FormatError(`DotCode: ${codeword === 108 ? 'FNC2' : 'FNC3'} is not supported`);
      } else if (codeword === 110 || codeword === 111) {
        const shifted = readWord('upper shift');
        const value = codeword === 110 ? shifted + 64 : shifted + 160;
        if ((codeword === 110 && (shifted < 64 || shifted > 95)) || (codeword === 111 && (shifted < 0 || shifted > 95)) || value > 255) {
          throw new FormatError('DotCode: invalid upper-shift operand');
        }
        appendBytes(bytes, value);
        markData();
      } else if (codeword === 112) { mode = 'X'; binarySeen = true; markControl(); }
      else throw new FormatError(`DotCode: unsupported Code Set A codeword ${codeword}`);
      continue;
    }

    // Code Set B.
    if (codeword <= 95) { appendBytes(bytes, bCharacter(codeword)); markData(); }
    else if (codeword === 96) { appendBytes(bytes, [13, 10]); markData(); }
    else if (codeword === 97) { appendBytes(bytes, 9); markData(); }
    else if (codeword === 98) { appendBytes(bytes, 28); markData(); }
    else if (codeword === 99) { appendBytes(bytes, 29); markData(); }
    else if (codeword === 100) { appendBytes(bytes, 30); markData(); }
    else if (codeword === 101) { readA(); markControl(); }
    else if (codeword === 102) mode = 'A';
    else if (codeword >= 103 && codeword <= 105) { readBShift(codeword - 101); markControl(); }
    else if (codeword === 106) { mode = 'C'; }
    else if (codeword === 107) { appendBytes(bytes, lead ? [] : 29); lead = false; }
    else if (codeword === 108 || codeword === 109) {
      markControl();
      throw new FormatError(`DotCode: ${codeword === 108 ? 'FNC2' : 'FNC3'} is not supported`);
    } else if (codeword === 110 || codeword === 111) {
      const shifted = readWord('upper shift');
      const value = codeword === 110 ? shifted + 64 : shifted + 160;
      if ((codeword === 110 && (shifted < 64 || shifted > 95)) || (codeword === 111 && (shifted < 0 || shifted > 95)) || value > 255) {
        throw new FormatError('DotCode: invalid upper-shift operand');
      }
      appendBytes(bytes, value);
      markData();
    } else if (codeword === 112) { mode = 'X'; binarySeen = true; markControl(); }
    else throw new FormatError(`DotCode: unsupported Code Set B codeword ${codeword}`);
  }

  if (!bytes.length) throw new FormatError('DotCode: decoded payload is empty');
  let text = '';
  let encoding: 'utf8' | 'latin1' = 'latin1';
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes));
    encoding = 'utf8';
  } catch {
    for (const byte of bytes) text += String.fromCharCode(byte);
  }
  return { text, bytes: Uint8Array.from(bytes), gs1, encoding, binarySeen };
}

function rotate(matrix: BitMatrix, degrees: DotCodeRotation): BitMatrix {
  if (degrees === 0) return matrix.clone();
  const output = degrees === 90 || degrees === 270 ? new BitMatrix(matrix.height, matrix.width) : new BitMatrix(matrix.width, matrix.height);
  for (let y = 0; y < matrix.height; y++) for (let x = 0; x < matrix.width; x++) {
    let nx = x;
    let ny = y;
    if (degrees === 90) { nx = matrix.height - 1 - y; ny = x; }
    else if (degrees === 180) { nx = matrix.width - 1 - x; ny = matrix.height - 1 - y; }
    else { nx = y; ny = matrix.width - 1 - x; }
    output.setValue(nx, ny, matrix.get(x, y));
  }
  return output;
}

function inverted(matrix: BitMatrix): BitMatrix {
  const output = matrix.clone();
  for (let y = 0; y < output.height; y++) for (let x = 0; x < output.width; x++) output.flip(x, y);
  return output;
}

function decodeCanonical(matrix: BitMatrix) {
  checkMatrix(matrix);
  // Inactive checkerboard positions are structural whitespace. Accepting a
  // dark bit there would turn arbitrary dense artwork into a false positive.
  for (let y = 0; y < matrix.height; y++) for (let x = 0; x < matrix.width; x++) {
    // The specification deliberately places two of the six tail/corner bits
    // on the opposite checkerboard parity. They are the only legal exception.
    if (!dotCodeIsDataPosition(x, y) && !dotCodeIsCorner(x, y, matrix.width, matrix.height) && matrix.get(x, y)) {
      throw new FormatError('DotCode: inactive alternating position is dark');
    }
  }
  const stream = readStream(matrix);
  const corrected = unmaskAndCorrect(stream, matrix.width, matrix.height);
  const payload = decodePayload(corrected.data);
  return { ...payload, ...corrected, width: matrix.width, height: matrix.height };
}

/** Decode a sampled DotCode matrix, trying quarter turns and polarity. */
export function decodeDotCode(matrix: BitMatrix, options: DotCodeDecodeOptions = {}): DotCodeDecodeResult {
  checkMatrix(matrix);
  if (options.rotation !== undefined && options.rotation !== 'auto' &&
      options.rotation !== 0 && options.rotation !== 90 && options.rotation !== 180 && options.rotation !== 270) {
    throw new FormatError('DotCode: rotation must be 0, 90, 180, 270 or auto');
  }
  if (options.inverted !== undefined && options.inverted !== 'auto' && typeof options.inverted !== 'boolean') {
    throw new FormatError('DotCode: inverted must be true, false or auto');
  }
  const rotations: DotCodeRotation[] = options.rotation === undefined || options.rotation === 'auto'
    ? [0, 90, 180, 270] : [options.rotation];
  const polarities = options.inverted === undefined || options.inverted === 'auto'
    ? [false, true] : [options.inverted];
  let firstError: unknown = null;
  for (const rotation of rotations) for (const isInverted of polarities) {
    try {
      let oriented = rotate(matrix, rotation);
      if (isInverted) oriented = inverted(oriented);
      const decoded = decodeCanonical(oriented);
      return {
        format: 'dotcode', text: decoded.text, bytes: decoded.bytes,
        width: decoded.width, height: decoded.height, mask: decoded.mask,
        dataCodewords: decoded.data.length, errorCodewords: decoded.errorCodewords,
        corrections: decoded.corrections, gs1: decoded.gs1, encoding: decoded.encoding,
        rotation, inverted: isInverted,
      };
    } catch (error) {
      if (firstError === null) firstError = error;
    }
  }
  if (firstError instanceof Error) throw firstError;
  throw new FormatError('DotCode: matrix could not be decoded');
}

export { ChecksumError, FormatError };
