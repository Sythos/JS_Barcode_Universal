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
 * Core primitive tests.
 *
 * The Reed-Solomon cases deliberately cover GF(929) alongside the binary
 * fields. A decoder that inlines XOR for field addition passes every binary
 * case and fails only here — that is the whole point of testing it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { GaloisField, GF256_QR, GF256_DM, GF929, GF16, GF64, GF1024, GF4096 }
  from '../src/js/core/galois-field.js';
import { rsEncode, rsDecode, generatorPoly } from '../src/js/core/reed-solomon.js';
import { BitMatrix } from '../src/js/core/bit-matrix.js';
import { BitWriter, BitReader } from '../src/js/core/bit-buffer.js';
import { ChecksumError } from '../src/js/core/errors.js';

/** Deterministic PRNG — reproducible failures matter more than good randomness. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

const ALL_FIELDS = [GF16, GF64, GF256_QR, GF256_DM, GF1024, GF4096, GF929];

test('galois field: axioms hold in every field', () => {
  for (const f of ALL_FIELDS) {
    const rnd = rng(12345);
    for (let i = 0; i < 400; i++) {
      const a = Math.floor(rnd() * f.size);
      const b = Math.floor(rnd() * f.size);

      assert.equal(f.add(a, 0), a, `${f.name}: a+0`);
      assert.equal(f.mul(a, 1), a, `${f.name}: a*1`);
      assert.equal(f.mul(a, 0), 0, `${f.name}: a*0`);
      assert.equal(f.add(a, f.neg(a)), 0, `${f.name}: a + (-a) = 0`);
      assert.equal(f.sub(f.add(a, b), b), a, `${f.name}: (a+b)-b = a`);
      assert.equal(f.add(a, b), f.add(b, a), `${f.name}: commutative +`);
      assert.equal(f.mul(a, b), f.mul(b, a), `${f.name}: commutative *`);

      if (a !== 0) {
        assert.equal(f.mul(a, f.inv(a)), 1, `${f.name}: a * a^-1 = 1`);
        assert.equal(f.div(f.mul(a, b), a), b, `${f.name}: (a*b)/a = b`);
      }
    }
  }
});

test('galois field: prime and binary addition genuinely differ', () => {
  // Guards against someone "simplifying" sub() back into XOR.
  assert.equal(GF256_QR.add(5, 3), 6);          // 101 ^ 011
  assert.equal(GF256_QR.sub(5, 3), 6);          // self-inverse
  assert.equal(GF929.add(5, 3), 8);             // ordinary mod arithmetic
  assert.equal(GF929.sub(5, 3), 2);
  assert.notEqual(GF929.add(5, 3), GF929.sub(5, 3));
  assert.equal(GF929.sub(3, 5), 927);           // wraps, not XOR
  assert.equal(GF929.neg(1), 928);
  assert.equal(GF256_QR.neg(1), 1);
});

test('galois field: generator really generates the group', () => {
  for (const f of ALL_FIELDS) {
    const seen = new Set();
    for (let i = 0; i < f.order; i++) seen.add(f.exp(i));
    assert.equal(seen.size, f.order, `${f.name}: exp cycle covers all non-zero elements`);
    assert.ok(!seen.has(0), `${f.name}: zero is not in the multiplicative group`);
  }
});

test('galois field: rejects a non-generating configuration', () => {
  // In GF(2^8) built on 0x11b (the AES polynomial) the element x has order 51,
  // not 255 — a realistic mix-up, and one that must fail loudly at construction
  // rather than silently produce a table with holes in it.
  assert.throws(() => new GaloisField({ size: 256, primitive: 0x11b }), /does not generate/);
  assert.throws(
    () => new GaloisField({ size: 929, prime: true, generator: 1 }),
    /does not generate/
  );
});

test('reed-solomon: generator polynomial is monic and has the right roots', () => {
  for (const [f, base] of [[GF256_QR, 0], [GF929, 1], [GF16, 0]]) {
    for (const eccLen of [2, 5, 10]) {
      const g = generatorPoly(eccLen, f, base);
      assert.equal(g.length, eccLen + 1, `${f.name}: degree`);
      assert.equal(g[0], 1, `${f.name}: monic`);
      for (let i = 0; i < eccLen; i++) {
        const root = f.exp(base + i);
        let acc = 0;
        for (let k = 0; k < g.length; k++) acc = f.add(f.mul(acc, root), g[k]);
        assert.equal(acc, 0, `${f.name}: a^${base + i} is a root`);
      }
    }
  }
});

test('reed-solomon: an undamaged codeword decodes without correction', () => {
  for (const [f, base] of [[GF256_QR, 0], [GF929, 1], [GF4096, 0]]) {
    const rnd = rng(7);
    const data = Array.from({ length: 20 }, () => Math.floor(rnd() * f.size));
    const cw = [...data, ...rsEncode(data, 10, f, base)];
    assert.equal(rsDecode(cw, 10, f, base), 0, `${f.name}: no corrections`);
    assert.deepEqual(cw.slice(0, 20), data, `${f.name}: data intact`);
  }
});

test('reed-solomon: corrects up to the theoretical limit', () => {
  /** @type {Array<[import('../src/js/core/galois-field.js').GaloisField, number]>} */
  const configs = [
    [GF16, 0], [GF64, 0], [GF256_QR, 0], [GF256_DM, 1],
    [GF1024, 0], [GF4096, 0], [GF929, 1], [GF929, 0],
  ];

  for (const [f, base] of configs) {
    // A Reed-Solomon codeword cannot be longer than the multiplicative order
    // of the field: GF(16) tops out at 15 symbols total. Exceeding it makes
    // error positions ambiguous, which looks like a decoder bug but is really
    // a misuse of the code.
    const eccLen = Math.min(12, Math.floor((f.order - 1) / 2) * 2);
    const maxErrors = eccLen / 2;
    const dataLen = Math.min(20, f.order - eccLen);

    for (let trial = 0; trial < 30; trial++) {
      const rnd = rng(1000 + trial * 31);
      const data = Array.from({ length: dataLen }, () => Math.floor(rnd() * f.size));
      const cw = [...data, ...rsEncode(data, eccLen, f, base)];
      const pristine = [...cw];

      const positions = new Set();
      while (positions.size < maxErrors) {
        positions.add(Math.floor(rnd() * cw.length));
      }
      for (const p of positions) {
        let v;
        do { v = Math.floor(rnd() * f.size); } while (v === cw[p]);
        cw[p] = v;
      }

      const fixed = rsDecode(cw, eccLen, f, base);
      assert.equal(fixed, maxErrors, `${f.name} base=${base} trial ${trial}: count`);
      assert.deepEqual(cw, pristine, `${f.name} base=${base} trial ${trial}: recovered`);
    }
  }
});

