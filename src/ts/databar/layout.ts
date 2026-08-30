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

/*
 * These limits are intentionally conservative. They keep a future renderer
 * from receiving dimensions that are technically safe JavaScript integers but
 * impractical to materialise. No matrix is allocated by this module.
 */
const MAX_LAYOUT_DIMENSION = 32_768;
const MAX_LAYOUT_MODULES = 16_777_216;

const DATA_BAR_LAYOUT_IDS: readonly DataBarLayoutId[] = Object.freeze([
  'omni',
  'truncated',
  'limited',
  'stacked',
  'stacked-omni',
  'expanded',
  'expanded-stacked',
  'omnidirectional',
  'stacked-omnidirectional',
]);

const STACKED_LAYOUT_IDS: readonly DataBarLayoutId[] = Object.freeze([
  'stacked',
  'stacked-omni',
  'expanded-stacked',
  'stacked-omnidirectional',
]);

const hasOwn = (value: object, property: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, property);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isBoundedPositiveInteger(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value > 0
    && value <= MAX_LAYOUT_DIMENSION;
}

function isBoundedNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    && value <= MAX_LAYOUT_DIMENSION;
}

function isLayoutId(value: unknown): value is DataBarLayoutId {
  return typeof value === 'string'
    && (DATA_BAR_LAYOUT_IDS as readonly string[]).includes(value);
}

function isStackedId(id: DataBarLayoutId): boolean {
  return (STACKED_LAYOUT_IDS as readonly string[]).includes(id);
}

/**
 * Calculate the active (quiet-zone-free) matrix dimensions for a descriptor.
 * The result is safe because callers first pass the descriptor through the
 * bounded validation checks.
 */
function activeHeight(layout: Pick<DataBarLayout, 'rows' | 'rowHeight' | 'separatorModules'>): number {
  return layout.rows * layout.rowHeight
    + (layout.rows - 1) * layout.separatorModules;
}

/**
 * Check that the descriptor can be materialised by a future renderer without
 * exceeding the shared geometry budget.
 */
function isWithinModuleBudget(layout: Pick<
  DataBarLayout,
  'rows' | 'modulesPerRow' | 'rowHeight' | 'separatorModules' | 'quietZone'
>): boolean {
  const height = activeHeight(layout);
  const footprintWidth = layout.modulesPerRow + layout.quietZone * 2;
  const footprintHeight = height + layout.quietZone * 2;

  if (footprintWidth > MAX_LAYOUT_DIMENSION || footprintHeight > MAX_LAYOUT_DIMENSION) {
    return false;
  }

  if (footprintWidth > MAX_LAYOUT_MODULES / footprintHeight) return false;
  return footprintWidth * footprintHeight <= MAX_LAYOUT_MODULES;
}

/**
 * Return whether an unknown value is a valid DataBar physical layout.
 *
 * Validation is side-effect free and performs no matrix allocation. A value
 * supplied by a caller may remain mutable; use {@link createDataBarLayout}
 * when an immutable descriptor is required.
 */
export function validateDataBarLayout(value: unknown): value is DataBarLayout {
  if (!isRecord(value)) return false;

  if (!hasOwn(value, 'id') || !isLayoutId(value.id)) return false;
  if (!hasOwn(value, 'rows') || !isBoundedPositiveInteger(value.rows)) return false;
  if (!hasOwn(value, 'modulesPerRow') || !isBoundedPositiveInteger(value.modulesPerRow)) return false;
  if (!hasOwn(value, 'rowHeight') || !isBoundedPositiveInteger(value.rowHeight)) return false;
  if (!hasOwn(value, 'separatorModules') || !isBoundedNonNegativeInteger(value.separatorModules)) return false;
  if (!hasOwn(value, 'quietZone') || !isBoundedPositiveInteger(value.quietZone)) return false;
  if (!hasOwn(value, 'linkage') || typeof value.linkage !== 'boolean') return false;
  if (!hasOwn(value, 'checksumModulus')
    || !isBoundedPositiveInteger(value.checksumModulus)
    || value.checksumModulus < 2) return false;
  if (!hasOwn(value, 'stacked') || typeof value.stacked !== 'boolean') return false;

  const rowsAreStacked = value.rows > 1;
  if (value.stacked !== rowsAreStacked) return false;
  if (isStackedId(value.id) !== value.stacked) return false;
  if (!value.stacked && value.separatorModules !== 0) return false;
  if (value.stacked && value.separatorModules < 1) return false;

  return isWithinModuleBudget({
    rows: value.rows,
    modulesPerRow: value.modulesPerRow,
    rowHeight: value.rowHeight,
    separatorModules: value.separatorModules,
    quietZone: value.quietZone,
  });
}

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
export function createDataBarLayout(options: DataBarLayoutOptions): DataBarLayout {
  if (!isRecord(options)) {
    throw new TypeError('GS1 DataBar layout options must be an object');
  }

  const descriptor: {
    id: DataBarLayoutId;
    rows: number;
    modulesPerRow: number;
    rowHeight: number;
    separatorModules: number;
    quietZone: number;
    linkage: boolean;
    checksumModulus: number;
    stacked: boolean;
  } = {
    id: options.id as DataBarLayoutId,
    rows: options.rows as number,
    modulesPerRow: options.modulesPerRow as number,
    rowHeight: options.rowHeight as number,
    separatorModules: options.separatorModules as number,
    quietZone: options.quietZone as number,
    linkage: options.linkage as boolean,
    checksumModulus: options.checksumModulus as number,
    stacked: options.stacked as boolean,
  };

  if (!validateDataBarLayout(descriptor)) {
    throw new RangeError('Invalid GS1 DataBar layout descriptor');
  }

  return Object.freeze(descriptor);
}

/**
 * Count active module cells in all rows, including row separators and excluding
 * the outer quiet zone. `rowHeight` is the number of module rows occupied by
 * each active DataBar row.
 *
 * @throws {TypeError} If `layout` is not a valid descriptor.
 */
export function dataBarTotalModules(layout: DataBarLayout): number {
  if (!validateDataBarLayout(layout)) {
    throw new TypeError('Cannot count modules for an invalid GS1 DataBar layout');
  }

  return layout.modulesPerRow * activeHeight(layout);
}
