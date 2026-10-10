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

/**
 * QR Code tests.
 *
 * Two of these carry far more weight than the rest.
 *
 * `validateTables()` is the guard on the structural tables: it checks, for all
 * 160 version/level combinations, that the recalled error correction figures
 * agree with a capacity counted off the module grid. A table is the easiest
 * thing in a barcode library to get subtly wrong and the hardest to debug from
 * the outside, so it is checked against geometry rather than against itself.
 *
 * The "no corrections on a clean symbol" test guards a whole class of bug that
 * round-trips cannot see. Encoder and decoder share their layout code, so a
 * layout that is wrong *in the same way on both sides* still round-trips
 * perfectly — while shipping symbols that have already spent part of their
 * error correction budget before anyone photographs them. Asserting that a
 * freshly encoded symbol needs zero repairs is what makes that visible.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { BitMatrix } from '../src/js/core/bit-matrix.js';
import { BitWriter } from '../src/js/core/bit-buffer.js';
import { GF256_QR } from '../src/js/core/galois-field.js';
import { rsEncode } from '../src/js/core/reed-solomon.js';
import { EncodeError, FormatError } from '../src/js/core/errors.js';
import { LuminanceSource } from '../src/js/image/luminance.js';
import { binarize } from '../src/js/image/binarizer.js';
import {
  encodeQR,
  decodeQR,
  detectQR,
  detectAndDecodeQR,
  validateTables,
} from '../src/js/qr/index.js';
import {
  ECC_LEVELS,
  alignmentCoordinates,
  blockLayout,
  dataCodewords,
  dataModuleOrder,
  freeModuleCount,
  geometricTotalCodewords,
  maskBit,
  reservedModules,
  versionSize,
} from '../src/js/qr/tables.js';
import { sjisToThirteenBits } from '../src/js/qr/encoder.js';

/** Render a BitMatrix to RGBA at an integer scale, black on white. */
function toImageData(matrix, scale = 1) {
  const width = matrix.width * scale;
  const height = matrix.height * scale;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = matrix.get((x / scale) | 0, (y / scale) | 0) ? 0 : 255;
      const p = (y * width + x) * 4;
      data[p] = data[p + 1] = data[p + 2] = v;
      data[p + 3] = 255;
    }
  }
  return { data, width, height };
}

/* ------------------------------------------------------------------ *
 * Tables
 * ------------------------------------------------------------------ */

test('qr tables: every version and level satisfies the capacity identity', () => {
  const problems = validateTables();
  assert.deepEqual(
    problems,
    [],
    `validateTables() found ${problems.length} problem(s):\n  ${problems.join('\n  ')}`
  );
});

test('qr tables: geometric capacity matches the published totals', () => {
  // Spot checks across the range. These come from the specification's own
  // capacity table and are independent of how this library counts modules, so
  // they catch a systematic error in the geometry that self-consistency would
  // not.
  const expected = {
    1: 26, 2: 44, 3: 70, 6: 172, 7: 196, 13: 532, 14: 581,
    20: 1085, 21: 1156, 27: 1828, 28: 1921, 34: 2761, 35: 2876, 40: 3706,
  };
  for (const [version, total] of Object.entries(expected)) {
    assert.equal(
      geometricTotalCodewords(Number(version)), total,
      `version ${version} total codewords`
    );
  }
});

test('qr tables: placement order covers every free module exactly once', () => {
  // The regression guard for a layout bug that is invisible to round-trips:
  // encoder and decoder share this order, so skipping one module and visiting
  // another twice stays perfectly self-consistent while corrupting a codeword
  // in every symbol produced.
  for (let version = 1; version <= 40; version++) {
    const size = versionSize(version);
    const order = dataModuleOrder(version);
    const reserved = reservedModules(version);

    assert.equal(order.length, freeModuleCount(version) * 2, `v${version} order length`);

    const seen = new Uint8Array(size * size);
    for (let p = 0; p < order.length; p += 2) {
      const x = order[p];
      const y = order[p + 1];
      assert.ok(!reserved.get(x, y), `v${version} order includes function module (${x},${y})`);
      assert.equal(seen[y * size + x], 0, `v${version} order revisits module (${x},${y})`);
      seen[y * size + x] = 1;
    }
  }
});

