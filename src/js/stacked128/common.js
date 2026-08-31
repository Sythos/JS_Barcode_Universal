/*
 * Sythos Barcode Suite — shared stacked Code 128 helpers
 *
 * MIT License
 * Copyright (c) 2026 Sythos
 * SPDX-License-Identifier: MIT
 *
 * Original work. No code from any other barcode implementation.
 */
import { BitMatrix } from '../core/bit-matrix.js';
import { EncodeError } from '../core/errors.js';
import { CODE128, CODE128_START_A, CODE128_START_B, CODE128_START_C, CODE128_FNC1, CODE128_CODE_A, CODE128_CODE_B, CODE128_CODE_C, CODE128_SHIFT, } from '../oned/patterns.js';
/** Expand a Code 128 width string into dark/light modules. */
export function code128PatternModules(value) {
    if (!Number.isInteger(value) || value < 0 || value >= CODE128.length) {
        throw new EncodeError(`Code 128: invalid symbol value ${value}`);
    }
    const pattern = CODE128[value];
    let modules = '';
    let dark = true;
    for (const digit of pattern) {
        const width = Number(digit);
        modules += (dark ? '1' : '0').repeat(width);
        dark = !dark;
    }
    return modules;
}
/** Render complete Code 128 codewords, including their 13-module stop. */
export function code128CodewordsModules(values) {
    return values.map((value) => code128PatternModules(value)).join('');
}
/** Code 128 checksum for a sequence that includes the start symbol. */
export function code128Checksum(values) {
    if (values.length === 0)
        throw new EncodeError('Code 128: checksum needs a start symbol');
    let sum = values[0];
    for (let i = 1; i < values.length; i++)
        sum += values[i] * i;
    return sum % 103;
}
const CODE128_BITS = new Map();
for (let value = 0; value < CODE128.length; value++) {
    CODE128_BITS.set(code128PatternModules(value), value);
}
/** Decode a single 11-module Code 128 symbol from a sampled module string. */
export function code128ValueFromModules(modules, offset) {
    const slice = modules.slice(offset, offset + 11);
    if (slice.length !== 11)
        return null;
    return CODE128_BITS.get(slice) ?? null;
}
/**
 * Interpret Code 128 data values after the start symbol and checksum.
 *
 * This deliberately mirrors the public Code 128 reader but keeps stacked
 * decoders independent from scanline state. The result is null for an empty
 * or structurally impossible stream.
 */
export function decodeCode128Values(startCode, dataValues) {
    if (![CODE128_START_A, CODE128_START_B, CODE128_START_C].includes(startCode))
        return null;
    if (dataValues.length === 0)
        return null;
    let mode = startCode === CODE128_START_A
        ? 'A' : startCode === CODE128_START_B ? 'B' : 'C';
    let shifted = null;
    let text = '';
    const fnc1AtStart = dataValues[0] === CODE128_FNC1;
    const fnc1Positions = [];
    for (let index = 0; index < dataValues.length; index++) {
        const value = dataValues[index];
        const active = shifted ?? mode;
        shifted = null;
        if (value === CODE128_CODE_A && mode !== 'A') {
            mode = 'A';
            continue;
        }
        if (value === CODE128_CODE_B && mode !== 'B') {
            mode = 'B';
            continue;
        }
        if (value === CODE128_CODE_C) {
            mode = 'C';
            continue;
        }
        if (value === CODE128_SHIFT) {
            shifted = mode === 'A' ? 'B' : 'A';
            continue;
        }
        if (value === CODE128_FNC1) {
            if (index > 0) {
                fnc1Positions.push(text.length);
                text += '\x1d';
            }
            continue;
        }
        // FNC2, FNC3 and FNC4 are control values. They are not part of the
        // textual payload exposed by this SDK, but remain valid Code 128 symbols.
        if (value >= 96 && value <= 102)
            continue;
        if (active === 'C') {
            if (value > 99)
                return null;
            text += String(value).padStart(2, '0');
        }
        else if (active === 'A') {
            if (value > 95)
                return null;
            text += value < 64 ? String.fromCharCode(value + 32) : String.fromCharCode(value - 64);
        }
        else {
            if (value > 95)
                return null;
            text += String.fromCharCode(value + 32);
        }
        if (text.length > 100000)
            return null;
    }
    if (text.length === 0)
        return null;
    return fnc1AtStart
        ? { text, fnc1AtStart: true, fnc1Positions }
        : { text };
}
/** Sample one module at the centre of every integer-sized module. */
export function sampleModules(row, start, moduleSize, count) {
    if (!Number.isInteger(moduleSize) || moduleSize < 1 || start < 0)
        return null;
    const end = start + moduleSize * count;
    if (end > row.length)
        return null;
    let modules = '';
    const centre = Math.floor((moduleSize - 1) / 2);
    for (let index = 0; index < count; index++) {
        modules += row[start + index * moduleSize + centre] ? '1' : '0';
    }
    return modules;
}
/**
 * Scan a binarized image for stacked symbols with integer module scaling.
 * The parser receives every plausible dark-run origin and can try one or more
 * geometry variants. A bounded scale keeps camera frames predictable.
 */
