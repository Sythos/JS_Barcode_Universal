/*!
 * Sythos Barcode Suite — tests
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
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildVCard, encodeVCard, parseVCard, decodeVCard,
  vinCheckDigit, validateVIN, encodeVIN,
  buildSPARQCodePayload, encodeSPARQCode, parseSPARQCodePayload, decodeSPARQCode,
  buildSwissQR, encodeSwissQR, parseSwissQR, decodeSwissQR, qrReferenceCheckDigit, validateIBAN, isQrIban,
  buildSEPAQR, encodeSEPAQR, parseSEPAQR, decodeSEPAQR,
  buildAAMVA, encodeAAMVA, parseAAMVA, decodeAAMVA,
} from '../src/js/payloads/index.js';
import { decodeQR } from '../src/js/qr/index.js';
import { decodeOneD } from '../src/js/oned/reader.js';
import { decodePDF417 } from '../src/js/pdf417/index.js';
import { BitMatrix } from '../src/js/core/bit-matrix.js';
import { EncodeError } from '../src/js/core/errors.js';

/** Stretch a 1-module-tall barcode into a scannable image. */
function stretch(matrix, scale = 3, height = 20) {
  const wide = matrix.scale(scale);
  const out = new BitMatrix(wide.width + 20 * scale, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < wide.width; x++) {
      if (wide.get(x, 0)) out.set(x + 10 * scale, y);
    }
  }
  return out;
}

test('vCard: builds a correctly escaped RFC 6350 block and round-trips through QR', () => {
  const text = buildVCard({
    firstName: 'Mario', lastName: 'Rossi, Jr;\\', organization: 'Sythos',
    phones: ['+391234567890', { number: '+390612345', type: 'WORK' }],
    emails: ['mario@example.com'],
    url: 'https://example.com',
    address: { street: 'Via Roma 1', city: 'Roma', zip: '00100', country: 'IT' },
    note: 'line1\nline2',
  });
  assert.match(text, /BEGIN:VCARD\r\nVERSION:3\.0\r\n/);
  assert.match(text, /N:Rossi\\, Jr\\;\\\\;Mario;;;/);
  assert.match(text, /TEL;TYPE=CELL:\+391234567890/);
  assert.match(text, /TEL;TYPE=WORK:\+390612345/);
  assert.match(text, /NOTE:line1\\nline2/);
  assert.match(text, /END:VCARD$/);

  const matrix = encodeVCard({ firstName: 'Mario', lastName: 'Rossi' });
  const decoded = decodeQR(matrix).text;
  assert.equal(decoded, buildVCard({ firstName: 'Mario', lastName: 'Rossi' }));
});

test('vCard: requires at least a name or organization', () => {
  assert.throws(() => buildVCard({}), EncodeError);
});

test('vCard: parseVCard reverses buildVCard, decodeVCard round-trips through QR', () => {
  const fields = {
    firstName: 'Mario', lastName: 'Rossi, Jr;\\', organization: 'Sythos', title: 'CEO',
    phones: [{ number: '+391234567890', type: 'CELL' }, { number: '+390612345', type: 'WORK' }],
    emails: ['mario@example.com', 'mario2@example.com'],
    url: 'https://example.com',
    address: { type: 'WORK', street: 'Via Roma 1', city: 'Roma', state: 'RM', zip: '00100', country: 'IT' },
    note: 'line1\nline2',
  };
  const text = buildVCard(fields);
  assert.deepEqual(parseVCard(text), fields);

  const matrix = encodeVCard(fields);
  assert.deepEqual(decodeVCard(matrix), fields);
});

test('VIN: check digit matches a known-good reference VIN', () => {
  assert.equal(validateVIN('1M8GDM9AXKP042788'), true);
  assert.equal(vinCheckDigit('1M8GDM9A0KP042788'), 'X');
});

test('VIN: rejects I, O and Q, and wrong lengths', () => {
  assert.throws(() => vinCheckDigit('1M8GDM9AIKP042788'), EncodeError);
  assert.throws(() => vinCheckDigit('SHORT'), EncodeError);
});

test('VIN: encodes through Code 39 and round-trips via the scanline reader', () => {
  const vin = '1M8GDM9AXKP042788';
  const matrix = encodeVIN(vin);
  const results = decodeOneD(stretch(matrix), { formats: ['code39'] });
  assert.equal(results[0]?.text, vin);
});

