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
 * Finite field arithmetic.
 *
 * One class serves every field this suite needs:
 *
 *   GF(2^4)   Aztec, small layer counts
 *   GF(2^6)   Aztec
 *   GF(2^8)   QR Code, Data Matrix, Aztec
 *   GF(2^10)  Aztec
 *   GF(2^12)  Aztec
 *   GF(929)   PDF417  <- a PRIME field, not a binary one
 *
 * ## The prime-field trap
 *
 * Multiplication unifies cleanly: exp/log tables work for the multiplicative
 * group of any finite field. Addition does NOT.
 *
 *   binary GF(2^m):  a + b  ==  a - b  ==  a XOR b      (self-inverse)
 *   prime  GF(p):    a + b  ==  (a+b) % p
 *                    a - b  ==  (a-b+p) % p             (NOT self-inverse)
 *
 * So `add`, `sub` and `neg` are methods on the field, never inlined. Any code
 * that writes a bare `^` for field arithmetic works perfectly for every binary
 * field and silently corrupts PDF417 — the failure is invisible until a real
 * scanner rejects the symbol. Route every operation through the field object.
 *
 * @module core/galois-field
 */
export class GaloisField {
    /**
     * @param {object} opts
     * @param {number} opts.size      Field order: 2^m for binary, p for prime.
     * @param {boolean} [opts.prime]  True for a prime field (mod arithmetic).
     * @param {number} [opts.primitive] Primitive polynomial, binary fields only.
     * @param {number} [opts.generator] Multiplicative generator. Defaults to 2
     *   for binary fields (x), and must be given explicitly for prime fields.
     * @param {string} [opts.name]
     */
    constructor({ size, prime = false, primitive = 0, generator = 2, name = '' }) {
        this.size = size;
        this.prime = prime;
        this.primitive = primitive;
        this.generator = generator;
        this.name = name || (prime ? `GF(${size})` : `GF(2^${Math.log2(size)})`);
        /** Multiplicative order: every non-zero element is generator^i for some i < order. */
        this.order = size - 1;
        const exp = new Int32Array(this.order * 2);
        const log = new Int32Array(size).fill(-1);
        let x = 1;
        for (let i = 0; i < this.order; i++) {
            exp[i] = x;
            log[x] = i;
            if (prime) {
                x = (x * generator) % size;
            }
            else {
                x <<= 1;
                if (x >= size)
                    x ^= primitive;
            }
        }
        // Wrapped copy lets mul() skip a modulo on the common path.
        for (let i = 0; i < this.order; i++)
            exp[this.order + i] = exp[i];
        // A short cycle still returns to 1 after `order` steps whenever its length
        // divides `order`, so "did we end at 1" does not detect a bad generator.
        // The reliable test is coverage: a true generator visits every non-zero
        // element exactly once, leaving no -1 in the log table.
        for (let v = 1; v < size; v++) {
            if (log[v] === -1) {
                throw new Error(`${this.name}: generator ${generator} does not generate the ` +
                    `multiplicative group (element ${v} is unreachable). ` +
                    (prime ? 'Choose a primitive root.' : 'Check the primitive polynomial.'));
            }
        }
        this.expTable = exp;
        this.logTable = log;
    }
    /** Additive identity is 0 and multiplicative identity is 1 in every field here. */
    get zero() { return 0; }
    get one() { return 1; }
    /**
     * a + b.
     * @param {number} a @param {number} b @returns {number}
     */
    add(a, b) {
        return this.prime ? (a + b) % this.size : a ^ b;
    }
    /**
     * a - b. Distinct from add() in prime fields — see the module note.
     * @param {number} a @param {number} b @returns {number}
     */
    sub(a, b) {
        return this.prime ? (a - b + this.size) % this.size : a ^ b;
    }
    /**
     * -a.
     * @param {number} a @returns {number}
     */
    neg(a) {
        return this.prime ? (this.size - a) % this.size : a;
    }
    /**
     * a * b.
     * @param {number} a @param {number} b @returns {number}
     */
    mul(a, b) {
        if (a === 0 || b === 0)
            return 0;
        return this.expTable[this.logTable[a] + this.logTable[b]];
    }
    /**
     * a / b.
     * @param {number} a @param {number} b @returns {number}
     */
    div(a, b) {
        if (b === 0)
            throw new Error(`${this.name}: division by zero`);
        if (a === 0)
            return 0;
        return this.expTable[this.logTable[a] - this.logTable[b] + this.order];
    }
    /**
     * 1 / a.
     * @param {number} a @returns {number}
     */
    inv(a) {
        if (a === 0)
            throw new Error(`${this.name}: zero has no inverse`);
        return this.expTable[this.order - this.logTable[a]];
    }
    /**
     * generator^i, for any integer i (negative included).
     * @param {number} i @returns {number}
     */
    exp(i) {
        let k = i % this.order;
        if (k < 0)
            k += this.order;
        return this.expTable[k];
    }
    /**
     * Discrete log base generator.
     * @param {number} a @returns {number}
     */
    log(a) {
        if (a === 0)
            throw new Error(`${this.name}: log of zero`);
        return this.logTable[a];
    }
}
/** QR Code, Data Matrix uses its own — see below. x^8 + x^4 + x^3 + x^2 + 1 */
export const GF256_QR = new GaloisField({ size: 256, primitive: 0x011d, name: 'GF(256)/QR' });
/** Data Matrix ECC200. x^8 + x^5 + x^3 + x^2 + 1 */
export const GF256_DM = new GaloisField({ size: 256, primitive: 0x012d, name: 'GF(256)/DataMatrix' });
/** Aztec's eight-bit data field is algebraically identical to Data Matrix's. */
export const GF256_AZTEC = GF256_DM;
/** PDF417. Prime field; 3 is a primitive root modulo 929. */
export const GF929 = new GaloisField({ size: 929, prime: true, generator: 3, name: 'GF(929)' });
/** Aztec, by layer count. */
export const GF16 = new GaloisField({ size: 16, primitive: 0x13, name: 'GF(16)' });
export const GF64 = new GaloisField({ size: 64, primitive: 0x43, name: 'GF(64)' });
export const GF1024 = new GaloisField({ size: 1024, primitive: 0x409, name: 'GF(1024)' });
export const GF4096 = new GaloisField({ size: 4096, primitive: 0x1069, name: 'GF(4096)' });
