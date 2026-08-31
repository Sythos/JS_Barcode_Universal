/*!
 * Sythos Barcode Suite
 *
 * MIT License
 * Copyright (c) 2026 Sythos
 * SPDX-License-Identifier: MIT
 *
 * Original work. No code from any other barcode implementation.
 */
/** Conservative integer-module Code 16K detector. @module code16k/detector */
import { BitMatrix } from '../core/bit-matrix.js';
import { code128PatternModules, renderStackedRows, sampleModules, scanStackedRows, } from '../stacked128/common.js';
import { code16kStartModules, code16kStopModules } from './tables.js';
import { decodeCode16K, decodeCode16KRow } from './decoder.js';
function rowModules(row, values) {
    return code16kStartModules(row) + '1' + values.map((value) => code128PatternModules(value)).join('') +
        code16kStopModules(row);
}
function rotateClockwise(source) {
    const rotated = new BitMatrix(source.height, source.width);
    for (let y = 0; y < source.height; y++) {
        for (let x = 0; x < source.width; x++) {
            if (source.get(x, y))
                rotated.set(source.height - 1 - y, x);
        }
    }
    return rotated;
}
function cornersFor(x, y, width, height) {
    return [
        { x, y }, { x: x + width, y },
        { x: x + width, y: y + height }, { x, y: y + height },
    ];
}
function rowHasDarkPixels(image, y, x, width) {
    if (y < 0 || y >= image.height)
        return false;
    for (let offset = 0; offset < width; offset++)
        if (!image.get(x + offset, y))
            return false;
    return true;
}
function contiguousSpan(values) {
    if (!values.length)
        return 0;
    const sorted = [...new Set(values)].sort((a, b) => a - b);
    let best = 1;
    let current = 1;
    for (let index = 1; index < sorted.length; index++) {
        if (sorted[index] === sorted[index - 1] + 1)
            current++;
        else {
            best = Math.max(best, current);
            current = 1;
        }
    }
    return Math.max(best, current);
}
function parseSample(row, start, moduleSize) {
    const modules = sampleModules(row, start, moduleSize, 70);
    if (!modules)
        return null;
    const parsed = decodeCode16KRow(modules);
    return parsed ? { ...parsed, modules } : null;
}
function detectOriented(image, options) {
    const requestedScale = options.moduleSize;
    if (requestedScale !== undefined &&
        (!Number.isInteger(requestedScale) || requestedScale < 1 || requestedScale > 32))
        return null;
    const maxModules = 70 * (requestedScale ?? 32);
    const found = scanStackedRows(image, 70, parseSample, maxModules)
        .filter((candidate) => requestedScale === undefined || candidate.moduleSize === requestedScale);
    const groups = new Map();
    for (const candidate of found) {
        const key = `${candidate.x}:${candidate.moduleSize}`;
        let group = groups.get(key);
        if (!group) {
            group = { x: candidate.x, moduleSize: candidate.moduleSize, rows: new Map() };
            groups.set(key, group);
        }
        let values = group.rows.get(candidate.parsed.row);
        if (!values) {
            values = [];
            group.rows.set(candidate.parsed.row, values);
        }
        values.push({ y: candidate.y, parsed: candidate.parsed });
    }
    for (const group of groups.values()) {
        const firstCandidates = group.rows.get(0);
        if (!firstCandidates?.length)
            continue;
        for (const first of firstCandidates) {
            const encodedRows = Math.floor(first.parsed.values[0] / 7) + 2;
            if (encodedRows < 2 || encodedRows > 16 || group.rows.size !== encodedRows)
                continue;
            const chosen = [];
            let complete = true;
            for (let row = 0; row < encodedRows; row++) {
                const entries = group.rows.get(row);
                if (!entries?.length) {
                    complete = false;
                    break;
                }
                const sorted = entries.slice().sort((a, b) => a.y - b.y);
                chosen.push({ y: sorted[0].y, parsed: sorted[0].parsed });
            }
            if (!complete)
                continue;
            const scale = group.moduleSize;
            const spans = chosen.map((entry) => {
                const entries = group.rows.get(entry.parsed.row) ?? [];
                return contiguousSpan(entries.map((candidate) => candidate.y));
            });
            if (!spans.every((span) => span === spans[0]) || spans[0] < scale || spans[0] % scale !== 0)
                continue;
            const rowHeight = spans[0] / scale;
            const firstY = chosen[0].y;
            const steps = chosen.slice(1).map((entry, index) => entry.y - chosen[index].y);
            if (!steps.length || !steps.every((step) => step === steps[0]) || steps[0] % scale !== 0)
                continue;
            const separatorHeight = steps[0] / scale - rowHeight;
            if (separatorHeight < 1 || separatorHeight > 16)
                continue;
            if (options.rowHeight !== undefined && rowHeight !== options.rowHeight)
                continue;
            if (options.separatorHeight !== undefined && separatorHeight !== options.separatorHeight)
                continue;
            const modules = chosen.map((entry) => rowModules(entry.parsed.row, entry.parsed.values));
            let matrix;
            try {
                matrix = renderStackedRows(modules, rowHeight, separatorHeight);
                const result = decodeCode16K(matrix, { rowHeight, separatorHeight, rows: encodedRows });
                const topSeparator = rowHasDarkPixels(image, firstY - scale, group.x, 70 * scale) ? scale : 0;
                const last = chosen[chosen.length - 1];
                const bottomY = last.y + spans[spans.length - 1];
                const bottomSeparator = rowHasDarkPixels(image, bottomY, group.x, 70 * scale) ? scale : 0;
                const boundsY = firstY - topSeparator;
                const boundsHeight = (bottomY + bottomSeparator) - boundsY;
                return {
                    ...result,
                    matrix,
                    corners: cornersFor(group.x, boundsY, 70 * scale, boundsHeight),
                    rotation: 0,
                    moduleSize: scale,
                };
            }
            catch {
                // A candidate is accepted only after all rows and checks decode.
            }
        }
    }
    return null;
}
/**
 * Detect and decode one Code 16K symbol from a binarized image.
 *
 * The detector is intentionally conservative and enumerates integer module
 * scales and the four orthogonal orientations. Non-integer perspective and
 * photographic threshold recovery remain the responsibility of the generic
 * image pipeline.
 */
export function detectCode16K(binaryImage, options = {}) {
    if (!binaryImage?.width || !binaryImage?.height || typeof binaryImage.get !== 'function')
        return null;
    let oriented = binaryImage;
    let toOriginal = (point) => ({ x: point.x, y: point.y });
    for (let rotation = 0; rotation < 4; rotation++) {
        const found = detectOriented(oriented, options);
        if (found) {
            return {
                ...found,
                corners: found.corners.map(toOriginal),
                rotation: rotation * 90,
            };
        }
        const previous = oriented;
        const previousToOriginal = toOriginal;
        oriented = rotateClockwise(previous);
        toOriginal = (point) => previousToOriginal({ x: point.y, y: previous.height - point.x });
    }
    return null;
}
/** Alias matching the detector naming used by the other format modules. */
export function detectAndDecodeCode16K(binaryImage, options = {}) {
    return detectCode16K(binaryImage, options);
}
