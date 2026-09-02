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
 * EXPERIMENTAL. Constants and small helpers for JAB Code's single-symbol,
 * 8-color, default-mode master symbol -- see `docs/JABCODE_NOTES.md` for
 * the scope this module was verified against and its honest limits.
 *
 * Values here are facts about the format (palette, finder/alignment core
 * colors, alignment-pattern position tables, the master-symbol metadata
 * walk), transcribed from the reference's own header/source constants,
 * fixed to this project's scope of `color_number=8` wherever the reference
 * generalizes over other color counts.
 *
 * @module jabcode/tables
 */
/** RGB triples, index = module color value 0-7. */
export const DEFAULT_PALETTE = [
    [0, 0, 0], // 0: black
    [0, 0, 255], // 1: blue
    [0, 255, 0], // 2: green
    [0, 255, 255], // 3: cyan
    [255, 0, 0], // 4: red
    [255, 0, 255], // 5: magenta
    [255, 255, 0], // 6: yellow
    [255, 255, 255], // 7: white
];
export const COLOR_NUMBER = 8;
export const BITS_PER_MODULE = 3; // log2(COLOR_NUMBER)
export const NC = 2; // log2(COLOR_NUMBER) - 1, master metadata's encoded color-count index
export const DEFAULT_ECC_LEVEL = 3;
export const WC = 4;
export const WR = 9; // ecclevel2wcwr[DEFAULT_ECC_LEVEL] = {4, 9}
export const DEFAULT_MASKING_REFERENCE = 7;
export const DISTANCE_TO_BORDER = 4;
export const COLOR_PALETTE_NUMBER = 4; // 4 palette copies placed per master symbol
// Finder/alignment pattern core colors, fixed to color_number=8 (Nc=2).
export const FP0_CORE_COLOR = 0;
export const FP1_CORE_COLOR = 0;
export const FP2_CORE_COLOR = 6;
export const FP3_CORE_COLOR = 3;
export const AP_CORE_COLOR = 3; // apn_core_color_index[Nc]
export const APX_CORE_COLOR = 6; // apx_core_color_index[Nc]
/** Color palette placement index in master symbol (4 quadrants x 8 colors). */
export const MASTER_PALETTE_PLACEMENT_INDEX = [
    [0, 3, 5, 6, 1, 2, 4, 7],
    [0, 6, 5, 3, 1, 2, 4, 7],
    [6, 0, 5, 3, 1, 2, 4, 7],
    [3, 0, 5, 6, 1, 2, 4, 7],
];
export const MASTER_METADATA_X = 6;
export const MASTER_METADATA_Y = 1;
/**
 * Positions of finder/alignment patterns, side-version 1-32 (1-indexed
 * module coordinate of each alignment pattern's center along one axis).
 */
export const JAB_AP_POS = [
    [4, 18],
    [4, 22],
    [4, 26],
    [4, 30],
    [4, 34],
    [4, 17, 38],
    [4, 20, 42],
    [4, 23, 46],
    [4, 26, 50],
    [4, 14, 32, 54],
    [4, 17, 39, 58],
    [4, 20, 46, 62],
    [4, 23, 44, 66],
    [4, 26, 37, 51, 70],
    [4, 14, 36, 58, 74],
    [4, 17, 39, 56, 78],
    [4, 20, 42, 63, 82],
    [4, 23, 38, 54, 70, 86],
    [4, 26, 38, 56, 77, 90],
    [4, 14, 33, 53, 72, 94],
    [4, 17, 38, 59, 79, 98],
    [4, 20, 36, 53, 70, 86, 102],
    [4, 23, 36, 55, 74, 93, 106],
    [4, 26, 36, 58, 79, 100, 110],
    [4, 14, 36, 58, 80, 92, 114],
    [4, 17, 34, 52, 70, 88, 99, 118],
    [4, 20, 37, 54, 72, 89, 106, 122],
    [4, 23, 38, 56, 74, 92, 113, 126],
    [4, 26, 36, 58, 78, 98, 120, 130],
    [4, 14, 32, 49, 67, 84, 102, 112, 134],
    [4, 17, 35, 53, 71, 89, 107, 119, 138],
    [4, 20, 38, 55, 73, 91, 108, 126, 142],
];
/** Number of finder/alignment patterns on a row/column, side-version 1-32. */
export const JAB_AP_NUM = [
    2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 8, 9, 9, 9,
];
/** Module side length for a given side-version (1-32). `VERSION2SIZE` in the reference. */
export function versionToSize(version) {
    return version * 4 + 17;
}
/**
 * Master-symbol capacity in bits, default mode (no metadata modules):
 * `getSymbolCapacity` in the reference, specialized to the master symbol
 * (index 0) with `color_number=8`.
 */
export function masterSymbolCapacity(version) {
    const sideSize = versionToSize(version);
    const nbModulesFp = 4 * 17;
    const nbModulesPalette = (COLOR_NUMBER - 2) * COLOR_PALETTE_NUMBER;
    const apNum = JAB_AP_NUM[version - 1];
    const nbModulesAp = (apNum * apNum - 4) * 7;
    const totalModules = sideSize * sideSize - nbModulesFp - nbModulesAp - nbModulesPalette;
    return totalModules * BITS_PER_MODULE;
}
/** Net LDPC message capacity (bits) for a given gross codeword capacity, at the fixed WC/WR. */
export function netCapacity(grossCapacity) {
    const blocks = Math.floor(grossCapacity / WR);
    return blocks * WR - blocks * WC;
}
/**
 * Walks (x, y) to the next master-symbol color-palette module position, in
 * the reference's own zig-zag order around the metadata/palette block.
 * Ported directly from `getNextMetadataModuleInMaster` (decoder.c) --
 * mechanical index arithmetic with no simpler equivalent description, kept
 * as a literal transcription to avoid introducing a subtly different walk.
 */
export function nextMetadataModuleInMaster(matrixHeight, matrixWidth, nextModuleCount, pos) {
    if (nextModuleCount % 4 === 0 || nextModuleCount % 4 === 2) {
        pos.y = matrixHeight - 1 - pos.y;
    }
    if (nextModuleCount % 4 === 1 || nextModuleCount % 4 === 3) {
        pos.x = matrixWidth - 1 - pos.x;
    }
    if (nextModuleCount % 4 === 0) {
        if (nextModuleCount <= 20 ||
            (nextModuleCount >= 44 && nextModuleCount <= 68) ||
            (nextModuleCount >= 96 && nextModuleCount <= 124) ||
            (nextModuleCount >= 156 && nextModuleCount <= 172)) {
            pos.y += 1;
        }
        else if ((nextModuleCount > 20 && nextModuleCount < 44) ||
            (nextModuleCount > 68 && nextModuleCount < 96) ||
            (nextModuleCount > 124 && nextModuleCount < 156)) {
            pos.x -= 1;
        }
    }
    if (nextModuleCount === 44 || nextModuleCount === 96 || nextModuleCount === 156) {
        const tmp = pos.x;
        pos.x = pos.y;
        pos.y = tmp;
    }
}
