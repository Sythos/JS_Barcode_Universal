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
 * GTIN validation and numeric compaction for GS1 DataBar GTIN-only symbols.
 *
 * This is intentionally not a bar-pattern encoder. It emits the exact symbol
 * character values required by ISO/IEC 24724:2011; a later encoder can turn
 * those values into widths without reinterpreting a GTIN or linkage flag.
 *
 * @module databar/codec
 */
import { DATABAR14_INSIDE_RADIX, DATABAR14_PAIR_RADIX, DATABAR14_SYMBOL_LIMIT, DATABAR_LIMITED_DATA_LIMIT, DATABAR_LIMITED_LINKAGE_OFFSET, DATABAR_LIMITED_PAIR_RADIX, } from './tables.js';
const GTIN_LENGTHS = new Set([8, 12, 13, 14]);
function digits(value, label) {
    const text = String(value);
    if (!/^\d+$/.test(text))
        throw new TypeError(`${label} must contain only decimal digits`);
    return text;
}
function asCharacterValue(value, label, maximum) {
    if (!Number.isInteger(value) || value < 0 || value > maximum) {
        throw new RangeError(`${label} must be an integer from 0 to ${maximum}`);
    }
    return value;
}
/** Calculate the GS1 modulo-10 check digit for a GTIN body. */
export function gtinCheckDigit(body) {
    const text = digits(body, 'GTIN body');
    if (text.length < 1 || text.length > 13)
        throw new RangeError('GTIN body must contain 1 to 13 digits');
    let sum = 0;
    for (let i = text.length - 1, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) {
        sum += Number(text[i]) * weight;
    }
    return String((10 - (sum % 10)) % 10);
}
/** Return a checked 14-digit GTIN, preserving only its standardized digits. */
export function normalizeGTIN(value) {
    const input = digits(value, 'GTIN');
    if (!GTIN_LENGTHS.has(input.length)) {
        throw new RangeError('GTIN must contain 8, 12, 13, or 14 digits including its check digit');
    }
    if (gtinCheckDigit(input.slice(0, -1)) !== input.at(-1)) {
        throw new RangeError(`GTIN check digit is invalid for ${input}`);
    }
    return input.padStart(14, '0');
}
/** Build a checked GTIN-14 from its thirteen-digit data body. */
export function makeGTIN14(body) {
    const input = digits(body, 'GTIN-14 body');
    if (input.length > 13)
        throw new RangeError('GTIN-14 body must contain at most 13 digits');
    const padded = input.padStart(13, '0');
    return padded + gtinCheckDigit(padded);
}
function gtinFromSymbolValue(symbolValue) {
    const value = BigInt(symbolValue);
    if (value < 0n || value >= DATABAR14_SYMBOL_LIMIT)
        throw new RangeError('GS1 DataBar-14 symbol value is out of range');
    const linkage = value >= 10000000000000n;
    const body = (linkage ? value - 10000000000000n : value).toString().padStart(13, '0');
    return { linkage, gtin: body + gtinCheckDigit(body) };
}
/**
 * Compact a GTIN into the four values shared by Omnidirectional, Truncated,
 * Stacked and Stacked Omnidirectional. The `physicalCharacters` sequence is
 * left-to-right on a linear DataBar-14 row: 1, 2, 4, 3.
 */
