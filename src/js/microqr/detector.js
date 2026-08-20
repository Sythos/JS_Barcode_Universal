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
import { NotFoundError } from '../core/errors.js';
import { sampleQuad } from '../image/grid-sampler.js';
import { decodeMicroQR } from './decoder.js';
/** Legal Micro QR side lengths (M1 through M4). */
const DIMENSIONS = [11, 13, 15, 17];
/** @typedef {{x:number, y:number}} Point */
/**
 * @typedef {object} Detection
 * @property {Point[]} corners Outer corners in reading order.
 * @property {number} dimension Side length in modules.
 * @property {'M1'|'M2'|'M3'|'M4'} version
 * @property {number} moduleSize Estimated pixels per module at the finder.
 * @property {number} rotation Clockwise orientation of the source raster.
 * @property {boolean} inverted Whether the detected symbol used inverted polarity.
 * @property {BitMatrix} matrix Rectified, normally polarised module matrix.
 */
function rotateVector(vector) {
    return { x: -vector.y, y: vector.x };
}
function add(point, a, av, b, bv) {
    return { x: point.x + a.x * av + b.x * bv, y: point.y + a.y * av + b.y * bv };
}
function sample(image, point) {
    const x = Math.round(point.x);
    const y = Math.round(point.y);
    if (x < 0 || y < 0 || x >= image.width || y >= image.height)
        return null;
    return image.get(x, y);
}
function expectedFinder(x, y) {
    return x === 0 || y === 0 || x === 6 || y === 6 ||
        (x >= 2 && x <= 4 && y >= 2 && y <= 4);
}
/** Connected components matching one polarity, capped to plausible centre blocks. */
function components(image, value) {
    const seen = new Uint8Array(image.width * image.height);
    const result = [];
    const maximumArea = Math.max(16, Math.floor(image.width * image.height * 0.08));
    for (let y = 0; y < image.height; y++)
        for (let x = 0; x < image.width; x++) {
            const start = y * image.width + x;
            if (seen[start] || image.get(x, y) !== value)
                continue;
            const queueX = [x];
            const queueY = [y];
            seen[start] = 1;
            let head = 0;
            let minX = x;
            let maxX = x;
            let minY = y;
            let maxY = y;
            while (head < queueX.length) {
                const px = queueX[head];
                const py = queueY[head++];
                if (px < minX)
                    minX = px;
                if (px > maxX)
                    maxX = px;
                if (py < minY)
                    minY = py;
                if (py > maxY)
                    maxY = py;
                for (const [nx, ny] of [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]]) {
                    if (nx < 0 || ny < 0 || nx >= image.width || ny >= image.height)
                        continue;
                    const index = ny * image.width + nx;
                    if (!seen[index] && image.get(nx, ny) === value) {
                        seen[index] = 1;
                        queueX.push(nx);
                        queueY.push(ny);
                    }
                }
            }
            const width = maxX - minX + 1;
            const height = maxY - minY + 1;
            const area = width * height;
            if (queueX.length > maximumArea || Math.min(width, height) < 2)
                continue;
            if (Math.max(width, height) > Math.min(width, height) * 1.7)
                continue;
            if (queueX.length < area * 0.42)
                continue;
            result.push({
                x: (minX + maxX) / 2,
                y: (minY + maxY) / 2,
                width,
                height,
                pixels: queueX.length,
            });
        }
    return result.sort((a, b) => b.pixels - a.pixels).slice(0, 256);
}
/** Score the complete 7x7 finder at module centres. */
function finderScore(image, centre, u, v, pitch, inverted) {
    let correct = 0;
    let total = 0;
    for (let y = 0; y < 7; y++)
        for (let x = 0; x < 7; x++) {
            const actual = sample(image, add(centre, u, (x - 3) * pitch, v, (y - 3) * pitch));
            if (actual === null)
                continue;
            const wanted = inverted ? !expectedFinder(x, y) : expectedFinder(x, y);
            if (actual === wanted)
                correct++;
            total++;
        }
    return total === 49 ? correct / total : 0;
}
/** Validate separator, timing arms and a sparse quiet-zone outline. */
function structureScore(image, centre, u, v, pitch, dimension, sx, sy, inverted) {
    let correct = 0;
    let total = 0;
    const check = (x, y, dark) => {
        const point = add(centre, u, (x - 3) * pitch * sx, v, (y - 3) * pitch * sy);
        const actual = sample(image, point);
        if (actual !== null && actual === (inverted ? !dark : dark))
            correct++;
        total++;
    };
    // The light separator lies between the finder and encoding region.
    for (let i = 0; i <= 7; i++) {
        check(7, i, false);
        check(i, 7, false);
    }
    // Both timing arms start dark at coordinate 8 and alternate to the edge.
    for (let i = 8; i < dimension; i++) {
        check(i, 0, (i & 1) === 0);
        check(0, i, (i & 1) === 0);
    }
    // A quiet-zone sample just beyond each edge rejects an isolated normal-QR
    // finder and most decorative squares without requiring a perfect crop.
    for (let i = 0; i < dimension; i += 2) {
        check(i, -1.25, false);
        check(-1.25, i, false);
        check(i, dimension + 0.75, false);
        check(dimension + 0.75, i, false);
    }
    return correct / total;
}
function invert(matrix) {
    const out = matrix.clone();
    for (let y = 0; y < out.height; y++)
        for (let x = 0; x < out.width; x++)
            out.flip(x, y);
    return out;
}
function orientationDegrees(u) {
    const degrees = Math.atan2(u.y, u.x) * 180 / Math.PI;
    return ((Math.round(degrees / 90) * 90) % 360 + 360) % 360;
}
function cornersFor(centre, u, v, pitch, dimension, sx, sy, dx = 0, dy = 0) {
    const tl = add(centre, u, -3.5 * pitch, v, -3.5 * pitch);
    const tr = add(tl, u, dimension * pitch * sx, v, 0);
    const bl = add(tl, u, 0, v, dimension * pitch * sy);
    const br = add(add(tr, v, dimension * pitch * sy, u, 0), u, dx * pitch, v, dy * pitch);
    return [tl, tr, br, bl];
}
function candidateKey(detection) {
    const centre = detection.finderCentre;
    return `${Math.round(centre.x)},${Math.round(centre.y)},${detection.dimension}`;
}
function sameCandidate(left, right) {
    if (left.dimension !== right.dimension)
        return false;
    const centre = (detection) => detection.corners.reduce((sum, point) => ({ x: sum.x + point.x / 4, y: sum.y + point.y / 4 }), { x: 0, y: 0 });
    const a = centre(left);
    const b = centre(right);
    const tolerance = Math.max(left.moduleSize, right.moduleSize) * 2;
    return Math.hypot(a.x - b.x, a.y - b.y) < tolerance;
}
/**
 * Find Micro QR symbols in a binarized raster.
 *
 * The search accepts arbitrary in-plane angles, including all quarter-turns.
 * Non-integer scale is supported through centre sampling. Mild projective
 * distortion is handled by searching the unconstrained fourth corner.
 *
 * @param {BitMatrix} binaryImage Set bit = dark.
 * @returns {Detection[]} Best candidate first; empty when no symbol is found.
 */
