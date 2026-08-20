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
 * Greyscale to black-and-white.
 *
 * This is the single biggest determinant of whether a reader works on real
 * photographs. Decoding logic is exact and either right or wrong; binarization
 * is a judgement call made a million times per image, and every downstream
 * stage inherits its mistakes. A symbol lost here is lost permanently.
 *
 * Two strategies:
 *
 *   global  — one threshold for the whole image. Fast, and correct for clean
 *             synthetic images: screenshots, generated PNGs, flat scans.
 *   hybrid  — a threshold per 8x8 block, smoothed across neighbours. Handles
 *             the uneven lighting that dominates camera input: shadows,
 *             glare, vignetting, a page curving away from the lens.
 *
 * @module image/binarizer
 */
import { BitMatrix } from '../core/bit-matrix.js';
import { NotFoundError } from '../core/errors.js';
/** Side of a block, in pixels. */
const BLOCK = 8;
const BLOCK_SHIFT = 3;
/** Below this spread, a block is treated as uniform rather than as edges. */
const MIN_DYNAMIC_RANGE = 24;
/**
 * One threshold for the entire image, chosen from the luminance histogram.
 *
 * Finds the two strongest peaks — ideally ink and paper — and cuts at the
 * point of lowest population between them, weighted by distance so a narrow
 * secondary peak does not drag the threshold onto a shoulder.
 *
 * @param {import('./luminance.js').LuminanceSource} source
 * @returns {BitMatrix} Set bit = dark module.
 */
export function binarizeGlobal(source) {
    const { grey, width, height } = source;
    const buckets = new Int32Array(32);
    for (let i = 0; i < grey.length; i++)
        buckets[grey[i] >> 3]++;
    const threshold = pickThreshold(buckets);
    const out = new BitMatrix(width, height);
    for (let y = 0; y < height; y++) {
        const base = y * width;
        for (let x = 0; x < width; x++) {
            if (grey[base + x] < threshold)
                out.set(x, y);
        }
    }
    return out;
}
/**
 * @param {Int32Array} buckets
 * @returns {number} Threshold in 0-255.
 */
function pickThreshold(buckets) {
    const n = buckets.length;
    let firstPeak = 0, firstPeakSize = 0;
    for (let i = 0; i < n; i++) {
        if (buckets[i] > firstPeakSize) {
            firstPeakSize = buckets[i];
            firstPeak = i;
        }
    }
    // Score candidates by population scaled by squared distance from the first
    // peak: the second peak must be both populous and clearly separated.
    let secondPeak = 0, secondScore = 0;
    for (let i = 0; i < n; i++) {
        const d = i - firstPeak;
        const score = buckets[i] * d * d;
        if (score > secondScore) {
            secondScore = score;
            secondPeak = i;
        }
    }
    let low = Math.min(firstPeak, secondPeak);
    let high = Math.max(firstPeak, secondPeak);
    if (high - low <= n >> 4) {
        // Effectively unimodal — a blank region, or an image with no ink. Fall
        // back to the midpoint of the occupied range rather than inventing edges.
        let lo = 0, hi = n - 1;
        while (lo < n && buckets[lo] === 0)
            lo++;
        while (hi > 0 && buckets[hi] === 0)
            hi--;
        return (((lo + hi) >> 1) << 3) + 4;
    }
    // Deepest valley between the peaks, biased toward the middle.
    let valley = low, valleyScore = -1;
    for (let i = low + 1; i < high; i++) {
        const fromLow = i - low;
        const fromHigh = high - i;
        const score = fromLow * fromHigh * (firstPeakSize - buckets[i]);
        if (score > valleyScore) {
            valleyScore = score;
            valley = i;
        }
    }
    return (valley << 3) + 4;
}
/**
 * Locally adaptive thresholding.
 *
 * Per 8x8 block: compute min, max and mean. A block with real contrast gets
 * its own mean as the threshold. A block that is flat is ambiguous on its own
 * — solid paper and solid ink look identical from the inside — so it inherits
 * from its neighbourhood, which is what stops large quiet zones from being
 * speckled into noise.
 *
 * Thresholds are then averaged over a 5x5 block window, so lighting gradients
 * are followed smoothly instead of producing visible block seams that the
 * detectors would read as edges.
 *
 * @param {import('./luminance.js').LuminanceSource} source
 * @returns {BitMatrix}
 */