test('qr tables: alignment coordinates are well formed', () => {
  assert.deepEqual(alignmentCoordinates(1), []);
  assert.deepEqual(alignmentCoordinates(2), [6, 18]);
  assert.deepEqual(alignmentCoordinates(7), [6, 22, 38]);
  assert.deepEqual(alignmentCoordinates(32), [6, 26, 54, 82, 110, 138]);
  assert.deepEqual(alignmentCoordinates(40), [6, 30, 58, 86, 114, 142, 170]);

  for (let version = 2; version <= 40; version++) {
    const coords = alignmentCoordinates(version);
    assert.equal(coords[0], 6, `v${version} first coordinate`);
    assert.equal(coords[coords.length - 1], versionSize(version) - 7, `v${version} last coordinate`);
  }
});

test('qr tables: block groups partition the data codewords', () => {
  for (let version = 1; version <= 40; version++) {
    for (const ecc of ECC_LEVELS) {
      const l = blockLayout(version, ecc);
      assert.equal(
        l.group1Blocks * l.group1DataCount + l.group2Blocks * l.group2DataCount,
        dataCodewords(version, ecc),
        `v${version}-${ecc} group split`
      );
      assert.equal(l.group2DataCount, l.group1DataCount + 1, `v${version}-${ecc} group step`);
    }
  }
});

/* ------------------------------------------------------------------ *
 * Symbol structure
 * ------------------------------------------------------------------ */

/** Assert a 7x7 finder pattern sits with its top-left corner at (ox, oy). */
function assertFinder(m, ox, oy, label) {
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      const ring = x === 0 || x === 6 || y === 0 || y === 6;
      const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
      assert.equal(
        m.get(ox + x, oy + y), ring || core,
        `${label} finder module (${x},${y})`
      );
    }
  }
}

test('qr encoder: symbol geometry', () => {
  for (const version of [1, 2, 7, 15, 26, 27, 40]) {
    const m = encodeQR('SYTHOS', { version, ecc: 'L' });
    const size = 17 + 4 * version;
    assert.equal(m.width, size, `v${version} width`);
    assert.equal(m.height, size, `v${version} height`);

    assertFinder(m, 0, 0, `v${version} top-left`);
    assertFinder(m, size - 7, 0, `v${version} top-right`);
    assertFinder(m, 0, size - 7, `v${version} bottom-left`);

    // The dark module is always set, and is the one module that carries no
    // information at all.
    assert.equal(m.get(8, size - 8), true, `v${version} dark module`);

    // Timing patterns alternate, starting dark on even coordinates.
    for (let i = 8; i < size - 8; i++) {
      assert.equal(m.get(i, 6), (i & 1) === 0, `v${version} horizontal timing at ${i}`);
      assert.equal(m.get(6, i), (i & 1) === 0, `v${version} vertical timing at ${i}`);
    }
  }
});

test('qr encoder: rejects bad options and oversized payloads', () => {
  assert.throws(() => encodeQR('x', { ecc: 'Z' }), EncodeError);
  assert.throws(() => encodeQR('x', { version: 0 }), EncodeError);
  assert.throws(() => encodeQR('x', { version: 41 }), EncodeError);
  assert.throws(() => encodeQR('x', { mask: 8 }), EncodeError);
  assert.throws(() => encodeQR('x'.repeat(50), { version: 1, ecc: 'H' }), EncodeError);
  // 2953 bytes is the absolute ceiling; comfortably past it nothing fits.
  assert.throws(() => encodeQR('x'.repeat(8000), { ecc: 'L' }), EncodeError);
});

/* ------------------------------------------------------------------ *
 * Round-trips
 * ------------------------------------------------------------------ */

