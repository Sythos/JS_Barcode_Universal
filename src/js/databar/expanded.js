/*!
 * Sythos Barcode Suite
 *
 * MIT License
 *
 * Copyright (c) 2026 Sythos
 * SPDX-FileCopyrightText: 2026 Sythos (https://www.sythos.net)
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
 * GS1 DataBar Expanded (RSS Expanded) writer, strict matrix reader and
 * clean-raster detector.
 *
 * The implementation deliberately handles the linear Expanded symbol only.
 * Expanded Stacked has a different row layout and remains in `stacked.ts`.
 * Width construction is performed from the normative constrained-composition
 * rules, so no third-party barcode table or runtime dependency is needed.
 *
 * @module databar/expanded
 */
import { BitMatrix } from '../core/bit-matrix.js';
import { ChecksumError, EncodeError, FormatError } from '../core/errors.js';
import { createDetectionCandidate } from '../core/detection-contract.js';
import { dataBarWidths } from './patterns.js';
import { GS1_SEPARATOR, decodeGS1ElementString, encodeGS1ElementString, } from './gs1.js';
const DATA_CHARACTER_MODULES = 17;
const FINDER_PATTERN_MODULES = 15;
const MIN_HEIGHT_MODULES = 34;
const MIN_DATA_CHARACTERS = 4;
const MAX_DATA_CHARACTERS = 21;
const MAX_CHARACTER_VALUE = 4191;
const MAX_DIMENSION = 32768;
const MAX_MODULES = 16777216;
/*
 * Finder codes are five-run physical patterns. Codes 1, 3, 5, 7, 9 and 11
 * are the reflected forms used when the finder is read in the opposite
 * parity position.
 */
const FINDER_PATTERNS = Object.freeze([
    Object.freeze([1, 8, 4, 1, 1]),
    Object.freeze([1, 1, 4, 8, 1]),
    Object.freeze([3, 6, 4, 1, 1]),
    Object.freeze([1, 1, 4, 6, 3]),
    Object.freeze([3, 4, 6, 1, 1]),
    Object.freeze([1, 1, 6, 4, 3]),
    Object.freeze([3, 2, 8, 1, 1]),
    Object.freeze([1, 1, 8, 2, 3]),
    Object.freeze([2, 6, 5, 1, 1]),
    Object.freeze([1, 1, 5, 6, 2]),
    Object.freeze([2, 2, 9, 1, 1]),
    Object.freeze([1, 1, 9, 2, 2]),
]);
/* Finder codes for 2..11 data-character pairs, in their normative order. */
const FINDER_SEQUENCES = Object.freeze([
    Object.freeze([0, 1]),
    Object.freeze([0, 3, 2]),
    Object.freeze([0, 5, 2, 7]),
    Object.freeze([0, 9, 2, 7, 4]),
    Object.freeze([0, 9, 2, 7, 6, 11]),
    Object.freeze([0, 9, 2, 7, 8, 11, 10]),
    Object.freeze([0, 1, 2, 3, 4, 5, 6, 7]),
    Object.freeze([0, 1, 2, 3, 4, 5, 6, 9, 8]),
    Object.freeze([0, 1, 2, 3, 4, 5, 6, 9, 10, 11]),
    Object.freeze([0, 1, 2, 3, 4, 7, 6, 9, 8, 11, 10]),
]);
/*
 * Expanded character groups. `oddRanks` and `evenRanks` are the number of
 * legal constrained compositions. Data characters carry 12 information bits;
 * the check character also uses the normative values through 4191.
 */
