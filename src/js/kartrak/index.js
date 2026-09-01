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
 * KarTrak ACI (Automatic Car Identification), the 1967-1977 AAR railcar
 * colour barcode. See `licenses/kartrak-aci.license` for the freedom-to-
 * implement finding and `docs/formats/kartrak.md` for the format guide.
 *
 * A KarTrak plate is 13 stacked lines, each two colour stripes (lower,
 * upper) drawn from {blue, checkerboard/white, red, black}. Lines 2-11 are
 * ten data digits (equipment code, 3-digit ownership code, 6-digit car
 * number); line 1 is a START marker, line 12 a STOP marker, line 13 a
 * mod-11 check digit that can take the extra value 10. The colour table and
 * the START/STOP glyph geometry below were verified against the raw
 * wikitext of Wikipedia's "KarTrak" article and cross-checked pixel-for-
 * pixel against its two reference SVG diagrams (Diagram Of a KarTrak ACI
 * Plate.svg, KarTrak ACI codes.svg) — not read off the rendered page or a
 * summary, since an earlier automated fetch of the same article transposed
 * the table's rows and columns.
 *
 * This module builds on the experimental `../color/` primitives
 * (`PolychromeMatrix`, `toColorImageData`, `classifyGrid`). Decoding a raw
 * image is scoped honestly: `detectKarTrak` finds one axis-aligned label on
 * a roughly uniform background by bounding-box contrast, with no rotation
 * or perspective correction. That is the same "clean single-symbol"
 * boundary this SDK already documents for MaxiCode, not a promise of
 * arbitrary photographic robustness (see `docs/COLOR_PIPELINE_NOTES.md`).
 *
 * @module kartrak
 */