const ROUND_TRIP_CASES = [
  ['numeric', '0123456789012345678901234567890123456789'],
  ['alphanumeric', 'SYTHOS BARCODE SUITE $25.00 / QR-CODE:2026'],
  ['byte', 'https://example.com/path?query=1&other=2#fragment'],
  ['accented latin-1', 'café naïve résumé über Größe'],
  ['utf-8 beyond latin-1', '日本語 — éàü ✓ €'],
  ['emoji', 'ship it 🚀🎉'],
  ['mixed modes', 'ORDER 12345 for café — total €42.50'],
  ['single character', 'X'],
  ['long text', 'The quick brown fox jumps over the lazy dog. '.repeat(20)],
];

test('qr: round-trips across every error correction level', () => {
  for (const [label, text] of ROUND_TRIP_CASES) {
    for (const ecc of ECC_LEVELS) {
      const m = encodeQR(text, { ecc });
      const r = decodeQR(m);
      assert.equal(r.text, text, `${label} at level ${ecc}`);
      assert.equal(r.ecc, ecc, `${label} reports level ${ecc}`);
      assert.ok(r.mask >= 0 && r.mask <= 7, `${label} mask in range`);
    }
  }
});

test('qr: round-trips at every version', () => {
  // Fill each symbol to roughly 90% of capacity so block splitting, padding and
  // the remainder bits are all exercised rather than just the easy first block.
  for (let version = 1; version <= 40; version++) {
    for (const ecc of ECC_LEVELS) {
      const capacity = dataCodewords(version, ecc);
      const text = 'AB1234-9/X'
        .repeat(Math.max(1, Math.ceil(capacity / 10)))
        .slice(0, Math.max(1, Math.floor(capacity * 0.9)));

      const m = encodeQR(text, { ecc, version });
      assert.equal(m.width, 17 + 4 * version, `v${version}-${ecc} dimension`);

      const r = decodeQR(m);
      assert.equal(r.text, text, `v${version}-${ecc} payload`);
      assert.equal(r.version, version, `v${version}-${ecc} version`);
      assert.equal(r.ecc, ecc, `v${version}-${ecc} level`);
    }
  }
});

test('qr: a clean symbol needs zero error corrections', () => {
  // The check that catches a layout that is self-consistently wrong. A symbol
  // straight out of the encoder must arrive at the decoder with its entire
  // correction budget intact; anything else is capacity silently spent before
  // the symbol has even been printed.
  for (let version = 1; version <= 40; version++) {
    for (const ecc of ECC_LEVELS) {
      const capacity = dataCodewords(version, ecc);
      const text = 'SYTHOS-2026/'
        .repeat(Math.max(1, Math.ceil(capacity / 12)))
        .slice(0, Math.max(1, Math.floor(capacity * 0.85)));

      const r = decodeQR(encodeQR(text, { ecc, version }));
      assert.equal(
        r.corrections, 0,
        `v${version}-${ecc} needed ${r.corrections} correction(s) on a pristine symbol`
      );
    }
  }
});

test('qr: version 7 and up carries readable version information', () => {
  // Versions below 7 have no version information block, so this is the path
  // that only larger symbols exercise.
  for (const version of [7, 8, 13, 14, 20, 21, 26, 27, 33, 40]) {
    const m = encodeQR('VERSION INFO TEST 0123456789', { version, ecc: 'L' });
    const r = decodeQR(m);
    assert.equal(r.version, version, `v${version} round-trip`);

    // Corrupting the dimension is not possible without changing the version, so
    // instead confirm the block is actually present and non-trivial.
    const size = versionSize(version);
    let dark = 0;
    for (let i = 0; i < 18; i++) {
      const major = Math.floor(i / 3);
      const minor = i % 3;
      if (m.get(major, size - 11 + minor)) dark++;
    }
    assert.ok(dark > 0 && dark < 18, `v${version} version information block is not uniform`);
  }
});

test('qr: version selection crosses the count-indicator boundaries', () => {
  // Character count fields widen at versions 10 and 27. A payload that lands
  // near a boundary is where an off-by-one in that logic shows up.
  for (const version of [9, 10, 11, 25, 26, 27, 28]) {
    for (const ecc of ECC_LEVELS) {
      for (const alphabet of ['0123456789', 'ABCDEFGHIJ', 'abcdefghij']) {
        const capacity = dataCodewords(version, ecc);
        const text = alphabet.repeat(Math.ceil(capacity / 4)).slice(0, Math.floor(capacity * 0.8));
        const r = decodeQR(encodeQR(text, { ecc, version }));
        assert.equal(r.text, text, `v${version}-${ecc} ${alphabet[0]}`);
        assert.equal(r.corrections, 0, `v${version}-${ecc} ${alphabet[0]} corrections`);
      }
    }
  }
});

