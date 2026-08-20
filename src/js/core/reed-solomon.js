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
 * `base` is 0 for QR; 1 for Aztec, Data Matrix and PDF417.
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
    if (eccLen <= 0)
        return [];
    const gen = cachedGenerator(eccLen, field, base);
    const res = new Array(data.length + eccLen).fill(0);
    for (let i = 0; i < data.length; i++)
        res[i] = data[i];
    // Synthetic division by a monic divisor: the leading coefficient is
    // annihilated each step and its multiple subtracted from the tail.
    for (let i = 0; i < data.length; i++) {
        const coef = res[i];
        if (coef === 0)
            continue;
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
        for (let i = 0; i < remainder.length; i++)
            remainder[i] = field.neg(remainder[i]);
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
function multiplyAscending(left, right, field, limit) {
    const out = new Array(Math.min(limit, left.length + right.length - 1)).fill(0);
    for (let i = 0; i < left.length; i++)
        for (let j = 0; j < right.length && i + j < out.length; j++) {
            out[i + j] = field.add(out[i + j], field.mul(left[i], right[j]));
        }
    return out;
}
function berlekampMassey(syndromes, field) {
    const limit = syndromes.length;
    const lambda = new Array(limit + 1).fill(0);
    const previous = new Array(limit + 1).fill(0);
    const temporary = new Array(limit + 1).fill(0);
    lambda[0] = 1;
    previous[0] = 1;
    let errorCount = 0;
    let shift = 1;
    let lastDiscrepancy = 1;
    for (let step = 0; step < limit; step++) {
        let discrepancy = syndromes[step];
        for (let i = 1; i <= errorCount; i++)
            discrepancy = field.add(discrepancy, field.mul(lambda[i], syndromes[step - i]));
        if (discrepancy === 0) {
            shift++;
            continue;
        }
        const scale = field.div(discrepancy, lastDiscrepancy);
        for (let i = 0; i <= limit; i++)
            temporary[i] = lambda[i];
        for (let i = 0; i + shift <= limit; i++)
            if (previous[i] !== 0) {
                lambda[i + shift] = field.sub(lambda[i + shift], field.mul(scale, previous[i]));
            }
        if (2 * errorCount <= step) {
            errorCount = step + 1 - errorCount;
            for (let i = 0; i <= limit; i++)
                previous[i] = temporary[i];
            lastDiscrepancy = discrepancy;
            shift = 1;
        }
        else
            shift++;
    }
    return { locator: lambda.slice(0, errorCount + 1), errorCount };
}
/**
 * Correct errors in a received codeword, in place.
 *
 * @param {number[]} received Data followed by parity, degree-descending.
 * @param {number} eccLen
 * @param {import('./galois-field.js').GaloisField} field
 * @param {number} [base]
 * @param {number[]} [erasures] Known damaged indexes, counted from wire order.
 * @returns {number} Number of symbols corrected.
 * @throws {ChecksumError} If the damage exceeds the correction capacity.
 */
export function rsDecode(received, eccLen, field, base = 0, erasures = []) {
    const n = received.length;
    if (!Array.isArray(erasures) || new Set(erasures).size !== erasures.length || erasures.some((index) => !Number.isInteger(index) || index < 0 || index >= n)) {
        throw new ChecksumError('Reed-Solomon: erasure positions must be unique codeword indexes');
    }
    if (erasures.length > eccLen)
        throw new ChecksumError(`Reed-Solomon: ${erasures.length} erasures exceeds correction capacity ${eccLen} (${field.name})`);
    // --- Syndromes. S[i] = R(a^(base+i)); all zero means an intact codeword.
    const syn = new Array(eccLen).fill(0);
    let damaged = false;
    for (let i = 0; i < eccLen; i++) {
        const s = evalPoly(received, field.exp(base + i), field);
        syn[i] = s;
        if (s !== 0)
            damaged = true;
    }
    if (!damaged)
        return 0;
    // Remove the known roots before locating unknown errors. The leading
    // erasureCount terms contain only the known-location transient and are not
    // part of the error-only recurrence.
    let erasureLocator = [1];
    for (const index of erasures) {
        const location = field.exp(n - 1 - index);
        erasureLocator = multiplyAscending(erasureLocator, [1, field.neg(location)], field, eccLen + 1);
    }
    const modified = multiplyAscending(syn, erasureLocator, field, eccLen).slice(erasures.length);
    const { locator: errorLocator, errorCount } = berlekampMassey(modified, field);
    if (2 * errorCount + erasures.length > eccLen) {
        throw new ChecksumError(`Reed-Solomon: ${errorCount} errors and ${erasures.length} erasures exceed correction capacity ` +
            `${eccLen} (${field.name})`);
    }
    const lambda = multiplyAscending(erasureLocator, errorLocator, field, eccLen + 1);
    const totalCount = errorCount + erasures.length;
    // --- Chien search. Position p (counted from the low-order end) is in error
    // when lambda(a^-p) == 0.
    const positions = [];
    for (let p = 0; p < n; p++) {
        const xInv = field.exp(-p);
        let acc = 0;
        let term = 1;
        for (let i = 0; i <= totalCount; i++) {
            acc = field.add(acc, field.mul(lambda[i], term));
            term = field.mul(term, xInv);
        }
        if (acc === 0)
            positions.push(p);
    }
    if (positions.length !== totalCount) {
        throw new ChecksumError(`Reed-Solomon: located ${positions.length} of ${totalCount} error positions`);
    }
    // --- Error evaluator. omega(x) = [S(x) * lambda(x)] mod x^eccLen,
    // with S degree-ascending.
    const omega = new Array(eccLen).fill(0);
    for (let i = 0; i < eccLen; i++) {
        let acc = 0;
        for (let j = 0; j <= i && j <= totalCount; j++) {
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
        for (let i = 1; i <= totalCount; i++) {
            if (field.prime) {
                // i * lambda[i] * x^(i-1), where `i` is repeated addition.
                let mult = 0;
                const t = field.mul(lambda[i], term);
                for (let k = 0; k < i; k++)
                    mult = field.add(mult, t);
                den = field.add(den, mult);
            }
            else if (i % 2 === 1) {
                den = field.add(den, field.mul(lambda[i], term));
            }
            term = field.mul(term, xInv);
        }
        if (den === 0) {
            throw new ChecksumError('Reed-Solomon: singular error locator derivative');
        }
        let magnitude = field.div(num, den);
        // X^(1-base): one factor of X when base is 0, none when base is 1.
        if (base === 0)
            magnitude = field.mul(magnitude, field.exp(p));
        else if (base !== 1)
            magnitude = field.mul(magnitude, field.exp(p * (1 - base)));
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
