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
 * "SPARQCode" (MSKYNET, Inc., ~2010): not a barcode symbology -- see
 * `docs/formats/qr-family.md` and `docs/JABCODE_NOTES.md`'s sibling
 * research note for the full provenance. It named a curated set of
 * application-layer conventions for structuring a QR code's *payload
 * text* (URLs, phone numbers, SMS, geographic coordinates, WiFi
 * configuration, business cards, and similar), all of which are
 * themselves already-public, non-proprietary conventions (URI schemes,
 * RFC 5870, the widely-deployed `WIFI:` format, RFC 6350 vCard) -- not a
 * bit-level format MSKYNET invented. This module builds each of those
 * payload strings and encodes it as an ordinary QR code.
 *
 * @module payloads/sparqcode
 */
import { EncodeError } from '../core/errors.js';
import { encodeQR } from '../qr/encoder.js';
import { buildVCard } from './vcard.js';
function escapeWifi(value) {
    return value.replace(/([\\;,:"])/g, '\\$1');
}
function formatICalendarDate(date) {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}
export function buildSPARQCodePayload(type, fields) {
    switch (type) {
        case 'url': {
            const { url } = fields;
            return url;
        }
        case 'email': {
            const { address, subject, body } = fields;
            const params = new URLSearchParams();
            if (subject)
                params.set('subject', subject);
            if (body)
                params.set('body', body);
            const query = params.toString();
            return `mailto:${address}${query ? `?${query}` : ''}`;
        }
        case 'phone': {
            const { number } = fields;
            return `tel:${number}`;
        }
        case 'sms': {
            const { number, message } = fields;
            return `sms:${number}${message ? `?body=${encodeURIComponent(message)}` : ''}`;
        }
        case 'geo': {
            const { latitude, longitude } = fields;
            return `geo:${latitude},${longitude}`;
        }
        case 'wifi': {
            const { ssid, password, encryption = password ? 'WPA' : 'nopass', hidden = false } = fields;
            const parts = [`WIFI:T:${encryption};S:${escapeWifi(ssid)};`];
            if (password)
                parts.push(`P:${escapeWifi(password)};`);
            if (hidden)
                parts.push('H:true;');
            parts.push(';');
            return parts.join('');
        }
        case 'bizcard':
            return buildVCard(fields);
        case 'youtube': {
            const { videoId } = fields;
            return `https://www.youtube.com/watch?v=${videoId}`;
        }
        case 'googleplay': {
            const { packageName } = fields;
            return `https://play.google.com/store/apps/details?id=${packageName}`;
        }
        case 'icalendar': {
            const { summary, start, end, location, description } = fields;
            const lines = [
                'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
                `SUMMARY:${summary}`,
                `DTSTART:${formatICalendarDate(start)}`,
                `DTEND:${formatICalendarDate(end)}`,
            ];
            if (location)
                lines.push(`LOCATION:${location}`);
            if (description)
                lines.push(`DESCRIPTION:${description}`);
            lines.push('END:VEVENT', 'END:VCALENDAR');
            return lines.join('\r\n');
        }
        default:
            throw new EncodeError(`SPARQCode: unsupported data type ${JSON.stringify(type)}`);
    }
}
/** Builds a SPARQCode-convention payload for `type` and encodes it as a QR code. */
export function encodeSPARQCode(type, fields, options = {}) {
    return encodeQR(buildSPARQCodePayload(type, fields), options);
}