test('qr: every mask can be forced and read back', () => {
  for (let mask = 0; mask < 8; mask++) {
    const r = decodeQR(encodeQR('MASK TEST 42', { mask, ecc: 'Q' }));
    assert.equal(r.mask, mask, `mask ${mask}`);
    assert.equal(r.text, 'MASK TEST 42');
    assert.equal(r.corrections, 0);
  }
});

test('qr: byte-mode payload is exposed as raw bytes', () => {
  // Lower case is outside the alphanumeric set, so this is genuinely byte mode
  // rather than the cheaper alphanumeric one.
  const r = decodeQR(encodeQR('ab', { ecc: 'L', charset: 'iso-8859-1' }));
  assert.deepEqual(Array.from(r.bytes), [0x61, 0x62]);

  // A payload with no byte segment reports no bytes.
  assert.equal(decodeQR(encodeQR('12345', { ecc: 'L' })).bytes.length, 0);
});

test('qr: Latin-1 and UTF-8 byte text preserve the selected encoding', () => {
  const texts = ['Ã©', 'Â£', 'café', '\u0080\u0091\u009f', 'ascii text'];
  for (const text of texts) {
    for (const charset of ['auto', 'iso-8859-1', 'utf-8']) {
      const symbol = encodeQR(text, { charset, kanji: false });
      const result = decodeQR(symbol);
      assert.equal(result.text, text);
      const expected = charset === 'utf-8' ? [...new TextEncoder().encode(text)]
        : Array.from(text, (point) => point.charCodeAt(0));
      assert.deepEqual([...result.bytes], expected);
      assert.equal(decodeQR(symbol, { charset: 'iso-8859-1' }).text, text);
      assert.equal(decodeQR(symbol, { charset: 'utf-8' }).text, text);
    }
  }
  assert.equal(decodeQR(encodeQR('Greetings 👋', { charset: 'utf-8' })).text, 'Greetings 👋');
  assert.throws(() => encodeQR('👋', { charset: 'iso-8859-1' }), EncodeError);
});

test('qr: every Latin-1 byte preserves its exact code point', () => {
  for (let value = 0; value <= 255; value++) {
    const text = 'a' + String.fromCharCode(value) + 'a';
    const result = decodeQR(encodeQR(text, { charset: 'iso-8859-1', kanji: false }));
    assert.equal(result.text, text, `Latin-1 byte ${value}`);
    assert.deepEqual([...result.bytes], [97, value, 97]);
  }
});

test('qr: ECI overhead is included in version selection', () => {
  const text = 'é'.repeat(17);
  assert.equal(decodeQR(encodeQR(text, { ecc: 'L', kanji: false })).version, 2);
  assert.throws(() => encodeQR(text, { ecc: 'L', version: 1, kanji: false }), EncodeError);
  assert.equal(encodeQR('a'.repeat(17), { ecc: 'L', version: 1 }).width, 21);
});

test('qr: ECI cost does not exclude a smaller alphanumeric and Kanji path', () => {
  const text = 'AAAAAAAAA§AAAAAAAAA';
  for (const charset of ['auto', 'iso-8859-1', 'utf-8']) {
    for (let mask = 0; mask < 8; mask++) {
      const result = decodeQR(encodeQR(text, { charset, version: 1, ecc: 'L', mask }));
      assert.equal(result.text, text);
      assert.equal(result.version, 1);
      assert.equal(result.corrections, 0);
      assert.equal(result.bytes.length, 0);
    }
    assert.equal(encodeQR(text, { charset, ecc: 'L' }).width, 21);
  }
  assert.throws(() => encodeQR(text, { charset: 'iso-8859-1', kanji: false, version: 1, ecc: 'L' }), EncodeError);
  const byteResult = decodeQR(encodeQR(text, { charset: 'iso-8859-1', kanji: false, ecc: 'L' }));
  assert.equal(byteResult.text, text);
  assert.equal(byteResult.version, 2);
});

