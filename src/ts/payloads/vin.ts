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
 * Vehicle Identification Number (VIN): not a barcode symbology of its own
 * -- a fixed 17-character alphanumeric identifier, ISO 3779, printed on
 * vehicles worldwide and commonly carried on a Code 39 label (the
 * North American convention this module follows for `encodeVIN`).
 *
 * Only the North American check-digit scheme (FMVSS 115 / SAE J853,
 * position 9) is implemented -- it is the one VIN authorities elsewhere
 * do not require, but computing and validating it is harmless and useful
 * even for a non-NA VIN (`validateVIN` simply reports whether position 9
 * matches; a VIN issued outside North America legitimately may not).
 *
 * @module payloads/vin
 */

import { EncodeError } from '../core/errors.js';
import { encodeCode39 } from '../oned/writers.js';

// I, O, Q are deliberately absent from a VIN (excluded to avoid confusion with 1, 0).
const TRANSLITERATION: Readonly<Record<string, number>> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9,
};
const WEIGHTS: readonly number[] = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

/** Computes the North American (FMVSS 115) VIN check digit for a 17-character VIN, ignoring position 9's own value. */
export function vinCheckDigit(vin: string): string {
  const upper = vin.toUpperCase();
  if (!VIN_PATTERN.test(upper)) {
    throw new EncodeError('VIN: must be exactly 17 characters from A-Z (excluding I, O, Q) and 0-9');
  }
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += TRANSLITERATION[upper[i]] * WEIGHTS[i];
  const remainder = sum % 11;
  return remainder === 10 ? 'X' : String(remainder);
}

/** Whether `vin`'s own position-9 character matches the North American check digit computed from the rest. */
export function validateVIN(vin: string): boolean {
  if (typeof vin !== 'string' || !VIN_PATTERN.test(vin.toUpperCase())) return false;
  return vin.toUpperCase()[8] === vinCheckDigit(vin);
}

export interface EncodeVINOptions {
  /** Compute and insert the check digit at position 9 instead of requiring it already be present. Default false. */
  computeCheckDigit?: boolean;
}

/**
 * Encodes a VIN as Code 39, the North American physical-label convention
 * (no Code 39 check character -- the VIN's own position-9 check digit is
 * the only checksum real VIN labels carry).
 */
export function encodeVIN(vin: string, options: EncodeVINOptions = {}) {
  if (typeof vin !== 'string') throw new EncodeError('VIN: value must be a string');
  let value = vin.toUpperCase();
  if (options.computeCheckDigit) {
    if (!/^[A-HJ-NPR-Z0-9]{8}[A-Z0-9][A-HJ-NPR-Z0-9]{8}$/.test(value)) {
      throw new EncodeError('VIN: must be exactly 17 characters from A-Z (excluding I, O, Q) and 0-9');
    }
    value = value.slice(0, 8) + vinCheckDigit(value.slice(0, 8) + '0' + value.slice(9)) + value.slice(9);
  } else if (!VIN_PATTERN.test(value)) {
    throw new EncodeError('VIN: must be exactly 17 characters from A-Z (excluding I, O, Q) and 0-9');
  }
  return encodeCode39(value, { checkDigit: false });
}
