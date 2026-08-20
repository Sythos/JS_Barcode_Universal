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
/** Compact PDF417 detector for clean, integer-scaled rasters. @module compactpdf417/detector */
import { BitMatrix } from '../core/bit-matrix.js';
import { compactPdf417Width } from './tables.js';
import { decodeCompactPDF417 } from './decoder.js';
function rotateClockwise(source) {
    const out = new BitMatrix(source.height, source.width);
    for (let y = 0; y < source.height; y++) {
        for (let x = 0; x < source.width; x++) {
            if (source.get(x, y))
                out.set(source.height - 1 - y, x);
        }
    }
    return out;
}
function cropAndDownsample(source, box, width, height, scale) {
    const out = new BitMatrix(width, height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let dark = 0;
            for (let dy = 0; dy < scale; dy++) {
                for (let dx = 0; dx < scale; dx++) {
                    if (source.get(box.x + x * scale + dx, box.y + y * scale + dy))
                        dark++;
                }
            }
            if (dark * 2 >= scale * scale)
                out.set(x, y);
        }
    }
    return out;
}
function cornersFor(box) {
    return [
        { x: box.x, y: box.y },
        { x: box.x + box.width, y: box.y },
        { x: box.x + box.width, y: box.y + box.height },
        { x: box.x, y: box.y + box.height },
    ];
}
function mapCorners(corners, toOriginal) {
    return corners.map((point) => toOriginal(point));
}
/**
 * Detect one Compact PDF417 symbol in a binarized raster.
 *
 * The clean-raster detector uses the dark bounding box and enumerates legal
 * compact widths, integer module scales, row counts and row heights. It is
 * deliberately conservative: arbitrary perspective, non-integer resampling,
 * grayscale thresholding and damaged stop bars belong to a future photo
 * detector and are not claimed here.
 *
 * @param {import('../core/bit-matrix.js').BitMatrix} binaryImage
 * @param {object} [options]
 * @param {number} [options.rowHeight] Restrict the row-height search.
 * @returns {object|null}
 */
export function detectCompactPDF417(binaryImage, options = {}) {
    if (!binaryImage?.width || !binaryImage?.height || typeof binaryImage.get !== 'function')
        return null;
    let oriented = binaryImage;
    let toOriginal = (point) => ({ x: point.x, y: point.y });
    for (let rotation = 0; rotation < 4; rotation++) {
        const bounds = oriented.getBounds();
        if (bounds) {
            for (let columns = 1; columns <= 30; columns++) {
                const width = compactPdf417Width(columns);
                const scale = bounds.width / width;
                if (!Number.isInteger(scale) || scale < 1)
                    continue;
                const baseHeight = bounds.height / scale;
                const rowHeights = Number.isInteger(options.rowHeight)
                    ? [options.rowHeight]
                    : Array.from({ length: 18 }, (_, index) => index + 3);
                for (const rowHeight of rowHeights) {
                    if (!Number.isInteger(baseHeight / rowHeight))
                        continue;
                    const rows = baseHeight / rowHeight;
                    if (rows < 3 || rows > 90)
                        continue;
                    const matrix = cropAndDownsample(oriented, bounds, width, baseHeight, scale);
                    try {
                        const result = decodeCompactPDF417(matrix, { rowHeight });
                        const corners = mapCorners(cornersFor(bounds), toOriginal);
                        return {
                            ...result,
                            matrix,
                            corners,
                            rotation: rotation * 90,
                            moduleSize: scale,
                            compact: true,
                        };
                    }
                    catch {
                        // Try another geometry; a standard PDF417 or random artwork should
                        // never be accepted unless the compact decoder validates every row.
                    }
                }
            }
        }
        const previous = oriented;
        const previousToOriginal = toOriginal;
        oriented = rotateClockwise(previous);
        toOriginal = (point) => previousToOriginal({ x: point.y, y: previous.height - point.x });
    }
    return null;
}
export function detectAndDecodeCompactPDF417(binaryImage, options = {}) {
    return detectCompactPDF417(binaryImage, options);
}