test('qr: no-ECI compatibility is explicit and does not change raw bytes', () => {
  // Fixed no-ECI symbol from the pre-fix writer: byte payload C3 A9, V1-L, mask 0.
  const rows = [
    '111111100010101111111', '100000100000101000001', '101110101010001011101',
    '101110100000101011101', '101110100101101011101', '100000100111001000001',
    '111111101010101111111', '000000001010000000000', '111011111010111000100',
    '100100011101010101111', '101100101111011101100', '000010011001110111001',
    '110100100111011100101', '000000001100001000110', '111111101110100010010',
    '100000101100001000111', '101110101010101010101', '101110100011010101010',
    '101110101011011101101', '100000101011110111010', '111111101101011101111',
  ];
  const symbol = new BitMatrix(21, 21);
  rows.forEach((row, y) => [...row].forEach((bit, x) => { if (bit === '1') symbol.set(x, y); }));
  for (const [charset, text] of [['auto', 'é'], ['utf-8', 'é'], ['iso-8859-1', 'Ã©']]) {
    const result = decodeQR(symbol, { charset });
    assert.equal(result.text, text);
    assert.deepEqual([...result.bytes], [195, 169]);
  }
  assert.equal(decodeQR(symbol).text, 'é');
  assert.throws(() => decodeQR(symbol, { charset: 'unknown' }), FormatError);

  // Rebuild the data and parity only. Keep the fixed V1-L, mask-0 function grid.
  function byteFixture(bytes, eci = null) {
    const writer = new BitWriter();
    if (eci !== null) { writer.put(7, 4); writer.put(eci, 8); }
    writer.put(4, 4);
    writer.put(bytes.length, 8);
    writer.putBytes(Uint8Array.from(bytes));
    writer.put(0, 4);
    writer.padToByte();
    const raw = writer.toBytes();
    const data = new Uint8Array(19);
    data.set(raw);
    for (let i = raw.length; i < data.length; i++) data[i] = (i - raw.length) % 2 ? 0x11 : 0xec;
    const codewords = [...data, ...rsEncode(data, 7, GF256_QR)];
    const fixture = symbol.clone();
    const order = dataModuleOrder(1);
    for (let bit = 0; bit < codewords.length * 8; bit++) {
      const x = order[bit * 2], y = order[bit * 2 + 1];
      const dark = Boolean((codewords[bit >> 3] >> (7 - (bit & 7))) & 1);
      fixture.setValue(x, y, dark !== maskBit(0, x, y));
    }
    return fixture;
  }
  const invalidUtf8 = byteFixture([255, 169]);
  assert.equal(decodeQR(invalidUtf8).text, 'ÿ©');
  assert.throws(() => decodeQR(invalidUtf8, { charset: 'utf-8' }), FormatError);
  for (const [eci, text] of [[3, 'Ã©'], [26, 'é'], [31, 'Ã©']]) {
    const result = decodeQR(byteFixture([195, 169], eci));
    assert.equal(result.text, text);
    assert.deepEqual([...result.bytes], [195, 169]);
  }
});

