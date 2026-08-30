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
/*
 * These limits are intentionally conservative. They keep a future renderer
 * from receiving dimensions that are technically safe JavaScript integers but
 * impractical to materialise. No matrix is allocated by this module.
 */
const MAX_LAYOUT_DIMENSION = 32768;
const MAX_LAYOUT_MODULES = 16777216;
const DATA_BAR_LAYOUT_IDS = Object.freeze([
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
const STACKED_LAYOUT_IDS = Object.freeze([
    'stacked',
    'stacked-omni',
    'expanded-stacked',
    'stacked-omnidirectional',
]);
const hasOwn = (value, property) => Object.prototype.hasOwnProperty.call(value, property);
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isBoundedPositiveInteger(value) {
    return typeof value === 'number'
        && Number.isSafeInteger(value)
        && value > 0
        && value <= MAX_LAYOUT_DIMENSION;
}
function isBoundedNonNegativeInteger(value) {
    return typeof value === 'number'
        && Number.isSafeInteger(value)
        && value >= 0
        && value <= MAX_LAYOUT_DIMENSION;
}
function isLayoutId(value) {
    return typeof value === 'string'
        && DATA_BAR_LAYOUT_IDS.includes(value);
}
function isStackedId(id) {
    return STACKED_LAYOUT_IDS.includes(id);
}
/**
 * Calculate the active (quiet-zone-free) matrix dimensions for a descriptor.
 * The result is safe because callers first pass the descriptor through the
 * bounded validation checks.
 */
function activeHeight(layout) {
    return layout.rows * layout.rowHeight
        + (layout.rows - 1) * layout.separatorModules;
}
/**
 * Check that the descriptor can be materialised by a future renderer without
 * exceeding the shared geometry budget.
 */
function isWithinModuleBudget(layout) {
    const height = activeHeight(layout);
    const footprintWidth = layout.modulesPerRow + layout.quietZone * 2;
    const footprintHeight = height + layout.quietZone * 2;
    if (footprintWidth > MAX_LAYOUT_DIMENSION || footprintHeight > MAX_LAYOUT_DIMENSION) {
        return false;
    }
    if (footprintWidth > MAX_LAYOUT_MODULES / footprintHeight)
        return false;
    return footprintWidth * footprintHeight <= MAX_LAYOUT_MODULES;
}
/**
 * Return whether an unknown value is a valid DataBar physical layout.
 *
 * Validation is side-effect free and performs no matrix allocation. A value
 * supplied by a caller may remain mutable; use {@link createDataBarLayout}
 * when an immutable descriptor is required.
 */
export function validateDataBarLayout(value) {
    if (!isRecord(value))
        return false;
    if (!hasOwn(value, 'id') || !isLayoutId(value.id))
        return false;
    if (!hasOwn(value, 'rows') || !isBoundedPositiveInteger(value.rows))
        return false;
    if (!hasOwn(value, 'modulesPerRow') || !isBoundedPositiveInteger(value.modulesPerRow))
        return false;
    if (!hasOwn(value, 'rowHeight') || !isBoundedPositiveInteger(value.rowHeight))
        return false;
    if (!hasOwn(value, 'separatorModules') || !isBoundedNonNegativeInteger(value.separatorModules))
        return false;
    if (!hasOwn(value, 'quietZone') || !isBoundedPositiveInteger(value.quietZone))
        return false;
    if (!hasOwn(value, 'linkage') || typeof value.linkage !== 'boolean')
        return false;
    if (!hasOwn(value, 'checksumModulus')
        || !isBoundedPositiveInteger(value.checksumModulus)
        || value.checksumModulus < 2)
        return false;
    if (!hasOwn(value, 'stacked') || typeof value.stacked !== 'boolean')
        return false;
    const rowsAreStacked = value.rows > 1;
    if (value.stacked !== rowsAreStacked)
        return false;
    if (isStackedId(value.id) !== value.stacked)
        return false;
    if (!value.stacked && value.separatorModules !== 0)
        return false;
    if (value.stacked && value.separatorModules < 1)
        return false;
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
export function createDataBarLayout(options) {
    if (!isRecord(options)) {
        throw new TypeError('GS1 DataBar layout options must be an object');
    }
    const descriptor = {
        id: options.id,
        rows: options.rows,
        modulesPerRow: options.modulesPerRow,
        rowHeight: options.rowHeight,
        separatorModules: options.separatorModules,
        quietZone: options.quietZone,
        linkage: options.linkage,
        checksumModulus: options.checksumModulus,
        stacked: options.stacked,
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
export function dataBarTotalModules(layout) {
    if (!validateDataBarLayout(layout)) {
        throw new TypeError('Cannot count modules for an invalid GS1 DataBar layout');
    }
    return layout.modulesPerRow * activeHeight(layout);
}
