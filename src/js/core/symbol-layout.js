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
 * These limits are intentionally conservative. They keep this foundation safe
 * for future matrix allocators while allowing the largest practical barcode
 * geometries. The implementation never allocates based on a descriptor.
 */
const MAX_LAYOUT_DIMENSION = 32768;
const MAX_LAYOUT_MODULES = 16777216;
const hasOwn = (value, property) => Object.prototype.hasOwnProperty.call(value, property);
function isBoundedPositiveInteger(value, maximum) {
    return typeof value === 'number'
        && Number.isFinite(value)
        && Number.isInteger(value)
        && value > 0
        && value <= maximum;
}
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/**
 * Check that the descriptor's full panel footprint stays within the allocation
 * budget. The quiet zone is included in the footprint because a later renderer
 * may materialize it alongside the active modules.
 */
function isWithinModuleBudget(width, height, quietZone, rows, columns) {
    const footprintWidth = width + quietZone * 2;
    const footprintHeight = height + quietZone * 2;
    if (footprintWidth > MAX_LAYOUT_DIMENSION || footprintHeight > MAX_LAYOUT_DIMENSION) {
        return false;
    }
    let total = footprintWidth;
    if (total > MAX_LAYOUT_MODULES / footprintHeight)
        return false;
    total *= footprintHeight;
    if (total > MAX_LAYOUT_MODULES / rows)
        return false;
    total *= rows;
    if (total > MAX_LAYOUT_MODULES / columns)
        return false;
    return total * columns <= MAX_LAYOUT_MODULES;
}
/**
 * Return whether an unknown value is a valid symbol layout descriptor.
 *
 * Validation is side-effect free and performs no matrix allocation. A valid
 * descriptor may be mutable when supplied by a caller; use
 * {@link createSymbolLayout} when an immutable value is required.
 */
export function validateSymbolLayout(value) {
    if (!isRecord(value))
        return false;
    if (!hasOwn(value, 'moduleShape') || (value.moduleShape !== 'square' && value.moduleShape !== 'dot')) {
        return false;
    }
    if (!hasOwn(value, 'lattice') || (value.lattice !== 'square' && value.lattice !== 'hex')) {
        return false;
    }
    if (!hasOwn(value, 'width') || !isBoundedPositiveInteger(value.width, MAX_LAYOUT_DIMENSION)) {
        return false;
    }
    if (!hasOwn(value, 'height') || !isBoundedPositiveInteger(value.height, MAX_LAYOUT_DIMENSION)) {
        return false;
    }
    if (!hasOwn(value, 'quietZone') || !isBoundedPositiveInteger(value.quietZone, MAX_LAYOUT_DIMENSION)) {
        return false;
    }
    const rows = value.rows;
    if (rows !== undefined
        && (!hasOwn(value, 'rows') || !isBoundedPositiveInteger(rows, MAX_LAYOUT_DIMENSION))) {
        return false;
    }
    const columns = value.columns;
    if (columns !== undefined
        && (!hasOwn(value, 'columns') || !isBoundedPositiveInteger(columns, MAX_LAYOUT_DIMENSION))) {
        return false;
    }
    const rowCount = rows === undefined ? 1 : rows;
    const columnCount = columns === undefined ? 1 : columns;
    return isWithinModuleBudget(value.width, value.height, value.quietZone, rowCount, columnCount);
}
/**
 * Create a validated, shallowly immutable symbol layout descriptor.
 *
 * Only the documented fields are copied. Unknown input properties are ignored,
 * so a future caller can pass a richer format-specific object without leaking
 * mutable implementation state into the shared descriptor.
 *
 * @throws {TypeError} If `options` is not an object.
 * @throws {RangeError} If any field is invalid or exceeds the safe budget.
 */
export function createSymbolLayout(options) {
    if (!isRecord(options)) {
        throw new TypeError('Symbol layout options must be an object');
    }
    const descriptor = {
        moduleShape: options.moduleShape,
        lattice: options.lattice,
        width: options.width,
        height: options.height,
        quietZone: options.quietZone,
    };
    if (options.rows !== undefined)
        descriptor.rows = options.rows;
    if (options.columns !== undefined)
        descriptor.columns = options.columns;
    if (!validateSymbolLayout(descriptor)) {
        throw new RangeError('Invalid symbol layout descriptor');
    }
    return Object.freeze(descriptor);
}
/**
 * Count logical modules in a complete layout without allocating a matrix.
 *
 * Optional rows and columns multiply the panel dimensions. Quiet-zone modules
 * are intentionally excluded: this helper reports symbol modules, while the
 * validation budget also protects the future rendered footprint.
 *
 * @throws {TypeError} If `layout` is not a valid descriptor.
 */
export function layoutModuleCount(layout) {
    if (!validateSymbolLayout(layout)) {
        throw new TypeError('Cannot count modules for an invalid symbol layout');
    }
    const rows = layout.rows === undefined ? 1 : layout.rows;
    const columns = layout.columns === undefined ? 1 : layout.columns;
    return layout.width * layout.height * rows * columns;
}