function fnc1Fixture(parts, position = 'first', applicationIndicator = 0) {
  const writer = new BitWriter();
  if (position === 'first') writer.put(5, 4);
  if (position === 'second') { writer.put(9, 4); writer.put(applicationIndicator, 8); }
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
  for (const { mode, text } of parts) {
    if (mode === 'eci') { writer.put(7, 4); writer.put(Number(text), 8); continue; }
    if (mode === 'byte') {
      writer.put(4, 4);
      writer.put(text.length, 8);
      writer.putBytes(Uint8Array.from(text, (char) => char.charCodeAt(0)));
    } else if (mode === 'numeric') {
      writer.put(1, 4);
      writer.put(text.length, 10);
      for (let i = 0; i < text.length; i += 3) {
        const group = text.slice(i, i + 3);
        writer.put(Number(group), group.length === 3 ? 10 : group.length === 2 ? 7 : 4);
      }
    } else {
      writer.put(2, 4);
      writer.put(text.length, 9);
      for (let i = 0; i < text.length; i += 2) {
        const first = alphabet.indexOf(text[i]);
        if (i + 1 < text.length) writer.put(first * 45 + alphabet.indexOf(text[i + 1]), 11);
        else writer.put(first, 6);
      }
    }
  }
  assert.ok(writer.length <= 268, 'fixture must leave four terminator bits');
  writer.put(0, 4);
  writer.padToByte();
  const raw = writer.toBytes();
  // V2-L has one block: 34 data codewords and 10 error-correction codewords.
  const data = new Uint8Array(34);
  data.set(raw);
  for (let i = raw.length; i < data.length; i++) data[i] = (i - raw.length) % 2 ? 0x11 : 0xec;
  const codewords = [...data, ...rsEncode(data, 10, GF256_QR)];
  const matrix = encodeQR('FIXTURE', { version: 2, ecc: 'L', mask: 0 });
  const order = dataModuleOrder(2);
  for (let bit = 0; bit < order.length / 2; bit++) {
    const x = order[bit * 2], y = order[bit * 2 + 1];
    const dark = bit < codewords.length * 8 && Boolean((codewords[bit >> 3] >> (7 - (bit & 7))) & 1);
    matrix.setValue(x, y, dark !== maskBit(0, x, y));
  }
  return matrix;
}

test('qr: FNC1 interprets only alphanumeric percent escapes', () => {
  for (const position of ['first', 'second']) {
    for (const [input, expected] of [
      ['ABC%DEF', 'ABC\x1dDEF'], ['%', '\x1d'], ['%%', '%'],
      ['%%%', '%\x1d'], ['%%%%', '%%'], ['%%%%%', '%%\x1d'],
      ['%A%', '\x1dA\x1d'], ['A%%B%C', 'A%B\x1dC'],
    ]) {
      const result = decodeQR(fnc1Fixture([{ mode: 'alphanumeric', text: input }], position, 165));
      assert.equal(result.text, expected, `${position}: ${input}`);
      assert.equal(result.corrections, 0);
      assert.equal(result.bytes.length, 0);
      assert.equal(decodeQR(fnc1Fixture([{ mode: 'alphanumeric', text: input }], 'none')).text, input);
    }
  }
});

test('qr: FNC1 state persists across modes but percent pairs stay within segments', () => {
  for (const position of ['first', 'second']) {
    const split = decodeQR(fnc1Fixture([
      { mode: 'alphanumeric', text: 'A%' },
      { mode: 'alphanumeric', text: '%B' },
    ], position));
    assert.equal(split.text, 'A\x1d\x1dB');
    const mixed = decodeQR(fnc1Fixture([
      { mode: 'alphanumeric', text: 'ABC%' },
      { mode: 'eci', text: '3' },
      { mode: 'byte', text: '%\x1d' },
      { mode: 'numeric', text: '123' },
      { mode: 'alphanumeric', text: '%%Z%' },
    ], position));
    assert.equal(mixed.text, 'ABC\x1d%\x1d123%Z\x1d');
    assert.deepEqual([...mixed.bytes], [37, 29]);
    assert.equal(mixed.corrections, 0);
  }
});

test('qr: FNC1 second-position application indicator is consumed, not payload text', () => {
  for (const indicator of [0, 1, 99, 165, 255]) {
    const matrix = fnc1Fixture([{ mode: 'alphanumeric', text: 'ABC%DEF' }], 'second', indicator);
    assert.equal(decodeQR(matrix).text, 'ABC\x1dDEF');
  }
  const ordinary = decodeQR(encodeQR('ABC%DEF%%'));
  assert.equal(ordinary.text, 'ABC%DEF%%');
});