test('VIN: computeCheckDigit inserts the correct digit at position 9', () => {
  const matrix = encodeVIN('1M8GDM9A0KP042788', { computeCheckDigit: true });
  const results = decodeOneD(stretch(matrix), { formats: ['code39'] });
  assert.equal(results[0]?.text, '1M8GDM9AXKP042788');
});

test('SPARQCode: every data type builds the expected public-convention payload', () => {
  assert.equal(buildSPARQCodePayload('url', { url: 'https://sythos.net/' }), 'https://sythos.net/');
  assert.equal(buildSPARQCodePayload('phone', { number: '+123' }), 'tel:+123');
  assert.equal(buildSPARQCodePayload('sms', { number: '+123', message: 'hi' }), 'sms:+123?body=hi');
  assert.equal(buildSPARQCodePayload('geo', { latitude: 45.1, longitude: 7.2 }), 'geo:45.1,7.2');
  assert.equal(
    buildSPARQCodePayload('email', { address: 'a@b.com', subject: 'Hi' }),
    'mailto:a@b.com?subject=Hi',
  );
  assert.equal(
    buildSPARQCodePayload('youtube', { videoId: 'abc123' }),
    'https://www.youtube.com/watch?v=abc123',
  );
  assert.equal(
    buildSPARQCodePayload('googleplay', { packageName: 'com.example.app' }),
    'https://play.google.com/store/apps/details?id=com.example.app',
  );
  assert.equal(
    buildSPARQCodePayload('wifi', { ssid: 'Guest;Net', password: 'p:w' }),
    'WIFI:T:WPA;S:Guest\\;Net;P:p\\:w;;',
  );
  assert.match(buildSPARQCodePayload('icalendar', {
    summary: 'Meet', start: new Date('2026-01-01T10:00:00Z'), end: new Date('2026-01-01T11:00:00Z'),
  }), /BEGIN:VCALENDAR\r\nVERSION:2\.0\r\nBEGIN:VEVENT\r\nSUMMARY:Meet\r\nDTSTART:20260101T100000Z\r\nDTEND:20260101T110000Z\r\nEND:VEVENT\r\nEND:VCALENDAR/);
});

test('SPARQCode: encodeSPARQCode round-trips through QR', () => {
  const matrix = encodeSPARQCode('url', { url: 'https://sythos.net/' });
  assert.equal(decodeQR(matrix).text, 'https://sythos.net/');
});

test('SPARQCode: parseSPARQCodePayload reverses each convention, decodeSPARQCode round-trips', () => {
  assert.deepEqual(parseSPARQCodePayload('https://sythos.net/'), { type: 'url', fields: { url: 'https://sythos.net/' } });
  assert.deepEqual(parseSPARQCodePayload('tel:+123'), { type: 'phone', fields: { number: '+123' } });
  assert.deepEqual(parseSPARQCodePayload('sms:+123?body=hi'), { type: 'sms', fields: { number: '+123', message: 'hi' } });
  assert.deepEqual(parseSPARQCodePayload('geo:45.1,7.2'), { type: 'geo', fields: { latitude: 45.1, longitude: 7.2 } });
  assert.deepEqual(
    parseSPARQCodePayload('mailto:a@b.com?subject=Hi'),
    { type: 'email', fields: { address: 'a@b.com', subject: 'Hi' } },
  );
  assert.deepEqual(
    parseSPARQCodePayload('https://www.youtube.com/watch?v=abc123'),
    { type: 'youtube', fields: { videoId: 'abc123' } },
  );
  assert.deepEqual(
    parseSPARQCodePayload('https://play.google.com/store/apps/details?id=com.example.app'),
    { type: 'googleplay', fields: { packageName: 'com.example.app' } },
  );
  assert.deepEqual(
    parseSPARQCodePayload('WIFI:T:WPA;S:Guest\\;Net;P:p\\:w;;'),
    { type: 'wifi', fields: { encryption: 'WPA', ssid: 'Guest;Net', password: 'p:w' } },
  );

  const icalPayload = buildSPARQCodePayload('icalendar', {
    summary: 'Meet', start: new Date('2026-01-01T10:00:00Z'), end: new Date('2026-01-01T11:00:00Z'),
  });
  assert.deepEqual(parseSPARQCodePayload(icalPayload), {
    type: 'icalendar',
    fields: { summary: 'Meet', start: new Date('2026-01-01T10:00:00Z'), end: new Date('2026-01-01T11:00:00Z') },
  });

  const bizPayload = buildSPARQCodePayload('bizcard', { firstName: 'Mario', lastName: 'Rossi' });
  assert.deepEqual(parseSPARQCodePayload(bizPayload), { type: 'bizcard', fields: { firstName: 'Mario', lastName: 'Rossi' } });

  const matrix = encodeSPARQCode('phone', { number: '+123' });
  assert.deepEqual(decodeSPARQCode(matrix), { type: 'phone', fields: { number: '+123' } });
});

