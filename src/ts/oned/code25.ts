/*!
 * Sythos Barcode Suite
 *
 * MIT License
 *
 * Copyright (c) 2026 Sythos
 * SPDX-FileCopyrightText: 2026 Sythos (https://www.sythos.net)
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
 * Code 25 family writers.
 *
 * Code 25 (also called Standard or Industrial 2 of 5) represents each digit
 * with five alternating bar/space elements, exactly two of the bars being wide.
 * IATA 2 of 5 uses the same digit grammar with a shorter start/stop frame.
 * The width descriptions below are expressed as module counts rather than
 * copied implementation tables and are checked by the focused test suite.
 *
 * @module oned/code25
 */

import { BitMatrix } from '../core/bit-matrix.js';
import { EncodeError } from '../core/errors.js';

/** Supported Code 25 framing profiles. */
export type Code25Variant = 'standard' | 'industrial' | 'iata';

/** The ten digit patterns, each with five bars and five spaces. */
export const CODE25_DIGIT_PATTERNS = [
  '1111313111', '3111111131', '1131111131', '3131111111',
  '1111311131', '3111311111', '1131311111', '1111113131',
  '3111113111', '1131113111',
] as const;

/** Start/stop run widths for the three public names. */
export const CODE25_VARIANTS: Readonly<Record<Code25Variant, {
  readonly id: 'industrial2of5' | 'iata2of5';
  readonly label: string;
  readonly start: string;
  readonly stop: string;
}>> = {
  // Code 25 and Industrial 2 of 5 share the discrete two-wide-bar grammar
  // and canonical industrial frame. `standard` is the friendly API alias.
  standard: { id: 'industrial2of5', label: 'Standard 2 of 5 (Code 25)', start: '313111', stop: '31113' },
  industrial: { id: 'industrial2of5', label: 'Industrial 2 of 5', start: '313111', stop: '31113' },
  iata: { id: 'iata2of5', label: 'IATA 2 of 5', start: '1111', stop: '311' },
};

const MAX_CODE25_DIGITS = 500;

function requireDigits(value: string, label: string): string {
  const text = String(value);
  if (!/^[0-9]+$/u.test(text)) {
    throw new EncodeError(`${label}: payload must be digits only, got "${value}"`);
  }
  if (text.length === 0 || text.length > MAX_CODE25_DIGITS) {
    throw new EncodeError(`${label}: payload length must be in 1..${MAX_CODE25_DIGITS}`);
  }
  return text;
}

/** Modulo-10 Code 25 check digit (alternating weights from the right). */
export function code25CheckDigit(value: string): number {
  let sum = 0;
  for (let i = 0; i < value.length; i++) {
    const fromRight = value.length - 1 - i;
    sum += Number(value[i]) * (fromRight % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

function expandWidths(widths: string, wideRatio: number): string {
  let modules = '';
  for (let i = 0; i < widths.length; i++) {
    const width = Number(widths[i]);
    const count = width > 1 ? wideRatio : 1;
    modules += (i % 2 === 0 ? '1' : '0').repeat(count);
  }
  return modules;
}

function toMatrix(modules: string): BitMatrix {
  const matrix = new BitMatrix(modules.length, 1);
  for (let x = 0; x < modules.length; x++) {
    if (modules[x] === '1') matrix.set(x, 0);
  }
  return matrix;
}

function resolveVariant(value: unknown): Code25Variant {
  const variant = String(value ?? 'standard').toLowerCase();
  if (variant === 'industrial' || variant === 'industrial2of5' || variant === 'industrial-2-of-5') return 'industrial';
  if (variant === 'iata' || variant === 'iata2of5' || variant === 'iata-2-of-5') return 'iata';
  if (variant === 'standard' || variant === 'code2of5' || variant === 'code-2-of-5' || variant === 'standard2of5' || variant === 'standard-2-of-5') return 'standard';
  throw new EncodeError(`Code 25: unknown variant "${value}"`);
}

/**
 * Encode one of the Code 25 family profiles.
 *
 * `checkDigit` is opt-in because the base symbologies do not require one. A
 * camera-profile decoder will require and validate it before promoting a read.
 *
 * @param {string} value Numeric payload.
 * @param {object} [options]
 * @param {Code25Variant|string} [options.variant='standard'] Framing profile.
 * @param {boolean} [options.checkDigit] Append a modulo-10 check digit.
 * @param {number} [options.wideRatio=3] Number of modules in a wide bar.
 * @returns {BitMatrix}
 */
export function encodeCode25(value: string, options: {
  variant?: Code25Variant | string;
  checkDigit?: boolean;
  wideRatio?: number;
} = {}): BitMatrix {
  const variant = resolveVariant(options.variant);
  const profile = CODE25_VARIANTS[variant];
  const label = profile.label;
  const ratio = options.wideRatio ?? 3;
  if (!Number.isInteger(ratio) || ratio < 2 || ratio > 8) {
    throw new EncodeError(`${label}: wideRatio must be an integer in 2..8`);
  }
  let digits = requireDigits(value, label);
  if (options.checkDigit === true) digits += String(code25CheckDigit(digits));

  let modules = expandWidths(profile.start, ratio);
  for (const digit of digits) modules += expandWidths(CODE25_DIGIT_PATTERNS[Number(digit)], ratio);
  modules += expandWidths(profile.stop, ratio);
  return toMatrix(modules);
}

/** Encode Standard 2 of 5 (the canonical Code 25 frame). */
export function encodeStandard2of5(value: string, options: Omit<Parameters<typeof encodeCode25>[1], 'variant'> = {}): BitMatrix {
  return encodeCode25(value, { ...options, variant: 'standard' });
}

/** Encode Industrial 2 of 5. */
export function encodeIndustrial2of5(value: string, options: Omit<Parameters<typeof encodeCode25>[1], 'variant'> = {}): BitMatrix {
  return encodeCode25(value, { ...options, variant: 'industrial' });
}

/** Encode IATA 2 of 5. */
export function encodeIATA2of5(value: string, options: Omit<Parameters<typeof encodeCode25>[1], 'variant'> = {}): BitMatrix {
  return encodeCode25(value, { ...options, variant: 'iata' });
}

/** Internal limit used by the scanline reader and its safety checks. */
export const CODE25_MAX_DIGITS = MAX_CODE25_DIGITS;