test('qr: FNC1 separators survive detector and browser bundle paths', async () => {
  const esm = await import('../bundle/sythos-barcode.esm.js');
  await import('../bundle/sythos-barcode.js');
  for (const position of ['first', 'second']) {
    const matrix = fnc1Fixture([{ mode: 'alphanumeric', text: 'ABC%DEF%%' }], position, 165);
    const image = toImageData(matrix.withMargin(4), 4);
    const found = detectAndDecodeQR(binarize(LuminanceSource.fromImageData(image)));
    assert.equal(found[0]?.text, 'ABC\x1dDEF%');
    for (const sdk of [esm, globalThis.SythosBarcode]) {
      assert.equal(sdk.decodeQR(matrix).text, 'ABC\x1dDEF%');
      assert.equal(sdk.decode(image, { formats: ['qr'] })[0]?.text, 'ABC\x1dDEF%');
    }
  }
});

test('qr: shift_jis 13-bit packing round-trips across both ranges', () => {
  // The two Shift_JIS ranges use different offsets, and the boundary between
  // them is the easy thing to fumble.
  let checked = 0;
  for (const [lo, hi] of [[0x8140, 0x9ffc], [0xe040, 0xebbf]]) {
    for (let sjis = lo; sjis <= hi; sjis++) {
      const packed = sjisToThirteenBits(sjis);
      if (packed < 0) continue;
      assert.ok(packed >= 0 && packed <= 0x1fff, `${sjis.toString(16)} packs into 13 bits`);
      const combined = (Math.floor(packed / 0xc0) << 8) | (packed % 0xc0);
      const back = combined + (combined + 0x8140 <= 0x9ffc ? 0x8140 : 0xc140);
      assert.equal(back, sjis, `0x${sjis.toString(16)} round-trip`);
      checked++;
    }
  }
  // Assert the exact count rather than a round threshold, because the exact
  // count is derivable and a threshold is not: a valid Shift_JIS trail byte is
  // 0x40-0x7E or 0x80-0xFC, which is 188 values per lead byte.
  //
  //   0x8140-0x9FFC : leads 0x81-0x9F, 31 x 188                    = 5828
  //   0xE040-0xEBBF : leads 0xE0-0xEA, 11 x 188                    = 2068
  //                   lead 0xEB, trails 0x40-0x7E and 0x80-0xBF    =  127
  //                                                          total = 8023
  //
  // Pinning it means a packing change that silently starts rejecting valid
  // codes fails here, which a "more than 9000" style bound would not catch.
  assert.equal(checked, 8023, `expected every valid code to be covered, checked ${checked}`);
});

/* ------------------------------------------------------------------ *
 * Error correction
 * ------------------------------------------------------------------ */

test('qr: damaged symbols still decode within the correction capacity', () => {
  const text = 'ERROR CORRECTION TEST 1234567890 SYTHOS';

  for (const ecc of ['Q', 'H']) {
    const clean = encodeQR(text, { ecc, version: 5 });
    const damaged = clean.clone();
    const size = damaged.width;

    // A contiguous scratch across the data region. Interleaving is what makes
    // this survivable: consecutive modules belong to different blocks, so the
    // damage arrives as a couple of errors per block rather than a burst that
    // overwhelms one of them.
    let flipped = 0;
    for (let y = 12; y < 16; y++) {
      for (let x = 10; x < 18; x++) {
        if (x === 6 || y === 6) continue;          // timing
        if (x >= size - 9 && y >= size - 9) continue; // alignment
        damaged.flip(x, y);
        flipped++;
      }
    }
    assert.ok(flipped > 20, 'the test should actually damage the symbol');

    const r = decodeQR(damaged);
    assert.equal(r.text, text, `level ${ecc} recovered the payload`);
    assert.ok(r.corrections > 0, `level ${ecc} reported repairs (got ${r.corrections})`);
  }
});

test('qr: a symbol damaged past capacity is rejected, not silently wrong', () => {
  const clean = encodeQR('SHORT', { ecc: 'L', version: 1 });
  const wrecked = clean.clone();
  // Obliterate most of the data region. Reporting a checksum failure is the
  // only honest outcome; returning plausible-looking text would be worse than
  // returning nothing.
  for (let y = 9; y < 21; y++) {
    for (let x = 0; x < 21; x++) {
      if (x === 6 || y === 6) continue;
      if (x < 9 && y > 12) continue;
      wrecked.flip(x, y);
    }
  }
  assert.throws(() => decodeQR(wrecked));
});