export function detectMicroQR(binaryImage) {
    if (!binaryImage || !binaryImage.width || !binaryImage.height) {
        throw new NotFoundError('detectMicroQR: no image supplied');
    }
    const detections = [];
    const seen = new Set();
    for (const inverted of [false, true]) {
        for (const centre of components(binaryImage, !inverted)) {
            for (let degrees = 0; degrees < 180; degrees += 3) {
                const angle = degrees * Math.PI / 180;
                const axis = { x: Math.cos(angle), y: Math.sin(angle) };
                const perpendicular = rotateVector(axis);
                const footprint = Math.abs(axis.x) + Math.abs(axis.y);
                const pitch = ((centre.width + centre.height) / 2) / (3 * footprint);
                if (pitch < 0.75)
                    continue;
                // The finder is rotationally symmetric; four turns decide which pair
                // of arms points into the encoding region.
                for (let turn = 0, u = axis, v = perpendicular; turn < 4; turn++) {
                    if (turn > 0) {
                        u = v;
                        v = { x: -u.y, y: u.x };
                    }
                    const fScore = finderScore(binaryImage, centre, u, v, pitch, inverted);
                    if (fScore < 0.9)
                        continue;
                    for (const dimension of DIMENSIONS) {
                        const scales = [0.84, 0.92, 1, 1.08, 1.16];
                        const rankedX = scales.map((scale) => ({
                            scale,
                            score: structureScore(binaryImage, centre, u, v, pitch, dimension, scale, 1, inverted),
                        })).sort((a, b) => b.score - a.score).slice(0, 2);
                        const rankedY = scales.map((scale) => ({
                            scale,
                            score: structureScore(binaryImage, centre, u, v, pitch, dimension, 1, scale, inverted),
                        })).sort((a, b) => b.score - a.score).slice(0, 2);
                        for (const xs of rankedX)
                            for (const ys of rankedY) {
                                const score = structureScore(binaryImage, centre, u, v, pitch, dimension, xs.scale, ys.scale, inverted);
                                if (score < 0.78)
                                    continue;
                                // With a single finder there is no direct bottom-right anchor.
                                // A compact search around the affine estimate lets the projective
                                // sampler account for convergence of the remote edges.
                                for (const delta of [[0, 0], [-0.75, 0], [0.75, 0], [0, -0.75], [0, 0.75],
                                    [-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]]) {
                                    const corners = cornersFor(centre, u, v, pitch, dimension, xs.scale, ys.scale, delta[0], delta[1]);
                                    let matrix;
                                    try {
                                        matrix = sampleQuad(binaryImage, dimension, corners, score < 0.9);
                                    }
                                    catch (error) {
                                        continue;
                                    }
                                    if (inverted)
                                        matrix = invert(matrix);
                                    try {
                                        const decoded = decodeMicroQR(matrix);
                                        const version = decoded.version ?? `M${(dimension - 9) / 2}`;
                                        const detection = {
                                            corners,
                                            dimension,
                                            version,
                                            moduleSize: pitch,
                                            rotation: orientationDegrees(u),
                                            inverted,
                                            matrix,
                                            finderCentre: { x: centre.x, y: centre.y },
                                            score: fScore + score,
                                        };
                                        const key = candidateKey(detection);
                                        if (!seen.has(key) && !detections.some((entry) => sameCandidate(entry, detection))) {
                                            seen.add(key);
                                            detections.push(detection);
                                        }
                                        // Decoder validation settled this dimension and orientation.
                                        break;
                                    }
                                    catch (error) {
                                        /* Try the next perspective hypothesis. */
                                    }
                                }
                            }
                    }
                }
            }
        }
    }
    detections.sort((a, b) => b.score - a.score || b.moduleSize - a.moduleSize);
    for (const detection of detections) {
        delete detection.finderCentre;
        delete detection.score;
    }
    return detections;
}
/**
 * Detect and decode all Micro QR symbols in a binarized raster.
 *
 * @param {BitMatrix} binaryImage
 * @returns {Array<object>}
 */
export function detectAndDecodeMicroQR(binaryImage) {
    let detections;
    try {
        detections = detectMicroQR(binaryImage);
    }
    catch (error) {
        return [];
    }
    const results = [];
    const seen = new Set();
    for (const detection of detections) {
        try {
            const decoded = decodeMicroQR(detection.matrix);
            const key = `${decoded.version ?? detection.version}|${decoded.text ?? ''}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            results.push(Object.assign({
                corners: detection.corners,
                rotation: detection.rotation,
                inverted: detection.inverted,
            }, decoded));
        }
        catch (error) {
            /* A failed candidate is a normal no-symbol result. */
        }
    }
    return results;
}
