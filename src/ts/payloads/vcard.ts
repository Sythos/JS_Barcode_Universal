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
 * vCard (RFC 6350): not a barcode symbology -- a plain-text contact-card
 * format commonly carried as a QR code payload. This module builds a
 * correctly escaped vCard 3.0 text block (the version most broadly
 * recognized by phone camera apps and dedicated QR readers) and encodes
 * it as an ordinary QR code; nothing here is specific to any particular
 * QR reader or "smart" QR product.
 *
 * @module payloads/vcard
 */

import { EncodeError } from '../core/errors.js';
import { encodeQR } from '../qr/encoder.js';
import { decodeQR } from '../qr/decoder.js';

export interface VCardPhone {
  number: string;
  /** e.g. 'CELL', 'WORK', 'HOME', 'FAX'. Default 'CELL'. */
  type?: string;
}

export interface VCardAddress {
  /** e.g. 'WORK', 'HOME'. */
  type?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface VCardFields {
  firstName?: string;
  lastName?: string;
  organization?: string;
  title?: string;
  phones?: (VCardPhone | string)[];
  emails?: string[];
  url?: string;
  address?: VCardAddress;
  note?: string;
}

/** Escapes a vCard text value per RFC 6350 §3.4: backslash, comma, semicolon and newline. */
function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}

/** Builds an RFC 6350 vCard 3.0 text block from structured fields. */
export function buildVCard(fields: VCardFields): string {
  const { firstName = '', lastName = '', organization, title, phones, emails, url, address, note } = fields;
  if (!firstName && !lastName && !organization) {
    throw new EncodeError('vCard: at least one of firstName, lastName or organization is required');
  }
  const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0'];
  lines.push(`N:${escapeText(lastName)};${escapeText(firstName)};;;`);
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || organization || '';
  lines.push(`FN:${escapeText(fullName)}`);
  if (organization) lines.push(`ORG:${escapeText(organization)}`);
  if (title) lines.push(`TITLE:${escapeText(title)}`);
  for (const phone of phones ?? []) {
    const { number, type = 'CELL' } = typeof phone === 'string' ? { number: phone, type: undefined } : phone;
    lines.push(`TEL;TYPE=${type ?? 'CELL'}:${escapeText(number)}`);
  }
  for (const email of emails ?? []) lines.push(`EMAIL:${escapeText(email)}`);
  if (url) lines.push(`URL:${escapeText(url)}`);
  if (address) {
    const { type = 'WORK', street = '', city = '', state = '', zip = '', country = '' } = address;
    lines.push(
      `ADR;TYPE=${type}:;;${escapeText(street)};${escapeText(city)};${escapeText(state)};${escapeText(zip)};${escapeText(country)}`,
    );
  }
  if (note) lines.push(`NOTE:${escapeText(note)}`);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

/** Builds a vCard and encodes it as a QR code. `options` are passed through to `encodeQR` (e.g. `{ ecc: 'M' }`). */
export function encodeVCard(fields: VCardFields, options: Record<string, unknown> = {}) {
  return encodeQR(buildVCard(fields), options);
}

/** Reverses `escapeText`: unescapes `\\`, `\;`, `\,` and `\n`, character by character so an escape sequence is never split mid-way. */
function unescapeText(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '\\' && i + 1 < value.length) {
      const next = value[i + 1];
      if (next === 'n') { out += '\n'; i++; continue; }
      if (next === '\\' || next === ',' || next === ';') { out += next; i++; continue; }
    }
    out += value[i];
  }
  return out;
}

/** Splits on an unescaped delimiter only -- an escaped delimiter (`\;`) or an escaped backslash (`\\`) is treated as a single unsplittable unit. */
function splitUnescaped(value: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = '';
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '\\' && i + 1 < value.length) {
      current += value[i] + value[i + 1];
      i++;
    } else if (value[i] === delimiter) {
      parts.push(current);
      current = '';
    } else {
      current += value[i];
    }
  }
  parts.push(current);
  return parts;
}

/**
 * Parses a vCard 3.0 text block (as built by `buildVCard`) back into
 * structured fields. Scoped to the properties `buildVCard` itself emits --
 * not a general RFC 6350 parser for arbitrary third-party vCards.
 */
export function parseVCard(text: string): VCardFields {
  const fields: VCardFields = {};
  const phones: VCardPhone[] = [];
  const emails: string[] = [];

  for (const line of text.split(/\r\n|\n/)) {
    if (!line) continue;
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const head = line.slice(0, colonIndex);
    const value = line.slice(colonIndex + 1);
    const [property, ...params] = head.split(';');
    const typeParam = params.find((p) => p.startsWith('TYPE='));
    const type = typeParam ? typeParam.slice('TYPE='.length) : undefined;

    switch (property) {
      case 'N': {
        const parts = splitUnescaped(value, ';').map(unescapeText);
        if (parts[0]) fields.lastName = parts[0];
        if (parts[1]) fields.firstName = parts[1];
        break;
      }
      case 'ORG':
        fields.organization = unescapeText(value);
        break;
      case 'TITLE':
        fields.title = unescapeText(value);
        break;
      case 'TEL':
        phones.push(type ? { number: unescapeText(value), type } : { number: unescapeText(value) });
        break;
      case 'EMAIL':
        emails.push(unescapeText(value));
        break;
      case 'URL':
        fields.url = unescapeText(value);
        break;
      case 'ADR': {
        const parts = splitUnescaped(value, ';').map(unescapeText);
        fields.address = {
          ...(type ? { type } : {}),
          ...(parts[2] ? { street: parts[2] } : {}),
          ...(parts[3] ? { city: parts[3] } : {}),
          ...(parts[4] ? { state: parts[4] } : {}),
          ...(parts[5] ? { zip: parts[5] } : {}),
          ...(parts[6] ? { country: parts[6] } : {}),
        };
        break;
      }
      case 'NOTE':
        fields.note = unescapeText(value);
        break;
      default:
        break; // BEGIN, VERSION, FN and END are structural/derived, not part of VCardFields
    }
  }

  if (phones.length) fields.phones = phones;
  if (emails.length) fields.emails = emails;
  return fields;
}

/** Decodes a QR symbol and parses its vCard payload back into structured fields. */
export function decodeVCard(matrix: unknown): VCardFields {
  return parseVCard(decodeQR(matrix).text);
}
