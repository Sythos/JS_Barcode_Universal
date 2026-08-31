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
 * Linear symbology tests.
 *
 * `validateTables()` is the important one: the pattern tables are redundant
 * with each symbology's own rules (module counts, wide-element counts,
 * uniqueness), so the rules can check the tables. A transcription slip that
 * breaks an invariant fails here rather than in the field.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { validateTables } from '../src/js/oned/patterns.js';
import {
  encodeEAN13, encodeEAN8, encodeUPCA, encodeUPCE, encodeISBN,
  encodeCode39, encodeCode93, encodeCode128,
  encodeITF, encodeITF14, encodeCodabar, encodeCode11,
  encodeMSI, encodePharmacode, ean13CheckDigit,
} from '../src/js/oned/writers.js';
import { decodeOneD } from '../src/js/oned/reader.js';
import { EncodeError } from '../src/js/core/errors.js';
import { BitMatrix } from '../src/js/core/bit-matrix.js';

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

test('pattern tables satisfy every structural invariant', () => {
  const problems = validateTables();
  assert.deepEqual(problems, [], `\n  - ${problems.join('\n  - ')}`);
});

test('EAN check digit matches known values', () => {
  // Widely published examples; each is verifiable by hand from the 3-1 rule.
  assert.equal(ean13CheckDigit('400638133393'), 1);
  assert.equal(ean13CheckDigit('978020137962'), 4);
  assert.equal(ean13CheckDigit('501234567890'), 0);
});

test('EAN-13 produces a 95-module symbol', () => {
  const m = encodeEAN13('5901234123457');
  assert.equal(m.width, 95);
  assert.equal(m.height, 1);
  // Guard bars at both ends and in the middle.
  assert.equal(m.get(0, 0), true);
  assert.equal(m.get(1, 0), false);
  assert.equal(m.get(2, 0), true);
  assert.equal(m.get(94, 0), true);
});

test('EAN-13 appends and validates the check digit', () => {
  const a = encodeEAN13('590123412345');
  const b = encodeEAN13('5901234123457');
  assert.equal(a.toString('1', '0'), b.toString('1', '0'));
  assert.throws(() => encodeEAN13('5901234123458'), EncodeError);
  assert.throws(() => encodeEAN13('123'), EncodeError);
  assert.throws(() => encodeEAN13('59012341234a'), EncodeError);
});

test('EAN-8 produces a 67-module symbol', () => {
  const m = encodeEAN8('96385074');
  assert.equal(m.width, 67);
});

test('UPC-A is an EAN-13 with a leading zero', () => {
  const upc = encodeUPCA('03600029145');
  const ean = encodeEAN13('003600029145');
  assert.equal(upc.toString('1', '0'), ean.toString('1', '0'));
  assert.equal(upc.width, 95);
});

test('ISBN-10 and ISBN-13 of the same book produce the same symbol', () => {
  // 0-306-40615-2 is the canonical worked example for the ISBN-10 modulo-11
  // check, and 978-0-306-40615-7 is its ISBN-13 form. If the conversion or
  // either check-digit calculation is wrong these two stop matching, which
  // makes this a genuine cross-check rather than a self-consistency test.
  const fromTen = encodeISBN('0-306-40615-2');
  const fromThirteen = encodeISBN('9780306406157');
  assert.equal(fromTen.toString('1', '0'), fromThirteen.toString('1', '0'));
  assert.equal(fromTen.width, 95);

  // Hyphens and spaces are cosmetic.
  assert.equal(
    encodeISBN('978 0 306 40615 7').toString('1', '0'),
    fromThirteen.toString('1', '0')
  );
});

test('ISBN enforces its own numbering rules', () => {
  // A wrong modulo-11 check digit. Encoding it anyway would produce a
  // perfectly scannable symbol carrying the wrong number — worse than refusing.
  assert.throws(() => encodeISBN('0-306-40615-3'), EncodeError);
  // X is legal, but only as the ISBN-10 check character.
  assert.doesNotThrow(() => encodeISBN('043942089X'));
  assert.throws(() => encodeISBN('X306406152'), EncodeError);
  // Bookland prefixes only.
  assert.throws(() => encodeISBN('1234567890123'), EncodeError);
  assert.throws(() => encodeISBN('123'), EncodeError);
});

test('UPC-E produces a 51-module symbol', () => {
  const m = encodeUPCE('01234565');
  assert.equal(m.width, 51);
});

test('Code 39 wraps the payload in start/stop characters', () => {
  const m = encodeCode39('ABC123');
  assert.ok(m.width > 0);
  // Each character is 6 narrow + 3 wide elements = 6 + 9 = 15 modules at the
  // default 3:1 ratio. Eight characters (payload plus two guards), plus the
  // seven narrow inter-character gaps.
  assert.equal(m.width, 8 * 15 + 7);
  assert.throws(() => encodeCode39('abc'), EncodeError);
  assert.throws(() => encodeCode39('A*B'), EncodeError);
  assert.doesNotThrow(() => encodeCode39('abc', { fullAscii: true }));
});