import { ChecksumError, EncodeError, FormatError, NotFoundError } from '../core/errors.js';
import { PolychromeMatrix } from '../color/matrix.js';
import { classifyGrid } from '../color/classify.js';
import { toColorImageData } from '../color/render.js';
import { PerspectiveTransform } from '../image/perspective.js';
// Re-exported for convenience, so a consumer of this format doesn't need a
// second import from the separate (still experimental) `../color/`
// subpath just to render or hold the matrix this module produces.
export { PolychromeMatrix, toColorImageData };
export const KARTRAK_PROFILE = 'sythos-kartrak-aci';
// Index 0 is PolychromeMatrix's fixed background/quiet-zone slot. A mid
// grey — not a light one — keeps it far in RGB space from all four label
// colours (white/checkerboard included) so a bounding-box search has a
// real margin against noise, rather than sitting close enough to white
// that ordinary pixel noise crosses the boundary.
const BACKGROUND = [128, 128, 128];
const BLUE = [0, 51, 204];
const WHITE = [255, 255, 255];
const RED = [204, 0, 0];
const BLACK = [0, 0, 0];
export const KARTRAK_PALETTE = Object.freeze([BACKGROUND, BLUE, WHITE, RED, BLACK]);
const BLUE_I = 1;
const WHITE_I = 2;
const RED_I = 3;
const BLACK_I = 4;
// (lower stripe index, upper stripe index) -> digit, verified against the
// "Values of label stripes" table (Lower Stripe rows x Upper Stripe columns).
const DIGIT_PAIR = Object.freeze([
    Object.freeze([BLUE_I, WHITE_I]), // 0
    Object.freeze([WHITE_I, WHITE_I]), // 1
    Object.freeze([WHITE_I, RED_I]), // 2
    Object.freeze([RED_I, BLACK_I]), // 3
    Object.freeze([RED_I, RED_I]), // 4
    Object.freeze([BLUE_I, BLACK_I]), // 5
    Object.freeze([WHITE_I, BLUE_I]), // 6
    Object.freeze([RED_I, WHITE_I]), // 7
    Object.freeze([WHITE_I, BLACK_I]), // 8
    Object.freeze([BLUE_I, BLUE_I]), // 9
]);
// Value 10 only ever appears on the check-digit line (line 13).
const TEN_PAIR = Object.freeze([BLUE_I, RED_I]);
function pairToValue(lower, upper) {
    for (let d = 0; d < DIGIT_PAIR.length; d++) {
        if (DIGIT_PAIR[d][0] === lower && DIGIT_PAIR[d][1] === upper)
            return d;
    }
    if (lower === TEN_PAIR[0] && upper === TEN_PAIR[1])
        return 10;
    return -1;
}
// The physical START/STOP labels are not a uniform two-stripe digit: they
// are a single line split into left/centre/right horizontal zones (roughly
// 23%/54%/23% of the label width in the reference SVGs) so a scanning beam
// reads a recognisable pattern regardless of exactly where across the
// label it crosses. GRID_COLUMNS=4 approximates that split as 1/2/1
// columns (25%/50%/25%) rather than the exact fractional proportions,
// which keeps every module boundary aligned to an integer column.
const GRID_COLUMNS = 4;
const DATA_DIGITS = 10;
const LINE_COUNT = 13;
const GRID_ROWS = LINE_COUNT * 2;
// Left zone: upper=blue, lower=black ("left START" / mirrored "right STOP").
// Centre zone (2 cols): upper=blue, lower=red ("centre START" / value 10).
// Right zone: upper=black, lower=red ("right START", shares digit 3's pair).
const START_UPPER = Object.freeze([BLUE_I, BLUE_I, BLUE_I, BLACK_I]);
const START_LOWER = Object.freeze([BLACK_I, RED_I, RED_I, RED_I]);
// STOP is START with upper/lower swapped: blue points toward the label
// centre in both directions (line 1 is the bottom line, line 12 near top).
const STOP_UPPER = START_LOWER;
const STOP_LOWER = START_UPPER;
/** Mod-11 weighted checksum: digit[i] * 2^i, summed and reduced mod 11. */
export function kartrakCheckDigit(digits) {
    let sum = 0;
    for (let i = 0; i < digits.length; i++)
        sum += digits[i] * (2 ** i);
    return sum % 11;
}
// Row 0 of the matrix is the top of the rendered image; line 13 (the
// checksum) is physically the topmost line and line 1 (START) the
// bottommost, matching "labels are read from bottom to top".
function lineRows(lineNumber) {
    const fromTop = LINE_COUNT - lineNumber;
    return { upper: fromTop * 2, lower: fromTop * 2 + 1 };
}
function fillRow(matrix, rowIndex, colors) {
    for (let x = 0; x < GRID_COLUMNS; x++)
        matrix.set(x, rowIndex, colors[x]);
}
function readRow(matrix, rowIndex) {
    const row = [];
    for (let x = 0; x < GRID_COLUMNS; x++)
        row.push(matrix.get(x, rowIndex));
    return row;
}
function rowsEqual(a, b) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}
/**
 * Encode a KarTrak ACI plate.
 *
 * @param {string} value Exactly 10 digits: 1 equipment-type digit, 3
 * ownership-code digits, 6 car-number digits. The check digit is computed,
 * not supplied.
 * @returns {PolychromeMatrix} With a frozen `.kartrak` metadata property.
 */
