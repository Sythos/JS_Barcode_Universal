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
 * Generic normalized bar-height profiles for future height-coded symbols.
 *
 * A profile uses a top and bottom edge in a unit-height coordinate system: zero
 * is the top of the symbol and one is the bottom. The four-state profiles use
 * the two independent edge extensions that are common to this class of
 * symbols, while the two-state profile is the tracker/full subset. A concrete
 * symbology remains responsible for its own data, checksum and orientation
 * rules.
 *
 * @module image/height-coded
 */
/** A state value accepted by a height-coded bar profile. */
export type HeightState = 0 | 1 | 2 | 3;
/** Supported numbers of states. */
export type HeightStateCount = 2 | 4;
/** Normalized top and bottom edges of one height-coded bar. */
export interface HeightCodedBar {
    /** Top edge, normalized to the inclusive range 0..1. */
    top: number;
    /** Bottom edge, normalized to the inclusive range 0..1. */
    bottom: number;
}
/**
 * Validate one state and return its narrowed value.
 *
 * When `stateCount` is supplied, states outside that alphabet are rejected;
 * leaving it out validates the complete four-state range.
 *
 * @param {number} state
 * @param {2|4} [stateCount]
 * @returns {HeightState}
 */
export declare function validateHeightState(state: number, stateCount?: HeightStateCount): HeightState;
/**
 * Return the normalized top and bottom edges for one state.
 *
 * State numbering is intentionally generic: 0 is tracker, 1 is ascender,
 * 2 is descender and 3 is full for the four-state alphabet. The two-state
 * alphabet exposes tracker (0) and full (1), so it is a strict subset of the
 * four-state geometry and does not prescribe a postal format's semantics.
 *
 * @param {number} state
 * @param {2|4} stateCount
 * @returns {HeightCodedBar}
 */
export declare function barHeightProfile(state: number, stateCount: HeightStateCount): HeightCodedBar;
/**
 * Convert a state sequence to normalized top/bottom bar profiles.
 *
 * The returned array and every profile in it are newly allocated, so callers
 * can safely adjust rendering coordinates without changing shared constants.
 *
 * @param {ArrayLike<number>} states
 * @param {2|4} stateCount
 * @returns {HeightCodedBar[]}
 */
export declare function encodeHeightProfile(states: ArrayLike<number>, stateCount: HeightStateCount): HeightCodedBar[];
/**
 * Convert normalized top/bottom bar profiles back to their states.
 *
 * Decoding is deliberately exact: a profile must match one of the canonical
 * normalized pairs for the selected alphabet. Raster or measurement code can
 * quantize its observations before calling this helper; accepting arbitrary
 * in-range pairs here would turn malformed bars into valid states.
 *
 * @param {ArrayLike<HeightCodedBar>} profile
 * @param {2|4} stateCount
 * @returns {HeightState[]}
 */
export declare function decodeHeightProfile(profile: ArrayLike<HeightCodedBar>, stateCount: HeightStateCount): HeightState[];
