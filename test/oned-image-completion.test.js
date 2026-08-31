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

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decode,
  decodeOneD,
  encode,
  encodeCode11,
  encodeMSI,
  encodeEAN2,
  encodeEAN5,
  encodeEAN13WithAddon,
  encodeEAN8WithAddon,
  encodeUPCAWithAddon,
  encodeUPCEWithAddon,
  encodeDataBar14,
  toImageData,
  listFormats,
} from '../src/index.js';

function imageOf(matrix, scale = 3) {
  return toImageData(matrix, { scale, margin: 6 });
}

function resultFor(image, formats, options = {}) {
  const found = decode(image, { formats, binarizer: 'global', ...options });
  assert.equal(found.length, 1, `expected one result, got ${JSON.stringify(found)}`);
  return found[0];
}

test('Code 11 image decoding validates checks and preserves hyphens', () => {
  const checked = resultFor(imageOf(encodeCode11('123-45', { checkDigit: true })), ['code11'], { checkDigit: true });
  assert.equal(checked.format, 'code11');
  assert.equal(checked.text, '123-45');

  const literal = resultFor(imageOf(encodeCode11('98-7', { checkDigit: false })), ['code11'], { checkDigit: false });
  assert.equal(literal.text, '98-7');
});

test('MSI/Plessey image decoding supports checked and unchecked payloads', () => {
  const checked = resultFor(imageOf(encodeMSI('12345', { checkDigit: true })), ['msi'], { checkDigit: true });
  assert.equal(checked.format, 'msi');
  assert.equal(checked.text, '12345');

  const single = resultFor(imageOf(encodeMSI('7')), ['msi']);
  assert.equal(single.text, '7');
});

test('EAN-2 and EAN-5 use parent-bound format selection semantics', () => {
  const ean13 = imageOf(encode('9781234567897', { format: 'ean13' }));
  const requestedParent = resultFor(ean13, ['ean13']);
  assert.equal(requestedParent.format, 'ean13');
  assert.equal(requestedParent.text, '9781234567897');
  assert.equal(requestedParent.addon, undefined);

  const parentWithSupplementsEnabled = resultFor(ean13, ['ean13', 'ean2', 'ean5']);
  assert.equal(parentWithSupplementsEnabled.format, 'ean13');
  assert.equal(parentWithSupplementsEnabled.text, '9781234567897');
  assert.equal(parentWithSupplementsEnabled.addon, undefined);

  const ean13WithTwo = imageOf(encodeEAN13WithAddon('9781234567897', '05'));
  const ean13WithFive = imageOf(encodeEAN13WithAddon('9781234567897', '52999'));
  const two = resultFor(ean13WithTwo, ['ean13', 'ean2', 'ean5']);
  assert.equal(two.format, 'ean13');
  assert.equal(two.text, '9781234567897');
  assert.equal(two.addon?.format, 'ean2');
  assert.equal(two.addon?.text, '05');
  const five = resultFor(ean13WithFive, ['ean13', 'ean2', 'ean5']);
  assert.equal(five.format, 'ean13');
  assert.equal(five.text, '9781234567897');
  assert.equal(five.addon?.format, 'ean5');
  assert.equal(five.addon?.text, '52999');

  const unrequestedTwo = resultFor(ean13WithTwo, ['ean13', 'ean5']);
  assert.equal(unrequestedTwo.format, 'ean13');
  assert.equal(unrequestedTwo.addon, undefined);
  const unrequestedFive = resultFor(ean13WithFive, ['ean13', 'ean2']);
  assert.equal(unrequestedFive.format, 'ean13');
  assert.equal(unrequestedFive.addon, undefined);

  assert.deepEqual(decode(ean13, { formats: ['ean2'], binarizer: 'global' }), []);
  assert.deepEqual(decode(ean13, { formats: ['ean5'], binarizer: 'global' }), []);
  const onlyTwo = resultFor(ean13WithTwo, ['ean2']);
  assert.equal(onlyTwo.format, 'ean13');
  assert.equal(onlyTwo.addon?.format, 'ean2');
  assert.equal(onlyTwo.addon?.text, '05');
  const onlyFive = resultFor(ean13WithFive, ['ean5']);
  assert.equal(onlyFive.format, 'ean13');
  assert.equal(onlyFive.addon?.format, 'ean5');
  assert.equal(onlyFive.addon?.text, '52999');

  assert.deepEqual(decode(imageOf(encodeEAN2('05')), { formats: ['ean2'], binarizer: 'global' }), []);
  assert.deepEqual(decode(imageOf(encodeEAN5('52999')), { formats: ['ean5'], binarizer: 'global' }), []);

  const readableFormats = listFormats().filter((format) => format.canRead).map((format) => format.id);
  const completeList = decode(ean13, { formats: readableFormats, binarizer: 'global' });
  assert.equal(completeList.length, 1, JSON.stringify(completeList));
  assert.equal(completeList[0].format, 'ean13');
  assert.equal(completeList[0].text, '9781234567897');
  assert.equal(completeList[0].addon, undefined);

  const malformed = encodeEAN13WithAddon('9781234567897', '52999').clone();
  for (let y = 0; y < malformed.height; y++) malformed.flip(105, y);
  const malformedResult = resultFor(imageOf(malformed), ['ean13', 'ean5']);
  assert.equal(malformedResult.format, 'ean13');
  assert.equal(malformedResult.text, '9781234567897');
  assert.equal(malformedResult.addon, undefined);
});

