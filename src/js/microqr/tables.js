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
 * Micro QR Code structural facts and geometry.
 *
 * Only the irreducible public symbology values are tabulated. Grid capacity,
 * reserved areas and placement order are derived independently and checked by
 * {@link validateMicroQrTables}. M1 and M3 have a four-bit final data symbol
 * character; `dataBits` therefore is authoritative and must not be inferred as
 * `dataCodewords * 8` for those versions.
 *
 * @module microqr/tables
 */
import { BitMatrix } from '../core/bit-matrix.js';
/** Numeric version identifiers used by the encoder selection loop. */
export const MICROQR_VERSIONS = Object.freeze([1, 2, 3, 4]);
export const MICROQR_VERSION_NAMES = Object.freeze(['M1', 'M2', 'M3', 'M4']);
export const MICROQR_ECC_LEVELS = Object.freeze(['DETECT', 'L', 'M', 'Q']);
export const MICROQR_FORMAT_MASK = 0x4445;
export const MICROQR_FORMAT_GENERATOR = 0x537;
const symbol = (version, ecc, symbolNumber, totalCodewords, dataCodewords, dataBits, eccCodewords) => Object.freeze({
    version,
    ecc,
    symbolNumber,
    size: 9 + Number(version.slice(1)) * 2,
    totalCodewords,
    dataCodewords,
    dataBits,
    eccCodewords,
    blockCount: 1,
    shortDataCodewordBits: dataBits % 8 || 8,
    remainderBits: 0,
});
/** The eight legal Micro QR version/error-correction combinations. */
export const MICROQR_SYMBOLS = Object.freeze([
    symbol('M1', 'DETECT', 0, 5, 3, 20, 2),
    symbol('M2', 'L', 1, 10, 5, 40, 5),
    symbol('M2', 'M', 2, 10, 4, 32, 6),
    symbol('M3', 'L', 3, 17, 11, 84, 6),
    symbol('M3', 'M', 4, 17, 9, 68, 8),
    symbol('M4', 'L', 5, 24, 16, 128, 8),
    symbol('M4', 'M', 6, 24, 14, 112, 10),
    symbol('M4', 'Q', 7, 24, 10, 80, 14),
]);
const symbolByKey = new Map(MICROQR_SYMBOLS.map((entry) => [`${entry.version}:${entry.ecc}`, entry]));
const symbolByNumber = new Map(MICROQR_SYMBOLS.map((entry) => [entry.symbolNumber, entry]));
function canonicalVersion(version) {
    const result = typeof version === 'number' ? `M${version}` : String(version).toUpperCase();
    if (!MICROQR_VERSION_NAMES.includes(result))
        throw new RangeError(`Micro QR: version must be M1-M4, got ${version}`);
    return result;
}
/** @param {string|number} version @returns {number} */
export function microQrVersionSize(version) {
    return 9 + Number(canonicalVersion(version).slice(1)) * 2;
}
/** Resolve the format symbol number for a legal version/ECC pair. */
export function microQrSymbolNumber(version, ecc) {
    return microQrBlockLayout(version, ecc).symbolNumber;
}
/** Resolve the immutable single-block layout for a legal version/ECC pair. */
export function microQrBlockLayout(version, ecc) {
    const canonical = canonicalVersion(version);
    const level = ecc == null && canonical === 'M1' ? 'DETECT' : String(ecc).toUpperCase();
    const entry = symbolByKey.get(`${canonical}:${level}`);
    if (!entry)
        throw new RangeError(`Micro QR: error correction level ${ecc} is not valid for ${canonical}`);
    return entry;
}
/** @returns {number} Usable message bits, including mode/count overhead. */
export function microQrDataCapacityBits(version, ecc) {
    return microQrBlockLayout(version, ecc).dataBits;
}
/**
 * Encode the five format data bits with BCH(15,5), then apply the Micro QR
 * format mask. `symbolNumber` occupies the high three data bits and `mask`
 * the low two.
 */
