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
import { decodeQR } from '../qr/decoder.js';
import { buildVCard, parseVCard } from './vcard.js';
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
function unescapeWifi(value) {
    return value.replace(/\\([\\;,:"])/g, '$1');
}
/**
 * Detects which SPARQCode convention `text` follows and parses it back into
 * fields. Detection is by prefix/shape, in the same order each convention's
 * own scheme is unambiguous; a payload matching none of them is treated as
 * a plain `'url'`.
 */
export function parseSPARQCodePayload(text) {
    if (text.startsWith('BEGIN:VCARD')) {
        return { type: 'bizcard', fields: parseVCard(text) };
    }
    if (text.startsWith('BEGIN:VCALENDAR')) {
        const lines = text.split(/\r\n|\n/);
        const get = (key) => lines.find((l) => l.startsWith(`${key}:`))?.slice(key.length + 1);
        const parseICalDate = (value) => new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`);
        const summary = get('SUMMARY');
        const start = get('DTSTART');
        const end = get('DTEND');
        const location = get('LOCATION');
        const description = get('DESCRIPTION');
        return {
            type: 'icalendar',
            fields: {
                ...(summary !== undefined ? { summary } : {}),
                ...(start !== undefined ? { start: parseICalDate(start) } : {}),
                ...(end !== undefined ? { end: parseICalDate(end) } : {}),
                ...(location !== undefined ? { location } : {}),
                ...(description !== undefined ? { description } : {}),
            },
        };
    }
    if (text.startsWith('WIFI:')) {
        const fields = {};
        for (const segment of splitWifiSegments(text.slice('WIFI:'.length))) {
            const separatorIndex = segment.indexOf(':');
            if (separatorIndex === -1)
                continue;
            const key = segment.slice(0, separatorIndex);
            const value = unescapeWifi(segment.slice(separatorIndex + 1));
            if (key === 'T')
                fields.encryption = value;
            else if (key === 'S')
                fields.ssid = value;
            else if (key === 'P')
                fields.password = value;
            else if (key === 'H')
                fields.hidden = value === 'true';
        }
        return { type: 'wifi', fields };
    }
    if (text.startsWith('mailto:')) {
        const [address, query] = text.slice('mailto:'.length).split('?');
        const params = new URLSearchParams(query ?? '');
        return {
            type: 'email',
            fields: {
                address,
                ...(params.has('subject') ? { subject: params.get('subject') } : {}),
                ...(params.has('body') ? { body: params.get('body') } : {}),
            },
        };
    }
    if (text.startsWith('tel:')) {
        return { type: 'phone', fields: { number: text.slice('tel:'.length) } };
    }
    if (text.startsWith('sms:')) {
        const [number, query] = text.slice('sms:'.length).split('?');
        const params = new URLSearchParams(query ?? '');
        return {
            type: 'sms',
            fields: { number, ...(params.has('body') ? { message: decodeURIComponent(params.get('body')) } : {}) },
        };
    }
    if (text.startsWith('geo:')) {
        const [latitude, longitude] = text.slice('geo:'.length).split(',').map(Number);
        return { type: 'geo', fields: { latitude, longitude } };
    }
    if (text.startsWith('https://www.youtube.com/watch?v=')) {
        return { type: 'youtube', fields: { videoId: text.slice('https://www.youtube.com/watch?v='.length) } };
    }
    if (text.startsWith('https://play.google.com/store/apps/details?id=')) {
        return { type: 'googleplay', fields: { packageName: text.slice('https://play.google.com/store/apps/details?id='.length) } };
    }
    return { type: 'url', fields: { url: text } };
}
/** Splits a `WIFI:` payload's `key:value;` segments on unescaped semicolons, matching `escapeWifi`'s escaping. */
function splitWifiSegments(value) {
    const parts = [];
    let current = '';
    for (let i = 0; i < value.length; i++) {
        if (value[i] === '\\' && i + 1 < value.length) {
            current += value[i] + value[i + 1];
            i++;
        }
        else if (value[i] === ';') {
            if (current)
                parts.push(current);
            current = '';
        }
        else {
            current += value[i];
        }
    }
    if (current)
        parts.push(current);
    return parts;
}
/** Decodes a QR symbol and parses its SPARQCode-convention payload back into fields. */
export function decodeSPARQCode(matrix) {
    return parseSPARQCodePayload(decodeQR(matrix).text);
}