export function encodeKarTrak(value) {
    if (typeof value !== 'string' || !/^\d{10}$/.test(value)) {
        throw new EncodeError('KarTrak ACI data must be exactly 10 digits (equipment code + 3-digit ownership code + 6-digit car number)');
    }
    const digits = value.split('').map(Number);
    const check = kartrakCheckDigit(digits);
    const matrix = new PolychromeMatrix(GRID_COLUMNS, GRID_ROWS, KARTRAK_PALETTE);
    const start = lineRows(1);
    fillRow(matrix, start.upper, START_UPPER);
    fillRow(matrix, start.lower, START_LOWER);
    for (let i = 0; i < DATA_DIGITS; i++) {
        const [lower, upper] = DIGIT_PAIR[digits[i]];
        const { upper: upperRow, lower: lowerRow } = lineRows(2 + i);
        fillRow(matrix, upperRow, new Array(GRID_COLUMNS).fill(upper));
        fillRow(matrix, lowerRow, new Array(GRID_COLUMNS).fill(lower));
    }
    const stop = lineRows(12);
    fillRow(matrix, stop.upper, STOP_UPPER);
    fillRow(matrix, stop.lower, STOP_LOWER);
    const [checkLower, checkUpper] = check === 10 ? TEN_PAIR : DIGIT_PAIR[check];
    const checkRows = lineRows(13);
    fillRow(matrix, checkRows.upper, new Array(GRID_COLUMNS).fill(checkUpper));
    fillRow(matrix, checkRows.lower, new Array(GRID_COLUMNS).fill(checkLower));
    matrix.kartrak = Object.freeze({
        profile: KARTRAK_PROFILE,
        text: value,
        equipmentCode: value.slice(0, 1),
        ownershipCode: value.slice(1, 4),
        carNumber: value.slice(4, 10),
        checkDigit: check,
    });
    return matrix;
}
function resultFrom(digits, checkValue) {
    const text = digits.join('');
    return Object.freeze({
        format: 'kartrak',
        profile: KARTRAK_PROFILE,
        text,
        equipmentCode: text.slice(0, 1),
        ownershipCode: text.slice(1, 4),
        carNumber: text.slice(4, 10),
        checkDigit: checkValue,
    });
}
/** Decode a `PolychromeMatrix` that is already a classified 4x26 KarTrak grid. */
export function decodeKarTrakMatrix(matrix) {
    if (!(matrix instanceof PolychromeMatrix) || matrix.width !== GRID_COLUMNS || matrix.height !== GRID_ROWS) {
        throw new FormatError(`KarTrak ACI decoder expects a ${GRID_COLUMNS}x${GRID_ROWS} colour grid`);
    }
    const start = lineRows(1);
    if (!rowsEqual(readRow(matrix, start.upper), START_UPPER) || !rowsEqual(readRow(matrix, start.lower), START_LOWER)) {
        throw new FormatError('KarTrak ACI start label was not found on line 1');
    }
    const stop = lineRows(12);
    if (!rowsEqual(readRow(matrix, stop.upper), STOP_UPPER) || !rowsEqual(readRow(matrix, stop.lower), STOP_LOWER)) {
        throw new FormatError('KarTrak ACI stop label was not found on line 12');
    }
    const readDigitLine = (lineNumber, maxValue) => {
        const { upper, lower } = lineRows(lineNumber);
        const upperRow = readRow(matrix, upper);
        const lowerRow = readRow(matrix, lower);
        const u = upperRow[0];
        const l = lowerRow[0];
        if (!upperRow.every((v) => v === u) || !lowerRow.every((v) => v === l)) {
            throw new FormatError(`KarTrak ACI line ${lineNumber} is not a uniform digit stripe`);
        }
        const value = pairToValue(l, u);
        if (value < 0 || value > maxValue) {
            throw new FormatError(`KarTrak ACI line ${lineNumber} is not a valid digit`);
        }
        return value;
    };
    const digits = [];
    for (let i = 0; i < DATA_DIGITS; i++)
        digits.push(readDigitLine(2 + i, 9));
    const checkValue = readDigitLine(13, 10);
    const expected = kartrakCheckDigit(digits);
    if (checkValue !== expected) {
        throw new ChecksumError(`KarTrak ACI check digit mismatch: label has ${checkValue}, expected ${expected}`);
    }
    return resultFrom(digits, checkValue);
}
function nearestIndex(r, g, b, palette) {
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < palette.length; i++) {
        const [pr, pg, pb] = palette[i];
        const dr = r - pr, dg = g - pg, db = b - pb;
        const d = dr * dr + dg * dg + db * db;
        if (d < bestDistance) {
            bestDistance = d;
            best = i;
        }
    }
    return best;
}
// Classifies every pixel against the whole 5-colour palette (background
// plus the four label colours) rather than thresholding distance from a
// single fixed background reference. A uniform lighting/tint shift moves
// the background reading right along with the label colours, so relative
// nearest-colour classification — the same technique `classifyGrid` already
// relies on — stays correct where a fixed absolute threshold would not.
//
// A single stray foreground pixel (isolated background noise crossing the
// nearest-colour boundary) must not move the box: a run's own dimension
// (its width for rows, its height for columns) is unknown up front, so a
// percentage-of-image threshold cannot tell a real label edge from noise
// either. Instead, a row/column only counts once it contains a contiguous
// foreground RUN at least MIN_RUN pixels long — real label content always
// forms long uniform runs (a full digit stripe or a START/STOP zone),
// isolated per-pixel noise essentially never does.
const MIN_RUN = 4;
function longestRun(get, length) {
    let longest = 0, current = 0;
    for (let i = 0; i < length; i++) {
        if (get(i)) {
            current++;
            if (current > longest)
                longest = current;
        }
        else
            current = 0;
    }
    return longest;
}
function findBounds(image, palette) {
    const { data, width, height } = image;
    const foreground = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const p = (y * width + x) * 4;
            if (nearestIndex(data[p], data[p + 1], data[p + 2], palette) !== 0)
                foreground[y * width + x] = 1;
        }
    }
    let minY = -1, maxY = -1;
    for (let y = 0; y < height; y++) {
        if (longestRun((x) => foreground[y * width + x], width) >= MIN_RUN) {
            if (minY === -1)
                minY = y;
            maxY = y;
        }
    }
    if (minY === -1)
        return null;
    let minX = -1, maxX = -1;
    for (let x = 0; x < width; x++) {
        if (longestRun((y) => foreground[y * width + x], height) >= MIN_RUN) {
            if (minX === -1)
                minX = x;
            maxX = x;
        }
    }
    if (minX === -1)
        return null;
    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}