const GROUPS = Object.freeze([
    Object.freeze({ gsum: 0, oddTotal: 12, evenTotal: 5, oddWidest: 7, evenWidest: 2, oddRanks: 87, evenRanks: 4 }),
    Object.freeze({ gsum: 348, oddTotal: 10, evenTotal: 7, oddWidest: 5, evenWidest: 4, oddRanks: 52, evenRanks: 20 }),
    Object.freeze({ gsum: 1388, oddTotal: 8, evenTotal: 9, oddWidest: 4, evenWidest: 5, oddRanks: 30, evenRanks: 52 }),
    Object.freeze({ gsum: 2948, oddTotal: 6, evenTotal: 11, oddWidest: 3, evenWidest: 6, oddRanks: 10, evenRanks: 104 }),
    Object.freeze({ gsum: 3988, oddTotal: 4, evenTotal: 13, oddWidest: 1, evenWidest: 8, oddRanks: 1, evenRanks: 204 }),
]);
/* Checksum blocks derive from the repeating power-of-three sequence. */
const CHECKSUM_POWERS = Object.freeze(Array.from({ length: 184 }, (_, exponent) => {
    let value = 1;
    for (let index = 0; index < exponent; index++)
        value = (value * 3) % 211;
    return value;
}));
const CHECKSUM_WEIGHT_BLOCKS = Object.freeze([
    Object.freeze([
        -1, -1, -1, -1, -1, -1, -1, -1,
        ...Array.from({ length: 8 }, (_, index) => CHECKSUM_POWERS[7 - index]),
    ]),
    ...Array.from({ length: 11 }, (_, index) => Object.freeze([
        ...CHECKSUM_POWERS.slice(8 + index * 16, 16 + index * 16),
        ...Array.from({ length: 8 }, (_, offset) => CHECKSUM_POWERS[23 + index * 16 - offset]),
    ])),
]);
const ISO646_VALUES = new Map([
    ['!', 232], ['"', 233], ['%', 234], ['&', 235], ["'", 236],
    ['(', 237], [')', 238], ['*', 239], ['+', 240], [',', 241],
    ['-', 242], ['.', 243], ['/', 244], [':', 245], [';', 246],
    ['<', 247], ['=', 248], ['>', 249], ['?', 250], ['_', 251],
    [' ', 252],
]);
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function positiveInteger(value, label) {
    if (!Number.isSafeInteger(value) || value < 1) {
        throw new EncodeError(`GS1 DataBar Expanded ${label} must be a positive integer`);
    }
    return value;
}
function resolveGeometry(options, logicalWidth) {
    if (options === undefined)
        options = {};
    if (!isRecord(options))
        throw new TypeError('GS1 DataBar Expanded options must be an object');
    if (options.linkage !== undefined && typeof options.linkage !== 'boolean') {
        throw new TypeError('GS1 DataBar linkage must be a boolean');
    }
    if (options.moduleScale !== undefined && options.scale !== undefined
        && options.moduleScale !== options.scale) {
        throw new EncodeError('GS1 DataBar Expanded moduleScale and scale disagree');
    }
    const scale = positiveInteger(options.moduleScale ?? options.scale ?? 1, 'moduleScale');
    const height = positiveInteger(options.height ?? MIN_HEIGHT_MODULES * scale, 'height');
    if (height < MIN_HEIGHT_MODULES * scale) {
        throw new EncodeError('GS1 DataBar Expanded height is below the normative 34-module minimum');
    }
    const width = logicalWidth * scale;
    if (!Number.isSafeInteger(width) || width > MAX_DIMENSION
        || height > MAX_DIMENSION || width * height > MAX_MODULES) {
        throw new EncodeError('GS1 DataBar Expanded dimensions exceed the safe matrix limit');
    }
    return Object.freeze({
        scale,
        height,
        width,
        linkage: options.linkage === true,
    });
}
function combinations(n, r) {
    if (n < r || r < 0)
        return 0;
    if (r === 0 || n === r)
        return 1;
    const k = Math.min(r, n - r);
    let result = 1;
    for (let index = 1; index <= k; index++) {
        result = result * (n - k + index) / index;
    }
    return result;
}
/*
 * Rank the same constrained composition that `dataBarWidths` un-ranks. This
 * local inverse lets the reader reject width sequences that merely resemble a
 * data character instead of silently normalising them.
 */
