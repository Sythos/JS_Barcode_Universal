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

import { EncodeError, FormatError } from '../src/js/core/errors.js';
import { encodeEAN13 } from '../src/js/oned/writers.js';
import {
  EAN2_PARITY,
  EAN5_PARITY,
  EAN_ADDON_SEPARATOR,
  EAN_ADDON_START,
  composeEANAddon,
  decodeEAN2,
  decodeEAN5,
  decodeEANAddon,
  ean2Parity,
  ean5CheckDigit,
  ean5Checksum,
  ean5Parity,
  encodeEAN2,
  encodeEANAddon,
  encodeEAN5,
  encodeEAN13WithAddon,
} from '../src/js/oned/addons.js';

test('EAN-2 parity and module geometry follow the four modulo rows', () => {
  assert.deepEqual(EAN2_PARITY, ['AA', 'AB', 'BA', 'BB']);
  for (let value = 0; value < 100; value++) {
    const text = String(value).padStart(2, '0');
    const matrix = encodeEAN2(text);
    assert.equal(matrix.width, 20);
    assert.equal(matrix.height, 1);
    assert.equal(ean2Parity(text), EAN2_PARITY[value % 4]);
    assert.equal(matrix.eanAddon.text, text);
    assert.equal(matrix.eanAddon.parity, ean2Parity(text));
    assert.equal(decodeEAN2(matrix).text, text);
  }
});

test('EAN-5 checksum and parity rows round-trip all boundary samples', () => {
  assert.deepEqual(EAN5_PARITY, [
    'BBAAA', 'BABAA', 'BAABA', 'BAAAB', 'ABBAA',
    'AABBA', 'AAABB', 'ABABA', 'ABAAB', 'AABAB',
  ]);
  const samples = ['00000', '51234', '12345', '99990', '99991', '90200'];
  for (const text of samples) {
    const matrix = encodeEAN5(text);
    const checksum = ean5Checksum(text);
    assert.equal(matrix.width, 47);
    assert.equal(matrix.height, 1);
    assert.equal(ean5Parity(text), EAN5_PARITY[checksum]);
    assert.equal(matrix.eanAddon.checksum, checksum);
    assert.deepEqual(decodeEAN5(matrix), {
      format: 'ean5', text, parity: ean5Parity(text), checksum,
    });
  }
});

test('EAN-5 checksum uses the 3/9 weighting rule', () => {
  assert.equal(ean5Checksum('51234'), 9);
  assert.equal(ean5CheckDigit('51234'), 9);
  assert.equal(ean5Checksum('00000'), 0);
  assert.equal(ean5Checksum('99999'), 3);
});

test('generic add-on encoder dispatches only the two standard lengths', () => {
  assert.equal(encodeEANAddon('12').width, 20);
  assert.equal(encodeEANAddon('51234').width, 47);
  assert.throws(() => encodeEANAddon('123'), EncodeError);
});

test('supplement guards, separators and invalid payloads are rejected', () => {
  const two = encodeEAN2('12');
  const five = encodeEAN5('51234');
  assert.equal(two.toString('1', '0').slice(0, 4), EAN_ADDON_START);
  assert.equal(five.toString('1', '0').slice(0, 4), EAN_ADDON_START);
  assert.ok(five.toString('1', '0').includes(EAN_ADDON_SEPARATOR));
  assert.throws(() => encodeEAN2('1'), EncodeError);
  assert.throws(() => encodeEAN2('ab'), EncodeError);
  assert.throws(() => encodeEAN5('1234'), EncodeError);
  assert.throws(() => encodeEAN5('1234a'), EncodeError);
  assert.throws(() => ean5Checksum('12'), EncodeError);
  assert.throws(() => decodeEAN2(five), FormatError);
  assert.throws(() => decodeEAN5(two), FormatError);
});

test('EAN add-on decoder accepts a composed EAN/UPC row without altering the base', () => {
  const base = encodeEAN13('5901234123457');
  const addon = encodeEAN5('51234');
  const composed = composeEANAddon(base, addon);

  assert.equal(composed.width, base.width + 9 + addon.width);
  assert.equal(composed.height, 1);
  assert.equal(base.width, 95);
  assert.deepEqual(decodeEAN5(composed), decodeEAN5(addon));
  assert.deepEqual(decodeEANAddon(composed), decodeEAN5(addon));
});

test('EAN base convenience wrapper composes either supplement length', () => {
  const two = encodeEAN13WithAddon('5901234123457', '12', { gap: 7 });
  const five = encodeEAN13WithAddon('5901234123457', '51234');
  assert.equal(two.width, 95 + 7 + 20);
  assert.equal(five.width, 95 + 9 + 47);
  assert.equal(decodeEAN2(two).text, '12');
  assert.equal(decodeEAN5(five).text, '51234');
  assert.equal(two.eanAddon.gap, 7);
  assert.throws(() => composeEANAddon(encodeEAN13('5901234123457'), '12', { gap: 0 }), EncodeError);
});
