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
/** Escapes a vCard text value per RFC 6350 §3.4: backslash, comma, semicolon and newline. */
function escapeText(value) {
    return value.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}
/** Builds an RFC 6350 vCard 3.0 text block from structured fields. */
export function buildVCard(fields) {
    const { firstName = '', lastName = '', organization, title, phones, emails, url, address, note } = fields;
    if (!firstName && !lastName && !organization) {
        throw new EncodeError('vCard: at least one of firstName, lastName or organization is required');
    }
    const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
    lines.push(`N:${escapeText(lastName)};${escapeText(firstName)};;;`);
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || organization || '';
    lines.push(`FN:${escapeText(fullName)}`);
    if (organization)
        lines.push(`ORG:${escapeText(organization)}`);
    if (title)
        lines.push(`TITLE:${escapeText(title)}`);
    for (const phone of phones ?? []) {
        const { number, type = 'CELL' } = typeof phone === 'string' ? { number: phone, type: undefined } : phone;
        lines.push(`TEL;TYPE=${type ?? 'CELL'}:${escapeText(number)}`);
    }
    for (const email of emails ?? [])
        lines.push(`EMAIL:${escapeText(email)}`);
    if (url)
        lines.push(`URL:${escapeText(url)}`);
    if (address) {
        const { type = 'WORK', street = '', city = '', state = '', zip = '', country = '' } = address;
        lines.push(`ADR;TYPE=${type}:;;${escapeText(street)};${escapeText(city)};${escapeText(state)};${escapeText(zip)};${escapeText(country)}`);
    }
    if (note)
        lines.push(`NOTE:${escapeText(note)}`);
    lines.push('END:VCARD');
    return lines.join('\r\n');
}
/** Builds a vCard and encodes it as a QR code. `options` are passed through to `encodeQR` (e.g. `{ ecc: 'M' }`). */
export function encodeVCard(fields, options = {}) {
    return encodeQR(buildVCard(fields), options);
}
