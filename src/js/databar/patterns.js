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
/** Mathematical width construction for GS1 DataBar characters. @module databar/patterns */
import { dataBar14GroupFor } from './tables.js';
function combinations(n, r) {
    if (n < r || r < 0)
        return 0;
    if (r === 0 || n === r)
        return 1;
    let result = 1;
    const k = Math.min(r, n - r);
    for (let i = 1; i <= k; i++)
        result = result * (n - k + i) / i;
    return result;
}
/**
 * Unrank one constrained positive composition.
 *
 * The rank is the GS1 DataBar symbol-character value inside its group. This
 * implementation follows the combinatorial definition directly: it counts
 * every remaining admissible suffix rather than storing third-party patterns.
 */
export function dataBarWidths(rank, modules, elements, maximumWidth, noNarrow) {
    if (!Number.isInteger(rank) || rank < 0)
        throw new RangeError('GS1 DataBar width rank must be non-negative');
    const widths = new Array(elements).fill(0);
    let remaining = modules;
    let narrowMask = 0;
    for (let bar = 0; bar < elements - 1; bar++) {
        let count = 0;
        for (let width = 1;; width++) {
            narrowMask |= width === 1 ? 1 << bar : 0;
            count = combinations(remaining - width - 1, elements - bar - 2);
            if (noNarrow && narrowMask === 0 && remaining - width - (elements - bar - 1) >= elements - bar - 1) {
                count -= combinations(remaining - width - (elements - bar), elements - bar - 2);
            }
            if (elements - bar - 1 > 1) {
                let tooWide = 0;
                for (let last = remaining - width - (elements - bar - 2); last > maximumWidth; last--) {
                    tooWide += combinations(remaining - width - last - 1, elements - bar - 3);
                }
                count -= tooWide * (elements - 1 - bar);
            }
            else if (remaining - width > maximumWidth) {
                count--;
            }
            if (rank < count) {
                widths[bar] = width;
                remaining -= width;
                break;
            }
            rank -= count;
            narrowMask &= ~(1 << bar);
        }
    }
    widths[elements - 1] = remaining;
    if (rank !== 0 || widths.some((width) => width < 1 || width > maximumWidth)) {
        throw new RangeError('GS1 DataBar width rank exceeds its character group');
    }
    return widths;
}
/** Convert one DataBar-14 character value into its eight alternating widths. */
export function dataBar14CharacterWidths(value, kind) {
    const group = dataBar14GroupFor(value, kind);
    const offset = value - group.gsum;
    const outside = kind === 'outside';
    const oddRank = outside ? Math.floor(offset / group.evenTotal) : offset % group.oddTotal;
    const evenRank = outside ? offset % group.evenTotal : Math.floor(offset / group.oddTotal);
    const odd = dataBarWidths(oddRank, group.oddModules, 4, group.oddWidest, !outside);
    const even = dataBarWidths(evenRank, group.evenModules, 4, group.evenWidest, outside);
    const result = [];
    for (let i = 0; i < 4; i++)
        result.push(odd[i], even[i]);
    return result;
}
const inverseCharacterMaps = new Map();
/** Recover a character value from its canonical eight-width representation. */
export function dataBar14ValueForWidths(widths, kind) {
    if (!Array.isArray(widths) || widths.length !== 8 || widths.some((width) => !Number.isInteger(width) || width < 1)) {
        throw new TypeError('GS1 DataBar character widths must contain eight positive integers');
    }
    if (kind !== 'outside' && kind !== 'inside')
        throw new RangeError(`Unknown GS1 DataBar character kind "${kind}"`);
    let inverse = inverseCharacterMaps.get(kind);
    if (!inverse) {
        inverse = new Map();
        const maximum = kind === 'outside' ? 2840 : 1596;
        for (let value = 0; value <= maximum; value++) {
            inverse.set(dataBar14CharacterWidths(value, kind).join(','), value);
        }
        inverseCharacterMaps.set(kind, inverse);
    }
    const value = inverse.get(widths.join(','));
    if (value === undefined)
        throw new RangeError(`Invalid GS1 DataBar ${kind} character widths`);
    return value;
}
/** Nine finder patterns, expressed as normative five-element widths. */
export const DATABAR14_FINDERS = Object.freeze([
    Object.freeze([3, 8, 2, 1, 1]), Object.freeze([3, 5, 5, 1, 1]),
    Object.freeze([3, 3, 7, 1, 1]), Object.freeze([3, 1, 9, 1, 1]),
    Object.freeze([2, 7, 4, 1, 1]), Object.freeze([2, 5, 6, 1, 1]),
    Object.freeze([2, 3, 8, 1, 1]), Object.freeze([1, 5, 7, 1, 1]),
    Object.freeze([1, 3, 9, 1, 1]),
]);
/** Weight sequence generated as powers of three modulo 79. */
export const DATABAR14_CHECKSUM_WEIGHTS = Object.freeze(Array.from({ length: 32 }, (_, index) => {
    let value = 1;
    for (let i = 0; i < index; i++)
        value = (value * 3) % 79;
    return value;
}));