test('reed-solomon: corrects mixed errors and known erasures within 2e+s capacity', () => {
  const eccLen = 8;
  const data = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const pristine = [...data, ...rsEncode(data, eccLen, GF929, 1)];
  const received = [...pristine];
  const erasures = [1, 7, 14];
  for (const index of erasures) received[index] = (received[index] + 123) % GF929.size;
  for (const index of [4, 12]) received[index] = (received[index] + 321) % GF929.size;
  assert.ok(2 * 2 + erasures.length <= eccLen);
  assert.equal(rsDecode(received, eccLen, GF929, 1, erasures), 5);
  assert.deepEqual(received, pristine);
});

test('reed-solomon: refuses damage beyond capacity instead of guessing', () => {
  for (const [f, base] of [[GF256_QR, 0], [GF929, 1]]) {
    const eccLen = 8;
    let refused = 0;
    const trials = 40;

    for (let trial = 0; trial < trials; trial++) {
      const rnd = rng(500 + trial * 13);
      const data = Array.from({ length: 20 }, () => Math.floor(rnd() * f.size));
      const cw = [...data, ...rsEncode(data, eccLen, f, base)];
      const pristine = [...cw];

      const positions = new Set();
      while (positions.size < eccLen / 2 + 2) positions.add(Math.floor(rnd() * cw.length));
      for (const p of positions) {
        let v;
        do { v = Math.floor(rnd() * f.size); } while (v === cw[p]);
        cw[p] = v;
      }

      try {
        rsDecode(cw, eccLen, f, base);
        // Not throwing is only acceptable if it did not silently corrupt data.
        assert.deepEqual(cw, pristine, `${f.name}: returned wrong data as if valid`);
      } catch (e) {
        assert.ok(e instanceof ChecksumError, `${f.name}: expected ChecksumError`);
        refused++;
      }
    }
    assert.ok(refused > trials * 0.5, `${f.name}: detected ${refused}/${trials} over-capacity cases`);
  }
});

