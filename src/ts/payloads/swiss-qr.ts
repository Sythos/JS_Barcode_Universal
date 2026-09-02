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
 * Swiss QR-bill: not a barcode symbology -- a fixed-line payload format
 * defined by SIX Interbank Clearing for the QR code printed on Swiss
 * payment slips, encoded as an ordinary QR code.
 *
 * Ported from "Swiss Implementation Guidelines for the QR-bill", Version
 * 2.3 (20.11.2023), read directly from SIX's own published PDF: the
 * fixed 4.2.2 data-element structure (including the "combined address"
 * option's removal in v2.3, so only the structured-address fields are
 * implemented), the 4.1.4 separator rule (CR+LF or LF; every element line
 * is present even when empty, except the trailing status-"A" elements --
 * Billing information and the two Alternative procedure lines -- which
 * are omitted if unused and nothing after them is used), and the Annex B
 * "Modulo 10 recursive" QR-reference check-digit algorithm, whose table
 * was cross-verified against the spec's own worked example (an input of
 * 21 00000 00003 13947 14300 0901 must produce check digit 7) since the
 * table itself is rendered as a diagram in the PDF, not extractable text.
 *
 * @module payloads/swiss-qr
 */

import { EncodeError, FormatError } from '../core/errors.js';
import { encodeQR } from '../qr/encoder.js';
import { decodeQR } from '../qr/decoder.js';

// Annex B, "Modulo 10 recursive": carry = TABLE[(carry + digit) % 10] per
// digit, left to right, starting carry = 0; check digit = (10 - carry) % 10.
const MOD10_RECURSIVE_TABLE: readonly number[] = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];

/** Computes the Annex B "Modulo 10 recursive" check digit for a 26-digit QR reference body. */
export function qrReferenceCheckDigit(digits: string): string {
  if (!/^\d{26}$/.test(digits)) {
    throw new EncodeError('Swiss QR-bill: QR reference body must be exactly 26 digits');
  }
  let carry = 0;
  for (const ch of digits) carry = MOD10_RECURSIVE_TABLE[(carry + Number(ch)) % 10];
  return String((10 - carry) % 10);
}

/** MOD-97-10 (ISO/IEC 7064) check, shared by IBAN and the ISO 11649 Creditor Reference. */
function mod97(value: string): number {
  const numeric = value.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  let remainder = 0;
  for (const ch of numeric) remainder = (remainder * 10 + Number(ch)) % 97;
  return remainder;
}

/** Whether `iban`'s own check digits (positions 3-4) satisfy the ISO 13616 MOD-97-10 rule. */
export function validateIBAN(iban: string): boolean {
  const value = iban.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(value)) return false;
  return mod97(value.slice(4) + value.slice(0, 4)) === 1;
}

/** Whether `iban` is a Swiss/Liechtenstein QR-IBAN (IID in 30000-31999, positions 5-9). */
export function isQrIban(iban: string): boolean {
  const value = iban.replace(/\s/g, '').toUpperCase();
  if (!/^(CH|LI)\d{2}\d{5}/.test(value)) return false;
  const iid = Number(value.slice(4, 9));
  return iid >= 30000 && iid <= 31999;
}

export interface SwissQRAddress {
  name: string;
  street?: string;
  buildingNumber?: string;
  postalCode: string;
  city: string;
  /** Two-letter ISO 3166-1 country code. */
  country: string;
}

export interface SwissQRFields {
  /** Creditor's IBAN or QR-IBAN, CH/LI only. */
  iban: string;
  creditor: SwissQRAddress;
  debtor?: SwissQRAddress;
  /** Payment amount, 0.01-999999999.99. Omit for no fixed amount. */
  amount?: number;
  /** 'CHF' or 'EUR'. Default 'CHF'. */
  currency?: 'CHF' | 'EUR';
  /** 'QRR' (26-digit body, check digit computed here), 'SCOR' (ISO 11649 reference, e.g. 'RF18539007547034') or 'NON'. */
  referenceType: 'QRR' | 'SCOR' | 'NON';
  /** For 'QRR': the 26-digit reference body (check digit is computed and appended). For 'SCOR': the full RF reference. Omit for 'NON'. */
  reference?: string;
  /** Unstructured message, max 140 characters. */
  unstructuredMessage?: string;
  /** Structured billing information, max 140 characters. */
  billingInformation?: string;
  /** Up to 2 alternative payment procedure lines, max 100 characters each. */
  alternativeProcedures?: string[];
}

function addressLines(address: SwissQRAddress | undefined): string[] {
  if (!address) return ['', '', '', '', '', '', ''];
  const { name, street = '', buildingNumber = '', postalCode, city, country } = address;
  return ['S', name, street, buildingNumber, postalCode, city, country];
}