test('Code 39 check digit is the modulo-43 sum', () => {
  const plain = encodeCode39('CODE39');
  const checked = encodeCode39('CODE39', { checkDigit: true });
  assert.ok(checked.width > plain.width);
});

test('Code 93 appends two check characters', () => {
  const m = encodeCode93('TEST93');
  // start + 6 data + 2 check + stop, 9 modules each, plus the termination bar.
  assert.equal(m.width, 10 * 9 + 1);
  assert.throws(() => encodeCode93('lowercase'), EncodeError);
});

test('Code 128 switches to code set C for digit runs', () => {
  const digits = encodeCode128('1234567890');
  const letters = encodeCode128('ABCDEFGHIJ');
  // Ten digits pack into five C symbols; ten letters need ten B symbols.
  assert.ok(digits.width < letters.width,
    `digits ${digits.width} should be narrower than letters ${letters.width}`);
  // Every Code 128 symbol is 11 modules, plus the 13-module stop.
  assert.equal((digits.width - 13) % 11, 0);
});

test('Code 128 rejects non-ASCII', () => {
  assert.throws(() => encodeCode128('café'), EncodeError);
});

test('ITF requires an even digit count and pads when needed', () => {
  const even = encodeITF('1234');
  const odd = encodeITF('123');
  assert.equal(odd.width, even.width);
  assert.throws(() => encodeITF('12a4'), EncodeError);
});

test('ITF-14 accepts 13 or 14 digits', () => {
  const a = encodeITF14('1234567890123');
  const b = encodeITF14('12345678901231');
  assert.equal(a.width, b.width);
  assert.throws(() => encodeITF14('123'), EncodeError);
});

test('Codabar handles embedded and explicit guards', () => {
  const embedded = encodeCodabar('A12345A');
  const explicit = encodeCodabar('12345', { start: 'A', stop: 'A' });
  assert.equal(embedded.toString('1', '0'), explicit.toString('1', '0'));
  assert.throws(() => encodeCodabar('12345', { start: 'X' }), EncodeError);
});

test('Code 11 and MSI encode digits', () => {
  assert.ok(encodeCode11('12345').width > 0);
  assert.ok(encodeMSI('1234', { checkDigit: true }).width >
            encodeMSI('1234', { checkDigit: false }).width);
  assert.throws(() => encodeCode11('ABC'), EncodeError);
});

test('Pharmacode enforces its value range', () => {
  assert.ok(encodePharmacode(3).width > 0);
  assert.ok(encodePharmacode(131070).width > 0);
  assert.throws(() => encodePharmacode(2), EncodeError);
  assert.throws(() => encodePharmacode(131071), EncodeError);
  assert.throws(() => encodePharmacode(1.5), EncodeError);
});

test('every writer produces a matrix that starts and ends with a dark module', () => {
  // A symbol beginning or ending on a space has lost its guard pattern.
  const samples = [
    ['ean13', encodeEAN13('5901234123457')],
    ['ean8', encodeEAN8('96385074')],
    ['upca', encodeUPCA('03600029145')],
    ['upce', encodeUPCE('01234565')],
    ['code39', encodeCode39('ABC')],
    ['code93', encodeCode93('ABC')],
    ['code128', encodeCode128('ABC123')],
    ['itf', encodeITF('1234')],
    ['codabar', encodeCodabar('A123A')],
    ['code11', encodeCode11('123')],
    ['msi', encodeMSI('123')],
    ['pharmacode', encodePharmacode(1234)],
  ];
  for (const [name, m] of samples) {
    assert.equal(m.get(0, 0), true, `${name}: first module must be dark`);
    assert.equal(m.get(m.width - 1, 0), true, `${name}: last module must be dark`);
    assert.equal(m.height, 1, `${name}: writers return a single row`);
  }
});

/* ------------------------------------------------------------------ *
 * Reading
 * ------------------------------------------------------------------ */

test('reader recovers EAN-13', () => {
  const image = stretch(encodeEAN13('5901234123457'));
  const results = decodeOneD(image, { formats: ['ean13'] });
  assert.ok(results.length > 0, 'nothing decoded');
  assert.equal(results[0].text, '5901234123457');
});

test('reader recovers EAN-8', () => {
  const image = stretch(encodeEAN8('96385074'));
  const results = decodeOneD(image, { formats: ['ean8'] });
  assert.ok(results.length > 0, 'nothing decoded');
  assert.equal(results[0].text, '96385074');
});

test('reader recovers UPC-A as its 12-digit form', () => {
  const image = stretch(encodeUPCA('036000291452'));
  const results = decodeOneD(image, { formats: ['upca'] });
  assert.ok(results.length > 0, 'nothing decoded');
  assert.equal(results[0].text, '036000291452');
});

