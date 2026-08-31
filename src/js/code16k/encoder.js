/*!
 * Sythos Barcode Suite
 *
 * MIT License
 * Copyright (c) 2026 Sythos
 * SPDX-License-Identifier: MIT
 *
 * Original work. No code from any other barcode implementation.
 */
import { EncodeError } from '../core/errors.js';
import { code128DataCodewords, } from '../oned/writers.js';
import { renderStackedRows } from '../stacked128/common.js';
import { CODE16K_CODEWORD_WIDTH, CODE16K_PAD, CODE16K_SYMBOLS_PER_ROW, code16kModeInfo, code16kStartModules, code16kStopModules, validateCode16KOptions, } from './tables.js';
import { code128PatternModules } from '../stacked128/common.js';
function asciiText(value) {
    if (typeof value === 'string') {
        if (value.length > 4096)
            throw new EncodeError('Code 16K: value is too long for the 16-row symbol limit');
        for (const character of value) {
            if (character.codePointAt(0) > 127) {
                throw new EncodeError('Code 16K: value must contain seven-bit ASCII characters');
            }
        }
        return value;
    }
    const bytes = value instanceof Uint8Array ? Array.from(value) :
        Array.isArray(value) ? value : null;
    if (!bytes)
        throw new EncodeError('Code 16K: value must be text or seven-bit bytes');
    if (bytes.length > 4096)
        throw new EncodeError('Code 16K: value is too long for the 16-row symbol limit');
    if (bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 127)) {
        throw new EncodeError('Code 16K: byte input must contain values from 0 to 127');
    }
    return bytes.map((byte) => String.fromCharCode(byte)).join('');
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
function rowModules(row, values) {
    if (values.length !== CODE16K_SYMBOLS_PER_ROW) {
        throw new EncodeError('Code 16K: every row must contain exactly five symbol characters');
    }
    let modules = code16kStartModules(row) + '1';
    for (const value of values) {
        if (!Number.isInteger(value) || value < 0 || value > 106) {
            throw new EncodeError(`Code 16K: invalid Code 128 symbol value ${value}`);
        }
        const symbol = code128PatternModules(value);
        if (symbol.length !== CODE16K_CODEWORD_WIDTH) {
            throw new EncodeError('Code 16K: Code 128 symbol width invariant failed');
        }
        modules += symbol;
    }
    modules += code16kStopModules(row);
    if (modules.length !== 70)
        throw new EncodeError('Code 16K: internal row width mismatch');
    return modules;
}
/**
 * Encode a Code 16K symbol.
 *
 * The implementation accepts seven-bit ASCII and the standard Code 128 A/B/C
 * data sets. It chooses the smallest legal row count unless `rows` is given.
 * The first symbol character carries the row count and mode; C1 and C2 are
 * calculated over every preceding symbol character exactly as specified.
 *
 * @param {string|Uint8Array|number[]} value
 * @param {Code16KEncodeOptions} [options]
 * @returns {Code16KMatrix}
 */
export function encodeCode16K(value, options = {}) {
    const text = asciiText(value);
    if (text.length === 0)
        throw new EncodeError('Code 16K: value must not be empty');
    const validated = validateCode16KOptions(options);
    const info = code16kModeInfo(options.mode, options.gs1 === true);
    const tokenized = code128DataCodewords(text, {
        gs1: info.gs1,
        startSet: info.startSet,
    });
    const data = tokenized.values.slice();
    const minimumRows = Math.max(2, Math.ceil((data.length + 3) / CODE16K_SYMBOLS_PER_ROW));
    const rows = validated.rows ?? minimumRows;
    if (rows < 2 || rows > 16) {
        throw new EncodeError('Code 16K: payload needs between 2 and 16 rows');
    }
    const capacity = rows * CODE16K_SYMBOLS_PER_ROW - 3;
    if (data.length > capacity) {
        throw new EncodeError(`Code 16K: payload needs ${data.length} data symbols but ${capacity} fit in ${rows} rows`);
    }
    const first = 7 * (rows - 2) + info.mode;
    if (first > 104)
        throw new EncodeError('Code 16K: row count and mode do not fit the S symbol');
    while (data.length < capacity)
        data.push(CODE16K_PAD);
    const beforeChecks = [first, ...data];
    const c1 = checksumOne(beforeChecks);
    const c2 = checksumTwo([...beforeChecks, c1]);
    const codewords = [...beforeChecks, c1, c2];
    if (codewords.length !== rows * CODE16K_SYMBOLS_PER_ROW) {
        throw new EncodeError('Code 16K: internal codeword packing mismatch');
    }
    const rowsModules = [];
    for (let row = 0; row < rows; row++) {
        rowsModules.push(rowModules(row, codewords.slice(row * CODE16K_SYMBOLS_PER_ROW, (row + 1) * CODE16K_SYMBOLS_PER_ROW)));
    }
    const matrix = renderStackedRows(rowsModules, validated.rowHeight, validated.separatorHeight);
    matrix.code16k = {
        format: 'code16k',
        rows,
        columns: CODE16K_SYMBOLS_PER_ROW,
        rowHeight: validated.rowHeight,
        separatorHeight: validated.separatorHeight,
        mode: info.mode,
        codewords,
        checksum: true,
    };
    return matrix;
}
/** Return the dimensions selected for a Code 16K payload without rendering it. */
export function code16kDimensions(value, options = {}) {
    const text = asciiText(value);
    if (text.length === 0)
        throw new EncodeError('Code 16K: value must not be empty');
    const validated = validateCode16KOptions(options);
    const info = code16kModeInfo(options.mode, options.gs1 === true);
    const tokenized = code128DataCodewords(text, { gs1: info.gs1, startSet: info.startSet });
    const dataLength = tokenized.values.length;
    const rows = validated.rows ?? Math.max(2, Math.ceil((dataLength + 3) / CODE16K_SYMBOLS_PER_ROW));
    const capacity = rows * CODE16K_SYMBOLS_PER_ROW - 3;
    if (rows > 16 || dataLength > capacity) {
        throw new EncodeError('Code 16K: payload does not fit the requested row count');
    }
    return {
        rows,
        columns: CODE16K_SYMBOLS_PER_ROW,
        width: 70,
        height: 2 + rows * validated.rowHeight + (rows - 1) * validated.separatorHeight,
        rowHeight: validated.rowHeight,
        separatorHeight: validated.separatorHeight,
    };
}
