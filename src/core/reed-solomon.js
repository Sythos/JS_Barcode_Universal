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
 * Reed-Solomon encoding and decoding over an arbitrary finite field.
 *
 * Systematic encoding: the output is the message followed by parity symbols,
 * so the data is readable without decoding when the symbol is undamaged.
 *
 * Decoding is syndromes -> Berlekamp-Massey -> Chien search -> Forney.
 * It corrects up to floor(eccLen / 2) symbol errors at unknown positions.
 *
 * Every arithmetic operation routes through the field object. There is
 * deliberately not a single bare `^` in this file: XOR is correct for binary
 * fields and wrong for GF(929), and the resulting bug is invisible to any test
 * that only exercises QR or Data Matrix. See core/galois-field.js.
 *
 * Polynomial convention in this module: **coefficient index 0 is the highest
 * degree**, matching the wire order of a codeword. The decoder converts to
 * degree-ascending internally where the algorithms are stated that way.
 *
 * @module core/reed-solomon
 */

import { ChecksumError } from './errors.js';

/**
 * Build the generator polynomial for `eccLen` parity symbols.
 *
 *   g(x) = product over i of (x - a^(base + i)),  i = 0 .. eccLen-1
 *
 * `base` is 0 for QR, Data Matrix and Aztec; 1 for PDF417.
 *
 * @param {number} eccLen
 * @param {import('./galois-field.js').GaloisField} field
 * @param {number} [base]
 * @returns {number[]} Monic, degree-descending, length eccLen + 1.
 */
export function generatorPoly(eccLen, field, base = 0) {
  let g = [1];
  for (let i = 0; i < eccLen; i++) {
    const root = field.exp(base + i);
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      // g[j]*x lands at next[j]; g[j]*(-root) lands at next[j+1].
      next[j] = field.add(next[j], g[j]);
      next[j + 1] = field.sub(next[j + 1], field.mul(g[j], root));
    }
    g = next;
  }
  return g;
}

const generatorCache = new Map();

/**
 * Cached {@link generatorPoly}. Encoding the same format repeatedly is the
 * common case and rebuilding the polynomial each time is pure waste.
 *
 * @param {number} eccLen
 * @param {import('./galois-field.js').GaloisField} field
 * @param {number} [base]
 * @returns {number[]}
 */
function cachedGenerator(eccLen, field, base) {
  const key = `${field.name}|${eccLen}|${base}`;
  let g = generatorCache.get(key);
  if (!g) {
    g = generatorPoly(eccLen, field, base);
    generatorCache.set(key, g);
  }
  return g;
}

/**
 * Compute `eccLen` parity symbols for `data`.
 *
 * @param {ArrayLike<number>} data
 * @param {number} eccLen
 * @param {import('./galois-field.js').GaloisField} field
 * @param {number} [base]
 * @returns {number[]} The parity symbols alone, length eccLen.
 */
export function rsEncode(data, eccLen, field, base = 0) {
  if (eccLen <= 0) return [];
  const gen = cachedGenerator(eccLen, field, base);
  const res = new Array(data.length + eccLen).fill(0);
  for (let i = 0; i < data.length; i++) res[i] = data[i];

  // Synthetic division by a monic divisor: the leading coefficient is
  // annihilated each step and its multiple subtracted from the tail.
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef === 0) continue;
    for (let j = 1; j <= eccLen; j++) {
      res[i + j] = field.sub(res[i + j], field.mul(gen[j], coef));
    }
  }

  const remainder = res.slice(data.length);

  // The codeword is data(x)*x^eccLen MINUS the remainder, so the parity
  // symbols are the negated remainder. In a binary field negation is the
  // identity and this is invisible; in GF(929) omitting it produces a
  // codeword that is not divisible by the generator, and every symbol fails
  // to decode. Exactly the class of bug the field abstraction exists to stop.
  if (field.prime) {
    for (let i = 0; i < remainder.length; i++) remainder[i] = field.neg(remainder[i]);
  }
  return remainder;
}

/**
 * Evaluate a degree-descending polynomial at x (Horner).
 *
 * @param {ArrayLike<number>} poly
 * @param {number} x
 * @param {import('./galois-field.js').GaloisField} field
 * @returns {number}
 */
function evalPoly(poly, x, field) {
  let acc = 0;
  for (let i = 0; i < poly.length; i++) {
    acc = field.add(field.mul(acc, x), poly[i]);
  }
  return acc;
}

/**
 * Correct errors in a received codeword, in place.
 *
 * @param {number[]} received Data followed by parity, degree-descending.
 * @param {number} eccLen
 * @param {import('./galois-field.js').GaloisField} field
 * @param {number} [base]
 * @returns {number} Number of symbols corrected.
 * @throws {ChecksumError} If the damage exceeds the correction capacity.
 */
