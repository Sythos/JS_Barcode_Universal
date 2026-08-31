/*
 * Sythos Barcode Suite — Codablock-F reader
 *
 * MIT License
 * Copyright (c) 2026 Sythos
 * SPDX-License-Identifier: MIT
 *
 * Original work. No code from any other barcode implementation.
 */
import { FormatError } from '../core/errors.js';
import { code128Checksum, code128CodewordsModules, code128ValueFromModules, decodeCode128Values, sampleModules, scanStackedRows, } from '../stacked128/common.js';
import { codablockFChecks } from './encoder.js';
const START_A = 103;
const CODE_B = 100;
const STOP = 106;
const PAD = 103;
const MIN_COLUMNS = 4;
const MAX_COLUMNS = 62;
function parseRow(row, start, moduleSize, columns) {
    const count = columns + 4;
    const moduleCount = 11 * count + 13;
    const modules = sampleModules(row, start, moduleSize, moduleCount);
    if (!modules)
        return null;
    let offset = 0;
    const startValue = code128ValueFromModules(modules, offset);
    if (startValue !== START_A)
        return null;
    offset += 11;
    const selector = code128ValueFromModules(modules, offset);
    if (selector !== CODE_B)
        return null;
    offset += 11;
    const indicator = code128ValueFromModules(modules, offset);
    if (indicator === null || indicator < 1 || indicator > 44)
        return null;
    offset += 11;
    const data = [];
    for (let i = 0; i < columns; i++) {
        const value = code128ValueFromModules(modules, offset);
        if (value === null || value === STOP)
            return null;
        data.push(value);
        offset += 11;
    }
    const rowCheck = code128ValueFromModules(modules, offset);
    if (rowCheck === null || rowCheck >= 103)
        return null;
    const withoutRowCheck = [START_A, CODE_B, indicator, ...data];
    if (code128Checksum(withoutRowCheck) !== rowCheck)
        return null;
    offset += 11;
    const stop = modules.slice(offset, offset + 13);
    if (stop !== code128CodewordsModules([STOP]))
        return null;
    return { indicator, data };
}
function rowBits(matrix, y) {
    let bits = '';
    for (let x = 0; x < matrix.width; x++)
        bits += matrix.get(x, y) ? '1' : '0';
    return bits;
}
function allDark(matrix, y) {
    if (y < 0 || y >= matrix.height)
        return false;
    for (let x = 0; x < matrix.width; x++)
        if (!matrix.get(x, y))
            return false;
    return true;
}
function decodeRows(rowsByNumber, rows, columns, moduleSize) {
    if (rowsByNumber.length !== rows || rows < 2 || rows > 44)
        return null;
    const stream = rowsByNumber.flatMap((entry) => entry.data);
    if (stream.length < 2)
        return null;
    const checks = codablockFChecks(stream.slice(0, -2));
    if (stream[stream.length - 2] !== checks[0] || stream[stream.length - 1] !== checks[1])
        return null;
    const body = stream.slice(0, -2);
    while (body.length > 0 && body[body.length - 1] === PAD)
        body.pop();
    const decoded = decodeCode128Values(104, body);
    if (!decoded)
        return null;
    return {
        format: 'codablockf',
        text: decoded.text,
        rows,
        columns,
        moduleSize,
        checksum: true,
    };
}
/** Validate an encoder-shaped matrix row by row, including every row-height pixel. */
function decodeCanonical(matrix, metadata) {
    const { rows, columns, rowHeight, separatorHeight } = metadata;
    if (!Number.isInteger(rows) || rows < 2 || rows > 44 ||
        !Number.isInteger(columns) || columns < MIN_COLUMNS || columns > MAX_COLUMNS)
        return null;
    const expectedWidth = 11 * (columns + 4) + 13;
    const expectedHeight = 2 + rows * rowHeight + (rows - 1) * separatorHeight;
    if (matrix.width !== expectedWidth || matrix.height !== expectedHeight)
        return null;
    if (!allDark(matrix, 0) || !allDark(matrix, matrix.height - 1))
        return null;
    const parsedRows = [];
    for (let row = 0; row < rows; row++) {
        const y = 1 + row * (rowHeight + separatorHeight);
        const source = rowBits(matrix, y);
        const parsed = parseRow(Uint8Array.from(source, (bit) => bit === '1' ? 1 : 0), 0, 1, columns);
        if (!parsed || parsed.indicator !== (row === 0 ? rows : row))
            return null;
        for (let offset = 1; offset < rowHeight; offset++) {
            if (rowBits(matrix, y + offset) !== source)
                return null;
        }
        parsedRows.push(parsed);
        if (row < rows - 1) {
            for (let offset = 0; offset < separatorHeight; offset++) {
                if (!allDark(matrix, y + rowHeight + offset))
                    return null;
            }
        }
    }
    return decodeRows(parsedRows, rows, columns, 1);
}
function assemble(image) {
    const minimumModules = 11 * (MIN_COLUMNS + 4) + 13;
    const candidates = scanStackedRows(image, minimumModules, (row, start, moduleSize) => {
        for (let columns = MIN_COLUMNS; columns <= MAX_COLUMNS; columns++) {
            const parsed = parseRow(row, start, moduleSize, columns);
            if (parsed)
                return { columns, ...parsed };
        }
        return null;
    }, 2200);
    const groups = new Map();
    for (const candidate of candidates) {
        const signature = `${candidate.x}:${candidate.moduleSize}`;
        const group = groups.get(signature) ?? new Map();
        const current = group.get(candidate.parsed.indicator);
        // Rows are repeated vertically; keeping one exact candidate per indicator
        // prevents rowHeight from multiplying the work without losing a symbol.
        if (!current)
            group.set(candidate.parsed.indicator, {
                columns: candidate.parsed.columns,
                parsed: candidate.parsed,
                moduleSize: candidate.moduleSize,
            });
        groups.set(signature, group);
    }
    for (const group of groups.values()) {
        for (const [rows, first] of group) {
            if (rows < 2 || rows > 44)
                continue;
            const columns = first.parsed.columns;
            const rowsByNumber = [];
            let complete = true;
            for (let row = 1; row < rows; row++) {
                const found = group.get(row);
                if (!found || found.columns !== columns) {
                    complete = false;
                    break;
                }
                rowsByNumber.push(found.parsed);
            }
            if (!complete)
                continue;
            rowsByNumber.unshift(first.parsed);
            const decoded = decodeRows(rowsByNumber, rows, columns, first.moduleSize);
            if (decoded)
                return decoded;
        }
    }
    return null;
}
/** Decode a Codablock-F matrix or throw when its structure is invalid. */
export function decodeCodablockF(matrix) {
    const metadata = matrix.codablockf;
    if (metadata) {
        const canonical = decodeCanonical(matrix, metadata);
        if (canonical)
            return canonical;
        throw new FormatError('Codablock-F: invalid rows, checks or Code 128 framing');
    }
    const result = assemble(matrix);
    if (!result)
        throw new FormatError('Codablock-F: invalid rows, checks or Code 128 framing');
    return result;
}
/** Locate and decode one Codablock-F symbol in a binarized raster. */
export function detectCodablockF(image) {
    return assemble(image);
}
/** Alias used by the generic image decoder. */
export const detectAndDecodeCodablockF = detectCodablockF;