/**
 * Detect and decode one axis-aligned KarTrak plate against a roughly
 * uniform background. Not a general-photo detector: no rotation or
 * perspective search, and the whole image is scanned for the plate's
 * bounding box by nearest-colour classification against `options.palette`
 * (background is always palette index 0).
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} image
 * @param {{palette?: readonly RGB[]}} [options]
 * @returns {object | null} `null` if no plate was found or it failed to decode.
 */
export function detectKarTrak(image, options = {}) {
    if (!image || typeof image.width !== 'number' || typeof image.height !== 'number' || !image.data)
        return null;
    const palette = options.palette ?? KARTRAK_PALETTE;
    const bounds = findBounds(image, palette);
    if (!bounds)
        return null;
    const { x, y, width, height } = bounds;
    const transform = PerspectiveTransform.quadToQuad(0, 0, GRID_COLUMNS, 0, GRID_COLUMNS, GRID_ROWS, 0, GRID_ROWS, x, y, x + width, y, x + width, y + height, x, y + height);
    let grid;
    try {
        grid = classifyGrid(image, GRID_COLUMNS, GRID_ROWS, transform, palette);
    }
    catch (error) {
        if (error instanceof NotFoundError)
            return null;
        throw error;
    }
    try {
        const result = decodeKarTrakMatrix(grid);
        return Object.freeze({ ...result, bounds: Object.freeze(bounds) });
    }
    catch {
        return null;
    }
}
/**
 * Decode either an already-classified `PolychromeMatrix` or a raw RGBA
 * image (via `detectKarTrak`).
 */
export function decodeKarTrak(input, options = {}) {
    if (input instanceof PolychromeMatrix)
        return decodeKarTrakMatrix(input);
    const found = detectKarTrak(input, options);
    if (!found)
        throw new FormatError('KarTrak ACI plate was not found in the image');
    return found;
}