test('bit matrix: get/set/flip round-trip', () => {
  const m = new BitMatrix(37, 11);
  assert.equal(m.get(5, 5), false);
  m.set(5, 5);
  assert.equal(m.get(5, 5), true);
  m.flip(5, 5);
  assert.equal(m.get(5, 5), false);

  // Word boundaries are where packing bugs live.
  for (const x of [0, 31, 32, 33, 36]) {
    m.set(x, 3);
    assert.equal(m.get(x, 3), true, `x=${x}`);
  }
  assert.equal(m.get(-1, 0), false);
  assert.equal(m.get(37, 0), false);
});

test('bit matrix: parse and toString round-trip', () => {
  const src = '#.#\n.#.\n##.';
  const m = BitMatrix.parse(src);
  assert.equal(m.width, 3);
  assert.equal(m.height, 3);
  assert.equal(m.toString('#', '.'), src);
});

test('bit matrix: margin, scale, bounds, rotate', () => {
  const m = BitMatrix.parse('#.\n.#');

  const margined = m.withMargin(2);
  assert.equal(margined.width, 6);
  assert.equal(margined.get(2, 2), true);
  assert.equal(margined.get(0, 0), false);

  const scaled = m.scale(3);
  assert.equal(scaled.width, 6);
  assert.equal(scaled.get(0, 0), true);
  assert.equal(scaled.get(2, 2), true);
  assert.equal(scaled.get(3, 0), false);

  assert.deepEqual(m.getBounds(), { x: 0, y: 0, width: 2, height: 2 });
  assert.equal(new BitMatrix(4, 4).getBounds(), null);

  const r = BitMatrix.parse('#.\n..');
  r.rotate180();
  assert.equal(r.toString('#', '.'), '..\n.#');
});

test('bit matrix: getRow', () => {
  const m = BitMatrix.parse('#.#.#');
  assert.deepEqual(Array.from(m.getRow(0)), [1, 0, 1, 0, 1]);
});

test('bit buffer: writer/reader round-trip at awkward widths', () => {
  const w = new BitWriter();
  const items = [[0b0100, 4], [0b1010101010, 10], [1, 1], [0xff, 8], [0b11011, 5], [0, 3]];
  for (const [v, n] of items) w.put(v, n);
  assert.equal(w.length, 31);

  const r = new BitReader(w.toBytes());
  for (const [v, n] of items) {
    assert.equal(r.read(n), v, `read ${n} bits`);
  }
});

test('bit buffer: reader reports exhaustion rather than returning garbage', () => {
  const w = new BitWriter();
  w.put(0b101, 3);
  const r = new BitReader(w.toBytes());
  assert.equal(r.read(3), 0b101);
  assert.equal(r.available(), 5); // padding bits in the final byte
  assert.throws(() => r.read(6));
});

test('bit buffer: 32-bit reads survive the sign boundary', () => {
  const w = new BitWriter();
  w.put(0xffffffff, 32);
  const r = new BitReader(w.toBytes());
  assert.equal(r.read(32), 0xffffffff);
});
