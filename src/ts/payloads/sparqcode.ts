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
import { buildVCard, parseVCard, VCardFields } from './vcard.js';

function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1');
}

export type SPARQCodeType =
  | 'url'
  | 'email'
  | 'phone'
  | 'sms'
  | 'geo'
  | 'wifi'
  | 'bizcard'
  | 'youtube'
  | 'googleplay'
  | 'icalendar';

export interface SPARQCodeUrlFields { url: string; }
export interface SPARQCodeEmailFields { address: string; subject?: string; body?: string; }
export interface SPARQCodePhoneFields { number: string; }
export interface SPARQCodeSmsFields { number: string; message?: string; }
export interface SPARQCodeGeoFields { latitude: number; longitude: number; }
export interface SPARQCodeWifiFields { ssid: string; password?: string; encryption?: 'WPA' | 'WEP' | 'nopass'; hidden?: boolean; }
export interface SPARQCodeYoutubeFields { videoId: string; }
export interface SPARQCodeGooglePlayFields { packageName: string; }
export interface SPARQCodeICalendarFields {
  summary: string;
  start: Date;
  end: Date;
  location?: string;
  description?: string;
}

function formatICalendarDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/** Builds the payload text for one SPARQCode data type. */
export function buildSPARQCodePayload(type: 'url', fields: SPARQCodeUrlFields): string;
export function buildSPARQCodePayload(type: 'email', fields: SPARQCodeEmailFields): string;
export function buildSPARQCodePayload(type: 'phone', fields: SPARQCodePhoneFields): string;
export function buildSPARQCodePayload(type: 'sms', fields: SPARQCodeSmsFields): string;
export function buildSPARQCodePayload(type: 'geo', fields: SPARQCodeGeoFields): string;
export function buildSPARQCodePayload(type: 'wifi', fields: SPARQCodeWifiFields): string;
export function buildSPARQCodePayload(type: 'bizcard', fields: VCardFields): string;
export function buildSPARQCodePayload(type: 'youtube', fields: SPARQCodeYoutubeFields): string;
export function buildSPARQCodePayload(type: 'googleplay', fields: SPARQCodeGooglePlayFields): string;
export function buildSPARQCodePayload(type: 'icalendar', fields: SPARQCodeICalendarFields): string;
export function buildSPARQCodePayload(type: SPARQCodeType, fields: Record<string, unknown>): string {
  switch (type) {
    case 'url': {
      const { url } = fields as unknown as SPARQCodeUrlFields;
      return url;
    }
    case 'email': {
      const { address, subject, body } = fields as unknown as SPARQCodeEmailFields;
      const params = new URLSearchParams();
      if (subject) params.set('subject', subject);
      if (body) params.set('body', body);
      const query = params.toString();
      return `mailto:${address}${query ? `?${query}` : ''}`;
    }
    case 'phone': {
      const { number } = fields as unknown as SPARQCodePhoneFields;
      return `tel:${number}`;
    }
    case 'sms': {
      const { number, message } = fields as unknown as SPARQCodeSmsFields;
      return `sms:${number}${message ? `?body=${encodeURIComponent(message)}` : ''}`;
    }
    case 'geo': {
      const { latitude, longitude } = fields as unknown as SPARQCodeGeoFields;
      return `geo:${latitude},${longitude}`;
    }
    case 'wifi': {
      const { ssid, password, encryption = password ? 'WPA' : 'nopass', hidden = false } = fields as unknown as SPARQCodeWifiFields;
      const parts = [`WIFI:T:${encryption};S:${escapeWifi(ssid)};`];
      if (password) parts.push(`P:${escapeWifi(password)};`);
      if (hidden) parts.push('H:true;');
      parts.push(';');
      return parts.join('');
    }
    case 'bizcard':
      return buildVCard(fields as unknown as VCardFields);
    case 'youtube': {
      const { videoId } = fields as unknown as SPARQCodeYoutubeFields;
      return `https://www.youtube.com/watch?v=${videoId}`;
    }
    case 'googleplay': {
      const { packageName } = fields as unknown as SPARQCodeGooglePlayFields;
      return `https://play.google.com/store/apps/details?id=${packageName}`;
    }
    case 'icalendar': {
      const { summary, start, end, location, description } = fields as unknown as SPARQCodeICalendarFields;
      const lines = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
        `SUMMARY:${summary}`,
        `DTSTART:${formatICalendarDate(start)}`,
        `DTEND:${formatICalendarDate(end)}`,
      ];
      if (location) lines.push(`LOCATION:${location}`);
      if (description) lines.push(`DESCRIPTION:${description}`);
      lines.push('END:VEVENT', 'END:VCALENDAR');
      return lines.join('\r\n');
    }
    default:
      throw new EncodeError(`SPARQCode: unsupported data type ${JSON.stringify(type)}`);
  }
}

/** Builds a SPARQCode-convention payload for `type` and encodes it as a QR code. */
export function encodeSPARQCode(type: SPARQCodeType, fields: Record<string, unknown>, options: Record<string, unknown> = {}) {
  return encodeQR(buildSPARQCodePayload(type as never, fields as never), options);
}

function unescapeWifi(value: string): string {
  return value.replace(/\\([\\;,:"])/g, '$1');
}

export interface ParsedSPARQCode {
  type: SPARQCodeType;
  fields: Record<string, unknown>;
}

/**
 * Detects which SPARQCode convention `text` follows and parses it back into
 * fields. Detection is by prefix/shape, in the same order each convention's
 * own scheme is unambiguous; a payload matching none of them is treated as
 * a plain `'url'`.
 */
export function parseSPARQCodePayload(text: string): ParsedSPARQCode {
  if (text.startsWith('BEGIN:VCARD')) {
    return { type: 'bizcard', fields: parseVCard(text) };
  }
  if (text.startsWith('BEGIN:VCALENDAR')) {
    const lines = text.split(/\r\n|\n/);
    const get = (key: string) => lines.find((l) => l.startsWith(`${key}:`))?.slice(key.length + 1);
    const parseICalDate = (value: string) => new Date(
      `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`,
    );
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
    const fields: Record<string, unknown> = {};
    for (const segment of splitWifiSegments(text.slice('WIFI:'.length))) {
      const separatorIndex = segment.indexOf(':');
      if (separatorIndex === -1) continue;
      const key = segment.slice(0, separatorIndex);
      const value = unescapeWifi(segment.slice(separatorIndex + 1));
      if (key === 'T') fields.encryption = value;
      else if (key === 'S') fields.ssid = value;
      else if (key === 'P') fields.password = value;
      else if (key === 'H') fields.hidden = value === 'true';
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
      fields: { number, ...(params.has('body') ? { message: decodeURIComponent(params.get('body')!) } : {}) },
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
function splitWifiSegments(value: string): string[] {
  const parts: string[] = [];
  let current = '';
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '\\' && i + 1 < value.length) {
      current += value[i] + value[i + 1];
      i++;
    } else if (value[i] === ';') {
      if (current) parts.push(current);
      current = '';
    } else {
      current += value[i];
    }
  }
  if (current) parts.push(current);
  return parts;
}

/** Decodes a QR symbol and parses its SPARQCode-convention payload back into fields. */
export function decodeSPARQCode(matrix: unknown): ParsedSPARQCode {
  return parseSPARQCodePayload(decodeQR(matrix).text);
}
