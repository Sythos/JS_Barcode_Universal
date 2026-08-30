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
const TRACKER_PROFILE = { top: 0.25, bottom: 0.75 };
const ASCENDER_PROFILE = { top: 0, bottom: 0.75 };
const DESCENDER_PROFILE = { top: 0.25, bottom: 1 };
const FULL_PROFILE = { top: 0, bottom: 1 };
// Keep validation and output allocations bounded when a caller passes data
// originating in a file or camera pipeline.
const MAX_PROFILE_LENGTH = 1000000;
function validateStateCount(stateCount) {
    if (stateCount !== 2 && stateCount !== 4) {
        throw new RangeError(`Height state count must be 2 or 4, got ${String(stateCount)}`);
    }
    return stateCount;
}
function validateProfileLength(value, label) {
    if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
        throw new TypeError(`${label} must be an array-like object`);
    }
    const length = value.length;
    if (typeof length !== 'number'
        || !Number.isSafeInteger(length) || length < 0 || length > MAX_PROFILE_LENGTH) {
        throw new RangeError(`${label} length must be a safe integer between 0 and ${MAX_PROFILE_LENGTH}`);
    }
    return length;
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
export function validateHeightState(state, stateCount) {
    if (stateCount !== undefined)
        validateStateCount(stateCount);
    if (!Number.isSafeInteger(state)) {
        throw new RangeError(`Height state must be a finite safe integer, got ${String(state)}`);
    }
    const maximum = stateCount === 2 ? 1 : 3;
    if (state < 0 || state > maximum) {
        throw new RangeError(`Height state must be between 0 and ${maximum} for ${stateCount ?? 4} states, got ${state}`);
    }
    return state;
}
function copyProfile(profile) {
    return { top: profile.top, bottom: profile.bottom };
}
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
export function barHeightProfile(state, stateCount) {
    const count = validateStateCount(stateCount);
    const checked = validateHeightState(state, count);
    if (count === 2) {
        return copyProfile(checked === 0 ? TRACKER_PROFILE : FULL_PROFILE);
    }
    switch (checked) {
        case 0: return copyProfile(TRACKER_PROFILE);
        case 1: return copyProfile(ASCENDER_PROFILE);
        case 2: return copyProfile(DESCENDER_PROFILE);
        default: return copyProfile(FULL_PROFILE);
    }
}
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
export function encodeHeightProfile(states, stateCount) {
    const count = validateStateCount(stateCount);
    const length = validateProfileLength(states, 'Height states');
    const profile = new Array(length);
    for (let index = 0; index < length; index++) {
        profile[index] = barHeightProfile(states[index], count);
    }
    return profile;
}
function decodeBar(profile, stateCount, index) {
    if (profile === null || typeof profile !== 'object' || Array.isArray(profile)) {
        throw new TypeError(`Height profile at index ${index} must be an object`);
    }
    const { top, bottom } = profile;
    if (typeof top !== 'number' || typeof bottom !== 'number'
        || !Number.isFinite(top) || !Number.isFinite(bottom)) {
        throw new RangeError(`Height profile at index ${index} must contain finite edges`);
    }
    if (top < 0 || top > 1 || bottom < 0 || bottom > 1 || top >= bottom) {
        throw new RangeError(`Height profile at index ${index} must satisfy 0 <= top < bottom <= 1`);
    }
    const maximum = stateCount === 2 ? 1 : 3;
    for (let state = 0; state <= maximum; state++) {
        const expected = barHeightProfile(state, stateCount);
        if (top === expected.top && bottom === expected.bottom) {
            return state;
        }
    }
    throw new RangeError(`Height profile at index ${index} does not match a canonical ${stateCount}-state profile`);
}
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
export function decodeHeightProfile(profile, stateCount) {
    const count = validateStateCount(stateCount);
    const length = validateProfileLength(profile, 'Height profile');
    const states = new Array(length);
    for (let index = 0; index < length; index++) {
        states[index] = decodeBar(profile[index], count, index);
    }
    return states;
}