test('Swiss QR-bill: Annex B check digit matches the specification\'s own worked example', () => {
  assert.equal(qrReferenceCheckDigit('21000000000313947143000901'), '7');
});

test('Swiss QR-bill: IBAN and QR-IBAN validation', () => {
  assert.equal(validateIBAN('CH9300762011623852957'), true);
  assert.equal(validateIBAN('CH0000000000000000000'), false);
  assert.equal(isQrIban('CH9300762011623852957'), false);
  assert.equal(isQrIban('CH4431999123000889012'), true);
});

test('Swiss QR-bill: builds the fixed 4.2.2 structure and round-trips through QR', () => {
  const text = buildSwissQR({
    iban: 'CH9300762011623852957',
    creditor: { name: 'Sythos SA', street: 'Musterstrasse', buildingNumber: '1', postalCode: '8000', city: 'Zurich', country: 'CH' },
    amount: 199.95,
    currency: 'CHF',
    referenceType: 'NON',
    unstructuredMessage: 'Test invoice',
  });
  const lines = text.split('\r\n');
  assert.deepEqual(lines.slice(0, 4), ['SPC', '0200', '1', 'CH9300762011623852957']);
  assert.deepEqual(lines.slice(4, 11), ['S', 'Sythos SA', 'Musterstrasse', '1', '8000', 'Zurich', 'CH']);
  assert.deepEqual(lines.slice(11, 18), ['', '', '', '', '', '', '']); // reserved Ultimate Creditor block
  assert.equal(lines[18], '199.95');
  assert.equal(lines[19], 'CHF');
  assert.deepEqual(lines.slice(20, 27), ['', '', '', '', '', '', '']); // no debtor
  assert.equal(lines[27], 'NON');
  assert.equal(lines[28], '');
  assert.equal(lines[29], 'Test invoice');
  assert.equal(lines[30], 'EPD');
  assert.equal(lines.length, 31); // trailing status-A elements (billing, AP1/AP2) all omitted

  const matrix = encodeSwissQR({
    iban: 'CH9300762011623852957',
    creditor: { name: 'Sythos SA', postalCode: '8000', city: 'Zurich', country: 'CH' },
    currency: 'CHF',
    referenceType: 'NON',
  });
  assert.match(decodeQR(matrix).text, /^SPC\r\n0200\r\n1\r\nCH9300762011623852957/);
});

test('Swiss QR-bill: QRR requires a QR-IBAN and appends a valid check digit', () => {
  assert.throws(() => buildSwissQR({
    iban: 'CH9300762011623852957', // not a QR-IBAN
    creditor: { name: 'X', postalCode: '1', city: 'Y', country: 'CH' },
    referenceType: 'QRR',
    reference: '21000000000313947143000901',
  }), EncodeError);

  const text = buildSwissQR({
    iban: 'CH4431999123000889012', // QR-IBAN
    creditor: { name: 'X', postalCode: '1', city: 'Y', country: 'CH' },
    referenceType: 'QRR',
    reference: '21000000000313947143000901',
  });
  const lines = text.split('\r\n');
  assert.equal(lines[27], 'QRR');
  assert.equal(lines[28], '210000000003139471430009017');
});

test('Swiss QR-bill: NON and SCOR reject a QR-IBAN', () => {
  const base = { iban: 'CH4431999123000889012', creditor: { name: 'X', postalCode: '1', city: 'Y', country: 'CH' } };
  assert.throws(() => buildSwissQR({ ...base, referenceType: 'NON' }), EncodeError);
  assert.throws(() => buildSwissQR({ ...base, referenceType: 'SCOR', reference: 'RF18539007547034' }), EncodeError);
});

