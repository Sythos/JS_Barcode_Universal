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
 * Aztec Rune decoder.
 *
 * The input is a square 11x11 module matrix. Structural modules are checked
 * before the seven masked GF(16) codewords are Reed-Solomon corrected. The
 * decoder tries the four in-plane quarter turns and both polarities, allowing
 * it to consume an oriented sampled image while still rejecting ordinary
 * Aztec/QR matrices.
 *
 * @module aztecrune/decoder
 */
import { FormatError } from '../core/errors.js';
import { rsDecode } from '../core/reed-solomon.js';
import { AZTEC_RUNE_DATA_POSITIONS, AZTEC_RUNE_ECC_CODEWORDS, AZTEC_RUNE_MASK, AZTEC_RUNE_SIZE, aztecRuneField, aztecRuneStructuralValue, } from './tables.js';
/** @param {import('../core/bit-matrix.js').BitMatrix} source @param {number} turns */
function rotateClockwise(source, turns) {
    let current = source.clone();
    for (let turn = 0; turn < turns; turn++) {
        const out = new source.constructor(current.height, current.width);
        for (let y = 0; y < current.height; y++)
            for (let x = 0; x < current.width; x++) {
                if (current.get(x, y))
                    out.set(current.height - 1 - y, x);
            }
        current = out;
    }
    return current;
}
/** @param {import('../core/bit-matrix.js').BitMatrix} matrix */
function invert(matrix) {
    const out = matrix.clone();
    for (let y = 0; y < out.height; y++)
        for (let x = 0; x < out.width; x++)
            out.flip(x, y);
    return out;
}
/** @param {import('../core/bit-matrix.js').BitMatrix} matrix @param {boolean} inverted */
function structureMatches(matrix, inverted) {
    for (let y = 0; y < AZTEC_RUNE_SIZE; y++)
        for (let x = 0; x < AZTEC_RUNE_SIZE; x++) {
            const expected = aztecRuneStructuralValue(x, y);
            if (expected === null)
                continue;
            if (matrix.get(x, y) !== (inverted ? !expected : expected))
                return false;
        }
    return true;
}
/** @param {import('../core/bit-matrix.js').BitMatrix} matrix @param {boolean} inverted */
function readCodewords(matrix, inverted) {
    const words = new Array(2 + AZTEC_RUNE_ECC_CODEWORDS).fill(0);
    for (let at = 0; at < AZTEC_RUNE_DATA_POSITIONS.length; at++) {
        const [x, y] = AZTEC_RUNE_DATA_POSITIONS[at];
        const bit = matrix.get(x, y) !== inverted;
        words[at >>> 2] = (words[at >>> 2] << 1) | (bit ? 1 : 0);
    }
    return words.map((word) => word ^ AZTEC_RUNE_MASK);
}
/** @param {number} value @param {boolean} inverted @param {number} rotation @param {number} corrections */
function result(value, inverted, rotation, corrections) {
    return {
        format: 'aztecrune',
        value,
        text: String(value).padStart(3, '0'),
        bytes: Uint8Array.of(value),
        dimension: AZTEC_RUNE_SIZE,
        inverted,
        rotation,
        corrections,
    };
}
/**
 * Decode a square Aztec Rune matrix.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} matrix
 * @param {{inverted?: boolean|'auto', rotation?: number|'auto'}} [options]
 * @returns {{format:'aztecrune',value:number,text:string,bytes:Uint8Array,dimension:number,inverted:boolean,rotation:number,corrections:number}}
 * @throws {FormatError} For non-Rune geometry, structure or uncorrectable data.
 */
export function decodeAztecRune(matrix, options = {}) {
    if (!matrix || matrix.width !== AZTEC_RUNE_SIZE || matrix.height !== AZTEC_RUNE_SIZE) {
        throw new FormatError(`Aztec Rune: expected an ${AZTEC_RUNE_SIZE}x${AZTEC_RUNE_SIZE} module matrix`);
    }
    const invertedModes = options.inverted === true ? [true] : options.inverted === false ? [false] : [false, true];
    const rotations = Number.isInteger(options.rotation)
        ? [((options.rotation % 360) + 360) % 360]
        : [0, 90, 180, 270];
    let checksumError = null;
    for (const requestedRotation of rotations) {
        if (requestedRotation % 90 !== 0)
            continue;
        // To canonicalize an input rotated clockwise by k degrees, rotate it
        // counter-clockwise by k. `turns` is the clockwise operation we apply.
        const turns = (4 - requestedRotation / 90) % 4;
        const canonicalRotation = requestedRotation;
        const rotated = turns === 0 ? matrix.clone() : rotateClockwise(matrix, turns);
        for (const inverted of invertedModes) {
            const canonical = inverted ? invert(rotated) : rotated;
            if (!structureMatches(canonical, false))
                continue;
            const words = readCodewords(canonical, false);
            try {
                const corrections = rsDecode(words, AZTEC_RUNE_ECC_CODEWORDS, aztecRuneField(), 1);
                const value = (words[0] << 4) | words[1];
                return result(value, inverted, canonicalRotation, corrections);
            }
            catch (error) {
                checksumError = error;
            }
        }
    }
    if (checksumError) {
        throw new FormatError(`Aztec Rune: Reed-Solomon check failed: ${checksumError.message}`);
    }
    throw new FormatError('Aztec Rune: structural pattern or orientation is invalid');
}
export { readCodewords, structureMatches };