export function microQrFormatInfo(symbolNumber, mask, maybeMask) {
    // Public convenience overload: (version, ecc, mask).
    if (arguments.length === 3) {
        symbolNumber = microQrSymbolNumber(symbolNumber, mask);
        mask = maybeMask;
    }
    if (!Number.isInteger(symbolNumber) || symbolNumber < 0 || symbolNumber > 7) {
        throw new RangeError('Micro QR: symbol number must be an integer in 0..7');
    }
    if (!Number.isInteger(mask) || mask < 0 || mask > 3) {
        throw new RangeError('Micro QR: mask must be an integer in 0..3');
    }
    const data = (symbolNumber << 2) | mask;
    let remainder = data << 10;
    for (let bit = 14; bit >= 10; bit--) {
        if ((remainder & (1 << bit)) !== 0)
            remainder ^= MICROQR_FORMAT_GENERATOR << (bit - 10);
    }
    return ((data << 10) | remainder) ^ MICROQR_FORMAT_MASK;
}
function hammingDistance(a, b) {
    let bits = (a ^ b) & 0x7fff;
    let count = 0;
    while (bits) {
        bits &= bits - 1;
        count++;
    }
    return count;
}
/** Decode/correct a 15-bit format word. Returns null beyond three errors. */
export function microQrDecodeFormatInfo(bits) {
    if (!Number.isInteger(bits) || bits < 0 || bits > 0x7fff) {
        throw new RangeError('Micro QR: format information must be a 15-bit integer');
    }
    let best = null;
    let bestDistance = 16;
    for (const entry of MICROQR_SYMBOLS)
        for (let mask = 0; mask < 4; mask++) {
            const expected = microQrFormatInfo(entry.symbolNumber, mask);
            const distance = hammingDistance(bits, expected);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = { version: entry.version, ecc: entry.ecc, symbolNumber: entry.symbolNumber, mask, correctedBits: distance, bits: expected };
            }
        }
    return bestDistance <= 3 ? best : null;
}
/**
 * Format modules in bit-number order, least significant bit first. Bits 0..7
 * run down column 8; bits 8..14 continue right-to-left along row 8.
 * Position (8,8) is shared by the two arms and appears once.
 */
export function microQrFormatInfoPositions(sizeOrVersion) {
    const size = typeof sizeOrVersion === 'number' && sizeOrVersion >= 11
        ? sizeOrVersion
        : microQrVersionSize(sizeOrVersion);
    if (![11, 13, 15, 17].includes(size))
        throw new RangeError(`Micro QR: invalid symbol size ${size}`);
    const positions = [];
    for (let y = 1; y <= 8; y++)
        positions.push([8, y]);
    for (let x = 7; x >= 1; x--)
        positions.push([x, 8]);
    return positions;
}
const reservedCache = new Map();
const functionCache = new Map();
/**
 * Fixed dark function modules before format information is written. Light
 * separator and light timing modules remain unset; use
 * {@link microQrReservedModules} to distinguish them from payload modules.
 */
