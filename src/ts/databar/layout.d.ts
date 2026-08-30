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
 * Structural descriptions for GS1 DataBar physical layouts.
 *
 * This module deliberately describes geometry only. It does not encode GTINs,
 * construct finder patterns, or claim an interoperable writer for any DataBar
 * variant. A later encoder can use the descriptor while keeping its payload
 * and symbol-character rules in the codec layer.
 *
 * @module databar/layout
 */

/**
 * DataBar layout identifiers represented by this descriptor.
 *
 * `omnidirectional` and `stacked-omnidirectional` are retained as aliases for
 * the longer names used by the existing DataBar-14 API. They describe the same
 * structural family as `omni` and `stacked-omni`; no encoding is implied.
 */
export type DataBarLayoutId =
  | 'omni'
  | 'truncated'
  | 'limited'
  | 'stacked'
  | 'stacked-omni'
  | 'expanded'
  | 'expanded-stacked'
  | 'omnidirectional'
  | 'stacked-omnidirectional';

/**
 * The immutable physical geometry and checksum metadata for one DataBar
 * variant.
 *
 * `modulesPerRow` is the active symbol width. `rowHeight` is the active module
 * height of each row, and `separatorModules` is the vertical gap between
 * adjacent rows. `quietZone` is the margin on each outer side and is excluded
 * from {@link dataBarTotalModules}; it is nevertheless included in the safe
 * footprint checks. A one-row layout has no separator and therefore requires
 * `separatorModules` to be zero.
 */
export interface DataBarLayout {
    readonly id: DataBarLayoutId;
    readonly rows: number;
    readonly modulesPerRow: number;
    readonly rowHeight: number;
    readonly separatorModules: number;
    readonly quietZone: number;
    readonly linkage: boolean;
    readonly checksumModulus: number;
    readonly stacked: boolean;
}

/** Input accepted by {@link createDataBarLayout}. */
export type DataBarLayoutOptions = DataBarLayout;

/** Alias for callers that use input-oriented naming. */
export type DataBarLayoutInput = DataBarLayoutOptions;

/** Alias for code that calls the value a descriptor. */
export type DataBarLayoutDescriptor = DataBarLayout;

/**
 * Return whether an unknown value is a valid DataBar physical layout.
 *
 * Validation is side-effect free and performs no matrix allocation. A value
 * supplied by a caller may remain mutable; use {@link createDataBarLayout}
 * when an immutable descriptor is required.
 */
export declare function validateDataBarLayout(value: unknown): value is DataBarLayout;

/**
 * Create a validated, shallowly immutable DataBar layout descriptor.
 *
 * Only documented fields are copied. Unknown input properties are ignored so
 * format-specific metadata cannot leak mutable state into the shared layout.
 * This factory describes future physical variants but intentionally does not
 * encode any payload.
 *
 * @throws {TypeError} If `options` is not an object.
 * @throws {RangeError} If a field is invalid or the physical footprint exceeds
 * the safe geometry budget.
 */
export declare function createDataBarLayout(options: DataBarLayoutOptions): DataBarLayout;

/**
 * Count active module cells in all rows, including row separators and excluding
 * the outer quiet zone. `rowHeight` is the number of module rows occupied by
 * each active DataBar row.
 *
 * @throws {TypeError} If `layout` is not a valid descriptor.
 */
export declare function dataBarTotalModules(layout: DataBarLayout): number;
