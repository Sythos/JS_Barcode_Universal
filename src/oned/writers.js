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
 * Linear barcode writers.
 *
 * Every writer returns a `BitMatrix` one module tall. Height is a rendering
 * decision, not an encoding one — a linear symbol carries no information
 * vertically, which is exactly why it survives a laser line that crosses it
 * anywhere. The renderers stretch it via the `barHeight` option.
 *
 * @module oned/writers
 */

import { BitMatrix } from '../core/bit-matrix.js';
import { EncodeError } from '../core/errors.js';
import {
  EAN_L, EAN_G, EAN_R, EAN13_PARITY, UPCE_PARITY,
  EAN_START_END, EAN_MIDDLE, UPCE_END,
  CODE39, CODE39_CHECK_SET, CODE39_EXTENDED,
  CODE93, CODE93_VALUES, CODE93_START_STOP,
  CODE128, CODE128_START_B, CODE128_START_C,
  CODE128_STOP, CODE128_FNC1, CODE128_CODE_A, CODE128_CODE_B, CODE128_CODE_C,
  ITF, CODABAR, CODABAR_START_STOP, CODE11, CODE11_START_STOP,
  MSI_BIT, MSI_START, MSI_STOP,
} from './patterns.js';

/* ------------------------------------------------------------------ *
 * Shared helpers
 * ------------------------------------------------------------------ */

/**
 * Expand an n/w width pattern into a module string, starting with a bar.
 *
 * @param {string} pattern Characters 'n' and 'w'.
 * @param {number} [wide] Modules per wide element.
 * @returns {string} Module string, '1' = dark.
 */
function expandNarrowWide(pattern, wide = 3) {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const width = pattern[i] === 'w' ? wide : 1;
    out += (i % 2 === 0 ? '1' : '0').repeat(width);
  }
  return out;
}

/**
 * Expand a digit-width pattern into a module string, starting with a bar.
 *
 * @param {string} pattern Characters '1'..'4'.
 * @returns {string}
 */
function expandWidths(pattern) {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    out += (i % 2 === 0 ? '1' : '0').repeat(Number(pattern[i]));
  }
  return out;
}

/**
 * @param {string} modules
 * @returns {BitMatrix} One row tall.
 */
function toMatrix(modules) {
  const m = new BitMatrix(modules.length, 1);
  for (let x = 0; x < modules.length; x++) {
    if (modules[x] === '1') m.set(x, 0);
  }
  return m;
}

/**
 * @param {string} value
 * @param {string} format
 */
function requireDigits(value, format) {
  if (!/^[0-9]+$/.test(value)) {
    throw new EncodeError(`${format}: payload must be digits only, got "${value}"`);
  }
}

/**
 * Modulo-10 check digit for the EAN/UPC family.
 *
 * Weights alternate 3 and 1, with the digit immediately left of the check
 * position weighted 3. Anchoring from the right rather than the left makes one
 * routine correct for EAN-8, EAN-13 and UPC-A alike, despite their different
 * payload lengths.
 *
 * @param {string} payload Digits, excluding the check digit.
 * @returns {number}
 */