export function microQrFunctionModules(version) {
    const canonical = canonicalVersion(version);
    const cached = functionCache.get(canonical);
    if (cached)
        return cached;
    const size = microQrVersionSize(canonical);
    const matrix = new BitMatrix(size, size);
    for (let y = 0; y < 7; y++)
        for (let x = 0; x < 7; x++) {
            const outer = x === 0 || x === 6 || y === 0 || y === 6;
            const centre = x >= 2 && x <= 4 && y >= 2 && y <= 4;
            if (outer || centre)
                matrix.set(x, y);
        }
    for (let coordinate = 8; coordinate < size; coordinate += 2) {
        matrix.set(coordinate, 0);
        matrix.set(0, coordinate);
    }
    functionCache.set(canonical, matrix);
    return matrix;
}
/** Shared immutable-in-use map of finder, separator, timing and format modules. */
export function microQrReservedModules(version) {
    const canonical = canonicalVersion(version);
    const cached = reservedCache.get(canonical);
    if (cached)
        return cached;
    const size = microQrVersionSize(canonical);
    const matrix = new BitMatrix(size, size);
    matrix.setRegion(0, 0, 8, 8); // 7x7 finder plus inner separator
    for (let coordinate = 8; coordinate < size; coordinate++) {
        matrix.set(coordinate, 0); // horizontal timing
        matrix.set(0, coordinate); // vertical timing
    }
    for (const [x, y] of microQrFormatInfoPositions(size))
        matrix.set(x, y);
    reservedCache.set(canonical, matrix);
    return matrix;
}
/** Number of modules carrying data or error-correction bits. */
export function microQrFreeModuleCount(version) {
    const size = microQrVersionSize(version);
    const reserved = microQrReservedModules(version);
    let count = 0;
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            if (!reserved.get(x, y))
                count++;
        }
    return count;
}
const orderCache = new Map();
/** Payload module coordinates as interleaved x,y pairs, MSB-first stream order. */
export function microQrDataModuleOrder(version) {
    const canonical = canonicalVersion(version);
    const cached = orderCache.get(canonical);
    if (cached)
        return cached;
    const size = microQrVersionSize(canonical);
    const reserved = microQrReservedModules(canonical);
    const order = new Int32Array(microQrFreeModuleCount(canonical) * 2);
    let offset = 0;
    let upward = true;
    for (let column = size - 1; column > 0; column -= 2) {
        for (let rowOffset = 0; rowOffset < size; rowOffset++) {
            const y = upward ? size - 1 - rowOffset : rowOffset;
            for (let side = 0; side < 2; side++) {
                const x = column - side;
                if (reserved.get(x, y))
                    continue;
                order[offset++] = x;
                order[offset++] = y;
            }
        }
        upward = !upward;
    }
    orderCache.set(canonical, order);
    return order;
}
/** The four Micro QR data-mask predicates. */
export function microQrMaskBit(mask, x, y) {
    switch (mask) {
        case 0: return (y & 1) === 0;
        case 1: return (((y >> 1) + Math.floor(x / 3)) & 1) === 0;
        case 2: return ((((y * x) & 1) + ((y * x) % 3)) & 1) === 0;
        case 3: return ((((y + x) & 1) + ((y * x) % 3)) & 1) === 0;
        default: throw new RangeError(`Micro QR: mask must be an integer in 0..3, got ${mask}`);
    }
}
/** Return all internal table/geometry invariant failures. */
export function validateMicroQrTables() {
    const issues = [];
    if (MICROQR_SYMBOLS.length !== 8)
        issues.push('expected eight symbol/ECC combinations');
    const numbers = new Set();
    for (const entry of MICROQR_SYMBOLS) {
        const tag = `${entry.version}-${entry.ecc}`;
        if (numbers.has(entry.symbolNumber))
            issues.push(`${tag}: duplicate symbol number`);
        numbers.add(entry.symbolNumber);
        if (entry.blockCount !== 1)
            issues.push(`${tag}: Micro QR must use one block`);
        if (entry.dataBits + entry.eccCodewords * 8 !== microQrFreeModuleCount(entry.version)) {
            issues.push(`${tag}: data/ECC bits do not fill the encoding region`);
        }
        if (entry.totalCodewords !== entry.dataCodewords + entry.eccCodewords)
            issues.push(`${tag}: codeword count mismatch`);
        if (entry.dataBits !== (entry.dataCodewords - 1) * 8 + entry.shortDataCodewordBits)
            issues.push(`${tag}: final data codeword mismatch`);
        if (entry.shortDataCodewordBits !== (entry.version === 'M1' || entry.version === 'M3' ? 4 : 8))
            issues.push(`${tag}: wrong final data codeword width`);
    }
    for (const version of MICROQR_VERSIONS) {
        const size = microQrVersionSize(version);
        const positions = microQrFormatInfoPositions(size);
        const unique = new Set(positions.map(([x, y]) => `${x},${y}`));
        if (positions.length !== 15 || unique.size !== 15)
            issues.push(`${version}: format positions must be 15 unique modules`);
        const order = microQrDataModuleOrder(version);
        const orderUnique = new Set();
        for (let i = 0; i < order.length; i += 2) {
            const x = order[i], y = order[i + 1];
            if (microQrReservedModules(version).get(x, y))
                issues.push(`${version}: placement enters reserved module ${x},${y}`);
            orderUnique.add(`${x},${y}`);
        }
        if (orderUnique.size * 2 !== order.length)
            issues.push(`${version}: placement repeats a module`);
        if (order.length !== microQrFreeModuleCount(version) * 2)
            issues.push(`${version}: placement does not cover encoding region`);
        const functions = microQrFunctionModules(version);
        for (let y = 0; y < size; y++)
            for (let x = 0; x < size; x++) {
                if (functions.get(x, y) && !microQrReservedModules(version).get(x, y)) {
                    issues.push(`${version}: dark function module ${x},${y} is not reserved`);
                }
            }
    }
    for (const entry of MICROQR_SYMBOLS)
        for (let mask = 0; mask < 4; mask++) {
            const decoded = microQrDecodeFormatInfo(microQrFormatInfo(entry.symbolNumber, mask));
            if (!decoded || decoded.symbolNumber !== entry.symbolNumber || decoded.mask !== mask || decoded.correctedBits !== 0) {
                issues.push(`${entry.version}-${entry.ecc}: format round-trip failed for mask ${mask}`);
            }
        }
    return issues;
}