test('qr decoder: rejects malformed matrices', () => {
  assert.throws(() => decodeQR(new BitMatrix(20, 20)));       // not 17 + 4v
  assert.throws(() => decodeQR(new BitMatrix(21, 25)));       // not square
  assert.throws(() => decodeQR(BitMatrix.parse('1 1\n 1 \n1 1'))); // far too small
});

/* ------------------------------------------------------------------ *
 * Full image pipeline
 * ------------------------------------------------------------------ */

test('qr pipeline: encode, render, binarize, detect and decode', () => {
  const cases = [
    'HELLO WORLD',
    'https://sythos.net/barcode',
    '86753098675309',
    'café — €12,50',
    'The quick brown fox jumps over the lazy dog. '.repeat(6),
  ];

  for (const text of cases) {
    for (const ecc of ECC_LEVELS) {
      for (const scale of [3, 5]) {
        const symbol = encodeQR(text, { ecc });
        // The quiet zone is not optional: the row scanner measures the light
        // run either side of a finder, and cannot do that at the image edge.
        const image = toImageData(symbol.withMargin(4), scale);
        const bits = binarize(LuminanceSource.fromImageData(image));

        const found = detectAndDecodeQR(bits);
        const tag = `"${text.slice(0, 20)}" ${ecc} x${scale}`;
        assert.equal(found.length, 1, `${tag}: expected exactly one symbol`);
        assert.equal(found[0].text, text, `${tag}: payload`);
        assert.equal(found[0].version, (symbol.width - 17) / 4, `${tag}: version`);
        assert.equal(found[0].corrections, 0, `${tag}: sampled cleanly`);
        assert.equal(found[0].corners.length, 4, `${tag}: four corners`);
      }
    }
  }
});

test('qr pipeline: detector reports geometry before decoding', () => {
  const symbol = encodeQR('DETECTOR GEOMETRY', { ecc: 'M', version: 4 });
  const scale = 4;
  const margin = 4;
  const image = toImageData(symbol.withMargin(margin), scale);
  const bits = binarize(LuminanceSource.fromImageData(image));

  const detections = detectQR(bits);
  assert.ok(detections.length >= 1, 'found at least one candidate');

  const d = detections[0];
  assert.equal(d.dimension, symbol.width, 'dimension in modules');
  assert.equal(d.version, 4, 'version');
  assert.ok(Math.abs(d.moduleSize - scale) < 1, `module size ${d.moduleSize} near ${scale}`);

  // Corners should land on the symbol's outer bounds, within a module.
  const expected = [
    [margin * scale, margin * scale],
    [(margin + symbol.width) * scale, margin * scale],
    [(margin + symbol.width) * scale, (margin + symbol.height) * scale],
    [margin * scale, (margin + symbol.height) * scale],
  ];
  for (let i = 0; i < 4; i++) {
    assert.ok(
      Math.hypot(d.corners[i].x - expected[i][0], d.corners[i].y - expected[i][1]) < scale * 1.5,
      `corner ${i} at (${d.corners[i].x.toFixed(1)}, ${d.corners[i].y.toFixed(1)}), ` +
      `expected near (${expected[i][0]}, ${expected[i][1]})`
    );
  }
});

test('qr pipeline: an upside-down symbol still decodes', () => {
  const text = 'ROTATED ONE EIGHTY';
  const symbol = encodeQR(text, { ecc: 'M' });
  const flipped = symbol.withMargin(4);
  flipped.rotate180();

  const bits = binarize(LuminanceSource.fromImageData(toImageData(flipped, 4)));
  const found = detectAndDecodeQR(bits);
  assert.equal(found.length, 1);
  assert.equal(found[0].text, text);
});

test('qr pipeline: an image with no symbol yields no results', () => {
  const blank = new BitMatrix(120, 120);
  assert.deepEqual(detectAndDecodeQR(blank), []);

  // A few stripes are not a QR code either.
  const stripes = new BitMatrix(120, 120);
  for (let y = 0; y < 120; y += 4) stripes.setRegion(0, y, 120, 2);
  assert.deepEqual(detectAndDecodeQR(stripes), []);
});
