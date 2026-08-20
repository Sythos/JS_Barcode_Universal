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
export declare function binarizeGlobal(source: import('./luminance.js').LuminanceSource): BitMatrix;
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
export declare function binarizeHybrid(source: import('./luminance.js').LuminanceSource): BitMatrix;
/**
 * Binarize with the named strategy.
 *
 * @param {import('./luminance.js').LuminanceSource} source
 * @param {'global' | 'hybrid' | 'auto'} [strategy]
 * @returns {BitMatrix}
 */
export declare function binarize(source: import('./luminance.js').LuminanceSource, strategy?: 'global' | 'hybrid' | 'auto'): BitMatrix;