export function binarizeHybrid(source) {
    const { grey, width, height } = source;
    // Too small to block up meaningfully; the global pass is strictly better.
    if (width < BLOCK * 5 || height < BLOCK * 5)
        return binarizeGlobal(source);
    const bw = (width + BLOCK - 1) >> BLOCK_SHIFT;
    const bh = (height + BLOCK - 1) >> BLOCK_SHIFT;
    const means = new Int32Array(bw * bh);
    const ranges = new Int32Array(bw * bh);
    for (let by = 0; by < bh; by++) {
        const y0 = by << BLOCK_SHIFT;
        const y1 = Math.min(y0 + BLOCK, height);
        for (let bx = 0; bx < bw; bx++) {
            const x0 = bx << BLOCK_SHIFT;
            const x1 = Math.min(x0 + BLOCK, width);
            let sum = 0, min = 255, max = 0, count = 0;
            for (let y = y0; y < y1; y++) {
                const base = y * width;
                for (let x = x0; x < x1; x++) {
                    const v = grey[base + x];
                    sum += v;
                    if (v < min)
                        min = v;
                    if (v > max)
                        max = v;
                    count++;
                }
            }
            const idx = by * bw + bx;
            means[idx] = count ? (sum / count) | 0 : 128;
            ranges[idx] = max - min;
        }
    }
    // Flat blocks adopt a threshold from context. Looking left and up is enough
    // because those neighbours are already resolved, and it makes the pass
    // single-shot rather than iterative.
    for (let by = 0; by < bh; by++) {
        for (let bx = 0; bx < bw; bx++) {
            const idx = by * bw + bx;
            if (ranges[idx] >= MIN_DYNAMIC_RANGE)
                continue;
            let inherited = means[idx];
            if (bx > 0 && by > 0) {
                const neighbours = [
                    means[idx - 1],
                    means[idx - bw],
                    means[idx - bw - 1],
                ];
                const avg = (neighbours[0] + neighbours[1] + neighbours[2]) / 3;
                // A flat block darker than its surroundings is ink; lighter is paper.
                // Either way the local minimum is the safer threshold than the mean.
                inherited = Math.min(avg, means[idx]);
            }
            means[idx] = inherited | 0;
        }
    }
    const out = new BitMatrix(width, height);
    const R = 2; // 5x5 block window
    for (let by = 0; by < bh; by++) {
        const y0 = by << BLOCK_SHIFT;
        const y1 = Math.min(y0 + BLOCK, height);
        const byLo = Math.max(0, by - R);
        const byHi = Math.min(bh - 1, by + R);
        for (let bx = 0; bx < bw; bx++) {
            const bxLo = Math.max(0, bx - R);
            const bxHi = Math.min(bw - 1, bx + R);
            let sum = 0, count = 0;
            for (let ny = byLo; ny <= byHi; ny++) {
                for (let nx = bxLo; nx <= bxHi; nx++) {
                    sum += means[ny * bw + nx];
                    count++;
                }
            }
            const threshold = sum / count;
            const x0 = bx << BLOCK_SHIFT;
            const x1 = Math.min(x0 + BLOCK, width);
            for (let y = y0; y < y1; y++) {
                const base = y * width;
                for (let x = x0; x < x1; x++) {
                    if (grey[base + x] < threshold)
                        out.set(x, y);
                }
            }
        }
    }
    return out;
}
/**
 * Binarize with the named strategy.
 *
 * @param {import('./luminance.js').LuminanceSource} source
 * @param {'global' | 'hybrid' | 'auto'} [strategy]
 * @returns {BitMatrix}
 */
export function binarize(source, strategy = 'auto') {
    if (!source || !source.grey)
        throw new NotFoundError('binarize: no luminance source');
    switch (strategy) {
        case 'global': return binarizeGlobal(source);
        case 'hybrid': return binarizeHybrid(source);
        case 'auto':
            // Small images are almost always generated rather than photographed.
            return source.width * source.height < 200 * 200
                ? binarizeGlobal(source)
                : binarizeHybrid(source);
        default:
            throw new NotFoundError(`Unknown binarizer strategy: ${strategy}`);
    }
}