export function encodeDataBar14GTIN(value, options = {}) {
    const gtin = normalizeGTIN(value);
    const linkage = options.linkage === true;
    if (options.linkage !== undefined && typeof options.linkage !== 'boolean') {
        throw new TypeError('GS1 DataBar linkage must be a boolean');
    }
    const dataBody = gtin.slice(0, -1);
    const symbolValue = BigInt(dataBody) + (linkage ? 10000000000000n : 0n);
    const leftPair = symbolValue / BigInt(DATABAR14_PAIR_RADIX);
    const rightPair = symbolValue % BigInt(DATABAR14_PAIR_RADIX);
    const outerLeft = Number(leftPair / BigInt(DATABAR14_INSIDE_RADIX));
    const innerLeft = Number(leftPair % BigInt(DATABAR14_INSIDE_RADIX));
    const outerRight = Number(rightPair / BigInt(DATABAR14_INSIDE_RADIX));
    const innerRight = Number(rightPair % BigInt(DATABAR14_INSIDE_RADIX));
    return Object.freeze({
        gtin, linkage, symbolValue, leftPair, rightPair,
        logicalCharacters: Object.freeze({ outerLeft, innerLeft, outerRight, innerRight }),
        physicalCharacters: Object.freeze([outerLeft, innerLeft, innerRight, outerRight]),
    });
}
/** Reconstruct and validate a GTIN from the four DataBar-14 character values. */
export function decodeDataBar14GTIN(values) {
    if (values === null || typeof values !== 'object')
        throw new TypeError('GS1 DataBar-14 characters must be an object');
    const outerLeft = asCharacterValue(values.outerLeft, 'outerLeft', 2840);
    const innerLeft = asCharacterValue(values.innerLeft, 'innerLeft', 1596);
    const outerRight = asCharacterValue(values.outerRight, 'outerRight', 2840);
    const innerRight = asCharacterValue(values.innerRight, 'innerRight', 1596);
    const leftPair = BigInt(outerLeft) * BigInt(DATABAR14_INSIDE_RADIX) + BigInt(innerLeft);
    const rightPair = BigInt(outerRight) * BigInt(DATABAR14_INSIDE_RADIX) + BigInt(innerRight);
    return Object.freeze({
        ...gtinFromSymbolValue(leftPair * BigInt(DATABAR14_PAIR_RADIX) + rightPair),
        leftPair, rightPair,
    });
}
/** Compact a DataBar Limited-eligible GTIN into its two data character values. */
export function encodeDataBarLimitedGTIN(value, options = {}) {
    const gtin = normalizeGTIN(value);
    const linkage = options.linkage === true;
    if (options.linkage !== undefined && typeof options.linkage !== 'boolean') {
        throw new TypeError('GS1 DataBar linkage must be a boolean');
    }
    const dataBody = BigInt(gtin.slice(0, -1));
    if (dataBody >= DATABAR_LIMITED_DATA_LIMIT) {
        throw new RangeError('GS1 DataBar Limited requires a GTIN whose indicator digit is 0 or 1');
    }
    const symbolValue = dataBody + (linkage ? DATABAR_LIMITED_LINKAGE_OFFSET : 0n);
    const left = Number(symbolValue / BigInt(DATABAR_LIMITED_PAIR_RADIX));
    const right = Number(symbolValue % BigInt(DATABAR_LIMITED_PAIR_RADIX));
    return Object.freeze({ gtin, linkage, symbolValue, left, right });
}
/** Reconstruct and validate a GTIN from DataBar Limited data character values. */
export function decodeDataBarLimitedGTIN(values) {
    if (values === null || typeof values !== 'object')
        throw new TypeError('GS1 DataBar Limited characters must be an object');
    const left = asCharacterValue(values.left, 'left', 1994036);
    const right = asCharacterValue(values.right, 'right', DATABAR_LIMITED_PAIR_RADIX - 1);
    let symbolValue = BigInt(left) * BigInt(DATABAR_LIMITED_PAIR_RADIX) + BigInt(right);
    const linkage = symbolValue >= DATABAR_LIMITED_LINKAGE_OFFSET;
    if (linkage)
        symbolValue -= DATABAR_LIMITED_LINKAGE_OFFSET;
    if (symbolValue < 0n || symbolValue >= DATABAR_LIMITED_DATA_LIMIT) {
        throw new RangeError('GS1 DataBar Limited character values do not encode a permitted GTIN');
    }
    const body = symbolValue.toString().padStart(13, '0');
    return Object.freeze({ linkage, gtin: body + gtinCheckDigit(body), symbolValue: BigInt(left) * BigInt(DATABAR_LIMITED_PAIR_RADIX) + BigInt(right) });
}
/** GS1 transmitted form for the GTIN-only DataBar variants. */
export function dataBarGtinTransmission(value) {
    return `]e001${normalizeGTIN(value)}`;
}
