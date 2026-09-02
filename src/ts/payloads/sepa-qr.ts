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
 * SEPA / EPC QR Code ("GiroCode"): not a barcode symbology -- a fixed
 * 12-line payload format defined by the European Payments Council for
 * initiating a SEPA Credit Transfer, encoded as an ordinary QR code.
 *
 * Ported from EPC069-12 v3.1 (19 March 2024), "Quick Response Code --
 * Guidelines to Enable the Data Capture for the Initiation of an SCT",
 * read directly from the European Payments Council's own published PDF
 * -- field order, lengths and the empty-field/trailing-omission rule are
 * all taken from that document's §2.2 data-element table and its two
 * worked examples (verified by counting line feeds in both), not from a
 * secondary description.
 *
 * @module payloads/sepa-qr
 */

import { EncodeError, FormatError } from '../core/errors.js';
import { encodeQR } from '../qr/encoder.js';
import { decodeQR } from '../qr/decoder.js';

export interface SEPAQRFields {
  /** '001' (BIC mandatory) or '002' (BIC optional for EEA-internal transfers). Default '002'. */
  version?: '001' | '002';
  /** 8 or 11 character BIC. Mandatory for version '001' or a non-EEA beneficiary PSP. */
  bic?: string;
  /** Beneficiary name, max 70 characters. */
  name: string;
  /** Beneficiary IBAN, max 34 characters. */
  iban: string;
  /** Amount in euro, 0.01-999999999.99. Omit for no fixed amount. */
  amount?: number;
  /** ISO 20022 ExternalPurposeCode, max 4 characters, e.g. 'GDDS', 'SALA'. */
  purpose?: string;
  /** Structured remittance reference (e.g. ISO 11649 RF reference), max 35 characters. Mutually exclusive with `unstructuredReference`. */
  structuredReference?: string;
  /** Unstructured remittance text, max 140 characters. Mutually exclusive with `structuredReference`. */
  unstructuredReference?: string;
  /** Beneficiary-to-originator information, max 70 characters. */
  beneficiaryInfo?: string;
}

function requireMaxLength(value: string | undefined, max: number, name: string): void {
  if (value !== undefined && value.length > max) {
    throw new EncodeError(`SEPA QR: ${name} must be at most ${max} characters, got ${value.length}`);
  }
}

/** Builds the EPC069-12 payload text for a SEPA Credit Transfer QR code. */
export function buildSEPAQR(fields: SEPAQRFields): string {
  const {
    version = '002', bic, name, iban, amount, purpose,
    structuredReference, unstructuredReference, beneficiaryInfo,
  } = fields;

  if (!name) throw new EncodeError('SEPA QR: name is required');
  if (!iban) throw new EncodeError('SEPA QR: iban is required');
  if (version === '001' && !bic) throw new EncodeError("SEPA QR: bic is required for version '001'");
  if (structuredReference && unstructuredReference) {
    throw new EncodeError('SEPA QR: structuredReference and unstructuredReference are mutually exclusive');
  }
  requireMaxLength(bic, 11, 'bic');
  requireMaxLength(name, 70, 'name');
  requireMaxLength(iban, 34, 'iban');
  requireMaxLength(purpose, 4, 'purpose');
  requireMaxLength(structuredReference, 35, 'structuredReference');
  requireMaxLength(unstructuredReference, 140, 'unstructuredReference');
  requireMaxLength(beneficiaryInfo, 70, 'beneficiaryInfo');
  if (amount !== undefined && (amount < 0.01 || amount > 999999999.99)) {
    throw new EncodeError('SEPA QR: amount must be between 0.01 and 999999999.99');
  }

  const fieldValues = [
    'BCD',
    version,
    '1', // character set: UTF-8
    'SCT',
    bic ?? '',
    name,
    iban,
    amount !== undefined ? `EUR${amount}` : '',
    purpose ?? '',
    structuredReference ?? '',
    unstructuredReference ?? '',
    beneficiaryInfo ?? '',
  ];

  // Per EPC069-12 §2.2: "The last populated element is not followed by any
  // character or element separator" -- trailing empty fields are dropped
  // entirely, but an empty field before the last populated one is kept as
  // an empty line (verified against both of the spec's own worked examples).
  let lastPopulated = fieldValues.length - 1;
  while (lastPopulated >= 0 && fieldValues[lastPopulated] === '') lastPopulated--;
  return fieldValues.slice(0, lastPopulated + 1).join('\n');
}

/** Builds a SEPA/EPC QR payload and encodes it as a QR code at error-correction level M, per EPC069-12. */
export function encodeSEPAQR(fields: SEPAQRFields, options: Record<string, unknown> = {}) {
  return encodeQR(buildSEPAQR(fields), { ecc: 'M', ...options });
}

/**
 * Parses a SEPA/EPC QR payload (as built by `buildSEPAQR`) back into
 * structured fields. Missing trailing lines (dropped by `buildSEPAQR`'s
 * trailing-omission rule) map to `undefined`, not an empty string.
 */
export function parseSEPAQR(text: string): SEPAQRFields {
  const lines = text.split(/\r\n|\n/);
  if (lines[0] !== 'BCD' || lines[3] !== 'SCT') {
    throw new FormatError('SEPA QR: not a recognized EPC069-12 payload');
  }

  const version = lines[1] as '001' | '002';
  const bic = lines[4];
  const name = lines[5];
  const iban = lines[6];
  const amountText = lines[7];
  const purpose = lines[8];
  const structuredReference = lines[9];
  const unstructuredReference = lines[10];
  const beneficiaryInfo = lines[11];

  return {
    version,
    ...(bic ? { bic } : {}),
    name,
    iban,
    ...(amountText ? { amount: Number(amountText.slice(3)) } : {}),
    ...(purpose ? { purpose } : {}),
    ...(structuredReference ? { structuredReference } : {}),
    ...(unstructuredReference ? { unstructuredReference } : {}),
    ...(beneficiaryInfo ? { beneficiaryInfo } : {}),
  };
}

/** Decodes a QR symbol and parses its SEPA/EPC QR payload back into structured fields. */
export function decodeSEPAQR(matrix: unknown): SEPAQRFields {
  return parseSEPAQR(decodeQR(matrix).text);
}
