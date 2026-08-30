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
 * Shared, format-neutral detector contracts.
 *
 * The module deliberately has no dependency on a particular matrix
 * implementation. A detector can supply its own matrix type through the
 * `TMatrix` generic while keeping the common geometry and candidate metadata.
 *
 * @module core/detection-contract
 */

/** A point in the source image, expressed in image coordinates. */
export type Point = {
    x: number;
    y: number;
};
/** The canonical in-plane orientations supported by shared detectors. */
export type Rotation = 0 | 45 | 90 | 135 | 180 | 225 | 270 | 315;
/**
 * Geometry recovered by a detector.
 *
 * `corners` are ordered top-left, top-right, bottom-right, bottom-left in the
 * source image. `matrix` is the detector's rectified or otherwise decoder-ready
 * representation, and is intentionally generic to keep this contract
 * dependency-free.
 */
export interface DetectionGeometry<TMatrix = unknown> {
    corners: Point[];
    moduleSize: number;
    rotation: Rotation;
    matrix: TMatrix;
    confidence?: number;
}
/**
 * Evidence collected while validating a candidate.
 *
 * Fields are optional because a 1D or 2D detector may not be able to provide
 * every signal. When present, `rows` is a non-negative row count and
 * `consistency` is a normalized value from zero to one.
 */
export interface ValidationQuality {
    quietZone?: boolean;
    checksum?: boolean | null;
    rows?: number | null;
    consistency?: number | null;
    [key: string]: unknown;
}
/** Optional decoded result and ranking metadata for a detection. */
export interface DetectionCandidateOptions<TResult = unknown> {
    result?: TResult;
    quality?: ValidationQuality;
    score?: number;
}
/** A validated detector geometry with optional decode and quality metadata. */
export type DetectionCandidate<TResult = unknown, TMatrix = unknown> = DetectionGeometry<TMatrix> & DetectionCandidateOptions<TResult>;
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
export declare function normalizeRotation(rotation: number): Rotation;
/**
 * Return whether four finite points form an ordered, non-degenerate quad.
 *
 * The required order is top-left, top-right, bottom-right, bottom-left. Both
 * clockwise and counter-clockwise winding are accepted; repeated points,
 * zero-length edges, collinear turns, concave quads, and self-intersections
 * are rejected.
 */
export declare function isValidCorners(corners: unknown): corners is [Point, Point, Point, Point];
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
export declare function createDetectionCandidate<TResult = unknown, TMatrix = unknown>(geometry: DetectionGeometry<TMatrix>, options?: DetectionCandidateOptions<TResult>): DetectionCandidate<TResult, TMatrix>;