test('Swiss QR-bill: parseSwissQR reverses buildSwissQR, decodeSwissQR round-trips', () => {
  const fields = {
    iban: 'CH9300762011623852957',
    creditor: { name: 'Sythos SA', street: 'Musterstrasse', buildingNumber: '1', postalCode: '8000', city: 'Zurich', country: 'CH' },
    amount: 199.95,
    currency: 'CHF',
    referenceType: 'NON',
    unstructuredMessage: 'Test invoice',
  };
  const text = buildSwissQR(fields);
  assert.deepEqual(parseSwissQR(text), fields);

  const matrix = encodeSwissQR(fields);
  assert.deepEqual(decodeSwissQR(matrix), fields);
});

test('Swiss QR-bill: parseSwissQR strips the QRR check digit and restores debtor, billing and AP lines', () => {
  const fields = {
    iban: 'CH4431999123000889012',
    creditor: { name: 'X', postalCode: '1', city: 'Y', country: 'CH' },
    debtor: { name: 'Debtor Name', street: 'Debtor Street', buildingNumber: '2', postalCode: '2000', city: 'Geneva', country: 'CH' },
    currency: 'CHF',
    referenceType: 'QRR',
    reference: '21000000000313947143000901',
    billingInformation: 'Billing info',
    alternativeProcedures: ['AP1 line', 'AP2 line'],
  };
  const text = buildSwissQR(fields);
  assert.deepEqual(parseSwissQR(text), fields);
});

test('SEPA QR: builds the EPC069-12 field order and omits trailing empty fields', () => {
  const text = buildSEPAQR({ name: 'Sythos SARL', iban: 'DE89370400440532013000', unstructuredReference: 'Invoice 42' });
  const lines = text.split('\n');
  assert.deepEqual(lines, ['BCD', '002', '1', 'SCT', '', 'Sythos SARL', 'DE89370400440532013000', '', '', '', 'Invoice 42']);
});

test('SEPA QR: version 001 requires a BIC', () => {
  assert.throws(() => buildSEPAQR({ version: '001', name: 'X', iban: 'DE89370400440532013000' }), EncodeError);
  const text = buildSEPAQR({ version: '001', bic: 'DEUTDEFF', name: 'X', iban: 'DE89370400440532013000' });
  assert.equal(text.split('\n')[4], 'DEUTDEFF');
});

test('SEPA QR: structured and unstructured references are mutually exclusive', () => {
  assert.throws(() => buildSEPAQR({
    name: 'X', iban: 'DE89370400440532013000',
    structuredReference: 'RF18539007547034', unstructuredReference: 'also this',
  }), EncodeError);
});

test('SEPA QR: round-trips through QR at error-correction level M', () => {
  const matrix = encodeSEPAQR({ name: 'Sythos SARL', iban: 'DE89370400440532013000' });
  assert.equal(decodeQR(matrix).text, 'BCD\n002\n1\nSCT\n\nSythos SARL\nDE89370400440532013000');
});

test('SEPA QR: parseSEPAQR reverses buildSEPAQR, decodeSEPAQR round-trips', () => {
  const fields = { name: 'Sythos SARL', iban: 'DE89370400440532013000', unstructuredReference: 'Invoice 42' };
  const text = buildSEPAQR(fields);
  assert.deepEqual(parseSEPAQR(text), { version: '002', ...fields });

  const matrix = encodeSEPAQR(fields);
  assert.deepEqual(decodeSEPAQR(matrix), { version: '002', ...fields });
});

test('SEPA QR: parseSEPAQR restores bic, amount, purpose and structuredReference', () => {
  const fields = {
    version: '001', bic: 'DEUTDEFF', name: 'Sythos SARL', iban: 'DE89370400440532013000',
    amount: 12.3, purpose: 'GDDS', structuredReference: 'RF18539007547034', beneficiaryInfo: 'Thanks',
  };
  const text = buildSEPAQR(fields);
  assert.deepEqual(parseSEPAQR(text), fields);
});