test('EAN-2 and EAN-5 remain attached to every supported EAN/UPC parent', () => {
  const parents = [
    ['ean13', (addon) => encodeEAN13WithAddon('9781234567897', addon)],
    ['ean8', (addon) => encodeEAN8WithAddon('96385074', addon)],
    ['upca', (addon) => encodeUPCAWithAddon('036000291452', addon)],
    ['upce', (addon) => encodeUPCEWithAddon('01234565', addon)],
  ];
  for (const [format, make] of parents) {
    const two = resultFor(imageOf(make('05')), [format, 'ean2']);
    assert.equal(two.format, format);
    assert.equal(two.addon.format, 'ean2');
    assert.equal(two.addon.text, '05');
    const five = resultFor(imageOf(make('52999')), [format, 'ean5']);
    assert.equal(five.format, format);
    assert.equal(five.addon.format, 'ean5');
    assert.equal(five.addon.text, '52999');

    const base = imageOf(encode({
      ean13: '9781234567897',
      ean8: '96385074',
      upca: '036000291452',
      upce: '01234565',
    }[format], { format }));
    const baseResult = resultFor(base, [format, 'ean2', 'ean5']);
    assert.equal(baseResult.format, format);
    assert.equal(baseResult.addon, undefined);
  }

  const isbnWithTwo = imageOf(encodeEAN13WithAddon('9780306406157', '05'));
  const isbnResult = resultFor(isbnWithTwo, ['isbn', 'ean2']);
  assert.equal(isbnResult.format, 'ean13');
  assert.equal(isbnResult.text, '9780306406157');
  assert.equal(isbnResult.addon?.format, 'ean2');
  assert.equal(isbnResult.addon?.text, '05');
});

test('GS1-128 preserves FNC1 and exposes parsed application identifiers', () => {
  const payload = '010950600013435210ABC' + String.fromCharCode(29) + '17250101';
  const result = resultFor(imageOf(encode(payload, { format: 'gs1128' })), ['gs1128']);
  assert.equal(result.format, 'gs1128');
  assert.equal(result.gs1, true);
  assert.equal(result.symbologyIdentifier, ']C1');
  assert.equal(result.elements.length, 3);
  assert.deepEqual(result.elements.map(({ ai, value }) => ({ ai, value })), [
    { ai: '01', value: '09506000134352' },
    { ai: '10', value: 'ABC' },
    { ai: '17', value: '250101' },
  ]);

  const ordinary = resultFor(imageOf(encode('ABC-123', { format: 'code128' })), ['code128']);
  assert.equal(ordinary.format, 'code128');
  assert.equal(ordinary.gs1, undefined);
});

test('GS1 DataBar-14 scanline decoding covers Omnidirectional and Truncated', () => {
  for (const variant of ['omnidirectional', 'truncated']) {
    const result = resultFor(
      imageOf(encodeDataBar14('00012345678905', { variant })),
      ['gs1databar14'],
    );
    assert.equal(result.format, 'gs1databar14');
    assert.equal(result.gtin, '00012345678905');
    assert.equal(result.gs1, true);
    assert.deepEqual(result.elements, [{ ai: '01', value: '00012345678905', fixed: true }]);
  }
});

test('new readers do not change the intentional Pharmacode capability', () => {
  const formats = Object.fromEntries(listFormats().map((entry) => [entry.id, entry]));
  assert.equal(formats.code11.canRead, true);
  assert.equal(formats.msi.canRead, true);
  assert.equal(formats.ean2.canRead, true);
  assert.equal(formats.ean5.canRead, true);
  assert.equal(formats.gs1databar14.canRead, true);
  assert.equal(formats.pharmacode.canRead, false);
});

test('malformed Code 11 and DataBar candidates are rejected', () => {
  const code11 = encodeCode11('12345', { checkDigit: true }).clone();
  code11.flip(Math.floor(code11.width / 2), 0);
  assert.deepEqual(decodeOneD(code11, { formats: ['code11'], checkDigit: true }), []);

  const databar = encodeDataBar14('00012345678905').clone();
  for (let y = 0; y < databar.height; y++) databar.flip(48, y);
  assert.deepEqual(decode(imageOf(databar), { formats: ['gs1databar14'], binarizer: 'global' }), []);
});

test('unrestricted decoding does not confuse the new readers with neighbours', () => {
  const cases = [
    ['code11', encodeCode11('1234567890')],
    ['msi', encodeMSI('123456789012')],
    ['ean8', encodeEAN8WithAddon('96385074', '52999')],
    ['gs1databar14', encodeDataBar14('00012345678905')],
  ];
  for (const [expected, matrix] of cases) {
    const results = decode(imageOf(matrix), { binarizer: 'global' });
    assert.equal(results.length, 1, `${expected}: ${JSON.stringify(results)}`);
    assert.equal(results[0].format, expected);
  }
});
