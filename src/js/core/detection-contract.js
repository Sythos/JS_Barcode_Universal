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
function hasOwn(value, property) {
    return Object.prototype.hasOwnProperty.call(value, property);
}
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
function cross(a, b, c) {
    return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
}
/**
 * Normalize a detector rotation to one of the supported 45-degree turns.
 *
 * This function is intentionally strict: arbitrary angles are not silently
 * snapped to a nearby orientation. The accepted domain is the integer range
 * `0..359`, and only exact multiples of 45 degrees are canonical.
 *
 * @throws {TypeError} If `rotation` is not a number.
 * @throws {RangeError} If `rotation` is outside the canonical domain.
 */
export function normalizeRotation(rotation) {
    if (typeof rotation !== 'number') {
        throw new TypeError('Rotation must be a number');
    }
    if (!Number.isFinite(rotation) || !Number.isInteger(rotation)
        || rotation < 0 || rotation >= 360 || rotation % 45 !== 0) {
        throw new RangeError('Rotation must be an integer multiple of 45 degrees in 0..359');
    }
    return rotation;
}
/**
 * Return whether four finite points form an ordered, non-degenerate quad.
 *
 * The required order is top-left, top-right, bottom-right, bottom-left. Both
 * clockwise and counter-clockwise winding are accepted; repeated points,
 * zero-length edges, collinear turns, concave quads, and self-intersections
 * are rejected.
 */
export function isValidCorners(corners) {
    if (!Array.isArray(corners) || corners.length !== 4)
        return false;
    const points = [];
    for (const value of corners) {
        if (!isRecord(value) || !isFiniteNumber(value.x) || !isFiniteNumber(value.y)) {
            return false;
        }
        points.push({ x: value.x, y: value.y });
    }
    for (let first = 0; first < points.length; first++) {
        for (let second = first + 1; second < points.length; second++) {
            if (points[first].x === points[second].x && points[first].y === points[second].y) {
                return false;
            }
        }
    }
    let winding = 0;
    for (let index = 0; index < points.length; index++) {
        const turn = cross(points[index], points[(index + 1) % points.length], points[(index + 2) % points.length]);
        if (!Number.isFinite(turn) || turn === 0)
            return false;
        const sign = Math.sign(turn);
        if (winding === 0)
            winding = sign;
        else if (sign !== winding)
            return false;
    }
    return true;
}
function isValidQuality(value) {
    if (!isRecord(value))
        return false;
    if (hasOwn(value, 'quietZone') && typeof value.quietZone !== 'boolean')
        return false;
    if (hasOwn(value, 'checksum')
        && value.checksum !== null && typeof value.checksum !== 'boolean')
        return false;
    if (hasOwn(value, 'rows') && value.rows !== null
        && (!isFiniteNumber(value.rows) || !Number.isInteger(value.rows) || value.rows < 0)) {
        return false;
    }
    if (hasOwn(value, 'consistency') && value.consistency !== null
        && (!isFiniteNumber(value.consistency) || value.consistency < 0 || value.consistency > 1)) {
        return false;
    }
    return true;
}
function isValidConfidence(value) {
    return value === undefined
        || (isFiniteNumber(value) && value >= 0 && value <= 1);
}
function isValidScore(value) {
    return value === undefined || isFiniteNumber(value);
}
/**
 * Create a validated detector candidate.
 *
 * All optional decoded-result and ranking metadata must be supplied in the
 * options object: `createDetectionCandidate(geometry, { result, quality, score })`.
 * Keeping the decoded result under the explicit `result` key avoids confusing
 * a result object with candidate metadata. The returned value owns a fresh
 * corner array and canonical rotation, and the input objects are never
 * mutated.
 *
 * @throws {TypeError} If the geometry, matrix, or options have an invalid type.
 * @throws {RangeError} If a numeric geometry or metadata value is invalid.
 */
export function createDetectionCandidate(geometry, options) {
    if (!isRecord(geometry)) {
        throw new TypeError('Detection geometry must be an object');
    }
    const geometryValue = geometry;
    const corners = geometryValue.corners;
    if (!isValidCorners(corners)) {
        throw new RangeError('Detection geometry must contain four non-degenerate corners');
    }
    const moduleSize = geometryValue.moduleSize;
    if (!isFiniteNumber(moduleSize) || moduleSize <= 0) {
        throw new RangeError('Detection geometry moduleSize must be a positive finite number');
    }
    const rotation = normalizeRotation(geometryValue.rotation);
    if (!hasOwn(geometryValue, 'matrix') || geometryValue.matrix === null
        || geometryValue.matrix === undefined) {
        throw new TypeError('Detection geometry must contain a matrix');
    }
    if (!isValidConfidence(geometryValue.confidence)) {
        throw new RangeError('Detection geometry confidence must be a finite number in 0..1');
    }
    const candidateOptions = options === undefined ? {} : options;
    if (!isRecord(candidateOptions)) {
        throw new TypeError('Detection candidate options must be an object');
    }
    const quality = candidateOptions.quality;
    if (quality !== undefined && !isValidQuality(quality)) {
        throw new TypeError('Detection candidate quality must be an object');
    }
    if (!isValidScore(candidateOptions.score)) {
        throw new RangeError('Detection candidate score must be a finite number');
    }
    const candidate = {
        ...geometry,
        corners: corners.map((point) => ({ x: point.x, y: point.y })),
        moduleSize,
        rotation,
    };
    if (hasOwn(candidateOptions, 'result') && candidateOptions.result !== undefined)
        candidate.result = candidateOptions.result;
    if (hasOwn(candidateOptions, 'quality') && quality !== undefined)
        candidate.quality = quality;
    if (hasOwn(candidateOptions, 'score') && candidateOptions.score !== undefined)
        candidate.score = candidateOptions.score;
    return candidate;
}