function candidateCount(remaining, bar, width, elements, maximumWidth, noNarrow, narrowMask) {
    let count = combinations(remaining - width - 1, elements - bar - 2);
    if (noNarrow && narrowMask === 0
        && remaining - width - (elements - bar - 1) >= elements - bar - 1) {
        count -= combinations(remaining - width - (elements - bar), elements - bar - 2);
    }
    if (elements - bar - 1 > 1) {
        let tooWide = 0;
        for (let last = remaining - width - (elements - bar - 2); last > maximumWidth; last--) {
            tooWide += combinations(remaining - width - last - 1, elements - bar - 3);
        }
        count -= tooWide * (elements - 1 - bar);
    }
    else if (remaining - width > maximumWidth) {
        count--;
    }
    return count;
}
function rankWidths(widths, modules, maximumWidth, noNarrow) {
    if (!Array.isArray(widths) || widths.length !== 4
        || widths.some((width) => !Number.isSafeInteger(width) || width < 1 || width > maximumWidth)
        || widths.reduce((sum, width) => sum + width, 0) !== modules) {
        throw new FormatError('GS1 DataBar Expanded subset widths are invalid');
    }
    let rank = 0;
    let remaining = modules;
    let narrowMask = 0;
    for (let bar = 0; bar < 3; bar++) {
        const selected = widths[bar];
        for (let width = 1; width < selected; width++) {
            if (width === 1)
                narrowMask |= 1 << bar;
            rank += candidateCount(remaining, bar, width, 4, maximumWidth, noNarrow, narrowMask);
            narrowMask &= ~(1 << bar);
        }
        if (selected === 1)
            narrowMask |= 1 << bar;
        else
            narrowMask &= ~(1 << bar);
        remaining -= selected;
    }
    if (widths[3] !== remaining)
        throw new FormatError('GS1 DataBar Expanded subset rank is not canonical');
    return rank;
}
function groupForValue(value) {
    for (let index = GROUPS.length - 1; index >= 0; index--) {
        if (value >= GROUPS[index].gsum)
            return GROUPS[index];
    }
    throw new RangeError('GS1 DataBar Expanded character value is out of range');
}
function expandedCharacterWidths(value) {
    if (!Number.isSafeInteger(value) || value < 0 || value > MAX_CHARACTER_VALUE) {
        throw new RangeError('GS1 DataBar Expanded character value is outside the normative range');
    }
    const group = groupForValue(value);
    const offset = value - group.gsum;
    const oddRank = Math.floor(offset / group.evenRanks);
    const evenRank = offset % group.evenRanks;
    if (oddRank >= group.oddRanks || evenRank >= group.evenRanks) {
        throw new RangeError('GS1 DataBar Expanded character value is outside its group');
    }
    const odd = dataBarWidths(oddRank, group.oddTotal, 4, group.oddWidest, true);
    const even = dataBarWidths(evenRank, group.evenTotal, 4, group.evenWidest, false);
    const widths = [];
    for (let index = 0; index < 4; index++)
        widths.push(odd[index], even[index]);
    if (widths.reduce((sum, width) => sum + width, 0) !== DATA_CHARACTER_MODULES) {
        throw new EncodeError('GS1 DataBar Expanded data character width total is invalid');
    }
    return widths;
}
function physicalDataCharacterWidths(value, characterIndex) {
    const canonical = expandedCharacterWidths(value);
    /* The first payload character follows the check character in reverse order. */
    return characterIndex % 2 === 1 ? canonical.slice().reverse() : canonical;
}
const dataCharacterMaps = new Map();
const checkCharacterMap = new Map();
function getCharacterMap(characterIndex, check = false) {
    const key = check ? 'check' : (characterIndex & 1);
    const cache = check ? checkCharacterMap : dataCharacterMaps;
    if (cache.has(key))
        return cache.get(key);
    const map = new Map();
    const maximum = check ? MAX_CHARACTER_VALUE : 4095;
    for (let value = 0; value <= maximum; value++) {
        const widths = check ? expandedCharacterWidths(value) : physicalDataCharacterWidths(value, characterIndex);
        map.set(widths.join(','), value);
    }
    cache.set(key, map);
    return map;
}
function valueForWidths(widths, characterIndex, check = false) {
    const value = getCharacterMap(characterIndex, check).get(widths.join(','));
    if (value === undefined)
        throw new FormatError('GS1 DataBar Expanded character widths are invalid');
    return value;
}
function finderWidths(finderCode) {
    const pattern = FINDER_PATTERNS[finderCode];
    if (!pattern)
        throw new FormatError('GS1 DataBar Expanded finder type is invalid');
    return pattern;
}
function appendWidths(bits, widths, dark) {
    let colour = dark;
    for (const width of widths) {
        for (let index = 0; index < width; index++)
            bits.push(colour);
        colour = !colour;
    }
    return colour;
}
function bitsToValue(bits, offset, length) {
    let value = 0;
    for (let index = 0; index < length; index++)
        value = (value << 1) | (bits[offset + index] ? 1 : 0);
    return value;
}
function appendBits(target, value, length) {
    for (let shift = length - 1; shift >= 0; shift--)
        target.push(((value >>> shift) & 1) !== 0);
}
function isDigit(value) {
    return value >= '0' && value <= '9';
}
function isDigitOrFNC1(value) {
    return isDigit(value) || value === GS1_SEPARATOR;
}
function appendNumericPair(bits, first, second) {
    if (first === GS1_SEPARATOR) {
        if (second !== GS1_SEPARATOR)
            throw new EncodeError('GS1 DataBar Expanded cannot start a field with FNC1');
        appendBits(bits, 0, 4);
        return;
    }
    const firstValue = first === GS1_SEPARATOR ? 10 : Number(first);
    const secondValue = second === GS1_SEPARATOR ? 10 : Number(second);
    if (firstValue > 9 || secondValue > 10)
        throw new EncodeError('GS1 DataBar Expanded numeric value is invalid');
    if (second === GS1_SEPARATOR) {
        appendBits(bits, firstValue + 1, 4);
    }
    else {
        appendBits(bits, 8 + 11 * firstValue + secondValue, 7);
    }
}
function alphaValue(value) {
    if (isDigit(value))
        return { value: Number(value) + 5, length: 5 };
    if (value === GS1_SEPARATOR)
        return { value: 15, length: 5, fnc1: true };
    if (value >= 'A' && value <= 'Z')
        return { value: value.charCodeAt(0) - 33, length: 6 };
    if (value === '*')
        return { value: 58, length: 6 };
    if (value >= ',' && value <= '/')
        return { value: value.charCodeAt(0) + 15, length: 6 };
    return undefined;
}
function isoValue(value) {
    if (isDigit(value))
        return { value: Number(value) + 5, length: 5 };
    if (value === GS1_SEPARATOR)
        return { value: 15, length: 5, fnc1: true };
    if (value >= 'A' && value <= 'Z')
        return { value: value.charCodeAt(0) - 1, length: 7 };
    if (value >= 'a' && value <= 'z')
        return { value: value.charCodeAt(0) + 7, length: 7 };
    const encoded = ISO646_VALUES.get(value);
    return encoded === undefined ? undefined : { value: encoded, length: 8 };
}
/* Encode the general-purpose field from numeric mode, as required by Expanded. */
function encodeGeneralPurpose(raw) {
    const bits = [];
    let mode = 'numeric';
    let offset = 0;
    while (offset < raw.length) {
        const value = raw[offset];
        if (mode === 'numeric') {
            if (offset + 1 < raw.length && isDigitOrFNC1(value) && isDigitOrFNC1(raw[offset + 1])
                && value !== GS1_SEPARATOR && raw[offset + 1] !== GS1_SEPARATOR) {
                appendNumericPair(bits, value, raw[offset + 1]);
                offset += 2;
                continue;
            }
            if (offset + 1 < raw.length && isDigit(value) && raw[offset + 1] === GS1_SEPARATOR) {
                appendNumericPair(bits, value, raw[offset + 1]);
                offset += 2;
                continue;
            }
            /* A lone digit before an alphanumeric value is encoded in alpha mode. */
            appendBits(bits, 0, 4);
            mode = 'alpha';
            continue;
        }
        if (mode === 'alpha') {
            if (value === GS1_SEPARATOR) {
                appendBits(bits, 15, 5);
                mode = 'numeric';
                offset++;
                continue;
            }
            const encoded = alphaValue(value);
            if (encoded) {
                appendBits(bits, encoded.value, encoded.length);
                offset++;
                continue;
            }
            /* Alpha-to-ISO/IEC 646 latch. */
            appendBits(bits, 4, 5);
            mode = 'iso646';
            continue;
        }
        if (value === GS1_SEPARATOR) {
            appendBits(bits, 15, 5);
            mode = 'numeric';
            offset++;
            continue;
        }
        const encoded = isoValue(value);
        if (!encoded) {
            throw new EncodeError(`GS1 DataBar Expanded value contains unsupported character "${value}"`);
        }
        appendBits(bits, encoded.value, encoded.length);
        offset++;
    }
    return Object.freeze({ bits, finalMode: mode });
}
function padGeneralPurpose(bits, finalMode, dataCharacters) {
    const output = bits.slice();
    const headerLength = 5;
    const targetLength = dataCharacters * 12;
    let remaining = targetLength - headerLength - output.length;
    if (remaining < 0)
        throw new EncodeError('GS1 DataBar Expanded general-purpose field exceeds the selected symbol size');
    if (finalMode === 'numeric' && remaining >= 4) {
        appendBits(output, 0, 4);
        remaining -= 4;
    }
    const fill = [false, false, true, false, false];
    for (let index = 0; index < remaining; index++)
        output.push(fill[index % fill.length]);
    if (output.length !== targetLength - headerLength) {
        throw new EncodeError('GS1 DataBar Expanded padding length is invalid');
    }
    return output;
}
function encodePayload(raw, linkage) {
    const general = encodeGeneralPurpose(raw);
    let dataCharacters = Math.max(MIN_DATA_CHARACTERS, Math.ceil((12 + 1 + 2 + 2 + general.bits.length) / 12));
    if (dataCharacters > MAX_DATA_CHARACTERS) {
        throw new EncodeError('GS1 DataBar Expanded payload is too long for the 21 data-character limit');
    }
    const vlf = [dataCharacters & 1, dataCharacters > 14 ? 1 : 0];
    const generalBits = padGeneralPurpose(general.bits, general.finalMode, dataCharacters);
    const information = [Boolean(linkage), false, false, Boolean(vlf[0]), Boolean(vlf[1]), ...generalBits];
    if (information.length !== dataCharacters * 12) {
        throw new EncodeError('GS1 DataBar Expanded information field has an invalid length');
    }
    const values = [];
    for (let offset = 0; offset < information.length; offset += 12) {
        values.push(bitsToValue(information, offset, 12));
    }
    return Object.freeze({ values, dataCharacters, information });
}
function checksumWeightSequence(dataCharacters) {
    const sequenceIndex = Math.floor((dataCharacters - 2) / 2);
    const sequence = FINDER_SEQUENCES[sequenceIndex];
    if (!sequence)
        throw new FormatError('GS1 DataBar Expanded finder sequence is invalid');
    const weights = [];
    for (const finderCode of sequence) {
        const block = CHECKSUM_WEIGHT_BLOCKS[finderCode];
        if (!block)
            throw new FormatError('GS1 DataBar Expanded checksum weight block is invalid');
        weights.push(...block);
    }
    const payloadWeights = weights.slice(8, 8 + dataCharacters * 8);
    if (payloadWeights.length !== dataCharacters * 8) {
        throw new FormatError('GS1 DataBar Expanded checksum weight sequence is truncated');
    }
    return payloadWeights;
}
function checkCharacterValue(physicalWidths, dataCharacters) {
    const weights = checksumWeightSequence(dataCharacters);
    let checksum = 0;
    for (let dataIndex = 0; dataIndex < physicalWidths.length; dataIndex++) {
        for (let widthIndex = 0; widthIndex < 8; widthIndex++) {
            checksum += physicalWidths[dataIndex][widthIndex] * weights[dataIndex * 8 + widthIndex];
        }
    }
    const check = 211 * (dataCharacters - 3) + (checksum % 211);
    if (check < 0 || check > MAX_CHARACTER_VALUE)
        throw new EncodeError('GS1 DataBar Expanded checksum value is out of range');
    return check;
}
function buildPhysicalBits(dataValues, linkage) {
    const dataCharacters = dataValues.length;
    const pairCount = Math.ceil((dataCharacters + 1) / 2);
    const sequenceIndex = Math.floor((dataCharacters - 2) / 2);
    const sequence = FINDER_SEQUENCES[sequenceIndex];
    if (!sequence || sequence.length !== pairCount) {
        throw new EncodeError('GS1 DataBar Expanded data-character count has no valid finder sequence');
    }
    const dataWidths = dataValues.map((value, index) => physicalDataCharacterWidths(value, index + 1));
    const checksumValue = checkCharacterValue(dataWidths, dataCharacters);
    const widths = [expandedCharacterWidths(checksumValue), ...dataWidths];
    let dark = true;
    const bits = [];
    dark = appendWidths(bits, [1, 1], dark);
    for (let index = 0; index < widths.length; index++) {
        dark = appendWidths(bits, widths[index], dark);
        if ((index & 1) === 0)
            dark = appendWidths(bits, finderWidths(sequence[index / 2]), dark);
    }
    appendWidths(bits, [1, 1], dark);
    const expectedWidth = 2 + widths.length * DATA_CHARACTER_MODULES
        + pairCount * FINDER_PATTERN_MODULES + 2;
    if (bits.length !== expectedWidth)
        throw new EncodeError('GS1 DataBar Expanded physical width is invalid');
    return Object.freeze({ bits, widths, dataCharacters, pairCount, linkage, checksum: checksumValue });
}
function paint(bits, height, scale) {
    const matrix = new BitMatrix(bits.length * scale, height);
    for (let x = 0; x < bits.length; x++) {
        if (bits[x])
            matrix.setRegion(x * scale, 0, scale, height);
    }
    return matrix;
}
/** Encode a GS1 element string as linear GS1 DataBar Expanded. */
export function encodeDataBarExpanded(value, options = {}) {
    const raw = encodeGS1ElementString(value);
    const linkage = options?.linkage === true;
    const payload = encodePayload(raw, linkage);
    const physical = buildPhysicalBits(payload.values, linkage);
    const logicalWidth = physical.bits.length;
    const geometry = resolveGeometry(options, logicalWidth);
    const matrix = paint(physical.bits, geometry.height, geometry.scale);
    matrix.databar = Object.freeze({
        variant: 'expanded',
        raw,
        linkage,
        dataCharacters: payload.dataCharacters,
        pairs: physical.pairCount,
        modules: logicalWidth,
        moduleScale: geometry.scale,
        height: geometry.height,
    });
    return matrix;
}
function requireMatrix(matrix) {
    if (!matrix || !Number.isInteger(matrix.width) || !Number.isInteger(matrix.height)
        || matrix.width < 1 || matrix.height < 1 || typeof matrix.get !== 'function') {
        throw new TypeError('GS1 DataBar Expanded decoder expects a BitMatrix-like value');
    }
}
function runWidths(bits) {
    if (!bits.length)
        return [];
    const widths = [];
    let colour = bits[0];
    let width = 0;
    for (const bit of bits) {
        if (bit === colour)
            width++;
        else {
            widths.push(width);
            colour = bit;
            width = 1;
        }
    }
    widths.push(width);
    return widths;
}
function logicalRow(matrix) {
    requireMatrix(matrix);
    const candidates = [];
    for (let dataCharacters = MIN_DATA_CHARACTERS; dataCharacters <= MAX_DATA_CHARACTERS; dataCharacters++) {
        const pairCount = Math.ceil((dataCharacters + 1) / 2);
        const logicalWidth = 2 + (dataCharacters + 1) * DATA_CHARACTER_MODULES
            + pairCount * FINDER_PATTERN_MODULES + 2;
        if (matrix.width % logicalWidth === 0)
            candidates.push({ dataCharacters, logicalWidth, scale: matrix.width / logicalWidth });
    }
    if (candidates.length === 0)
        throw new FormatError('GS1 DataBar Expanded matrix width is not a valid symbol width');
    const candidate = candidates.find(({ scale }) => Number.isSafeInteger(scale) && scale >= 1);
    if (!candidate || matrix.height < MIN_HEIGHT_MODULES * candidate.scale) {
        throw new FormatError('GS1 DataBar Expanded matrix scale or height is invalid');
    }
    const { dataCharacters, logicalWidth, scale } = candidate;
    const row = [];
    for (let x = 0; x < logicalWidth; x++) {
        const sample = Boolean(matrix.get(x * scale + Math.floor(scale / 2), Math.floor(matrix.height / 2)));
        for (let dx = 0; dx < scale; dx++) {
            if (Boolean(matrix.get(x * scale + dx, Math.floor(matrix.height / 2))) !== sample) {
                throw new FormatError('GS1 DataBar Expanded horizontal modules are not integer-scaled');
            }
        }
        row.push(sample);
    }
    for (let y = 0; y < matrix.height; y++) {
        for (let x = 0; x < logicalWidth; x++) {
            const expected = row[x];
            for (let dx = 0; dx < scale; dx++) {
                if (Boolean(matrix.get(x * scale + dx, y)) !== expected) {
                    throw new FormatError('GS1 DataBar Expanded rows are inconsistent');
                }
            }
        }
    }
    return { row, dataCharacters, logicalWidth, scale };
}
function decodePhysical(row, dataCharacters) {
    const pairCount = Math.ceil((dataCharacters + 1) / 2);
    const sequenceIndex = Math.floor((dataCharacters - 2) / 2);
    const sequence = FINDER_SEQUENCES[sequenceIndex];
    if (!sequence || sequence.length !== pairCount)
        throw new FormatError('GS1 DataBar Expanded finder sequence is invalid');
    if (row.length < 4 || !row[0] || row[1])
        throw new FormatError('GS1 DataBar Expanded left guard is invalid');
    const values = [];
    const physicalWidths = [];
    let cursor = 2;
    for (let index = 0; index <= dataCharacters; index++) {
        const charBits = row.slice(cursor, cursor + DATA_CHARACTER_MODULES);
        const widths = runWidths(charBits);
        if (widths.length !== 8 || widths.reduce((sum, width) => sum + width, 0) !== DATA_CHARACTER_MODULES) {
            throw new FormatError('GS1 DataBar Expanded data-character run count is invalid');
        }
        physicalWidths.push(widths);
        values.push(valueForWidths(widths, index, index === 0));
        cursor += DATA_CHARACTER_MODULES;
        if ((index & 1) === 0) {
            const finderBits = row.slice(cursor, cursor + FINDER_PATTERN_MODULES);
            const observed = runWidths(finderBits);
            const expected = finderWidths(sequence[index / 2]);
            if (observed.length !== 5 || observed.some((width, position) => width !== expected[position])) {
                throw new FormatError('GS1 DataBar Expanded finder pattern is invalid');
            }
            cursor += FINDER_PATTERN_MODULES;
        }
    }
    const end = row.slice(cursor);
    if (end.length !== 2 || end[0] === end[1])
        throw new FormatError('GS1 DataBar Expanded right guard is invalid');
    if (cursor + 2 !== row.length)
        throw new FormatError('GS1 DataBar Expanded trailing modules are invalid');
    const weights = checksumWeightSequence(dataCharacters);
    let checksum = 0;
    for (let index = 1; index < values.length; index++) {
        for (let widthIndex = 0; widthIndex < 8; widthIndex++) {
            checksum += physicalWidths[index][widthIndex] * weights[(index - 1) * 8 + widthIndex];
        }
    }
    const expected = 211 * (dataCharacters - 3) + (checksum % 211);
    if (values[0] !== expected)
        throw new ChecksumError('GS1 DataBar Expanded checksum mismatch');
    return Object.freeze({ values, physicalWidths, dataCharacters, pairCount, scale: 1 });
}
function decodeGeneralPurpose(payload) {
    let position = 0;
    let mode = 'numeric';
    let raw = '';
    const allZero = (offset) => {
        for (let index = offset; index < payload.length; index++)
            if (payload[index])
                return false;
        return true;
    };
    const isPaddingTail = (offset) => {
        const fill = [false, false, true, false, false];
        for (let phase = 0; phase < fill.length; phase++) {
            let matches = true;
            for (let index = offset; index < payload.length; index++) {
                if (payload[index] !== fill[(phase + index - offset) % fill.length]) {
                    matches = false;
                    break;
                }
            }
            if (matches)
                return true;
        }
        return false;
    };
    const read = (length) => {
        if (position + length > payload.length)
            throw new FormatError('GS1 DataBar Expanded general-purpose field is truncated');
        const value = bitsToValue(payload, position, length);
        position += length;
        return value;
    };
    let guard = 0;
    while (position < payload.length && guard++ < payload.length + 4) {
        if (mode === 'numeric') {
            if (position + 7 <= payload.length && !allZero(position)) {
                const value = bitsToValue(payload, position, 7);
                if (value >= 8 && value <= 117) {
                    const first = Math.floor((value - 8) / 11);
                    const second = (value - 8) % 11;
                    if (first > 9 || second > 9)
                        throw new FormatError('GS1 DataBar Expanded numeric digit is invalid');
                    position += 7;
                    raw += `${first}${second}`;
                    continue;
                }
            }
            if (position + 4 <= payload.length) {
                const value = read(4);
                if (value === 0) {
                    if (position >= payload.length || allZero(position))
                        break;
                    mode = 'alpha';
                    continue;
                }
                if (value >= 1 && value <= 10) {
                    raw += `${value - 1}${GS1_SEPARATOR}`;
                    mode = 'numeric';
                    continue;
                }
            }
            throw new FormatError('GS1 DataBar Expanded numeric block is invalid');
        }
        if (mode === 'alpha') {
            if (position + 3 <= payload.length && bitsToValue(payload, position, 3) === 0) {
                position += 3;
                mode = 'numeric';
                continue;
            }
            if (position + 5 > payload.length) {
                if (allZero(position) || isPaddingTail(position))
                    break;
                throw new FormatError('GS1 DataBar Expanded alphanumeric block is truncated');
            }
            const five = bitsToValue(payload, position, 5);
            if (five === 4) {
                position += 5;
                mode = 'iso646';
                continue;
            }
            if (five >= 5 && five <= 15) {
                position += 5;
                if (five === 15) {
                    raw += GS1_SEPARATOR;
                    mode = 'numeric';
                }
                else
                    raw += String(five - 5);
                continue;
            }
            if (position + 6 > payload.length)
                throw new FormatError('GS1 DataBar Expanded alphanumeric character is truncated');
            const six = read(6);
            if (six >= 32 && six <= 57)
                raw += String.fromCharCode(six + 33);
            else if (six === 58)
                raw += '*';
            else if (six >= 59 && six <= 62)
                raw += String.fromCharCode(six - 15);
            else
                throw new FormatError('GS1 DataBar Expanded alphanumeric character is invalid');
            continue;
        }
        if (position + 3 <= payload.length && bitsToValue(payload, position, 3) === 0) {
            position += 3;
            mode = 'numeric';
            continue;
        }
        if (position + 5 > payload.length) {
            if (allZero(position) || isPaddingTail(position))
                break;
            throw new FormatError('GS1 DataBar Expanded ISO/IEC 646 block is truncated');
        }
        const five = bitsToValue(payload, position, 5);
        if (five === 4) {
            position += 5;
            mode = 'alpha';
            continue;
        }
        if (five >= 5 && five <= 15) {
            position += 5;
            if (five === 15) {
                raw += GS1_SEPARATOR;
                mode = 'numeric';
            }
            else
                raw += String(five - 5);
            continue;
        }
        if (position + 7 <= payload.length) {
            const seven = read(7);
            if (seven >= 64 && seven <= 89)
                raw += String.fromCharCode(seven + 1);
            else if (seven >= 90 && seven <= 115)
                raw += String.fromCharCode(seven + 7);
            else {
                if (position < 7)
                    throw new FormatError('GS1 DataBar Expanded ISO/IEC 646 character is invalid');
                position -= 7;
                const eight = read(8);
                const entry = [...ISO646_VALUES.entries()].find(([, encoded]) => encoded === eight);
                if (!entry)
                    throw new FormatError('GS1 DataBar Expanded ISO/IEC 646 character is invalid');
                raw += entry[0];
            }
            continue;
        }
        throw new FormatError('GS1 DataBar Expanded ISO/IEC 646 block is truncated');
    }
    if (guard >= payload.length + 4)
        throw new FormatError('GS1 DataBar Expanded general-purpose field did not terminate');
    return raw;
}
function gtinCheckDigit(value) {
    let sum = 0;
    for (let index = value.length - 1; index >= 0; index--) {
        sum += Number(value[index]) * ((value.length - index) % 2 === 1 ? 3 : 1);
    }
    return String((10 - (sum % 10)) % 10);
}
function decodeMethodOne(bits, dataCharacters) {
    if (bits.length < 48)
        throw new FormatError('GS1 DataBar Expanded method 1 information is truncated');
    const symbolCharacters = dataCharacters + 1;
    const expectedVlf = [symbolCharacters % 2 === 1, symbolCharacters > 14];
    if (bits[2] !== expectedVlf[0] || bits[3] !== expectedVlf[1]) {
        throw new FormatError('GS1 DataBar Expanded method 1 variable-length field is invalid');
    }
    const chunks = [bitsToValue(bits, 4, 4)];
    for (let offset = 8; offset < 48; offset += 10)
        chunks.push(bitsToValue(bits, offset, 10));
    if (chunks[0] > 9 || chunks.slice(1).some((value) => value > 999)) {
        throw new FormatError('GS1 DataBar Expanded method 1 GTIN is invalid');
    }
    const gtinWithoutCheck = `${chunks[0]}${chunks.slice(1).map((value) => String(value).padStart(3, '0')).join('')}`;
    const general = bits.length === 48 ? '' : decodeGeneralPurpose(bits.slice(48));
    return `01${gtinWithoutCheck}${gtinCheckDigit(gtinWithoutCheck)}${general}`;
}
function decodeInformation(values, linkage, dataCharacters) {
    const bits = [];
    for (const value of values)
        appendBits(bits, value, 12);
    if (bits.length < 5 || bits[0] !== linkage) {
        throw new FormatError('GS1 DataBar Expanded information header is invalid');
    }
    let raw;
    if (!bits[1] && !bits[2]) {
        raw = decodeGeneralPurpose(bits.slice(5));
    }
    else if (bits[1]) {
        raw = decodeMethodOne(bits, dataCharacters);
    }
    else {
        throw new FormatError('GS1 DataBar Expanded information header is invalid');
    }
    const elements = decodeGS1ElementString(raw);
    return Object.freeze({ raw, elements });
}
/** Decode a clean or integer-scaled GS1 DataBar Expanded matrix. */
export function decodeDataBarExpanded(matrix) {
    const geometry = logicalRow(matrix);
    const decoded = decodePhysical(geometry.row, geometry.dataCharacters);
    const linkage = (decoded.values[1] & 0x800) !== 0;
    const information = decodeInformation(decoded.values.slice(1), linkage, decoded.dataCharacters);
    return Object.freeze({
        format: 'databar-expanded',
        variant: 'expanded',
        text: information.raw,
        raw: information.raw,
        gs1: true,
        linkage,
        checksum: decoded.values[0],
        checksumValid: true,
        dataCharacters: decoded.dataCharacters,
        pairs: decoded.pairCount,
        moduleScale: geometry.scale,
        height: matrix.height,
        symbologyIdentifier: ']e0',
        elements: information.elements,
    });
}
function crop(source, box) {
    const output = new BitMatrix(box.width, box.height);
    for (let y = 0; y < box.height; y++) {
        for (let x = 0; x < box.width; x++)
            if (source.get(box.x + x, box.y + y))
                output.set(x, y);
    }
    return output;
}
function rotateClockwise(source) {
    const output = new BitMatrix(source.height, source.width);
    for (let y = 0; y < source.height; y++) {
        for (let x = 0; x < source.width; x++)
            if (source.get(x, y))
                output.set(source.height - 1 - y, x);
    }
    return output;
}
function mapPoint(point, previous) {
    return { x: point.y, y: previous.height - point.x };
}
function cornersFor(box) {
    return [
        { x: box.x, y: box.y },
        { x: box.x + box.width, y: box.y },
        { x: box.x + box.width, y: box.y + box.height },
        { x: box.x, y: box.y + box.height },
    ];
}
function canonicalCorners(points) {
    const ordered = [...points].sort((left, right) => left.y - right.y || left.x - right.x);
    const [topLeft, topRight] = ordered.slice(0, 2).sort((left, right) => left.x - right.x);
    const [bottomLeft, bottomRight] = ordered.slice(2).sort((left, right) => left.x - right.x);
    return [topLeft, topRight, bottomRight, bottomLeft];
}
function validImage(image) {
    return isRecord(image) && typeof image.get === 'function'
        && Number.isSafeInteger(image.width) && Number.isSafeInteger(image.height)
        && image.width > 0 && image.height > 0
        && image.width <= MAX_DIMENSION && image.height <= MAX_DIMENSION
        && image.width * image.height <= MAX_MODULES;
}
/** Detect one complete, dark-on-light Expanded symbol in a clean raster. */
export function detectDataBarExpanded(binaryImage, options = {}) {
    if (!validImage(binaryImage) || !isRecord(options))
        return null;
    let oriented = binaryImage;
    let toOriginal = (point) => ({ x: point.x, y: point.y });
    for (let rotation = 0; rotation < 4; rotation++) {
        const bounds = oriented.getBounds?.();
        if (bounds && bounds.width > 0 && bounds.height > 0) {
            const candidate = crop(oriented, bounds);
            try {
                const result = decodeDataBarExpanded(candidate);
                const geometry = createDetectionCandidate({
                    corners: canonicalCorners(cornersFor(bounds).map((point) => toOriginal(point))),
                    moduleSize: result.moduleScale,
                    rotation: rotation * 90,
                    matrix: candidate,
                    confidence: 1,
                }, {
                    result,
                    quality: {
                        quietZone: bounds.x > 0 && bounds.y > 0
                            && bounds.x + bounds.width < oriented.width
                            && bounds.y + bounds.height < oriented.height,
                        checksum: true,
                        rows: 1,
                        consistency: 1,
                    },
                    score: 1,
                });
                return Object.freeze({ ...result, ...geometry });
            }
            catch {
                /* A complete dark component belonging to another symbol is ignored. */
            }
        }
        const previous = oriented;
        const previousToOriginal = toOriginal;
        oriented = rotateClockwise(previous);
        toOriginal = (point) => previousToOriginal(mapPoint(point, previous));
    }
    return null;
}
/** Detect-and-decode alias matching the other DataBar modules. */
export const detectAndDecodeDataBarExpanded = detectDataBarExpanded;
/** Decode one complete, unscaled binary scanline. */
export function decodeDataBarExpandedScanline(row) {
    if (!row || typeof row.length !== 'number' || row.length < 1)
        return null;
    const matrix = new BitMatrix(row.length, MIN_HEIGHT_MODULES);
    for (let x = 0; x < row.length; x++)
        if (row[x])
            matrix.setRegion(x, 0, 1, MIN_HEIGHT_MODULES);
    try {
        return decodeDataBarExpanded(matrix);
    }
    catch {
        return null;
    }
}
export const encodeGS1DataBarExpanded = encodeDataBarExpanded;
export const decodeGS1DataBarExpanded = decodeDataBarExpanded;
export const detectGS1DataBarExpanded = detectDataBarExpanded;
export const detectAndDecodeGS1DataBarExpanded = detectAndDecodeDataBarExpanded;
