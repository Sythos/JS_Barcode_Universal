/*!
 * Sythos Barcode Suite
 *
 * MIT License
 *
 * Copyright (c) 2026 Sythos
 * SPDX-FileCopyrightText: 2026 Sythos (https://www.sythos.net)
 * SPDX-License-Identifier: MIT
 *
 * Original work. No code from any other barcode implementation.
 */
/**
 * Integer-scale Han Xin detector.
 *
 * Detection deliberately accepts one prominent, axis-aligned symbol from a
 * binarized image.  It does not guess a perspective quadrilateral or return a
 * low-confidence payload: the strict module decoder remains the final gate.
 *
 * @module hanxin/detector
 */
import { BitMatrix } from '../core/bit-matrix.js';
import { NotFoundError } from '../core/errors.js';
import { decodeHanXin } from './decoder.js';
import { hanXinSize } from './tables.js';
function boundsForPolarity(image, inverted) {
    let left = image.width;
    let top = image.height;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < image.height; y++)
        for (let x = 0; x < image.width; x++) {
            const dark = image.get(x, y) !== inverted;
            if (!dark)
                continue;
            if (x < left)
                left = x;
            if (x > right)
                right = x;
            if (y < top)
                top = y;
            if (y > bottom)
                bottom = y;
        }
    return right < left || bottom < top ? null : {
        x: left,
        y: top,
        width: right - left + 1,
        height: bottom - top + 1,
    };
}
function sampleBounds(source, bounds, version, inverted) {
    const size = hanXinSize(version);
    const matrix = new BitMatrix(size, size);
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            const px = Math.min(source.width - 1, Math.max(0, Math.floor(bounds.x + ((x + 0.5) * bounds.width) / size)));
            const py = Math.min(source.height - 1, Math.max(0, Math.floor(bounds.y + ((y + 0.5) * bounds.height) / size)));
            if (source.get(px, py) !== inverted)
                matrix.set(x, y);
        }
    return matrix;
}
/** Detect one strict, integer-scale Han Xin symbol in a binarized image. */
export function detectHanXin(binaryImage) {
    if (!binaryImage || !Number.isInteger(binaryImage.width) || !Number.isInteger(binaryImage.height) ||
        binaryImage.width < 1 || binaryImage.height < 1) {
        throw new NotFoundError('detectHanXin: no image supplied');
    }
    const candidates = [];
    for (const inverted of [false, true]) {
        const bounds = boundsForPolarity(binaryImage, inverted);
        if (!bounds)
            continue;
        for (const version of [1, 2, 3]) {
            const size = hanXinSize(version);
            if (bounds.width !== bounds.height || bounds.width % size !== 0)
                continue;
            const moduleSize = bounds.width / size;
            if (!Number.isInteger(moduleSize) || moduleSize < 1)
                continue;
            const matrix = sampleBounds(binaryImage, bounds, version, inverted);
            let result;
            try {
                result = decodeHanXin(matrix, { rotation: 'auto', inverted: false });
            }
            catch {
                continue;
            }
            candidates.push({
                corners: [
                    { x: bounds.x, y: bounds.y },
                    { x: bounds.x + bounds.width, y: bounds.y },
                    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
                    { x: bounds.x, y: bounds.y + bounds.height },
                ],
                dimension: { width: size, height: size },
                moduleSize,
                matrix,
                result: { ...result, inverted: result.inverted || inverted },
            });
        }
    }
    candidates.sort((left, right) => right.moduleSize - left.moduleSize);
    return candidates[0] ?? null;
}
/** Detect and decode one verified Han Xin symbol, or return null. */
export function detectAndDecodeHanXin(binaryImage) {
    let detection;
    try {
        detection = detectHanXin(binaryImage);
    }
    catch {
        return null;
    }
    if (!detection)
        return null;
    return {
        ...detection.result,
        corners: detection.corners,
        moduleSize: detection.moduleSize,
    };
}