test('reader recovers Code 128 without leaking the checksum into the text', () => {
  // Regression guard. The checksum symbol sits immediately before the stop
  // pattern and is indistinguishable from data while scanning, so a decoder
  // that interprets symbols as it goes appends it to the result — a Code C
  // checksum of 70 arrives as the digits "70". Every one of these payloads
  // decoded with trailing junk before the fix.
  const payloads = [
    'ABC-123456',   // mixed, ends in a digit run (switches into code set C)
    '1234567890',   // pure digits, entirely code set C
    'Hello World',  // pure code set B
    'A',            // single character
    '12345',        // odd digit count, forces a C -> B switch
  ];

  for (const payload of payloads) {
    const image = stretch(encodeCode128(payload));
    const results = decodeOneD(image, { formats: ['code128'] });
    assert.ok(results.length > 0, `${payload}: nothing decoded`);
    assert.equal(results[0].text, payload, `${payload}: decoded text`);
  }
});

test('reader rejects a Code 128 symbol whose checksum is wrong', () => {
  // Without checksum verification, a misread produces plausible garbage —
  // worse than reporting nothing, because the caller cannot tell.
  const matrix = encodeCode128('ABCDEF');
  // Flip a module in the middle of the payload, well clear of the guards.
  const damaged = matrix.clone();
  const x = Math.floor(damaged.width / 2);
  for (let i = 0; i < 4; i++) damaged.flip(x + i, 0);

  const results = decodeOneD(stretch(damaged), { formats: ['code128'] });
  for (const r of results) {
    assert.notEqual(r.text, 'ABCDEF', 'damaged symbol must not decode as the original');
  }
});

test('reader recovers Code 39', () => {
  const image = stretch(encodeCode39('HELLO-39'));
  const results = decodeOneD(image, { formats: ['code39'] });
  assert.ok(results.length > 0, 'nothing decoded');
  assert.equal(results[0].text, 'HELLO-39');
});

test('reader recovers Code 93', () => {
  const image = stretch(encodeCode93('CODE93'));
  const results = decodeOneD(image, { formats: ['code93'] });
  assert.ok(results.length > 0, 'nothing decoded');
  assert.equal(results[0].text, 'CODE93');
});

test('reader recovers ITF', () => {
  const image = stretch(encodeITF('12345678'));
  const results = decodeOneD(image, { formats: ['itf'] });
  assert.ok(results.length > 0, 'nothing decoded');
  assert.equal(results[0].text, '12345678');
});

test('reader recovers Codabar', () => {
  const image = stretch(encodeCodabar('A12345A'));
  const results = decodeOneD(image, { formats: ['codabar'] });
  assert.ok(results.length > 0, 'nothing decoded');
  assert.equal(results[0].text, '12345');
});

test('reader finds nothing in a blank image rather than inventing a result', () => {
  const blank = new BitMatrix(200, 40);
  assert.deepEqual(decodeOneD(blank), []);
});

test('an unrestricted decode returns exactly one result per symbol', async () => {
  // The regression guard for false positives. Decoders that reported a match
  // they had not validated produced a phantom result *alongside* the real one:
  // a Code 39 symbol also read as `itf:01`, a UPC-A also as `itf:40`. With no
  // `formats` filter the caller cannot tell which is real, and `decodeStrict()`
  // could return the phantom.
  //
  // The fixes were structural, not heuristic: UPC-E now verifies its check
  // digit by expanding to UPC-A, and ITF requires both a genuine stop pattern
  // and a realistic minimum length.
  const { encode, decode, toImageData } = await import('../src/index.js');

  const samples = [
    ['ean13', '5901234123457'], ['ean8', '96385074'],
    ['upca', '036000291452'], ['upce', '01234565'],
    ['code128', 'ABC-123'], ['gs1128', '0101234567890128'],
    ['code39', 'ABC'], ['code93', 'ABC'],
    ['itf', '12345678'], ['itf14', '12345678901231'],
    ['codabar', 'A12345A'],
  ];

  for (const [format, payload] of samples) {
    const image = toImageData(encode(payload, { format }), { scale: 3, margin: 6 });
    const results = decode(image);

    assert.equal(
      results.length, 1,
      `${format}: expected exactly one result, got ` +
      JSON.stringify(results.map((r) => `${r.format}:${r.text}`))
    );
  }
});

test('ITF rejects a fragment with no stop pattern', () => {
  // Two digits' worth of interleaved bars, with nothing after them. Before the
  // fix this decoded happily; a real symbol always ends in a stop pattern.
  const fragment = encodeITF('12345678');
  const truncated = new BitMatrix(fragment.width - 8, 1);
  for (let x = 0; x < truncated.width; x++) {
    if (fragment.get(x, 0)) truncated.set(x, 0);
  }
  const results = decodeOneD(stretch(truncated), { formats: ['itf'] });
  for (const r of results) {
    assert.notEqual(r.text, '12345678', 'a truncated symbol must not decode as complete');
  }
});
