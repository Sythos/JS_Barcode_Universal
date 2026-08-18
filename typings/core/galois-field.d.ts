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
 * SPDX-FileCopyrightText: 2026 Sythos (https://www.sythos.net)
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
export declare class GaloisField {
    size: number;
    prime: boolean;
    primitive: number;
    generator: number;
    name: string;
    /** Multiplicative order: every non-zero element is generator^i for some i < order. */
    order: number;
    expTable: Int32Array<ArrayBuffer>;
    logTable: Int32Array<ArrayBuffer>;
    /**
     * @param {object} opts
     * @param {number} opts.size      Field order: 2^m for binary, p for prime.
     * @param {boolean} [opts.prime]  True for a prime field (mod arithmetic).
     * @param {number} [opts.primitive] Primitive polynomial, binary fields only.
     * @param {number} [opts.generator] Multiplicative generator. Defaults to 2
     *   for binary fields (x), and must be given explicitly for prime fields.
     * @param {string} [opts.name]
     */
    constructor({ size, prime, primitive, generator, name }: {
        size: number;
        prime?: boolean;
        primitive?: number;
        generator?: number;
        name?: string;
    });
    /** Additive identity is 0 and multiplicative identity is 1 in every field here. */
    get zero(): number;
    get one(): number;
    /**
     * a + b.
     * @param {number} a @param {number} b @returns {number}
     */
    add(a: number, b: number): number;
    /**
     * a - b. Distinct from add() in prime fields — see the module note.
     * @param {number} a @param {number} b @returns {number}
     */
    sub(a: number, b: number): number;
    /**
     * -a.
     * @param {number} a @returns {number}
     */
    neg(a: number): number;
    /**
     * a * b.
     * @param {number} a @param {number} b @returns {number}
     */
    mul(a: number, b: number): number;
    /**
     * a / b.
     * @param {number} a @param {number} b @returns {number}
     */
    div(a: number, b: number): number;
    /**
     * 1 / a.
     * @param {number} a @returns {number}
     */
    inv(a: number): number;
    /**
     * generator^i, for any integer i (negative included).
     * @param {number} i @returns {number}
     */
    exp(i: number): number;
    /**
     * Discrete log base generator.
     * @param {number} a @returns {number}
     */
    log(a: number): number;
}
/** QR Code, Data Matrix uses its own — see below. x^8 + x^4 + x^3 + x^2 + 1 */
export declare const GF256_QR: GaloisField;
/** Data Matrix ECC200. x^8 + x^5 + x^3 + x^2 + 1 */
export declare const GF256_DM: GaloisField;
/** Aztec's eight-bit data field is algebraically identical to Data Matrix's. */
export declare const GF256_AZTEC: GaloisField;
/** PDF417. Prime field; 3 is a primitive root modulo 929. */
export declare const GF929: GaloisField;
/** Aztec, by layer count. */
export declare const GF16: GaloisField;
export declare const GF64: GaloisField;
export declare const GF1024: GaloisField;
export declare const GF4096: GaloisField;