export function rsDecode(received, eccLen, field, base = 0) {
  const n = received.length;

  // --- Syndromes. S[i] = R(a^(base+i)); all zero means an intact codeword.
  const syn = new Array(eccLen).fill(0);
  let damaged = false;
  for (let i = 0; i < eccLen; i++) {
    const s = evalPoly(received, field.exp(base + i), field);
    syn[i] = s;
    if (s !== 0) damaged = true;
  }
  if (!damaged) return 0;

  // --- Berlekamp-Massey. Degree-ascending here: lambda[k] is the coefficient
  // of x^k, which is how the recurrence is naturally stated.
  const lambda = new Array(eccLen + 1).fill(0);
  const prev = new Array(eccLen + 1).fill(0);
  const tmp = new Array(eccLen + 1).fill(0);
  lambda[0] = 1;
  prev[0] = 1;
  let errCount = 0;   // current LFSR length
  let shift = 1;      // steps since `prev` was last updated
  let lastDisc = 1;   // discrepancy at that update

  for (let step = 0; step < eccLen; step++) {
    let disc = syn[step];
    for (let i = 1; i <= errCount; i++) {
      disc = field.add(disc, field.mul(lambda[i], syn[step - i]));
    }

    if (disc === 0) {
      shift++;
      continue;
    }

    const scale = field.div(disc, lastDisc);
    tmp.fill(0);
    for (let i = 0; i <= eccLen; i++) tmp[i] = lambda[i];

    for (let i = 0; i + shift <= eccLen; i++) {
      if (prev[i] === 0) continue;
      lambda[i + shift] = field.sub(lambda[i + shift], field.mul(scale, prev[i]));
    }

    if (2 * errCount <= step) {
      errCount = step + 1 - errCount;
      for (let i = 0; i <= eccLen; i++) prev[i] = tmp[i];
      lastDisc = disc;
      shift = 1;
    } else {
      shift++;
    }
  }

  if (errCount === 0 || errCount > eccLen / 2) {
    throw new ChecksumError(
      `Reed-Solomon: ${errCount} errors exceeds correction capacity ` +
      `${Math.floor(eccLen / 2)} (${field.name})`
    );
  }

  // --- Chien search. Position p (counted from the low-order end) is in error
  // when lambda(a^-p) == 0.
  const positions = [];
  for (let p = 0; p < n; p++) {
    const xInv = field.exp(-p);
    let acc = 0;
    let term = 1;
    for (let i = 0; i <= errCount; i++) {
      acc = field.add(acc, field.mul(lambda[i], term));
      term = field.mul(term, xInv);
    }
    if (acc === 0) positions.push(p);
  }

  if (positions.length !== errCount) {
    throw new ChecksumError(
      `Reed-Solomon: located ${positions.length} of ${errCount} error positions`
    );
  }

  // --- Error evaluator. omega(x) = [S(x) * lambda(x)] mod x^eccLen,
  // with S degree-ascending.
  const omega = new Array(eccLen).fill(0);
  for (let i = 0; i < eccLen; i++) {
    let acc = 0;
    for (let j = 0; j <= i && j <= errCount; j++) {
      acc = field.add(acc, field.mul(lambda[j], syn[i - j]));
    }
    omega[i] = acc;
  }

  // --- Forney. For an error at position p, with X = a^p:
  //   magnitude = -X^(1-base) * omega(X^-1) / lambda'(X^-1)
  // The sign is a no-op in binary fields and load-bearing in GF(929).
  let corrected = 0;
  for (const p of positions) {
    const xInv = field.exp(-p);

    let num = 0;
    let term = 1;
    for (let i = 0; i < eccLen; i++) {
      num = field.add(num, field.mul(omega[i], term));
      term = field.mul(term, xInv);
    }

    // Formal derivative: only odd-index terms survive in a binary field, but
    // in a prime field every term contributes with an integer multiplier.
    let den = 0;
    term = 1;
    for (let i = 1; i <= errCount; i++) {
      if (field.prime) {
        // i * lambda[i] * x^(i-1), where `i` is repeated addition.
        let mult = 0;
        const t = field.mul(lambda[i], term);
        for (let k = 0; k < i; k++) mult = field.add(mult, t);
        den = field.add(den, mult);
      } else if (i % 2 === 1) {
        den = field.add(den, field.mul(lambda[i], term));
      }
      term = field.mul(term, xInv);
    }

    if (den === 0) {
      throw new ChecksumError('Reed-Solomon: singular error locator derivative');
    }

    let magnitude = field.div(num, den);
    // X^(1-base): one factor of X when base is 0, none when base is 1.
    if (base === 0) magnitude = field.mul(magnitude, field.exp(p));
    else if (base !== 1) magnitude = field.mul(magnitude, field.exp(p * (1 - base)));
    magnitude = field.neg(magnitude);

    const idx = n - 1 - p;
    received[idx] = field.sub(received[idx], magnitude);
    corrected++;
  }

  // Verify: a genuine correction zeroes every syndrome. Without this check,
  // damage beyond capacity can produce a plausible-looking wrong answer.
  for (let i = 0; i < eccLen; i++) {
    if (evalPoly(received, field.exp(base + i), field) !== 0) {
      throw new ChecksumError('Reed-Solomon: correction failed verification');
    }
  }

  return corrected;
}