test('AAMVA: builds the fixed header, subfile designator and mandatory elements, round-trips through PDF417', () => {
  const fields = {
    iin: '999999', vehicleClass: 'D', restrictions: 'NONE', endorsements: 'NONE',
    expirationDate: '01012030', lastName: 'ROSSI', firstName: 'MARIO',
    issueDate: '01012024', dateOfBirth: '01011990', sex: '1', eyeColor: 'BRO', height: '178 cm',
    street1: 'VIA ROMA 1', city: 'ROMA', state: 'RM', postalCode: '00100',
    customerId: 'X1234567', documentDiscriminator: 'DOC0001', country: 'USA',
  };
  const text = buildAAMVA(fields);
  assert.equal(text.slice(0, 4), '@\n\x1e\r'); // Compliance Indicator, Data Element Separator, Record Separator, Segment Terminator
  assert.equal(text.slice(4, 21), 'ANSI 999999100001'); // File Type, IIN, AAMVA version, jurisdiction version, number of entries
  assert.equal(text.slice(21, 23), 'DL'); // subfile designator: subfile type
  assert.equal(text.slice(23, 27), '0031'); // subfile designator: offset (header 21 bytes + one 10-byte designator entry)
  assert.match(text, /DAQX1234567\n/);
  assert.match(text, /DCSROSSI\n/);
  assert.match(text, /DACMARIO\n/);
  assert.match(text, /DCGUSA\n/);
  assert.ok(text.endsWith('\r'));

  const matrix = encodeAAMVA(fields);
  const decoded = decodePDF417(matrix).text;
  assert.equal(decoded, text);
});

test('AAMVA: parseAAMVA reverses buildAAMVA, decodeAAMVA round-trips through PDF417', () => {
  const fields = {
    iin: '999999', vehicleClass: 'D', restrictions: 'NONE', endorsements: 'NONE',
    expirationDate: '01012030', lastName: 'ROSSI', firstName: 'MARIO',
    issueDate: '01012024', dateOfBirth: '01011990', sex: '1', eyeColor: 'BRO', height: '178 cm',
    street1: 'VIA ROMA 1', city: 'ROMA', state: 'RM', postalCode: '00100',
    customerId: 'X1234567', documentDiscriminator: 'DOC0001', country: 'USA',
  };
  const text = buildAAMVA(fields);
  const expected = {
    ...fields,
    aamvaVersion: '10', jurisdictionVersion: '00', documentType: 'DL',
    familyNameTruncation: 'N', firstNameTruncation: 'N', middleNameTruncation: 'N',
  };
  assert.deepEqual(parseAAMVA(text), expected);

  const matrix = encodeAAMVA(fields);
  assert.deepEqual(decodeAAMVA(matrix), expected);
});

test('AAMVA: parseAAMVA restores optional fields and drops the "NONE" middleName default', () => {
  const fields = {
    iin: '999999', vehicleClass: 'D', restrictions: 'NONE', endorsements: 'NONE',
    expirationDate: '01012030', lastName: 'ROSSI', firstName: 'MARIO', middleName: 'LUIGI',
    issueDate: '01012024', dateOfBirth: '01011990', sex: '1', eyeColor: 'BRO', height: '178 cm',
    street1: 'VIA ROMA 1', street2: 'APT 2', city: 'ROMA', state: 'RM', postalCode: '00100',
    customerId: 'X1234567', documentDiscriminator: 'DOC0001', country: 'USA',
    familyNameTruncation: 'N', firstNameTruncation: 'N', middleNameTruncation: 'N', suffix: 'JR',
  };
  const text = buildAAMVA(fields);
  assert.deepEqual(parseAAMVA(text), { ...fields, aamvaVersion: '10', jurisdictionVersion: '00', documentType: 'DL' });
});

test('AAMVA: rejects a malformed IIN and missing mandatory fields', () => {
  const base = {
    vehicleClass: 'D', restrictions: 'NONE', endorsements: 'NONE',
    expirationDate: '01012030', lastName: 'ROSSI', firstName: 'MARIO',
    issueDate: '01012024', dateOfBirth: '01011990', sex: '1', eyeColor: 'BRO', height: '178 cm',
    street1: 'VIA ROMA 1', city: 'ROMA', state: 'RM', postalCode: '00100',
    customerId: 'X1234567', documentDiscriminator: 'DOC0001', country: 'USA',
  };
  assert.throws(() => buildAAMVA({ ...base, iin: '12345' }), EncodeError);
  assert.throws(() => buildAAMVA({ ...base, iin: '999999', lastName: undefined }), EncodeError);
});
