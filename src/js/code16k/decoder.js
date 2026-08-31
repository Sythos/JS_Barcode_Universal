/*!
 * Sythos Barcode Suite
 *
 * MIT License
 * Copyright (c) 2026 Sythos
 * SPDX-License-Identifier: MIT
 *
 * Original work. No code from any other barcode implementation.
 */
/** Code 16K decoder for sampled, axis-aligned module matrices. @module code16k/decoder */
import { FormatError } from '../core/errors.js';
import { CODE16K_CODEWORD_WIDTH, CODE16K_MAX_ROWS, CODE16K_MIN_ROWS, CODE16K_PAD, CODE16K_SYMBOLS_PER_ROW, code16kModeInfo, code16kStartModules, code16kStopModules, } from './tables.js';
import { code128ValueFromModules, } from '../stacked128/common.js';
function equalAt(source, offset, expected) {
    return source.slice(offset, offset + expected.length) === expected;
}
/** Decode one complete 70-module Code 16K row. */
export function decodeCode16KRow(modules, expectedRow = undefined) {
    if (typeof modules !== 'string' || modules.length !== 70)
        return null;
    const candidates = expectedRow === undefined
        ? Array.from({ length: CODE16K_MAX_ROWS }, (_, index) => index)
        : [expectedRow];
    for (const row of candidates) {
        if (!Number.isInteger(row) || row < 0 || row >= CODE16K_MAX_ROWS)
            continue;
        if (!equalAt(modules, 0, code16kStartModules(row)))
            continue;
        if (modules[7] !== '1')
            continue;
        if (!equalAt(modules, 63, code16kStopModules(row)))
            continue;
        const values = [];
        let valid = true;
        for (let column = 0; column < CODE16K_SYMBOLS_PER_ROW; column++) {
            const value = code128ValueFromModules(modules, 8 + column * CODE16K_CODEWORD_WIDTH);
            if (value === null) {
                valid = false;
                break;
            }
            values.push(value);
        }
        if (valid)
            return { row, values };
    }
    return null;
}
function separatorIsDark(matrix, y) {
    if (y < 0 || y >= matrix.height)
        return false;
    for (let x = 0; x < matrix.width; x++)
        if (!matrix.get(x, y))
            return false;
    return true;
}
function readRow(matrix, y) {
    if (y < 0 || y >= matrix.height)
        return null;
    let modules = '';
    for (let x = 0; x < matrix.width; x++)
        modules += matrix.get(x, y) ? '1' : '0';
    return decodeCode16KRow(modules);
}
function rowIsConsistent(matrix, y, rowHeight, expected) {
    for (let offset = 0; offset < rowHeight; offset++) {
        const parsed = readRow(matrix, y + offset);
        if (!parsed || parsed.row !== expected.row ||
            parsed.values.some((value, index) => value !== expected.values[index]))
            return false;
    }
    return true;
}
function code128StartForMode(mode) {
    if (mode === 0)
        return 103;
    if (mode === 1 || mode === 3)
        return 104;
    if (mode === 2 || mode === 4)
        return 105;
    return -1;
}
function checksumOne(values) {
    let sum = 0;
    for (let index = 0; index < values.length; index++)
        sum += (index + 2) * values[index];
    return sum % 107;
}
function checksumTwo(valuesThroughC1) {
    let sum = 0;
    for (let index = 0; index < valuesThroughC1.length; index++) {
        sum += (index + 1) * valuesThroughC1[index];
    }
    return sum % 107;
}
function decodeRows(rows, rowHeight, separatorHeight) {
    if (rows.length < CODE16K_MIN_ROWS || rows.length > CODE16K_MAX_ROWS) {
        throw new FormatError('Code 16K: row count must be in 2..16');
    }
    const first = rows[0];
    if (first.row !== 0 || first.values.length !== CODE16K_SYMBOLS_PER_ROW) {
        throw new FormatError('Code 16K: first row is missing or malformed');
    }
    const symbol = first.values[0];
    if (!Number.isInteger(symbol) || symbol < 0 || symbol > 104) {
        throw new FormatError('Code 16K: invalid S symbol');
    }
    const rowCount = Math.floor(symbol / 7) + 2;
    const mode = symbol % 7;
    if (rowCount !== rows.length || rowCount < CODE16K_MIN_ROWS || rowCount > CODE16K_MAX_ROWS) {
        throw new FormatError('Code 16K: S symbol does not agree with the row count');
    }
    if (mode === 5 || mode === 6) {
        throw new FormatError('Code 16K: shift modes 5 and 6 are not supported by this decoder');
    }
    const expectedRows = Array.from({ length: rowCount }, (_, index) => index);
    for (let index = 0; index < rowCount; index++) {
        if (rows[index].row !== expectedRows[index] || rows[index].values.length !== CODE16K_SYMBOLS_PER_ROW) {
            throw new FormatError('Code 16K: rows are missing or out of order');
        }
    }
    const codewords = rows.flatMap((entry) => entry.values);
    if (codewords.length !== rowCount * CODE16K_SYMBOLS_PER_ROW) {
        throw new FormatError('Code 16K: invalid codeword count');
    }
    const c1 = codewords[codewords.length - 2];
    const c2 = codewords[codewords.length - 1];
    const beforeChecks = codewords.slice(0, -2);
    if (checksumOne(beforeChecks) !== c1 || checksumTwo([...beforeChecks, c1]) !== c2) {
        throw new FormatError('Code 16K: check character mismatch');
    }
    const data = codewords.slice(1, -2);
    while (data.length && data[data.length - 1] === CODE16K_PAD)
        data.pop();
    if (!data.length)
        throw new FormatError('Code 16K: data region is empty');
    const expectedStart = code128StartForMode(mode);
    if (expectedStart < 0)
        throw new FormatError('Code 16K: unsupported mode');
    const info = code16kModeInfo(mode, mode === 3 || mode === 4);
    const firstIsFnc1 = data[0] === 102;
    if (info.gs1 !== firstIsFnc1) {
        throw new FormatError('Code 16K: mode and leading FNC1 do not agree');
    }
    // Keep Code 16K aligned with ordinary Code 128 A/B/C decoding while the row
    // framing and checks remain format-specific.
    const decoded = decodeCode128ValuesLocal(expectedStart, data);
    if (!decoded)
        throw new FormatError('Code 16K: invalid Code 128 data stream');
    return {
        format: 'code16k',
        text: decoded.text,
        rows: rowCount,
        columns: CODE16K_SYMBOLS_PER_ROW,
        rowHeight,
        separatorHeight,
        mode,
        codewords,
        checksum: true,
        symbologyIdentifier: info.gs1 ? ']K1' : ']K0',
        ...(info.gs1 ? { gs1: true } : {}),
        ...(decoded.fnc1AtStart ? { fnc1AtStart: true } : {}),
        ...(decoded.fnc1Positions?.length ? { fnc1Positions: decoded.fnc1Positions } : {}),
    };
}
/* Keep the decoder self-contained if this module is consumed without the full common declaration graph. */
function decodeCode128ValuesLocal(startCode, dataValues) {
    if (![103, 104, 105].includes(startCode) || !dataValues.length)
        return null;
    let mode = startCode === 103 ? 'A' : startCode === 104 ? 'B' : 'C';
    let shifted = null;
    let text = '';
    const fnc1AtStart = dataValues[0] === 102;
    const fnc1Positions = [];
    for (let index = 0; index < dataValues.length; index++) {
        const value = dataValues[index];
        const active = shifted ?? mode;
        shifted = null;
        if (value === 101 && mode !== 'A') {
            mode = 'A';
            continue;
        }
        if (value === 100 && mode !== 'B') {
            mode = 'B';
            continue;
        }
        if (value === 99) {
            mode = 'C';
            continue;
        }
        if (value === 98) {
            shifted = mode === 'A' ? 'B' : 'A';
            continue;
        }
        if (value === 102) {
            if (index > 0) {
                fnc1Positions.push(text.length);
                text += '\x1d';
            }
            continue;
        }
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
    return text.length ? { text, ...(fnc1AtStart ? { fnc1AtStart: true } : {}), fnc1Positions } : null;
}
function candidateGeometry(matrix, options) {
    const metadata = matrix.code16k;
    const requestedRows = options.rows ?? metadata?.rows;
    const requestedRowHeight = options.rowHeight ?? metadata?.rowHeight;
    const requestedSeparatorHeight = options.separatorHeight ?? metadata?.separatorHeight;
    const candidates = [];
    for (const outer of [true, false]) {
        const innerHeight = matrix.height - (outer ? 2 : 0);
        for (let rows = CODE16K_MIN_ROWS; rows <= CODE16K_MAX_ROWS; rows++) {
            if (requestedRows !== undefined && rows !== requestedRows)
                continue;
            for (let separatorHeight = requestedSeparatorHeight ?? 1; separatorHeight <= (requestedSeparatorHeight ?? 16); separatorHeight++) {
                if (!Number.isInteger(separatorHeight) || separatorHeight < 1 || separatorHeight > 16)
                    continue;
                const numerator = innerHeight - (rows - 1) * separatorHeight;
                if (numerator < rows || numerator % rows !== 0)
                    continue;
                const rowHeight = numerator / rows;
                if (rowHeight < 1 || rowHeight > 128)
                    continue;
                if (requestedRowHeight !== undefined && rowHeight !== requestedRowHeight)
                    continue;
                candidates.push({ rows, rowHeight, separatorHeight, outer });
            }
        }
    }
    return candidates;
}
/**
 * Decode a complete, axis-aligned Code 16K module matrix.
 *
 * The decoder re-checks row geometry, row identifiers, both modulo-107 check
 * characters and the Code 128 data stream. Metadata attached by the encoder
 * is used only as a geometry hint and never substitutes for validation.
 */
export function decodeCode16K(matrix, options = {}) {
    if (!matrix?.width || !matrix?.height || typeof matrix.get !== 'function') {
        throw new FormatError('Code 16K: matrix with width, height and get() is required');
    }
    if (matrix.width !== 70)
        throw new FormatError('Code 16K: matrix width must be 70 modules');
    for (const geometry of candidateGeometry(matrix, options)) {
        const first = readRow(matrix, geometry.outer ? 1 : 0);
        if (!first || first.row !== 0)
            continue;
        const encodedRows = Math.floor(first.values[0] / 7) + 2;
        if (encodedRows !== geometry.rows)
            continue;
        const rows = [];
        let valid = true;
        for (let row = 0; row < geometry.rows; row++) {
            const y = (geometry.outer ? 1 : 0) + row * (geometry.rowHeight + geometry.separatorHeight);
            const parsed = readRow(matrix, y);
            if (!parsed || parsed.row !== row) {
                valid = false;
                break;
            }
            if (!rowIsConsistent(matrix, y, geometry.rowHeight, parsed)) {
                valid = false;
                break;
            }
            rows.push(parsed);
            if (row < geometry.rows - 1 && !separatorIsDark(matrix, y + geometry.rowHeight)) {
                valid = false;
                break;
            }
        }
        if (!valid)
            continue;
        if (geometry.outer && (!separatorIsDark(matrix, 0) ||
            !separatorIsDark(matrix, matrix.height - 1)))
            continue;
        try {
            return decodeRows(rows, geometry.rowHeight, geometry.separatorHeight);
        }
        catch {
            // Try another legal geometry before rejecting the matrix.
        }
    }
    throw new FormatError('Code 16K: no valid row geometry or checksum found');
}