/** Builds the SIX QR-bill payload text for a Swiss (or Liechtenstein) payment. */
export function buildSwissQR(fields: SwissQRFields): string {
  const {
    iban, creditor, debtor, amount, currency = 'CHF', referenceType, reference,
    unstructuredMessage, billingInformation, alternativeProcedures = [],
  } = fields;

  if (!iban || !/^(CH|LI)\d{19}$/.test(iban.replace(/\s/g, '').toUpperCase())) {
    throw new EncodeError('Swiss QR-bill: iban must be a 21-character CH or LI IBAN with no spaces');
  }
  if (!creditor) throw new EncodeError('Swiss QR-bill: creditor is required');
  if (unstructuredMessage && unstructuredMessage.length > 140) {
    throw new EncodeError('Swiss QR-bill: unstructuredMessage must be at most 140 characters');
  }
  if (billingInformation && billingInformation.length > 140) {
    throw new EncodeError('Swiss QR-bill: billingInformation must be at most 140 characters');
  }
  if (alternativeProcedures.length > 2) {
    throw new EncodeError('Swiss QR-bill: at most 2 alternativeProcedures lines are permitted');
  }
  for (const line of alternativeProcedures) {
    if (line.length > 100) throw new EncodeError('Swiss QR-bill: each alternativeProcedures line must be at most 100 characters');
  }
  if (amount !== undefined && (amount < 0.01 || amount > 999999999.99)) {
    throw new EncodeError('Swiss QR-bill: amount must be between 0.01 and 999999999.99');
  }

  const ibanNormalized = iban.replace(/\s/g, '').toUpperCase();
  const isQr = isQrIban(ibanNormalized);
  let referenceLine = '';
  if (referenceType === 'QRR') {
    if (!isQr) throw new EncodeError("Swiss QR-bill: referenceType 'QRR' requires a QR-IBAN");
    if (!reference || !/^\d{26}$/.test(reference)) {
      throw new EncodeError("Swiss QR-bill: 'QRR' reference must be the 26-digit reference body");
    }
    referenceLine = reference + qrReferenceCheckDigit(reference);
  } else if (referenceType === 'SCOR') {
    if (isQr) throw new EncodeError("Swiss QR-bill: referenceType 'SCOR' cannot be used with a QR-IBAN");
    if (!reference) throw new EncodeError("Swiss QR-bill: 'SCOR' requires a reference");
    referenceLine = reference;
  } else if (referenceType === 'NON') {
    if (isQr) throw new EncodeError("Swiss QR-bill: referenceType 'NON' cannot be used with a QR-IBAN");
    if (reference) throw new EncodeError("Swiss QR-bill: reference must be omitted for referenceType 'NON'");
  } else {
    throw new EncodeError(`Swiss QR-bill: referenceType must be 'QRR', 'SCOR' or 'NON', got ${JSON.stringify(referenceType)}`);
  }

  const fixedLines = [
    'SPC', '0200', '1',
    ibanNormalized,
    ...addressLines(creditor),
    '', '', '', '', '', '', '', // Ultimate Creditor: reserved, must not be filled in (status X)
    amount !== undefined ? amount.toFixed(2) : '',
    currency,
    ...addressLines(debtor),
    referenceType, referenceLine,
    unstructuredMessage ?? '',
    'EPD',
  ];

  // Status "A" (additional) trailing elements only: Billing information, then
  // up to 2 alternative-procedure lines -- omitted (not left blank) if unused
  // and nothing after them is used (4.1.4).
  const trailing = [billingInformation ?? '', ...alternativeProcedures];
  let lastPopulated = trailing.length - 1;
  while (lastPopulated >= 0 && trailing[lastPopulated] === '') lastPopulated--;

  return [...fixedLines, ...trailing.slice(0, lastPopulated + 1)].join('\r\n');
}

/** Builds a Swiss QR-bill payload and encodes it as a QR code at error-correction level M. */
export function encodeSwissQR(fields: SwissQRFields, options: Record<string, unknown> = {}) {
  return encodeQR(buildSwissQR(fields), { ecc: 'M', ...options });
}

/** Reverses `addressLines`: `undefined` when the address-type line isn't 'S' (an omitted debtor). */
function parseAddressLines(lines: string[]): SwissQRAddress | undefined {
  const [type, name, street, buildingNumber, postalCode, city, country] = lines;
  if (type !== 'S') return undefined;
  return {
    name,
    ...(street ? { street } : {}),
    ...(buildingNumber ? { buildingNumber } : {}),
    postalCode,
    city,
    country,
  };
}

/**
 * Parses a Swiss QR-bill payload (as built by `buildSwissQR`) back into
 * structured fields, using the same fixed-line-index layout. For a 'QRR'
 * reference, strips the trailing check digit `buildSwissQR` appended, so
 * the result's `reference` is the same 26-digit body a caller would pass
 * back into `buildSwissQR`.
 */
export function parseSwissQR(text: string): SwissQRFields {
  const lines = text.split(/\r\n|\n/);
  if (lines[0] !== 'SPC' || lines[1] !== '0200' || lines[2] !== '1') {
    throw new FormatError('Swiss QR-bill: not a recognized QR-bill payload');
  }
  if (lines[30] !== 'EPD') {
    throw new FormatError('Swiss QR-bill: missing EPD trailer');
  }

  const iban = lines[3];
  const creditor = parseAddressLines(lines.slice(4, 11));
  if (!creditor) throw new FormatError('Swiss QR-bill: missing creditor address');
  const amountText = lines[18];
  const currency = lines[19] as 'CHF' | 'EUR';
  const debtor = parseAddressLines(lines.slice(20, 27));
  const referenceType = lines[27] as 'QRR' | 'SCOR' | 'NON';
  const referenceLine = lines[28];
  const unstructuredMessage = lines[29];

  const reference = referenceType === 'QRR'
    ? referenceLine.slice(0, -1)
    : referenceType === 'SCOR' ? referenceLine : undefined;

  const trailing = lines.slice(31);
  const billingInformation = trailing[0];
  const alternativeProcedures = trailing.slice(1).filter((line) => line !== '');

  return {
    iban,
    creditor,
    ...(debtor ? { debtor } : {}),
    ...(amountText ? { amount: Number(amountText) } : {}),
    currency,
    referenceType,
    ...(reference ? { reference } : {}),
    ...(unstructuredMessage ? { unstructuredMessage } : {}),
    ...(billingInformation ? { billingInformation } : {}),
    ...(alternativeProcedures.length ? { alternativeProcedures } : {}),
  };
}

/** Decodes a QR symbol and parses its Swiss QR-bill payload back into structured fields. */
export function decodeSwissQR(matrix: unknown): SwissQRFields {
  return parseSwissQR(decodeQR(matrix).text);
}