export function scanStackedRows(image, minimumModules, parser, maximumModules = 900) {
    const candidates = [];
    const rowBuffer = new Uint8Array(image.width);
    const maximumScale = Math.min(32, Math.max(1, Math.floor(maximumModules / Math.max(1, minimumModules))));
    for (let y = 0; y < image.height; y++) {
        const row = image.getRow(y, rowBuffer);
        for (let start = 0; start < row.length; start++) {
            if (!row[start] || (start > 0 && row[start - 1]))
                continue;
            for (let moduleSize = 1; moduleSize <= maximumScale; moduleSize++) {
                if (start + minimumModules * moduleSize > row.length)
                    break;
                const parsed = parser(row, start, moduleSize);
                if (parsed !== null)
                    candidates.push({ x: start, y, moduleSize, parsed });
            }
        }
    }
    return candidates;
}
/** Paint a set of row module strings with separator bars and quiet rows. */
export function renderStackedRows(rowModules, rowHeight, separatorHeight) {
    if (!Number.isInteger(rowHeight) || rowHeight < 1 || rowHeight > 128) {
        throw new EncodeError('Stacked Code 128: rowHeight must be an integer in 1..128');
    }
    if (!Number.isInteger(separatorHeight) || separatorHeight < 1 || separatorHeight > 16) {
        throw new EncodeError('Stacked Code 128: separatorHeight must be an integer in 1..16');
    }
    if (rowModules.length < 1)
        throw new EncodeError('Stacked Code 128: at least one row is required');
    const width = rowModules[0].length;
    if (width < 1 || rowModules.some((modules) => modules.length !== width)) {
        throw new EncodeError('Stacked Code 128: rows must have equal module widths');
    }
    const height = 2 + rowModules.length * rowHeight + (rowModules.length - 1) * separatorHeight;
    const matrix = new BitMatrix(width, height);
    matrix.setRegion(0, 0, width, 1);
    matrix.setRegion(0, height - 1, width, 1);
    let y = 1;
    for (let row = 0; row < rowModules.length; row++) {
        const modules = rowModules[row];
        for (let x = 0; x < width; x++) {
            if (modules[x] === '1')
                matrix.setRegion(x, y, 1, rowHeight);
        }
        y += rowHeight;
        if (row < rowModules.length - 1) {
            matrix.setRegion(0, y, width, separatorHeight);
            y += separatorHeight;
        }
    }
    return matrix;
}
/** Build an alternating-width pattern, starting with dark or light. */
export function alternatingWidths(widths, startsDark) {
    let modules = '';
    let dark = startsDark;
    for (const width of widths) {
        if (!Number.isInteger(width) || width < 1)
            throw new EncodeError('Stacked barcode: invalid guard width');
        modules += (dark ? '1' : '0').repeat(width);
        dark = !dark;
    }
    return modules;
}