export function ean13CheckDigit(payload) {
  let sum = 0;
  for (let i = 0; i < payload.length; i++) {
    const fromRight = payload.length - 1 - i;
    sum += Number(payload[i]) * (fromRight % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

/* ------------------------------------------------------------------ *
 * EAN / UPC
 * ------------------------------------------------------------------ */

/**
 * EAN-13. Accepts 12 digits (check digit appended) or 13 (verified).
 *
 * @param {string} value
 * @returns {BitMatrix}
 */
export function encodeEAN13(value) {
  requireDigits(value, 'EAN-13');
  let digits = value;
  if (digits.length === 12) {
    digits += String(ean13CheckDigit(digits));
  } else if (digits.length === 13) {
    const expected = ean13CheckDigit(digits.slice(0, 12));
    if (Number(digits[12]) !== expected) {
      throw new EncodeError(`EAN-13: check digit is ${digits[12]}, expected ${expected}`);
    }
  } else {
    throw new EncodeError(`EAN-13: needs 12 or 13 digits, got ${digits.length}`);
  }

  const parity = EAN13_PARITY[Number(digits[0])];
  let modules = EAN_START_END;
  for (let i = 0; i < 6; i++) {
    const d = Number(digits[i + 1]);
    modules += parity[i] === 'L' ? EAN_L[d] : EAN_G[d];
  }
  modules += EAN_MIDDLE;
  for (let i = 7; i < 13; i++) modules += EAN_R[Number(digits[i])];
  modules += EAN_START_END;

  return toMatrix(modules);
}

/**
 * EAN-8. Accepts 7 digits (check digit appended) or 8 (verified).
 *
 * @param {string} value
 * @returns {BitMatrix}
 */
export function encodeEAN8(value) {
  requireDigits(value, 'EAN-8');
  let digits = value;
  if (digits.length === 7) {
    digits += String(ean13CheckDigit(digits));
  } else if (digits.length === 8) {
    const expected = ean13CheckDigit(digits.slice(0, 7));
    if (Number(digits[7]) !== expected) {
      throw new EncodeError(`EAN-8: check digit is ${digits[7]}, expected ${expected}`);
    }
  } else {
    throw new EncodeError(`EAN-8: needs 7 or 8 digits, got ${digits.length}`);
  }

  let modules = EAN_START_END;
  for (let i = 0; i < 4; i++) modules += EAN_L[Number(digits[i])];
  modules += EAN_MIDDLE;
  for (let i = 4; i < 8; i++) modules += EAN_R[Number(digits[i])];
  modules += EAN_START_END;

  return toMatrix(modules);
}

/**
 * ISBN, as its printed EAN-13 ("Bookland") symbol.
 *
 * ISBN is not a separate symbology — an ISBN barcode *is* an EAN-13 carrying a
 * 978 or 979 prefix. What ISBN adds is its own numbering rules, and those are
 * worth enforcing here: an ISBN-10 uses a modulo-**11** check digit, in which
 * the value ten is written `X`. That is a different calculation from the
 * modulo-10 check the EAN symbol will carry. Passing an ISBN-10 straight
 * through would produce a perfectly scannable symbol encoding the wrong
 * number, so the two checks are kept distinct and the digit is recomputed.
 *
 * Accepts ISBN-10 or ISBN-13, with or without hyphens and spaces.
 *
 * @param {string} value
 * @returns {BitMatrix}
 */
export function encodeISBN(value) {
  const cleaned = String(value).replace(/[\s-]/g, '').toUpperCase();

  if (/^[0-9]{9}[0-9X]$/.test(cleaned)) {
    // ISBN-10: verify its modulo-11 check, then convert to the 978 form.
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += Number(cleaned[i]) * (10 - i);
    sum += cleaned[9] === 'X' ? 10 : Number(cleaned[9]);
    if (sum % 11 !== 0) {
      throw new EncodeError(`ISBN-10: check digit "${cleaned[9]}" fails the modulo-11 test`);
    }
    // The check digit does not carry over — encodeEAN13 computes the new one.
    return encodeEAN13('978' + cleaned.slice(0, 9));
  }

  if (/^[0-9]{12,13}$/.test(cleaned)) {
    const prefix = cleaned.slice(0, 3);
    if (prefix !== '978' && prefix !== '979') {
      throw new EncodeError(`ISBN-13 must begin with 978 or 979, got ${prefix}`);
    }
    // encodeEAN13 appends the check digit at 12, or verifies it at 13.
    return encodeEAN13(cleaned);
  }

  throw new EncodeError(
    `ISBN: expected 10 or 13 digits, hyphens optional — got "${value}"`
  );
}

/**
 * UPC-A. Structurally an EAN-13 whose first digit is zero.
 *
 * @param {string} value 11 or 12 digits.
 * @returns {BitMatrix}
 */
export function encodeUPCA(value) {
  requireDigits(value, 'UPC-A');
  if (value.length !== 11 && value.length !== 12) {
    throw new EncodeError(`UPC-A: needs 11 or 12 digits, got ${value.length}`);
  }
  return encodeEAN13('0' + value);
}

/**
 * Expand a UPC-E body to the 11 digits preceding the check digit.
 *
 * @param {number} system Number system, 0 or 1.
 * @param {string} body 6 digits.
 * @returns {string} 11 digits.
 */
export function upceToUpcaBody(system, body) {
  const d = body;
  const last = Number(d[5]);
  let middle;
  if (last <= 2) {
    middle = d.slice(0, 2) + String(last) + '0000' + d.slice(2, 5);
  } else if (last === 3) {
    middle = d.slice(0, 3) + '00000' + d.slice(3, 5);
  } else if (last === 4) {
    middle = d.slice(0, 4) + '00000' + d[4];
  } else {
    middle = d.slice(0, 5) + '0000' + String(last);
  }
  return String(system) + middle;
}

/**
 * UPC-E, the zero-suppressed form of UPC-A.
 *
 * @param {string} value 6 digits (system 0 assumed), 7 (system + body), or 8 (with check).
 * @returns {BitMatrix}
 */
export function encodeUPCE(value) {
  requireDigits(value, 'UPC-E');

  let system, body, check;
  if (value.length === 6) {
    system = 0;
    body = value;
    check = ean13CheckDigit(upceToUpcaBody(0, body));
  } else if (value.length === 7) {
    system = Number(value[0]);
    body = value.slice(1);
    check = ean13CheckDigit(upceToUpcaBody(system, body));
  } else if (value.length === 8) {
    system = Number(value[0]);
    body = value.slice(1, 7);
    check = Number(value[7]);
  } else {
    throw new EncodeError(`UPC-E: needs 6, 7 or 8 digits, got ${value.length}`);
  }

  if (system !== 0 && system !== 1) {
    throw new EncodeError(`UPC-E: number system must be 0 or 1, got ${system}`);
  }

  const parity = UPCE_PARITY[check];
  let modules = EAN_START_END;
  for (let i = 0; i < 6; i++) {
    const d = Number(body[i]);
    // Number system 1 inverts the entire parity pattern relative to system 0.
    const even = system === 0 ? parity[i] === 'E' : parity[i] === 'O';
    modules += even ? EAN_G[d] : EAN_L[d];
  }
  modules += UPCE_END;

  return toMatrix(modules);
}

/* ------------------------------------------------------------------ *
 * Code 39
 * ------------------------------------------------------------------ */

/**
 * Code 39.
 *
 * @param {string} value
 * @param {object} [options]
 * @param {boolean} [options.checkDigit] Append the modulo-43 check character.
 * @param {boolean} [options.fullAscii] Escape characters outside the native set.
 * @param {number} [options.wideRatio] Wide-to-narrow ratio, 2 or 3.
 * @returns {BitMatrix}
 */
export function encodeCode39(value, options = {}) {
  const { checkDigit = false, fullAscii = false, wideRatio = 3 } = options;
  if (wideRatio < 2 || wideRatio > 3) {
    throw new EncodeError(`Code 39: wide ratio must be 2 or 3, got ${wideRatio}`);
  }

  let text = value;
  if (fullAscii) {
    text = '';
    for (const ch of value) {
      const code = ch.charCodeAt(0);
      if (code > 127) throw new EncodeError(`Code 39: '${ch}' is outside ASCII`);
      text += CODE39_EXTENDED[code];
    }
  }

  for (const ch of text) {
    if (ch === '*') {
      throw new EncodeError("Code 39: '*' is reserved as the start/stop character");
    }
    if (!CODE39[ch]) {
      throw new EncodeError(
        `Code 39: character '${ch}' is not encodable` +
        (fullAscii ? '' : ' — try the fullAscii option')
      );
    }
  }

  let payload = text;
  if (checkDigit) {
    let sum = 0;
    for (const ch of text) sum += CODE39_CHECK_SET.indexOf(ch);
    payload += CODE39_CHECK_SET[sum % 43];
  }

  // Characters are separated by a narrow inter-character gap.
  const parts = ['*', ...payload, '*'].map((ch) => expandNarrowWide(CODE39[ch], wideRatio));
  return toMatrix(parts.join('0'));
}

/* ------------------------------------------------------------------ *
 * Code 93
 * ------------------------------------------------------------------ */

/**
 * Code 93, always with its two mandatory check characters.
 *
 * @param {string} value
 * @returns {BitMatrix}
 */
export function encodeCode93(value) {
  const values = [];
  for (const ch of value) {
    const idx = CODE93_VALUES.indexOf(ch);
    if (idx < 0) throw new EncodeError(`Code 93: character '${ch}' is not encodable`);
    values.push(idx);
  }

  // Check character C weights the payload 1..20 from the right; K then repeats
  // the exercise over the payload plus C, weighted 1..15.
  const weighted = (data, maxWeight) => {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const weight = ((data.length - 1 - i) % maxWeight) + 1;
      sum += weight * data[i];
    }
    return sum % 47;
  };

  values.push(weighted(values, 20));
  values.push(weighted(values, 15));

  let modules = expandWidths(CODE93_START_STOP);
  for (const v of values) modules += expandWidths(CODE93[CODE93_VALUES[v]]);
  modules += expandWidths(CODE93_START_STOP);
  modules += '1'; // termination bar

  return toMatrix(modules);
}

/* ------------------------------------------------------------------ *
 * Code 128
 * ------------------------------------------------------------------ */

/** Set B maps printable ASCII starting at space to symbol value 0. */
const CODE128_B_OFFSET = 32;

/**
 * Code 128, with automatic code-set selection.
 *
 * The heuristic: switch into set C when enough consecutive digits are present
 * to repay the switch symbol — four at the start or end of the payload, six in
 * the middle, since C packs two digits per symbol. An encoder that never
 * switches produces a valid but needlessly wide symbol.
 *
 * @param {string} value
 * @param {object} [options]
 * @param {boolean} [options.gs1] Emit a leading FNC1, making this GS1-128.
 * @returns {BitMatrix}
 */
export function encodeCode128(value, options = {}) {
  const { gs1 = false } = options;
  for (const ch of value) {
    if (ch.charCodeAt(0) > 127) {
      throw new EncodeError(`Code 128: '${ch}' is outside ASCII`);
    }
  }

  /** Length of the digit run starting at i. */
  const digitRun = (i) => {
    let n = 0;
    while (i + n < value.length && value[i + n] >= '0' && value[i + n] <= '9') n++;
    return n;
  };

  const codes = [];
  let mode;
  let i = 0;

  const startRun = digitRun(0);
  if (startRun >= 4 && startRun % 2 === 0) {
    codes.push(CODE128_START_C);
    mode = 'C';
  } else {
    codes.push(CODE128_START_B);
    mode = 'B';
  }
  if (gs1) codes.push(CODE128_FNC1);

  while (i < value.length) {
    const run = digitRun(i);
    const atEnd = i + run === value.length;
    const worthC = run >= 6 || (i === 0 && run >= 4) || (atEnd && run >= 4);

    if (mode !== 'C' && worthC && run >= 2) {
      codes.push(CODE128_CODE_C);
      mode = 'C';
      continue;
    }

    if (mode === 'C') {
      if (run >= 2) {
        codes.push(Number(value.substr(i, 2)));
        i += 2;
        continue;
      }
      codes.push(CODE128_CODE_B);
      mode = 'B';
      continue;
    }

    const code = value.charCodeAt(i);
    if (code < 32) {
      // Control characters live in set A only.
      if (mode !== 'A') {
        codes.push(CODE128_CODE_A);
        mode = 'A';
        continue;
      }
      codes.push(code + 64);
    } else {
      if (mode === 'A' && code >= 96) {
        codes.push(CODE128_CODE_B);
        mode = 'B';
        continue;
      }
      codes.push(code - CODE128_B_OFFSET);
    }
    i++;
  }

  // Checksum: the start value plus each symbol weighted by its position.
  let sum = codes[0];
  for (let k = 1; k < codes.length; k++) sum += codes[k] * k;
  codes.push(sum % 103);
  codes.push(CODE128_STOP);

  let modules = '';
  for (const c of codes) modules += expandWidths(CODE128[c]);

  return toMatrix(modules);
}

/* ------------------------------------------------------------------ *
 * Interleaved 2 of 5
 * ------------------------------------------------------------------ */

/**
 * Interleaved 2 of 5.
 *
 * Digits are encoded in pairs: the first supplies the bars, the second the
 * spaces between them. That interleaving is where the density comes from, and
 * why the payload length must be even.
 *
 * @param {string} value
 * @param {object} [options]
 * @param {boolean} [options.checkDigit] Append a modulo-10 check digit.
 * @param {number} [options.wideRatio]
 * @returns {BitMatrix}
 */
export function encodeITF(value, options = {}) {
  const { checkDigit = false, wideRatio = 3 } = options;
  requireDigits(value, 'ITF');

  let digits = value;
  if (checkDigit) digits += String(ean13CheckDigit(digits));
  // A leading zero pads to an even length without changing the value.
  if (digits.length % 2 !== 0) digits = '0' + digits;

  let modules = '1010'; // start: four narrow elements

  for (let i = 0; i < digits.length; i += 2) {
    const bars = ITF[Number(digits[i])];
    const spaces = ITF[Number(digits[i + 1])];
    for (let k = 0; k < 5; k++) {
      modules += '1'.repeat(bars[k] === 'w' ? wideRatio : 1);
      modules += '0'.repeat(spaces[k] === 'w' ? wideRatio : 1);
    }
  }

  // Stop: wide bar, narrow space, narrow bar.
  modules += '1'.repeat(wideRatio) + '0' + '1';
  return toMatrix(modules);
}

/**
 * ITF-14, the shipping-container form: exactly 14 digits.
 *
 * @param {string} value 13 or 14 digits.
 * @returns {BitMatrix}
 */
export function encodeITF14(value) {
  requireDigits(value, 'ITF-14');
  let digits = value;
  if (digits.length === 13) {
    digits += String(ean13CheckDigit(digits));
  } else if (digits.length !== 14) {
    throw new EncodeError(`ITF-14: needs 13 or 14 digits, got ${digits.length}`);
  }
  return encodeITF(digits);
}

/* ------------------------------------------------------------------ *
 * Codabar
 * ------------------------------------------------------------------ */

/**
 * Codabar.
 *
 * @param {string} value Optionally already wrapped in start/stop characters A-D.
 * @param {object} [options]
 * @param {string} [options.start] One of A, B, C, D.
 * @param {string} [options.stop]
 * @param {number} [options.wideRatio]
 * @returns {BitMatrix}
 */
export function encodeCodabar(value, options = {}) {
  const { wideRatio = 3 } = options;
  let text = value.toUpperCase();
  let start = (options.start || '').toUpperCase();
  let stop = (options.stop || '').toUpperCase();

  // Accept the common convention of embedding the guards in the payload.
  if (!start && text.length >= 2 &&
      CODABAR_START_STOP.includes(text[0]) &&
      CODABAR_START_STOP.includes(text[text.length - 1])) {
    start = text[0];
    stop = text[text.length - 1];
    text = text.slice(1, -1);
  }
  if (!start) start = 'A';
  if (!stop) stop = 'A';

  if (!CODABAR_START_STOP.includes(start) || !CODABAR_START_STOP.includes(stop)) {
    throw new EncodeError('Codabar: start and stop characters must be A, B, C or D');
  }
  for (const ch of text) {
    if (!CODABAR[ch] || CODABAR_START_STOP.includes(ch)) {
      throw new EncodeError(`Codabar: character '${ch}' is not encodable in the payload`);
    }
  }

  const parts = [start, ...text, stop].map((ch) => expandNarrowWide(CODABAR[ch], wideRatio));
  return toMatrix(parts.join('0'));
}

/* ------------------------------------------------------------------ *
 * Code 11
 * ------------------------------------------------------------------ */

/** Code 11 character values, in order. */
const CODE11_CHARSET = '0123456789-';

/**
 * Code 11, digits and hyphen.
 *
 * @param {string} value
 * @param {object} [options]
 * @param {boolean} [options.checkDigit] Append check character C, plus K when long.
 * @param {number} [options.wideRatio]
 * @returns {BitMatrix}
 */
export function encodeCode11(value, options = {}) {
  const { checkDigit = true, wideRatio = 3 } = options;

  for (const ch of value) {
    if (!CODE11_CHARSET.includes(ch)) {
      throw new EncodeError(`Code 11: character '${ch}' is not encodable`);
    }
  }

  let payload = value;
  if (checkDigit) {
    const weighted = (text, maxWeight) => {
      let sum = 0;
      for (let i = 0; i < text.length; i++) {
        const weight = ((text.length - 1 - i) % maxWeight) + 1;
        sum += weight * CODE11_CHARSET.indexOf(text[i]);
      }
      return sum;
    };
    payload += CODE11_CHARSET[weighted(payload, 10) % 11];
    // The second check character is conventionally added only to longer payloads.
    if (value.length >= 10) payload += CODE11_CHARSET[weighted(payload, 9) % 11];
  }

  const parts = [
    expandNarrowWide(CODE11_START_STOP, wideRatio),
    ...[...payload].map((ch) => expandNarrowWide(CODE11[ch], wideRatio)),
    expandNarrowWide(CODE11_START_STOP, wideRatio),
  ];
  return toMatrix(parts.join('0'));
}

/* ------------------------------------------------------------------ *
 * MSI / Plessey
 * ------------------------------------------------------------------ */

/**
 * MSI Plessey.
 *
 * @param {string} value Digits.
 * @param {object} [options]
 * @param {boolean} [options.checkDigit] Append the Luhn modulo-10 check digit.
 * @returns {BitMatrix}
 */
export function encodeMSI(value, options = {}) {
  const { checkDigit = false } = options;
  requireDigits(value, 'MSI');

  let digits = value;
  if (checkDigit) {
    // Luhn: the odd-positioned digits, read as one number, are doubled.
    let odd = '';
    for (let i = digits.length - 1; i >= 0; i -= 2) odd = digits[i] + odd;
    const doubled = String(Number(odd) * 2);
    let sum = 0;
    for (const ch of doubled) sum += Number(ch);
    for (let i = digits.length - 2; i >= 0; i -= 2) sum += Number(digits[i]);
    digits += String((10 - (sum % 10)) % 10);
  }

  let modules = MSI_START;
  for (const ch of digits) {
    const bits = Number(ch).toString(2).padStart(4, '0');
    for (const b of bits) modules += MSI_BIT[b];
  }
  modules += MSI_STOP;

  return toMatrix(modules);
}

/* ------------------------------------------------------------------ *
 * Pharmacode
 * ------------------------------------------------------------------ */

/**
 * Pharmacode, one-track.
 *
 * Unusual among linear symbologies: it encodes an integer directly in a
 * bijective base-2 representation rather than digit by digit, and carries no
 * check digit at all — its only redundancy is the narrow legal value range.
 *
 * @param {number | string} value 3 to 131070.
 * @returns {BitMatrix}
 */
export function encodePharmacode(value) {
  let n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isInteger(n) || n < 3 || n > 131070) {
    throw new EncodeError(`Pharmacode: value must be an integer in 3..131070, got ${value}`);
  }

  const bars = [];
  while (n > 0) {
    if (n % 2 === 0) {
      bars.push('111'); // wide
      n = n / 2 - 1;
    } else {
      bars.push('1');   // narrow
      n = (n - 1) / 2;
    }
  }
  bars.reverse();

  return toMatrix(bars.join('0'));
}
